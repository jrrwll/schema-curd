use std::str::FromStr;
use std::time::{Duration, Instant};
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::Row;
use tracing::{error, info};

use crate::api::TestDatasourceResult;
use crate::repo::RuntimePool;

pub enum DatasourceConnectOptions {
    MySql(MySqlConnectOptions),
    Postgres(PgConnectOptions),
}

impl DatasourceConnectOptions {
    pub fn new(url: &str, username: &str, password: &str) -> Result<Self, String> {
        if url.starts_with("mysql://") {
            let options = MySqlConnectOptions::from_str(url)
                .map_err(|_| "URL must be a valid MySQL URL".to_owned())?;
            if options.get_database().is_none_or(str::is_empty) {
                return Err("URL must include a database name".to_owned());
            }
            let options = RuntimePool::connect_options_mysql(options, username, password);
            return Ok(Self::MySql(options));
        }
        if url.starts_with("postgres://") || url.starts_with("postgresql://") {
            let options = PgConnectOptions::from_str(url)
                .map_err(|_| "URL must be a valid PostgreSQL URL".to_owned())?;
            if options.get_database().is_none_or(str::is_empty) {
                return Err("URL must include a database name".to_owned());
            }
            let options = RuntimePool::connect_options_pg(options, username, password);
            return Ok(DatasourceConnectOptions::Postgres(options));
        }
        Err("URL must use the mysql, postgres, or postgresql protocol".to_owned())
    }

    pub async fn test_connection(self) -> Result<TestDatasourceResult, String> {
        match self {
            DatasourceConnectOptions::MySql(options) => Self::test_connection_mysql(options).await,
            DatasourceConnectOptions::Postgres(options) => Self::test_connection_pg(options).await,
        }
    }

    async fn test_connection_mysql(options: MySqlConnectOptions) -> Result<TestDatasourceResult, String> {
        let started_at = Instant::now();
        info!(database_type = "mysql", "testing datasource connection");
        let pool = MySqlPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(Duration::from_secs(5))
            .connect_with(options)
            .await
            .map_err(|source| connection_error("mysql", started_at, source))?;
        let (version, database) = sqlx::query("select version() as version, database() as `database`")
            .fetch_one(&pool)
            .await
            .map(|row| (row.get::<String, _>("version"), row.get::<String, _>("database")))
            .map_err(|source| connection_error("mysql", started_at, source))?;
        pool.close().await;

        let cost_ms = started_at.elapsed().as_millis() as u64;
        info!(database_type = "mysql", version, database, cost_ms, "datasource connection test succeeded");
        Ok(TestDatasourceResult { database_type: "mysql".to_owned(), version, database, cost_ms })
    }

    async fn test_connection_pg(options: PgConnectOptions) -> Result<TestDatasourceResult, String> {
        let started_at = Instant::now();
        info!(database_type = "postgresql", "testing datasource connection");
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(Duration::from_secs(5))
            .connect_with(options)
            .await
            .map_err(|source| connection_error("postgresql", started_at, source))?;
        let (version, database): (String, String) = sqlx::query_as(
            "
            select current_setting('server_version') as version, current_database() as database
            ",
        )
            .fetch_one(&pool)
            .await
            .map_err(|source| connection_error("postgresql", started_at, source))?;
        pool.close().await;

        let cost_ms = started_at.elapsed().as_millis() as u64;
        info!(database_type = "postgresql", version, database, cost_ms, "datasource connection test succeeded");
        Ok(TestDatasourceResult { database_type: "postgresql".to_owned(), version, database, cost_ms })
    }
}

fn connection_error(database_type: &str, started_at: Instant, source: sqlx::Error) -> String {
    error!(
        database_type,
        cost_ms = started_at.elapsed().as_millis() as u64,
        error = ?source,
        "datasource connection test failed"
    );
    format!("Failed to connect to datasource: {source}")
}
