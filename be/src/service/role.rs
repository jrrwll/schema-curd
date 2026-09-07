use std::collections::{HashMap, HashSet};

use anyhow::Context;
use corers::{api::PageResult, axum::ApiError};

use crate::common::error::ErrorCode;
use crate::model::{CreateUserRole, RoleEntity, UserEntity};
use crate::repo::UserRepo;
use crate::util::format_datetime;
use crate::{api::*, common::state::ApiState, repo::RoleRepo};

pub struct RoleService;

impl RoleService {
    pub async fn list(
        state: &ApiState,
        param: RoleListParam,
    ) -> Result<PageResult<RoleListResult>, ApiError> {
        let (total, items) = RoleRepo::list(&state.pool, param)
            .await
            .map_err(ApiError::unknown)?;
        if items.is_empty() {
            return Ok((total, Vec::new()).into());
        }
        let user_ids: Vec<i64> = items
            .iter()
            .map(|v| v.user_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let user_map = UserRepo::get_multi(&state.pool, user_ids)
            .await
            .map_err(ApiError::unknown)?;

        let items: Vec<RoleListResult> = items
            .into_iter()
            .map(|v| convert_role_result(v, &user_map))
            .collect::<Result<_, _>>()?;
        let result = (total, items).into();
        Ok(result)
    }

    pub async fn grant(
        state: &ApiState,
        param: RoleGrantParam,
        op_user_id: i64,
    ) -> Result<(), ApiError> {
        let user_id = param.user_id;
        let role = param.role.to_string();
        let resource_type = param.resource_type.to_string();
        let resource_id = param.resource_id;

        let found = Self::has_role(
            state,
            user_id,
            resource_type.clone(),
            resource_id,
            role.clone(),
        )
        .await?;
        if found {
            return Ok(());
        }

        let entity = CreateUserRole {
            user_id,
            role,
            resource_type,
            resource_id,
        };
        RoleRepo::grant(&state.pool, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        Ok(())
    }

    pub async fn revoke(state: &ApiState, id: i64, op_user_id: i64) -> Result<(), ApiError> {
        Self::get_role(state, id).await?;

        let found = RoleRepo::revoke(&state.pool, id, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !found {
            return Err(ErrorCode::role_not_found(id).into_error());
        }
        Ok(())
    }

    async fn get_role(state: &ApiState, id: i64) -> Result<RoleEntity, ApiError> {
        RoleRepo::get(&state.pool, id)
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| ErrorCode::role_not_found(id).into_error())
    }

    async fn has_role(
        state: &ApiState,
        user_id: i64,
        resource_type: String,
        resource_id: i64,
        expect_role: String,
    ) -> Result<bool, ApiError> {
        let role = RoleRepo::get_by_uk(&state.pool, user_id, resource_type, resource_id)
            .await
            .map_err(ApiError::unknown)?;
        if let Some(role) = role
            && role.role == expect_role
        {
            return Ok(true);
        }
        Ok(false)
    }

    pub async fn update(
        state: &ApiState,
        param: RoleUpdateParam,
        op_user_id: i64,
    ) -> Result<(), ApiError> {
        let id = param.id;
        Self::get_role(state, id).await?;

        let param = param.grant;
        let user_id = param.user_id;
        let role = param.role.to_string();
        let resource_type = param.resource_type.to_string();
        let resource_id = param.resource_id;
        let found = Self::has_role(
            state,
            user_id,
            resource_type.clone(),
            resource_id.clone(),
            role.clone(),
        )
        .await?;
        if found {
            return Err(ErrorCode::role_already_existing(resource_type, resource_id).into_error());
        }

        let entity = CreateUserRole {
            user_id,
            role,
            resource_type,
            resource_id,
        };
        let update_success = RoleRepo::update(&state.pool, id, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !update_success {
            return Err(ErrorCode::operate_failed.into_error());
        }
        Ok(())
    }
}

fn convert_role_result(
    entity: RoleEntity,
    user_map: &HashMap<i64, UserEntity>,
) -> Result<RoleListResult, ApiError> {
    let user_id = entity.user_id;
    Ok(RoleListResult {
        id: entity.id,
        created_at: format_datetime(entity.created_at),
        user_id,
        user_name: user_map
            .get(&user_id)
            .map(|v| v.name.clone())
            .unwrap_or_default(),
        user_display_name: user_map
            .get(&user_id)
            .map(|v| v.display_name.clone())
            .unwrap_or_default(),
        user_disabled: user_map
            .get(&user_id)
            .map(|v| v.disabled)
            .unwrap_or_default(),
        role: entity
            .role
            .parse()
            .with_context(|| "Invalid role: {entity.role}")
            .map_err(Into::<ApiError>::into)?,
        resource_type: entity
            .resource_type
            .parse()
            .with_context(|| "Invalid resource type: {entity.resource_type}")
            .map_err(Into::<ApiError>::into)?,
        resource_id: entity.resource_id,
    })
}
