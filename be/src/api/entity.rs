use axum::{Router, extract::State, routing::post};

use crate::{common::state::ApiState, http::extract::Authenticated, service::EntityService};
use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson};
use serde_json::Value;

use super::*;

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/entity",
        Router::new()
            .route("/list", post(list))
            .route("/create", post(create))
            .route("/update", post(update)), // .route("/delete", post(delete))
    )
}

async fn list(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<EntityListParam>,
) -> Result<ApiPageResult<Value>, ApiError> {
    let op_user_id = identity.user_id;
    EntityService::list(&state, param, op_user_id).await.map(Into::into)
}

async fn create(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<EntityCreateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;
    EntityService::create(&state, param, op_user_id).await.map(Into::into)
}

async fn update(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<EntityUpdateParam>,
) -> Result<ApiResult<EntityUpdateResult>, ApiError> {
    let op_user_id = identity.user_id;
    EntityService::update(&state, param, op_user_id).await.map(Into::into)
}
