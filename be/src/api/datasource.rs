use axum::{
    Router,
    extract::State,
    routing::{get, post},
};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson, ValidatedQuery};

use crate::{common::state::ApiState, http::extract::Authenticated, model::embed::RoleEnum, service::{AccessService, DatasourceService}, util::Either};

use super::*;

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/datasource",
        Router::new()
            .route("/list", post(list))
            // .route("/summary", post(summary))
            .route("/detail", get(detail))
            .route("/create", post(create))
            .route("/update", post(update))
            .route("/delete", post(delete)),
    )
}

async fn list(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<DatasourceListParam>,
) -> Result<ApiPageResult<DatasourceListResult>, ApiError> {
    let op_user_id = identity.user_id;

    let user = AccessService::verify_user(&state, op_user_id).await?;
    DatasourceService::list(&state, param, user).await.map(Into::into)
}

async fn detail(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedQuery(param): ValidatedQuery<IdParam>,
) -> Result<ApiResult<DatasourceDetailResult>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    let role = AccessService::require_datasource_role(&state, op_user_id, Either::Left(id), RoleEnum::Read).await?;
    DatasourceService::detail(&state, id, role).await.map(Into::into)
}

async fn create(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<DatasourceCreateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;

    AccessService::require_super_admin(&state, op_user_id).await?;
    DatasourceService::create(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn update(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<DatasourceUpdateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    AccessService::require_datasource_role(&state, op_user_id, Either::Left(id), RoleEnum::Write).await?;
    DatasourceService::update(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn delete(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<IdParam>,
) -> Result<ApiResult<()>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    AccessService::require_super_admin(&state, op_user_id).await?;
    DatasourceService::delete(&state, id, op_user_id).await?;
    Ok(ApiResult::ok(None))
}
