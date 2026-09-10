use std::{str::FromStr, time::Duration};

use anyhow::{Context, bail};
use sqlx::{ConnectOptions, MySqlPool, PgPool, mysql::MySqlConnectOptions, postgres::PgConnectOptions};
use tracing::log::LevelFilter;

use crate::{
    api::*,
    model::{MySqlPhysicalColumnRow, PhysicalTableRow, PostgresPhysicalColumnRow},
};

pub enum RuntimePool {
    MySql(MySqlPool),
    Postgres(PgPool),
}

impl RuntimePool {
    pub fn connect_lazy(url: &str, username: &str, password: &str) -> anyhow::Result<Self> {
        if url.starts_with("mysql://") {
            let options = MySqlConnectOptions::from_str(url).context("Invalid MySQL datasource URL")?;
            let options = Self::connect_options_mysql(options, username, password);
            return Ok(Self::MySql(MySqlPool::connect_lazy_with(options)));
        }
        if url.starts_with("postgres://") || url.starts_with("postgresql://") {
            let options = PgConnectOptions::from_str(url).context("Invalid PostgreSQL datasource URL")?;
            let options = Self::connect_options_pg(options, username, password);
            return Ok(Self::Postgres(PgPool::connect_lazy_with(options)));
        }
        bail!("Unsupported datasource URL scheme");
    }

    pub async fn list_tables(&self, limit: usize) -> anyhow::Result<Vec<PhysicalTableListResult>> {
        match self {
            Self::MySql(pool) => sqlx::query_as::<_, PhysicalTableRow>(
                "
                    select table_name as name, coalesce(table_comment, '') as comment \
                    from information_schema.tables \
                    where table_schema = database() and table_type = 'BASE TABLE' \
                    order by table_name limit ?
                    ",
            )
            .bind(i64::try_from(limit).unwrap_or(i64::MAX))
            .fetch_all(pool)
            .await
            .context("Failed to query MySQL physical tables"),
            Self::Postgres(pool) => sqlx::query_as::<_, PhysicalTableRow>(
                "
                    select c.relname as name, coalesce(obj_description(c.oid, 'pg_class'), '') as comment \
                    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace \
                    where n.nspname = current_schema() and c.relkind in ('r', 'p') \
                    order by c.relname limit $1
                    ",
            )
            .bind(i64::try_from(limit).unwrap_or(i64::MAX))
            .fetch_all(pool)
            .await
            .context("Failed to query PostgreSQL physical tables"),
        }
        .map(|rows| rows.into_iter().map(Into::into).collect())
    }

    pub async fn list_columns(&self, table_name: &str) -> anyhow::Result<Vec<PhysicalColumnListResult>> {
        match self {
            Self::MySql(pool) => sqlx::query_as::<_, MySqlPhysicalColumnRow>(
                "
                    select column_name as name, data_type as database_type,
                        cast(is_nullable = 'YES' as signed) as nullable,
                        cast(column_default is not null as signed) as has_default,
                        cast(extra like '%auto_increment%' or extra like '%generated%' as signed) as generated_flag,
                        cast(column_key = 'PRI' as signed) as primary_key,
                        coalesce(column_comment, '') as comment
                    from information_schema.columns 
                    where table_schema = database() and table_name = ?
                    order by ordinal_position
                    ",
            )
            .bind(table_name)
            .fetch_all(pool)
            .await
            .context("Failed to query MySQL physical columns")
            .map(|rows| rows.into_iter().map(Into::into).collect()),
            Self::Postgres(pool) => sqlx::query_as::<_, PostgresPhysicalColumnRow>(
                "
                    select a.attname as name, pg_catalog.format_type(a.atttypid, a.atttypmod) as database_type,
                     not a.attnotnull as nullable, a.atthasdef as has_default,
                     (a.attidentity <> '' or a.attgenerated <> '') as generated_flag,
                     coalesce(a.attnum = any(i.indkey), false) as primary_key,
                     coalesce(pg_catalog.col_description(c.oid, a.attnum), '') as comment
                     from pg_catalog.pg_class c
                     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                     join pg_catalog.pg_attribute a on a.attrelid = c.oid
                     left join pg_catalog.pg_index i on i.indrelid = c.oid and i.indisprimary
                     where n.nspname = current_schema() and c.relname = $1
                       and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
                     order by a.attnum
                    ",
            )
            .bind(table_name)
            .fetch_all(pool)
            .await
            .context("Failed to query PostgreSQL physical columns")
            .map(|rows| rows.into_iter().map(Into::into).collect()),
        }
    }

    pub fn connect_options_mysql(options: MySqlConnectOptions, username: &str, password: &str) -> MySqlConnectOptions {
        let options = options
            .username(username)
            .pipes_as_concat(false)
            .no_engine_substitution(false)
            .timezone(None)
            .set_names(false)
            .log_statements(LevelFilter::Info)
            .log_slow_statements(LevelFilter::Warn, Duration::from_secs(1));
        let options = if password.is_empty() { options } else { options.password(password) };
        options
    }

    pub fn connect_options_pg(options: PgConnectOptions, username: &str, password: &str) -> PgConnectOptions {
        let options = options
            .username(username)
            .log_statements(LevelFilter::Info)
            .log_slow_statements(LevelFilter::Warn, Duration::from_secs(1));
        let options = if password.is_empty() { options } else { options.password(password) };
        options
    }
}
