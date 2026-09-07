use std::{str::FromStr, time::Duration};

use anyhow::{Context, bail};
use sqlx::{
    ConnectOptions,
    mysql::{MySqlConnectOptions, MySqlPoolOptions},
};
use tracing::log::LevelFilter;

pub type DbPool = sqlx::MySqlPool;

pub async fn connect_database(url: &str) -> anyhow::Result<DbPool> {
    let options = MySqlConnectOptions::from_str(url)
        .context("Invalid MySQL DATABASE_URL")?
        .log_statements(LevelFilter::Info)
        .log_slow_statements(LevelFilter::Warn, Duration::from_secs(1));
    if options.get_database().is_none_or(str::is_empty) {
        bail!("MySQL DATABASE_URL must include a database name");
    }
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .context("Failed to connect to MySQL system database")?;
    return Ok(pool);
}

pub fn last_insert_id(result: sqlx::mysql::MySqlQueryResult) -> anyhow::Result<i64> {
    i64::try_from(result.last_insert_id()).context("Inserted ID exceeds i64 range")
}
