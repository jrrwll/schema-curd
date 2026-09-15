use std::{str::FromStr, time::Duration};

use anyhow::{bail, Context};
use sqlx::{mysql::MySqlConnectOptions, postgres::PgConnectOptions, ConnectOptions, MySqlPool, PgPool};
use tracing::log::LevelFilter;

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
