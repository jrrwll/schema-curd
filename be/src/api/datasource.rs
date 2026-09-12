use axum::{
    Router,
    extract::State,
    routing::{get, post},
};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson, ValidatedQuery};
use either::Either;

use crate::{
    common::state::ApiState,
    http::extract::Authenticated,
    model::embed::RoleEnum,
    service::{AccessService, DatasourceService},
};
use crate::http::extract::CurrentSuperAdmin;
use super::*;

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

    let user = AccessService::verify_user(&state, op_user_id).await?;
    DatasourceService::list(&state, param, user).await.map(Into::into)
}

async fn detail(
    State(state): State<ApiState>, Authenticated(identity): Authenticated,
    ValidatedQuery(param): ValidatedQuery<IdParam>,
) -> Result<ApiResult<DatasourceDetailResult>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    let (_, role) = AccessService::require_datasource_role(&state, op_user_id, Either::Left(id), RoleEnum::Read).await?;
    DatasourceService::detail(&state, id, role).await.map(Into::into)
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
    let datasource_name = param.name.clone();
    let op_user_id = identity.user_id;

    let (datasource, _) = AccessService::require_datasource_role(
        &state, op_user_id, Either::Right(datasource_name), RoleEnum::Write).await?;
    DatasourceService::update(&state, datasource.id, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn delete(
    State(state): State<ApiState>, CurrentSuperAdmin(identity): CurrentSuperAdmin, ValidatedJson(param): ValidatedJson<NameParam>,
) -> Result<ApiResult<()>, ApiError> {
    let datasource_name = param.name;
    let op_user_id = identity.user_id;

    let datasource = AccessService::verify_datasource(
        &state, Either::Right(datasource_name)).await?;
    DatasourceService::delete(&state, datasource, op_user_id).await?;
    Ok(ApiResult::ok(None))
}
