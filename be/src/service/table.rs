use crate::{
    api::*,
    common::{error::ErrorCode, state::ApiState},
    model::{CreateTable, TableEntity, UpdateTable, embed::RoleEnum},
    repo::TableRepo,
    service::{AccessService, MetaService},
    util::serialize_config,
};
use corers::{api::PageResult, axum::ApiError};
use either::Either;

pub struct TableService;

impl TableService {
    pub async fn list(
        state: &ApiState, param: TableListParam, op_user_id: i64,
    ) -> Result<PageResult<TableListResult>, ApiError> {
        let datasource_name = param.datasource.clone();
        let datasource_role = AccessService::permit_table_list(&state, op_user_id, datasource_name.clone()).await?;

        let (total, items) = TableRepo::list(&state.pool, param).await.map_err(ApiError::unknown)?;
        let mut items: Vec<TableListResult> = items.into_iter().map(Into::into).collect();

        if let Some(role) = datasource_role
            && role.implies(RoleEnum::Write)
        {
            items.iter_mut().for_each(|item| item.effective_role = Some(role).into());
        } else {
            let table_roles = AccessService::load_table_roles(state, op_user_id, datasource_name).await?;
            for item in &mut items {
                if let Some(role) = table_roles.get(&item.id) {
                    item.effective_role = Some(*role).into();
                } else if let Some(role) = datasource_role {
                    item.effective_role = Some(role).into();
                }
            }
        }

        Ok((total, items).into())
    }

    pub async fn detail(state: &ApiState, id: i64, op_user_id: i64) -> Result<TableDetailResult, ApiError> {
        let (table, datasource, table_role) =
            AccessService::require_table_role(&state, op_user_id, Either::Left(id), RoleEnum::Read).await?;

        let mut result: TableDetailResult = (table, datasource).try_into()?;
        result.base.effective_role = Some(table_role).into();
        Ok(result)
    }

    pub async fn get_table(state: &ApiState, id: i64) -> Result<TableEntity, ApiError> {
        TableRepo::get(&state.pool, id)
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| ErrorCode::table_not_found(id).into_error())
    }

    pub async fn get_table_by_name(
        state: &ApiState, name: String, datasource_name: String,
    ) -> Result<TableEntity, ApiError> {
        TableRepo::get_by_name(&state.pool, name.clone(), datasource_name.clone())
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| ErrorCode::table_name_not_found(name, datasource_name).into_error())
    }

    pub async fn create(state: &ApiState, param: TableCreateParam, op_user_id: i64) -> Result<(), ApiError> {
        let datasource_name = param.datasource.clone();
        AccessService::require_datasource_role(&state, op_user_id, Either::Right(datasource_name), RoleEnum::Write).await?;

        let entity = CreateTable {
            datasource_name: param.datasource,
            name: param.name,
            display_name: param.display_name,
            table_name: param.table_name,
            table_config: serialize_config(&param.table_config)?,
            columns_config: serialize_config(&param.columns_config)?,
        };
        TableRepo::create(&state.pool, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        MetaService::reload_registry(state).await?;
        Ok(())
    }

    pub async fn update(state: &ApiState, param: TableUpdateParam, op_user_id: i64) -> Result<(), ApiError> {
        let table_id = param.id;
        AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Write).await?;

        let entity = UpdateTable {
            id: param.id,
            display_name: param.display_name,
            table_config: serialize_config(&param.table_config)?,
            columns_config: serialize_config(&param.columns_config)?,
        };
        let op_ok = TableRepo::update(&state.pool, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !op_ok {
            return Err(ErrorCode::operate_failed.into_error());
        }
        MetaService::reload_registry(state).await?;
        Ok(())
    }

    pub async fn delete(state: &ApiState, id: i64, op_user_id: i64) -> Result<(), ApiError> {
        AccessService::permit_table_delete(&state, op_user_id, id).await?;

        let op_ok = TableRepo::delete(&state.pool, id, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !op_ok {
            return Err(ErrorCode::operate_failed.into_error());
        }
        Ok(())
    }
}
