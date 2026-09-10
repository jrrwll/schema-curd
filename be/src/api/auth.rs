use axum::{Router, extract::State, routing::post};
use corers::api::ApiResult;
use corers::axum::{ApiError, ValidatedJson};

use super::{AuthTokenResult, LoginParam, RefreshParam};
use crate::{common::state::ApiState, service::AuthService};

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest("/auth", Router::new().route("/login", post(login)).route("/refresh", post(refresh)))
}

async fn login(
    State(state): State<ApiState>, ValidatedJson(param): ValidatedJson<LoginParam>,
) -> Result<ApiResult<AuthTokenResult>, ApiError> {
    let res = AuthService::login(&state, param).await?;
    Ok(ApiResult::ok(Some(res)))
}

async fn refresh(
    State(state): State<ApiState>, ValidatedJson(param): ValidatedJson<RefreshParam>,
) -> Result<ApiResult<AuthTokenResult>, ApiError> {
    AuthService::refresh(&state, param).await.map(Into::into)
}
