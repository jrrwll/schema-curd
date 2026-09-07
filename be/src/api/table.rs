use axum::{
    Router,
    extract::State,
    routing::{get, post},
};

use corers::api::{ApiPageResult, ApiResult};
use corers::axum::{ApiError, ValidatedJson, ValidatedQuery};

use crate::{
    common::state::ApiState, http::extract::Authenticated, model::embed::RoleEnum, service::{AccessService, TableService}, util::Either,
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
            .route("/delete", post(delete))
        ,
    )
}

async fn list(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TableListParam>,
) -> Result<ApiPageResult<TableListResult>, ApiError> {
    let datasource_name = param.datasource.clone();
    let op_user_id = identity.user_id;

    let datasource_role = AccessService::permit_table_list(&state, op_user_id, datasource_name).await?;
    TableService::list(&state, param, datasource_role, op_user_id).await.map(Into::into)
}

async fn detail(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedQuery(param): ValidatedQuery<IdParam>,
) -> Result<ApiResult<TableDetailResult>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    let (_, table_role) = AccessService::require_table_role(&state, op_user_id, Either::Left(id), RoleEnum::Read).await?;
    TableService::detail(&state, id, table_role).await.map(Into::into)
}

async fn create(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TableCreateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let datasource_name = param.datasource.clone();
    let op_user_id = identity.user_id;

    AccessService::require_datasource_role(
        &state,
        op_user_id,
        Either::Right(datasource_name),
        RoleEnum::Write,
    )
    .await?;
    TableService::create(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn update(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TableUpdateParam>,
) -> Result<ApiResult<()>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    AccessService::require_table_role(&state, op_user_id, Either::Left(id), RoleEnum::Write).await?;
    TableService::update(&state, param, op_user_id).await?;
    Ok(ApiResult::ok(None))
}

async fn delete(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<IdParam>,
) -> Result<ApiResult<()>, ApiError> {
    let id = param.id;
    let op_user_id = identity.user_id;

    AccessService::permit_datasource_write_by_table_id(&state, op_user_id, id).await?;
    TableService::delete(&state, id, op_user_id).await?;
    Ok(ApiResult::ok(None))
}
