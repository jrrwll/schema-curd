use axum::{extract::State, routing::post, Router};

use crate::{common::state::ApiState, http::extract::Authenticated, service::PhysicalService};
use corers::api::ApiResult;
use corers::axum::{ApiError, ValidatedJson};

use super::*;

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/physical",
        Router::new()
            .route("/connection/test", post(test_connection))
            .route("/table/list", post(list_table_physical))
            .route("/table/refresh", post(refresh_table_physical))
            .route("/column/list", post(list_column_physical))
            .route("/column/refresh", post(refresh_column_physical)),
    )
}

async fn test_connection(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TestDatasourceParam>,
) -> Result<ApiResult<TestDatasourceResult>, ApiError> {
    let op_user_id = identity.user_id;
    PhysicalService::test_connection(&state, param, op_user_id).await.map(Into::into)
}

async fn list_table_physical(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalTableListParam>,
) -> Result<ApiResult<Vec<PhysicalTableListResult>>, ApiError> {
    let op_user_id = identity.user_id;

    PhysicalService::list_table(&state, param.datasource, op_user_id)
        .await
        .map(Into::into)
}

async fn refresh_table_physical(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalTableListParam>,
) -> Result<ApiResult<Vec<PhysicalTableListResult>>, ApiError> {
    let op_user_id = identity.user_id;

    PhysicalService::refresh_table(&state, param.datasource, op_user_id)
        .await
        .map(Into::into)
}

async fn list_column_physical(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalColumnListParam>,
) -> Result<ApiResult<Vec<PhysicalColumnListResult>>, ApiError> {
    let op_user_id = identity.user_id;
    PhysicalService::list_column(&state, param, op_user_id).await.map(Into::into)
}

async fn refresh_column_physical(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalColumnListParam>,
) -> Result<ApiResult<Vec<PhysicalColumnListResult>>, ApiError> {
    let op_user_id = identity.user_id;
    PhysicalService::refresh_column(&state, param, op_user_id).await.map(Into::into)
}
