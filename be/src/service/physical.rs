use std::{
    str::FromStr,
    time::{Duration, Instant},
};

use corers::axum::ApiError;
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlPoolOptions},
    postgres::{PgConnectOptions, PgPoolOptions},
};
use tracing::{error, info};

use crate::{
    api::*,
    common::{constants::PHYSICAL_TABLE_LIMIT, error::ErrorCode, state::ApiState},
};
use crate::{repo::RuntimePool, service::MetaCacheService};

const PHYSICAL_TABLE_QUERY_LIMIT: usize = PHYSICAL_TABLE_LIMIT + 1;

pub struct PhysicalService;

impl PhysicalService {
    pub async fn test_connection(
        _: &ApiState,
        param: TestDatasourceParam,
    ) -> Result<TestDatasourceResult, ApiError> {
        DatasourceConnectOptions::new(
            &param.url,
            &param.username,
            &param.password.unwrap_or_default(),
        )?
        .test_connection()
        .await
    }

    pub async fn list_table(
        state: &ApiState,
        datasource_name: String,
    ) -> Result<Vec<PhysicalTableListResult>, ApiError> {
        let tables = MetaCacheService::get_tables(state.kv_store.clone(), &datasource_name)
            .await
            .map_err(ApiError::unknown)?
            .unwrap_or_default();
        Ok(tables)
    }

    pub async fn refresh_table(
        state: &ApiState,
        datasource_name: String,
    ) -> Result<Vec<PhysicalTableListResult>, ApiError> {
        let tables = Self::query_tables(state, datasource_name.clone()).await?;
        MetaCacheService::save_tables(state.kv_store.clone(), &datasource_name, &tables)
            .await
            .map_err(ApiError::unknown)?;
        Ok(tables)
    }

    async fn query_tables(
        state: &ApiState,
        datasource_name: String,
    ) -> Result<Vec<PhysicalTableListResult>, ApiError> {
        let source = state
            .registry
            .get(datasource_name.clone())
            .await
            .map_err(|e| {
                error!(
                    datasource = datasource_name.clone(),
                    error = ?e,
                    "Datasource connect failed: {e}"
                );
                ErrorCode::datasource_connect_failed(datasource_name.clone()).into_error()
            })?;
        let Some(source) = source else {
            return Err(ErrorCode::datasource_name_not_found(datasource_name).into_error());
        };

        let started_at = Instant::now();
        info!(
            datasource = datasource_name.clone(),
            "querying physical tables"
        );
        let tables = source
            .pool
            .list_tables(PHYSICAL_TABLE_QUERY_LIMIT)
            .await
            .map_err(|e| {
                error!(
                    datasource = datasource_name.clone(),
                    error = ?e,
                    "Datasource connect failed: {e}"
                );
                ErrorCode::datasource_connect_failed(datasource_name.clone()).into_error()
            })?;
        info!(
            datasource = datasource_name.clone(),
            table_count = tables.len(),
            cost_ms = started_at.elapsed().as_millis() as u64,
            "physical table query succeeded"
        );
        Ok(tables)
    }

    pub async fn list_column(
        state: &ApiState,
        datasource_name: String,
        table_name: String,
    ) -> Result<Vec<PhysicalColumnListResult>, ApiError> {
        let columns =
            MetaCacheService::get_columns(state.kv_store.clone(), &datasource_name, &table_name)
                .await
                .map_err(ApiError::unknown)?
                .unwrap_or_default();
        Ok(columns)
    }

    pub async fn refresh_column(
        state: &ApiState,
        datasource_name: String,
        table_name: String,
    ) -> Result<Vec<PhysicalColumnListResult>, ApiError> {
        let columns = Self::query_columns(state, datasource_name.clone(), &table_name).await?;
        MetaCacheService::save_columns(
            state.kv_store.clone(),
            &datasource_name,
            &table_name,
            &columns,
        )
        .await
        .map_err(ApiError::unknown)?;
        Ok(columns)
    }

