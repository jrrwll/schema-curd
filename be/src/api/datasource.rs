use axum::{
    extract::State,
    routing::{get, post},
    Router,
};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson, ValidatedQuery};

use super::*;
use crate::http::extract::CurrentSuperAdmin;
use crate::{
    common::state::ApiState,
    http::extract::Authenticated
    ,
    service::DatasourceService,
};

pub fn get_routes() -> Router<ApiState> {
    Router::new().nest(
        "/datasource",
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
    ValidatedJson(param): ValidatedJson<DatasourceListParam>,
) -> Result<ApiPageResult<DatasourceListResult>, ApiError> {
    let op_user_id = identity.user_id;
    DatasourceService::list(&state, param, op_user_id).await.map(Into::into)
}

async fn detail(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedQuery(param): ValidatedQuery<IdParam>,
) -> Result<ApiResult<DatasourceDetailResult>, ApiError> {
    let op_user_id = identity.user_id;
    DatasourceService::detail(&state, param.id, op_user_id).await.map(Into::into)
}

async fn create(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<DatasourceCreateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;
    DatasourceService::create(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn update(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<DatasourceUpdateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;
    DatasourceService::update(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn delete(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin,
    ValidatedJson(param): ValidatedJson<NameParam>,
) -> Result<ApiResult<()>, ApiError> {
    let op_user_id = identity.user_id;
    DatasourceService::delete(&state, param.name, op_user_id).await?;
    Ok(ApiResult::ok(None))
}
