use axum::{Router, extract::State, routing::post};

use corers::api::ApiResult;
use corers::axum::{ApiError, ValidatedJson};

use crate::{common::state::ApiState, http::extract::Authenticated, service::DiscoveryService};

use super::*;

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/discovery",
        Router::new()
            .route("/datasource/list", post(list_datasources))
            .route("/table/list", post(list_tables)),
    )
}

async fn list_datasources(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<DiscoveryDatasourceListParam>,
) -> Result<ApiResult<Vec<DiscoveryDatasourceTableListResult>>, ApiError> {
    let op_user_id = identity.user_id;

    DiscoveryService::list_datasources(&state, param, op_user_id)
        .await
        .map(Into::into)
}

async fn list_tables(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<DiscoveryTableListParam>,
) -> Result<ApiResult<Vec<DiscoveryDatasourceTableListResult>>, ApiError> {
    let op_user_id = identity.user_id;

    DiscoveryService::list_tables(&state, param, op_user_id).await.map(Into::into)
}
