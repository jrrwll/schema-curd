mod query;
mod value;

use std::sync::Arc;

use corers::{api::PageResult, axum::ApiError};
use serde_json::Value;

use crate::{
    api::*, common::{error::ErrorCode, state::ApiState}, repo::{EntityRepo, RuntimeDatasource},
};

use crate::model::TableEntity;
use query::build_list_plan;
use value::validate_columns;

pub struct EntityService;

impl EntityService {
    pub async fn list(
        state: &ApiState,
        table: TableEntity,
        param: EntityListParam,
    ) -> Result<PageResult<Value>, ApiError> {
        let datasource_name = table.datasource_name.clone();
        let table_name = table.table_name.clone();

        let source: Option<Arc<RuntimeDatasource>> = state
            .registry
            .get(datasource_name.clone())
            .await
            .map_err(Into::<ApiError>::into)?;
        let Some(source) = source else {
            return Err(ErrorCode::datasource_name_not_found(datasource_name).into_error());
        };

        let plan = build_list_plan(&resolved, &param)?;
        let (total, items) = EntityRepo::new(&source.pool, resolved.table)
            .list(plan)
            .await
            .map_err(Into::<ApiError>::into)?;
        Ok((total, items).into())
    }

    pub async fn create(
        state: &ApiState,
        datasource_name: String,
        table_name: String,
        param: EntityCreateParam,
    ) -> Result<(), ApiError> {
        let source: Option<Arc<RuntimeDatasource>> = state
            .registry
            .get(datasource_name.clone())
            .await
            .map_err(Into::<ApiError>::into)?;
        let Some(source) = source else {
            return Err(ErrorCode::datasource_name_not_found(datasource_name).into_error());
        };
        let Some(resolved) = source.resolve_table(&table_name) else {
            return Err(ErrorCode::table_name_not_found(datasource_name, table_name).into_error());
        };
        if resolved.table.table_config.readonly {
            return Err(ApiError::Validation("Table is read-only".to_owned()));
        }

        let mut values = validate_columns(&resolved, &param.columns, true)?;
        for (name, value) in &resolved.table.table_config.insert_fixed_values {
            values.insert(name.clone(), value.try_into()?);
        }
        if values.is_empty() {
            return Err(ApiError::Validation("No columns to create".to_owned()));
        }
        EntityRepo::new(resolved.pool, resolved.table)
            .create(values.into_iter().collect())
            .await
            .map_err(Into::<ApiError>::into)?;
        Ok(())
    }

    pub async fn update(
        state: &ApiState,
        datasource_name: String,
        table_name: String,
        param: EntityUpdateParam,
    ) -> Result<EntityUpdateResult, ApiError> {
        let source: Option<Arc<RuntimeDatasource>> = state
            .registry
            .get(datasource_name.clone())
            .await
            .map_err(Into::<ApiError>::into)?;
        let Some(source) = source else {
            return Err(ErrorCode::datasource_name_not_found(datasource_name).into_error());
        };
        let Some(resolved) = source.resolve_table(&table_name) else {
            return Err(ErrorCode::table_name_not_found(datasource_name, table_name).into_error());
        };
        if resolved.table.table_config.readonly {
            return Err(ApiError::Validation("Table is read-only".to_owned()));
        }

        let mut values = validate_columns(&resolved, &param.columns, false)?;
        let mut where_values = Vec::new();
        for primary_key in &resolved.table.table_config.primary_keys {
            let value = values.remove(primary_key).ok_or_else(|| {
                ApiError::Validation(format!(
                    "Primary key {} is required for update",
                    resolved.table.columns.get(primary_key).map(|v|v.display_name.clone()).unwrap_or(primary_key.clone())
                ))
            })?;
            where_values.push((primary_key.clone(), value));
        }

        // keep all columns but primary_keys
        values.retain(|name, _| {
            resolved.table.columns.contains_key(name) &&
            !resolved.table.table_config.primary_keys.contains(name)
        });
        if values.is_empty() {
            return Err(ApiError::Validation("No columns to update".to_owned()));
        }
        let affected = EntityRepo::new(resolved.pool, resolved.table)
            .update(values.into_iter().collect(), where_values)
            .await
            .map_err(Into::<ApiError>::into)?;
        Ok(EntityUpdateResult { affected })
    }

}
