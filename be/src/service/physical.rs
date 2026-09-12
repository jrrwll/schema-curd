use std::time::Instant;

use corers::axum::ApiError;
use either::Either;
use tracing::{error, info};

use crate::model::embed::RoleEnum;
use crate::repo::DatasourceConnectOptions;
use crate::service::{AccessService, MetaCacheService};
use crate::{
    api::*,
    common::{constants::PHYSICAL_TABLE_LIMIT, error::ErrorCode, state::ApiState},
};

const PHYSICAL_TABLE_QUERY_LIMIT: usize = PHYSICAL_TABLE_LIMIT + 1;

pub struct PhysicalService;

impl PhysicalService {
    pub async fn test_connection(_: &ApiState, param: TestDatasourceParam) -> Result<TestDatasourceResult, ApiError> {
        DatasourceConnectOptions::new(&param.url, &param.username, &param.password.unwrap_or_default())
            .map_err(ApiError::Validation)?
            .test_connection()
            .await
            .map_err(ApiError::Validation)
    }

    pub async fn list_table(
        state: &ApiState, datasource_name: String, op_user_id: i64,
    ) -> Result<Vec<PhysicalTableListResult>, ApiError> {
        AccessService::require_datasource_role(
            &state,
            op_user_id,
            Either::Right(datasource_name.clone()),
            RoleEnum::Write,
        )
        .await?;

        let tables = MetaCacheService::get_tables(state.kv_store.clone(), &datasource_name)
            .await
            .map_err(ApiError::unknown)?
            .unwrap_or_default();
        Ok(tables)
    }

    pub async fn refresh_table(
        state: &ApiState, datasource_name: String, op_user_id: i64,
    ) -> Result<Vec<PhysicalTableListResult>, ApiError> {
        AccessService::require_datasource_role(
            &state,
            op_user_id,
            Either::Right(datasource_name.clone()),
            RoleEnum::Write,
        )
        .await?;

        let tables = Self::query_tables(state, datasource_name.clone()).await?;
        MetaCacheService::save_tables(state.kv_store.clone(), &datasource_name, &tables)
            .await
            .map_err(ApiError::unknown)?;
        Ok(tables)
    }

    async fn query_tables(state: &ApiState, datasource_name: String) -> Result<Vec<PhysicalTableListResult>, ApiError> {
        let source = state.registry.get(datasource_name.clone()).await.map_err(|e| {
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
        info!(datasource = datasource_name.clone(), "querying physical tables");
        let tables = source.pool.list_tables(PHYSICAL_TABLE_QUERY_LIMIT).await.map_err(|e| {
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
        state: &ApiState, param: PhysicalColumnListParam, op_user_id: i64,
    ) -> Result<Vec<PhysicalColumnListResult>, ApiError> {
        let (datasource_name, table_name) = permit_column_physical(&state, param, op_user_id).await?;

        let columns = MetaCacheService::get_columns(state.kv_store.clone(), &datasource_name, &table_name)
            .await
            .map_err(ApiError::unknown)?
            .unwrap_or_default();
        Ok(columns)
    }

    pub async fn refresh_column(
        state: &ApiState, param: PhysicalColumnListParam, op_user_id: i64,
    ) -> Result<Vec<PhysicalColumnListResult>, ApiError> {
        let (datasource_name, table_name) = permit_column_physical(&state, param, op_user_id).await?;

        let columns = Self::query_columns(state, datasource_name.clone(), &table_name).await?;
        MetaCacheService::save_columns(state.kv_store.clone(), &datasource_name, &table_name, &columns)
            .await
            .map_err(ApiError::unknown)?;
        Ok(columns)
    }

    async fn query_columns(
        state: &ApiState, datasource_name: String, table_name: &str,
    ) -> Result<Vec<PhysicalColumnListResult>, ApiError> {
        let source = state.registry.get(datasource_name.clone()).await.map_err(|e| {
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
        info!(datasource = datasource_name.clone(), table = table_name.to_string(), "querying physical columns");
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

async fn permit_column_physical(
    state: &ApiState, param: PhysicalColumnListParam, op_user_id: i64,
) -> Result<(String, String), ApiError> {
    let (datasource_name, table_name) = if let Some(table_id) = param.table_id {
        let (table, _, _) =
            AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Write).await?;

        (table.datasource_name, table.table_name)
    } else if let Some(table_name) = param.table {
        let Some(datasource_name) = param.datasource else {
            return Err(ApiError::Validation("Param datasource is required since table is passed".to_owned()));
        };
        // only permit datasource
        AccessService::require_datasource_role(
            &state,
            op_user_id,
            Either::Right(datasource_name.clone()),
            RoleEnum::Write,
        )
        .await?;

        (datasource_name, table_name)
    } else {
        return Err(ApiError::Validation("Param table_id or table is required".to_owned()));
    };
    Ok((datasource_name, table_name))
}
