pub use connect::*;
pub use registry::*;

mod connect;
mod registry;

use anyhow::Context;

use crate::api::{PhysicalColumnListResult, PhysicalTableListResult};
use crate::infra::pool::RuntimePool;
use crate::model::{MySqlPhysicalColumnRow, PhysicalTableRow, PostgresPhysicalColumnRow};

pub struct PhysicalRepo;

impl PhysicalRepo {

    pub async fn list_tables(pool: &RuntimePool) -> anyhow::Result<Vec<PhysicalTableListResult>> {
        match pool {
            RuntimePool::MySql(pool) => sqlx::query_as::<_, PhysicalTableRow>(
                "
                    select table_name as name, coalesce(table_comment, '') as comment \
                    from information_schema.tables \
                    where table_schema = database() and table_type = 'BASE TABLE' \
                    order by table_name limit 501
                    ",
            )
                .fetch_all(pool)
                .await
                .context("Failed to query MySQL physical tables"),
            RuntimePool::Postgres(pool) => sqlx::query_as::<_, PhysicalTableRow>(
                "
                    select c.relname as name, coalesce(obj_description(c.oid, 'pg_class'), '') as comment \
                    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace \
                    where n.nspname = current_schema() and c.relkind in ('r', 'p') \
                    order by c.relname limit 501
                    ",
            )
                .fetch_all(pool)
                .await
                .context("Failed to query PostgreSQL physical tables"),
        }
            .map(|rows| rows.into_iter().map(Into::into).collect())
    }

    pub async fn list_columns(pool: &RuntimePool, table_name: &str) -> anyhow::Result<Vec<PhysicalColumnListResult>> {
        match pool {
            RuntimePool::MySql(pool) => sqlx::query_as::<_, MySqlPhysicalColumnRow>(
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
            RuntimePool::Postgres(pool) => sqlx::query_as::<_, PostgresPhysicalColumnRow>(
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
}
