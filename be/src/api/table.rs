use axum::{
    extract::State,
    routing::{get, post},
    Router,
};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson, ValidatedQuery};

use crate::{
    common::state::ApiState,
    http::extract::Authenticated
    ,
    service::TableService,
};

use super::*;

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/table",
        Router::new()
            .route("/list", post(list))
            .route("/detail", get(detail))
            .route("/create", post(create))
            .route("/update", post(update))
            .route("/delete", post(delete)),
    )
}

async fn list(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TableListParam>,
) -> Result<ApiPageResult<TableListResult>, ApiError> {
    let op_user_id = identity.user_id;
    TableService::list(&state, param, op_user_id)
        .await
        .map(Into::into)
}

async fn detail(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedQuery(param): ValidatedQuery<IdParam>,
) -> Result<ApiResult<TableDetailResult>, ApiError> {
    let op_user_id = identity.user_id;
    TableService::detail(&state, param.id, op_user_id).await.map(Into::into)
}

async fn create(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TableCreateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;
    TableService::create(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn update(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TableUpdateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;
    TableService::update(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn delete(
    State(state): State<ApiState>, Authenticated(identity): Authenticated, ValidatedJson(param): ValidatedJson<IdParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;
    TableService::delete(&state, param.id, op_user_id).await?;
    Ok(ApiResult::ok(None))
}
