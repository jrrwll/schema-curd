use corers::{api::PageResult, axum::ApiError};

use crate::{
    api::*,
    common::{error::ErrorCode, state::ApiState},
    model::{CreateDatasource, DatasourceEntity, UpdateDatasource, UserEntity, embed::RoleEnum},
    repo::DatasourceRepo,
    service::{AccessService, MetaService},
    util::serialize_config,
};

pub struct DatasourceService;

impl DatasourceService {
    pub async fn list(
        state: &ApiState, param: DatasourceListParam, user: UserEntity,
    ) -> Result<PageResult<DatasourceListResult>, ApiError> {
        let op_user_id = user.id;
        let super_admin = user.super_admin;
        let (total, items) = if super_admin {
            DatasourceRepo::list(&state.pool, param).await
        } else {
            DatasourceRepo::list_permitted(&state.pool, param, op_user_id).await
        }
        .map_err(ApiError::unknown)?;

        let mut items: Vec<DatasourceListResult> = items.into_iter().map(Into::into).collect();
        if super_admin {
            items.iter_mut().for_each(|item| item.effective_role = EffectiveRoleEnum::Write);
        } else {
            let datasource_roles = AccessService::load_datasource_roles(state, op_user_id).await?;
            for item in &mut items {
                if let Some(role) = datasource_roles.get(&item.id)
                    && role.implies(RoleEnum::Write)
                {
                    item.effective_role = EffectiveRoleEnum::Write;
                }
            }
        }
        let result = (total, items).into();
        Ok(result)
    }

    pub async fn detail(state: &ApiState, id: i64, role: RoleEnum) -> Result<DatasourceDetailResult, ApiError> {
        let entity = Self::get_datasource(state, id).await?;
        let mut result: DatasourceDetailResult = entity.try_into()?;
        if role == RoleEnum::Write {
            result.base.effective_role = EffectiveRoleEnum::Write;
        }
        Ok(result)
    }

    pub async fn get_datasource(state: &ApiState, id: i64) -> Result<DatasourceEntity, ApiError> {
        DatasourceRepo::get(&state.pool, id)
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| ErrorCode::datasource_not_found(id).into_error())
    }

    pub async fn get_datasource_by_name(
        state: &ApiState, datasource_name: String,
    ) -> Result<DatasourceEntity, ApiError> {
        DatasourceRepo::get_by_name(&state.pool, datasource_name.clone())
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| ErrorCode::datasource_name_not_found(datasource_name).into_error())
    }

    pub async fn create(state: &ApiState, param: DatasourceCreateParam, op_user_id: i64) -> Result<(), ApiError> {
        let entity = CreateDatasource {
            name: param.name,
            url: param.url,
            username: param.username,
            password: param.password,
            display_name: param.display_name,
            config: serialize_config(&param.config)?,
        };
        DatasourceRepo::create(&state.pool, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        MetaService::reload_registry(state).await?;
        Ok(())
    }

    pub async fn update(state: &ApiState, datasource_id: i64, param: DatasourceUpdateParam, op_user_id: i64) -> Result<(), ApiError> {
        let entity = UpdateDatasource {
            id: datasource_id,
            url: param.url,
            username: param.username,
            password: param.password,
            display_name: param.display_name,
            config: serialize_config(&param.config)?,
        };
        let op_ok = DatasourceRepo::update(&state.pool, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !op_ok {
            return Err(ErrorCode::operate_failed.into_error());
        }
        MetaService::reload_registry(state).await?;
        Ok(())
    }

    pub async fn delete(state: &ApiState, datasource: DatasourceEntity, op_user_id: i64) -> Result<(), ApiError> {
        let op_ok = DatasourceRepo::delete(&state.pool, datasource.id, datasource.name, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !op_ok {
            return Err(ErrorCode::operate_failed.into_error());
        }
        Ok(())
    }
}
