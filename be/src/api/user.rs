use axum::{
    Router,
    extract::State,
    routing::{get, post},
};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson};

use crate::{
    common::state::ApiState,
    http::extract::{Authenticated, CurrentSuperAdmin},
    service::UserService,
};

use super::*;

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/user",
        Router::new()
            .route("/profile", get(profile))
            .route("/list", post(list))
            .route("/create", post(create))
            .route("/update", post(update))
            .route("/disable", post(disable))
            .route("/enable", post(enable))
            .route("/delete", post(delete)),
    )
}

async fn profile(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
) -> Result<ApiResult<ProfileResult>, ApiError> {
    UserService::profile(&state, identity.user_id).await.map(Into::into)
}

async fn list(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<UserListParam>,
) -> Result<ApiPageResult<UserListResult>, ApiError> {
    UserService::list(&state, param).await.map(Into::into)
}

async fn create(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<UserCreateParam>,
) -> Result<ApiResult<()>, ApiError> {
    UserService::create(&state, param, identity.user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn update(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<UserUpdateParam>,
) -> Result<ApiResult<()>, ApiError> {
    UserService::update(&state, param, identity.user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn disable(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<IdParam>,
) -> Result<ApiResult<()>, ApiError> {
    let user_id = param.id;
    let op_user_id = identity.user_id;

    UserService::disable(&state, user_id, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn enable(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<IdParam>,
) -> Result<ApiResult<()>, ApiError> {
    let user_id = param.id;
    let op_user_id = identity.user_id;

    UserService::enable(&state, user_id, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn delete(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<IdParam>,
) -> Result<ApiResult<()>, ApiError> {
    let user_id = param.id;
    let op_user_id = identity.user_id;

    UserService::delete(&state, user_id, op_user_id).await?;
    Ok(ApiResult::ok(None))
}
