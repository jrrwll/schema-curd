mod query;
mod value;

use std::sync::Arc;

use corers::{api::PageResult, axum::ApiError};
use either::Either;
use serde_json::Value;

use crate::{
    api::*,
    common::{error::ErrorCode, state::ApiState},
    repo::{EntityRepo, RuntimeDatasource},
};

use crate::model::embed::{RoleEnum, TableDetailConfig};
use crate::service::AccessService;
use query::build_list_plan;
use value::validate_columns;

pub struct EntityService;

impl EntityService {
    pub async fn list(
        state: &ApiState, param: EntityListParam, op_user_id: i64,
    ) -> Result<PageResult<Value>, ApiError> {
        let table_id = param.table_id;
        let (table, _, _) =
            AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Read).await?;

        let source = Self::get_source(state, table.datasource_name.clone()).await?;
        let config: TableDetailConfig = table.try_into()?;
        let datasource_config = &source.config.config;

        let plan = build_list_plan(&config, datasource_config, &param)?;
        let (total, items) = EntityRepo::new(&source.pool, &config)
            .list(plan)
            .await
            .map_err(Into::<ApiError>::into)?;
        Ok((total, items).into())
    }

    pub async fn create(state: &ApiState, param: EntityCreateParam, op_user_id: i64) -> Result<(), ApiError> {
        let table_id = param.table_id;
        let (table, _, _) =
            AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Write).await?;

        let source = Self::get_source(state, table.datasource_name.clone()).await?;
        let config: TableDetailConfig = table.try_into()?;
        let datasource_config = &source.config.config;
        if config.table_config.readonly {
            return Err(ApiError::Validation("Table is read-only".to_owned()));
        }

        let mut values = validate_columns(&config, datasource_config, &param.columns, true)?;
        for (name, value) in &config.table_config.insert_fixed_values {
            values.insert(name.clone(), value.try_into()?);
        }
        if values.is_empty() {
            return Err(ApiError::Validation("No columns to create".to_owned()));
        }
        EntityRepo::new(&source.pool, &config)
            .create(values.into_iter().collect())
            .await
            .map_err(Into::<ApiError>::into)?;
        Ok(())
    }

    pub async fn update(
        state: &ApiState, param: EntityUpdateParam, op_user_id: i64,
    ) -> Result<EntityUpdateResult, ApiError> {
        let table_id = param.table_id;
        let (table, _, _) =
            AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Write).await?;

        let source = Self::get_source(state, table.datasource_name.clone()).await?;
        let config: TableDetailConfig = table.try_into()?;
        let datasource_config = &source.config.config;
        if config.table_config.readonly {
            return Err(ApiError::Validation("Table is read-only".to_owned()));
        }

        let mut values = validate_columns(&config, datasource_config, &param.columns, false)?;
        let mut where_values = Vec::new();
        for primary_key in &config.table_config.primary_keys {
            let value = values.remove(primary_key).ok_or_else(|| {
                ApiError::Validation(format!(
                    "Primary key {} is required for update",
                    config
                        .columns
                        .get(primary_key)
                        .map(|v| v.display_name.clone())
                        .unwrap_or(primary_key.clone())
                ))
            })?;
            where_values.push((primary_key.clone(), value));
        }

        // keep all columns but primary_keys
        values.retain(|name, _| config.columns.contains_key(name) && !config.table_config.primary_keys.contains(name));
        if values.is_empty() {
            return Err(ApiError::Validation("No columns to update".to_owned()));
        }
        let affected = EntityRepo::new(&source.pool, &config)
            .update(values.into_iter().collect(), where_values)
            .await
            .map_err(Into::<ApiError>::into)?;
        Ok(EntityUpdateResult { affected })
    }

    async fn get_source(state: &ApiState, datasource_name: String) -> Result<Arc<RuntimeDatasource>, ApiError> {
        let source: Option<Arc<RuntimeDatasource>> = state
            .registry
            .get(datasource_name.clone())
            .await
            .map_err(Into::<ApiError>::into)?;
        let Some(source) = source else {
            return Err(ErrorCode::datasource_name_not_found(datasource_name).into_error());
        };
        Ok(source)
    }
}
