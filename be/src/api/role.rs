use axum::{
    Router,
    extract::State,
    routing::{post},
};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson};

use crate::{common::state::ApiState, http::extract::CurrentSuperAdmin, service::RoleService};

use super::*;

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/role",
        Router::new()
            .route("/list", post(list))
            .route("/grant", post(grant))
            .route("/batch/grant/user", post(batch_grant_user))
            .route("/batch/grant/resource", post(batch_grant_resource))
            .route("/revoke", post(revoke))
            .route("/batch/revoke", post(batch_revoke))
            .route("/update", post(update))
            .route("/user/datasource/list", post(user_datasource_list))
            .route("/user/table/list", post(user_table_list))
            .route("/datasource/user/list", post(datasource_user_list))
            .route("/table/user/list", post(table_user_list))
        ,
    )
}

async fn list(
    State(state): State<ApiState>,
    CurrentSuperAdmin(_): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleListParam>,
) -> Result<ApiPageResult<RoleListResult>, ApiError> {
    RoleService::list(&state, param).await.map(Into::into)
}

async fn grant(
    State(state): State<ApiState>,
    CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleGrantParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;

    RoleService::grant(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn batch_grant_user(
    State(state): State<ApiState>,
    CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleBatchGrantUserParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;

    RoleService::batch_grant_user(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn batch_grant_resource(
    State(state): State<ApiState>,
    CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleBatchGrantResourceParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;

    RoleService::batch_grant_resource(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn revoke(
    State(state): State<ApiState>,
    CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<IdParam>,
) -> Result<ApiResult<()>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    RoleService::revoke(&state, id, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn batch_revoke(
    State(state): State<ApiState>,
    CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<IdsParam>,
) -> Result<ApiResult<()>, ApiError> {
    let ids = param.ids;
    let op_user_id = identity.user_id;

    RoleService::batch_revoke(&state, ids, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn update(
    State(state): State<ApiState>,
    CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleUpdateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;

    RoleService::update(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn user_datasource_list(
    State(state): State<ApiState>,
    CurrentSuperAdmin(_): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleUserListParam>,
) -> Result<ApiResult<Vec<RoleUserResourceListResult>>, ApiError> {
    RoleService::user_datasource_list(&state, param).await.map(Into::into)
}

async fn user_table_list(
    State(state): State<ApiState>,
    CurrentSuperAdmin(_): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleUserListParam>,
) -> Result<ApiResult<Vec<RoleUserResourceListResult>>, ApiError> {
    RoleService::user_table_list(&state, param).await.map(Into::into)
}

async fn datasource_user_list(
    State(state): State<ApiState>,
    CurrentSuperAdmin(_): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleResourceListParam>,
) -> Result<ApiResult<Vec<RoleUserResourceListResult>>, ApiError> {
    RoleService::datasource_user_list(&state, param).await.map(Into::into)
}

async fn table_user_list(
    State(state): State<ApiState>,
    CurrentSuperAdmin(_): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<RoleResourceListParam>,
) -> Result<ApiResult<Vec<RoleUserResourceListResult>>, ApiError> {
    RoleService::table_user_list(&state, param).await.map(Into::into)
}
