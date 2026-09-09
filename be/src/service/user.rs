use corers::api::PageResult;
use corers::axum::ApiError;

use crate::api::*;
use crate::model::{CreateUser, UpdateUser, UserEntity};
use crate::service::RefreshTokenCacheService;
use crate::util::hash_password;
use crate::{common::{error::ErrorCode, state::ApiState}, repo::UserRepo};

pub struct UserService;

impl UserService {

    pub async fn profile(state: &ApiState, id: i64) -> Result<ProfileResult, ApiError> {
        let user = Self::get_user(state, id).await?;
        if user.disabled {
            return Err(ApiError::Forbidden("User is disabled".to_owned()));
        }

        Ok(ProfileResult{
            id: user.id,
            name: user.name,
            display_name: user.display_name,
            super_admin: user.super_admin,
        })
    }

    async fn get_user(state: &ApiState, id: i64) -> Result<UserEntity, ApiError> {
        UserRepo::get(&state.pool, id).await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| ErrorCode::user_not_found(id).into_error())
    }

    pub async fn list(state: &ApiState, param: UserListParam) -> Result<PageResult<UserListResult>, ApiError> {
        let (total, items) = UserRepo::list(&state.pool, param).await
                .map_err(ApiError::unknown)?;
        let items: Vec<UserListResult> = items.into_iter().map(Into::into).collect();
        let result = (total, items).into();
        Ok(result)
    }

    pub async fn create(state: &ApiState, param: UserCreateParam, op_user_id: i64) -> Result<(), ApiError> {
        let password = hash_password(param.password).await?;

        let entity = CreateUser {
            created_by: op_user_id,
            updated_by: op_user_id,
            name: param.name,
            password,
            display_name: param.display_name,
        };
        UserRepo::create(&state.pool, entity)
            .await
            .map_err(ApiError::unknown)
    }

    pub async fn update(state: &ApiState, param: UserUpdateParam, op_user_id: i64) -> Result<(), ApiError> {
        let user_id = param.id;
        let user = Self::get_user(state, user_id).await?;
        if user.disabled {
            return Err(ErrorCode::user_is_disabled(user_id).into_error());
        }
        if param.password.is_none() && param.display_name.is_none() {
            return Err(ApiError::Validation("No fields to update".to_owned()));
        }
        let password_changed = param.password.is_some();
        let password = match param.password {
            Some(password) => Some(hash_password(password).await?),
            None => None,
        };

        let entity = UpdateUser {
            id: param.id,
            updated_by: op_user_id,
            password,
            display_name: param.display_name,
        };
        let found = UserRepo::update(&state.pool, entity)
            .await.map_err(ApiError::unknown)?;
        if !found {
            return Err(ErrorCode::user_not_found(user_id).into_error());
        }

        if password_changed {
            RefreshTokenCacheService::remove(state.kv_store.clone(), user_id)
                .await.map_err(ApiError::unknown)?;
        }
        Ok(())
    }

    pub async fn disable(state: &ApiState, id: i64, op_user_id: i64) -> Result<(), ApiError> {
        let user = Self::get_user(state, id).await?;
        if user.disabled {
            return Ok(());
        }
        let found = UserRepo::set_disabled(&state.pool, id, op_user_id, false, true)
            .await.map_err(ApiError::unknown)?;
        if !found {
            return Err(ErrorCode::operate_failed.into_error());
        }
        Ok(())
    }

    pub async fn enable(state: &ApiState, id: i64, op_user_id: i64) -> Result<(), ApiError> {
        let user = Self::get_user(state, id).await?;
        if !user.disabled {
            return Ok(());
        }
        let found = UserRepo::set_disabled(&state.pool, id, op_user_id, true, false)
            .await.map_err(ApiError::unknown)?;
        if !found {
            return Err(ErrorCode::operate_failed.into_error());
        }
        Ok(())
    }

    pub async fn delete(state: &ApiState, id: i64, op_user_id: i64) -> Result<(), ApiError> {
        let ok = UserRepo::delete(&state.pool, id, op_user_id).await
            .map_err(ApiError::unknown)?;
        if !ok {
            return Err(ErrorCode::user_not_found(id).into_error());
        }
        Ok(())
    }

    
}