use std::collections::HashMap;

use corers::axum::ApiError;

use crate::{
    common::{error::ErrorCode, state::ApiState},
    model::{DatasourceEntity, RoleEntity, TableEntity, UserEntity, embed::RoleEnum},
    repo::{RoleRepo, UserRepo},
    service::{DatasourceService, RoleCacheService, TableService},
    util::Either,
};

pub struct AccessService;

impl AccessService {
    // permits
    pub async fn permit_datasource_write_by_table_id(
        state: &ApiState,
        user_id: i64,
        table_id: i64,
    ) -> Result<(), ApiError> {
        let table = Self::verify_table(state, Either::Left(table_id)).await?;
        let datasource_role = Self::get_datasource_role(state, user_id, Either::Right(table.datasource_name.clone())).await?;
        if datasource_role.is_some_and(|v|v.1.implies(RoleEnum::Write)) {
            return Ok(());
        }
        Err(forbidden())
    }

    pub async fn permit_table_list(
        state: &ApiState,
        user_id: i64,
        datasource_name: String,
    ) -> Result<Option<RoleEnum>, ApiError> {
        let datasource_role = Self::get_datasource_role(state, user_id, Either::Right(datasource_name.clone())).await?;
        if let Some((_, datasource_role)) = datasource_role && datasource_role.implies(RoleEnum::Read) {
            return Ok(Some(datasource_role));
        }

        let roles = Self::load_table_roles(state, user_id, datasource_name).await?;
        if roles.is_empty() {
            return Err(forbidden());
        }
        Ok(None)
    }

    pub async fn has_datasource_role(
        state: &ApiState,
        user_id: i64,
        datasource_id: i64,
        expect_role: RoleEnum,
    ) -> Result<bool, ApiError> {
        let roles = Self::load_datasource_roles(state, user_id).await?;
        if roles.is_empty() {
            return Ok(false);
        }
        if let Some(role) = roles.get(&datasource_id) {
            return Ok(role.implies(expect_role));
        }
        Ok(false)
    }

    // perms
    pub async fn require_super_admin(state: &ApiState, user_id: i64) -> Result<(), ApiError> {
        let user = Self::verify_user(state, user_id).await?;
        if !user.super_admin {
            return Err(forbidden());
        }
        Ok(())
    }

    pub async fn require_datasource_role(
        state: &ApiState,
        user_id: i64,
        datasource_id_or_name: Either<i64, String>,
        required_role: RoleEnum,
    ) -> Result<RoleEnum, ApiError> {
        let role = Self::get_datasource_role(state, user_id, datasource_id_or_name).await?;
        let Some((_, role)) = role else {
            return Err(forbidden());
        };

        if role.implies(required_role) {
            return Ok(role);
        }
        Err(forbidden())
    }

    pub async fn require_table_role(
        state: &ApiState,
        user_id: i64,
        table_id_or_name: Either<i64, (String, String)>,
        required_role: RoleEnum,
    ) -> Result<(TableEntity, RoleEnum), ApiError> {
        let table_role = Self::get_table_role(state, user_id, table_id_or_name).await?;
        let Some((table, role)) = table_role else {
            return Err(forbidden());
        };

        if role.implies(required_role) {
            return Ok((table, role));
        }
        Err(forbidden())
    }

    pub async fn get_datasource_role(
        state: &ApiState,
        user_id: i64,
        datasource_id_or_name: Either<i64, String>,
    ) -> Result<Option<(DatasourceEntity, RoleEnum)>, ApiError> {
        let datasource = Self::verify_datasource(state, datasource_id_or_name).await?;
        let user = Self::verify_user(state, user_id).await?;
        if user.super_admin {
            return Ok(Some((datasource, RoleEnum::Write)));
        }
        let roles = Self::load_datasource_roles(state, user_id).await?;
        if roles.is_empty() {
            return Ok(None);
        }
        let Some(role) = roles.get(&datasource.id) else {
            return Ok(None);
        };
        Ok(Some((datasource, *role)))
    }

    pub async fn get_table_role(
        state: &ApiState,
        user_id: i64,
        table_id_or_name: Either<i64, (String, String)>,
    ) -> Result<Option<(TableEntity, RoleEnum)>, ApiError> {
        let table = Self::verify_table(state, table_id_or_name).await?;
        let datasource_role = Self::get_datasource_role(state, user_id, Either::Right(table.datasource_name.clone())).await?;
        let datasource_role = match datasource_role {
            Some((_, datasource_role)) => Some(datasource_role),
            None => None,
        };
        if let Some(role) = datasource_role && role.implies(RoleEnum::Write) {
            return Ok(Some((table, role)));
        }

        let roles = Self::load_table_roles(state, user_id, table.datasource_name.clone()).await?;
        let Some(role) = roles.get(&table.id) else {
            return Ok(datasource_role.map(|v| (table, v)));
        };
        Ok(Some((table, *role)))
    }

    // verify
    pub async fn verify_user(state: &ApiState, user_id: i64) -> Result<UserEntity, ApiError> {
        let user = UserRepo::get(&state.pool, user_id)
            .await
            .map_err(ApiError::unknown)?;
        let Some(user) = user else {
            return Err(ApiError::Unauthorized);
        };
        if user.disabled {
            return Err(forbidden());
        }
        Ok(user)
    }

    pub async fn verify_datasource(
        state: &ApiState,
        datasource_id_or_name: Either<i64, String>,
    ) -> Result<DatasourceEntity, ApiError> {
        let datasource = match datasource_id_or_name {
            Either::Left(datasource_id) => {
                DatasourceService::get_datasource(state, datasource_id).await?
            }
            Either::Right(datasource_name) => {
                DatasourceService::get_datasource_by_name(state, datasource_name).await?
            }
        };
        if datasource.disabled {
            return Err(ErrorCode::datasource_disabled(datasource.name).into_error());
        }
        Ok(datasource)
    }

    pub async fn verify_table(
        state: &ApiState,
        table_id_or_name: Either<i64, (String, String)>,
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

    // load cache
    pub async fn load_datasource_roles(
        state: &ApiState,
        user_id: i64,
    ) -> Result<HashMap<i64, RoleEnum>, ApiError> {
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
        state: &ApiState,
        user_id: i64,
        datasource_name: String,
    ) -> Result<HashMap<i64, RoleEnum>, ApiError> {
        let roles =
            RoleCacheService::get_table_roles(state.kv_store.clone(), user_id, &datasource_name)
                .await
                .map_err(ApiError::unknown)?;
        if let Some(roles) = roles {
            return Ok(roles);
        }

        let entities = RoleRepo::get_table_roles(&state.pool, user_id, datasource_name.clone())
            .await
            .map_err(ApiError::unknown)?;
        let roles = parse_role_entities(entities)?;

        RoleCacheService::save_table_roles(
            state.kv_store.clone(),
            user_id,
            &datasource_name,
            &roles,
        )
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