    async fn query_columns(
        state: &ApiState,
        datasource_name: String,
        table_name: &str,
    ) -> Result<Vec<PhysicalColumnListResult>, ApiError> {
        let source = state
            .registry
            .get(datasource_name.clone())
            .await
            .map_err(|e| {
                error!(
                    datasource = datasource_name.clone(),
                    table = table_name.to_string(),
                    error = ?e,
                    "Datasource connect failed: {e}"
                );
                ErrorCode::datasource_connect_failed(datasource_name.clone()).into_error()
            })?;
        let Some(source) = source else {
            return Err(ErrorCode::datasource_name_not_found(datasource_name).into_error());
        };

        let started_at = Instant::now();
        info!(
            datasource = datasource_name.clone(),
            table = table_name.to_string(),
            "querying physical columns"
        );
        let columns = source.pool.list_columns(table_name).await.map_err(|e| {
            error!(
                datasource_name = datasource_name.clone(),
                error = ?e,
                "Datasource connect failed: {e}"
            );
            ErrorCode::datasource_connect_failed(datasource_name.clone()).into_error()
        })?;
        info!(
            datasource = datasource_name.clone(),
            table = table_name.to_string(),
            column_count = columns.len(),
            cost_ms = started_at.elapsed().as_millis() as u64,
            "physical column query succeeded"
        );
        Ok(columns)
    }
}

pub(super) enum DatasourceConnectOptions {
    MySql(MySqlConnectOptions),
    Postgres(PgConnectOptions),
}

impl DatasourceConnectOptions {
    pub fn new(url: &str, username: &str, password: &str) -> Result<Self, ApiError> {
        if url.starts_with("mysql://") {
            let options = MySqlConnectOptions::from_str(url)
                .map_err(|_| ApiError::Validation("URL must be a valid MySQL URL".to_owned()))?;
            if options.get_database().is_none_or(str::is_empty) {
                return Err(ApiError::Validation(
                    "URL must include a database name".to_owned(),
                ));
            }
            let options = RuntimePool::connect_options_mysql(options, username, password);
            return Ok(Self::MySql(options));
        }
        if url.starts_with("postgres://") || url.starts_with("postgresql://") {
            let options = PgConnectOptions::from_str(url).map_err(|_| {
                ApiError::Validation("URL must be a valid PostgreSQL URL".to_owned())
            })?;
            if options.get_database().is_none_or(str::is_empty) {
                return Err(ApiError::Validation(
                    "URL must include a database name".to_owned(),
                ));
            }
            let options = RuntimePool::connect_options_pg(options, username, password);
            return Ok(DatasourceConnectOptions::Postgres(options));
        }
        Err(ApiError::Validation(
            "URL must use the mysql, postgres, or postgresql protocol".to_owned(),
        ))
    }

    pub async fn test_connection(self) -> Result<TestDatasourceResult, ApiError> {
        match self {
            DatasourceConnectOptions::MySql(options) => Self::test_connection_mysql(options).await,
            DatasourceConnectOptions::Postgres(options) => Self::test_connection_pg(options).await,
        }
    }

    async fn test_connection_mysql(
        options: MySqlConnectOptions,
    ) -> Result<TestDatasourceResult, ApiError> {
        let started_at = Instant::now();
        info!(database_type = "mysql", "testing datasource connection");
        let pool = MySqlPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(Duration::from_secs(5))
            .connect_with(options)
            .await
            .map_err(|source| connection_error("mysql", started_at, source))?;
        let version = sqlx::query_scalar::<_, String>("select version()")
            .fetch_one(&pool)
            .await
            .map_err(|source| connection_error("mysql", started_at, source))?;
        pool.close().await;

        let cost_ms = started_at.elapsed().as_millis() as u64;
        info!(
            database_type = "mysql",
            version, cost_ms, "datasource connection test succeeded"
        );
        Ok(TestDatasourceResult {
            database_type: "mysql".to_owned(),
            version,
            cost_ms,
        })
    }

    async fn test_connection_pg(
        options: PgConnectOptions,
    ) -> Result<TestDatasourceResult, ApiError> {
        let started_at = Instant::now();
        info!(
            database_type = "postgresql",
            "testing datasource connection"
        );
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(Duration::from_secs(5))
            .connect_with(options)
            .await
            .map_err(|source| connection_error("postgresql", started_at, source))?;
        let version = sqlx::query_scalar::<_, String>("show server_version")
            .fetch_one(&pool)
            .await
            .map_err(|source| connection_error("postgresql", started_at, source))?;
        pool.close().await;

        let cost_ms = started_at.elapsed().as_millis() as u64;
        info!(
            database_type = "postgresql",
            version, cost_ms, "datasource connection test succeeded"
        );
        Ok(TestDatasourceResult {
            database_type: "postgresql".to_owned(),
            version,
            cost_ms,
        })
    }
}

fn connection_error(database_type: &str, started_at: Instant, source: sqlx::Error) -> ApiError {
    error!(
        database_type,
        cost_ms = started_at.elapsed().as_millis() as u64,
        error = ?source,
        "datasource connection test failed"
    );
    ApiError::Validation(format!("Failed to connect to datasource: {source}"))
}
