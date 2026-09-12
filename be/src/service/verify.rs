use crate::common::error::ErrorCode;
use crate::common::state::ApiState;
use crate::model::embed::RoleEnum;
use crate::model::{DatasourceEntity, RoleEntity, TableEntity, UserEntity};
use crate::repo::{RoleRepo, UserRepo};
use crate::service::{DatasourceService, RoleCacheService, TableService, datasource};
use corers::axum::ApiError;
use either::Either;
use std::collections::HashMap;

pub struct VerifyService;

impl VerifyService {
    pub async fn get_datasource_and_role(
        state: &ApiState, user_id: i64, datasource_id_or_name: Either<i64, String>,
    ) -> Result<(DatasourceEntity, Option<RoleEnum>), ApiError> {
        let datasource = Self::verify_datasource(state, datasource_id_or_name).await?;
        let user = Self::verify_user(state, user_id).await?;
        if user.super_admin {
            return Ok((datasource, Some(RoleEnum::Write)));
        }
        let roles = Self::load_datasource_roles(state, user_id).await?;
        if roles.is_empty() {
            return Ok((datasource, None));
        }
        let Some(role) = roles.get(&datasource.id) else {
            return Ok((datasource, None));
        };
        Ok((datasource, Some(*role)))
    }

    // verify
    pub async fn verify_user(state: &ApiState, user_id: i64) -> Result<UserEntity, ApiError> {
        let user = UserRepo::get(&state.pool, user_id).await.map_err(ApiError::unknown)?;
        let Some(user) = user else {
            return Err(ApiError::Forbidden("User not found".to_owned()));
        };
        if user.disabled {
            return Err(forbidden());
        }
        Ok(user)
    }

    pub async fn verify_datasource(
        state: &ApiState, datasource_id_or_name: Either<i64, String>,
    ) -> Result<DatasourceEntity, ApiError> {
        let datasource = match datasource_id_or_name {
            Either::Left(datasource_id) => DatasourceService::get_datasource(state, datasource_id).await?,
            Either::Right(datasource_name) => DatasourceService::get_datasource_by_name(state, datasource_name).await?,
        };
        if datasource.disabled {
            return Err(ErrorCode::datasource_disabled(datasource.name).into_error());
        }
        Ok(datasource)
    }

    pub async fn verify_table(
        state: &ApiState, table_id_or_name: Either<i64, (String, String)>,
    ) -> Result<TableEntity, ApiError> {
        let table = match table_id_or_name {
            Either::Left(table_id) => TableService::get_table(state, table_id).await?,
            Either::Right((datasource_name, table_name)) => {
                TableService::get_table_by_name(state, table_name, datasource_name).await?
            }
        };
        if table.disabled {
            return Err(ErrorCode::table_disabled(table.id).into_error());
        }
        Ok(table)
    }

    pub async fn verify_datasource_table(
        state: &ApiState, table_id_or_name: Either<i64, (String, String)>,
    ) -> Result<(DatasourceEntity, TableEntity), ApiError> {
        let table = Self::verify_table(state, table_id_or_name).await?;
        let datasource = Self::verify_datasource(state, Either::Right(table.datasource_name.clone())).await?;
        Ok((datasource, table))
    }

    // load cache
    pub async fn load_datasource_roles(state: &ApiState, user_id: i64) -> Result<HashMap<i64, RoleEnum>, ApiError> {
        let roles = RoleCacheService::get_datasource_roles(state.kv_store.clone(), user_id)
            .await
            .map_err(ApiError::unknown)?;
        if let Some(roles) = roles {
            return Ok(roles);
        }

        let entities = RoleRepo::get_datasource_roles(&state.pool, user_id)
            .await
            .map_err(ApiError::unknown)?;
        let roles = parse_role_entities(entities)?;

        RoleCacheService::save_datasource_roles(state.kv_store.clone(), user_id, &roles)
            .await
            .map_err(ApiError::unknown)?;
        Ok(roles)
    }

    pub async fn load_table_roles(
        state: &ApiState, user_id: i64, datasource_name: String,
    ) -> Result<HashMap<i64, RoleEnum>, ApiError> {
        let roles = RoleCacheService::get_table_roles(state.kv_store.clone(), user_id, &datasource_name)
            .await
            .map_err(ApiError::unknown)?;
        if let Some(roles) = roles {
            return Ok(roles);
        }

        let entities = RoleRepo::get_table_roles(&state.pool, user_id, datasource_name.clone())
            .await
            .map_err(ApiError::unknown)?;
        let roles = parse_role_entities(entities)?;

        RoleCacheService::save_table_roles(state.kv_store.clone(), user_id, &datasource_name, &roles)
            .await
            .map_err(ApiError::unknown)?;
        Ok(roles)
    }
}

fn parse_role_entities(entities: Vec<RoleEntity>) -> Result<HashMap<i64, RoleEnum>, ApiError> {
    let roles: HashMap<i64, RoleEnum> = entities
        .into_iter()
        .map(|v| v.role.parse::<RoleEnum>().map(|role| (v.resource_id, role)))
        .collect::<Result<_, _>>()
        .map_err(ApiError::unknown)?;
    Ok(roles)
}

fn forbidden() -> ApiError {
    ApiError::Forbidden("Permission denied".to_owned())
}
