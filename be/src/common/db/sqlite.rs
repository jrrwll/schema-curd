use std::{str::FromStr, time::Duration};

use anyhow::Context;
use sqlx::{
    ConnectOptions,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use tracing::log::LevelFilter;

pub type DbPool = sqlx::SqlitePool;

pub async fn connect_database(url: &str) -> anyhow::Result<DbPool> {
    let options = SqliteConnectOptions::from_str(url)
        .context("Invalid SQLite DATABASE_URL")?
        .log_statements(LevelFilter::Info)
        .log_slow_statements(LevelFilter::Warn, Duration::from_secs(1));
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .with_context(|| format!("Failed to open SQLite database {url}"))?;
    return Ok(pool);
}

pub fn last_insert_id(result: sqlx::sqlite::SqliteQueryResult) -> anyhow::Result<i64> {
    Ok(result.last_insert_rowid())
}
