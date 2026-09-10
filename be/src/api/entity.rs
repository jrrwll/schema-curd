use axum::{Router, extract::State, routing::post};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson};
use serde_json::Value;

use crate::{
    common::state::ApiState,
    http::extract::Authenticated,
    model::embed::RoleEnum,
    service::{AccessService, EntityService},
    util::Either,
};

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
    let table_id = param.table_id;
    let op_user_id = identity.user_id;

    let (table, _) =
        AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Read).await?;
    EntityService::list(&state, table, param).await.map(Into::into)
}

async fn create(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<EntityCreateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let table_id = param.table_id;
    let op_user_id = identity.user_id;

    let (table, _) =
        AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Write).await?;
    EntityService::create(&state, table, param).await?;
    Ok(ApiResult::ok(None))
}

async fn update(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<EntityUpdateParam>,
) -> Result<ApiResult<EntityUpdateResult>, ApiError> {
    let table_id = param.table_id;
    let op_user_id = identity.user_id;

    let (table, _) =
        AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Write).await?;
    EntityService::update(&state, table, param).await.map(Into::into)
}
