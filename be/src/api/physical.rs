use axum::{extract::State, routing::post, Router};

use corers::api::ApiResult;
use corers::axum::{ApiError, ValidatedJson};

use crate::model::embed::RoleEnum;
use crate::service::AccessService;
use crate::util::Either;
use crate::{common::state::ApiState, http::extract::Authenticated, service::PhysicalService};

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
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<TestDatasourceParam>,
) -> Result<ApiResult<TestDatasourceResult>, ApiError> {
    let op_user_id = identity.user_id;

    if let Some(id) = param.id {
        AccessService::require_datasource_role(
            &state,
            op_user_id,
            Either::Left(id),
            RoleEnum::Write,
        )
        .await?;
    } else {
        AccessService::require_super_admin(&state, op_user_id).await?;
    }

    PhysicalService::test_connection(&state, param)
        .await
        .map(Into::into)
}

async fn list_table_physical(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalTableListParam>,
) -> Result<ApiResult<Vec<PhysicalTableListResult>>, ApiError> {
    let datasource_name = param.datasource;

    PhysicalService::list_table(&state, datasource_name)
        .await
        .map(Into::into)
}

async fn refresh_table_physical(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalTableListParam>,
) -> Result<ApiResult<Vec<PhysicalTableListResult>>, ApiError> {
    let datasource_name = param.datasource;
    let op_user_id = identity.user_id;

    AccessService::require_datasource_role(
        &state,
        op_user_id,
        Either::Right(datasource_name.clone()),
        RoleEnum::Write,
    )
    .await?;
    PhysicalService::refresh_table(&state, datasource_name)
        .await
        .map(Into::into)
}

async fn list_column_physical(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalColumnListParam>,
) -> Result<ApiResult<Vec<PhysicalColumnListResult>>, ApiError> {
    let op_user_id = identity.user_id;

    let (datasource_name, table_name) = permit_column_physical(&state, param, op_user_id).await?;
    PhysicalService::list_column(&state, datasource_name, table_name)
        .await
        .map(Into::into)
}

async fn refresh_column_physical(
    State(state): State<ApiState>,
    Authenticated(identity): Authenticated,
    ValidatedJson(param): ValidatedJson<PhysicalColumnListParam>,
) -> Result<ApiResult<Vec<PhysicalColumnListResult>>, ApiError> {
    let op_user_id = identity.user_id;

    let (datasource_name, table_name) = permit_column_physical(&state, param, op_user_id).await?;
    PhysicalService::refresh_column(&state, datasource_name, table_name)
        .await
        .map(Into::into)
}

async fn permit_column_physical(state: &ApiState, param: PhysicalColumnListParam, op_user_id: i64) -> Result<(String, String), ApiError> {
    let (datasource_name, table_name) = if let Some(table_id) = param.table_id {
        let (table, _) = AccessService::require_table_role(&state, op_user_id, Either::Left(table_id), RoleEnum::Read).await?;

        (table.datasource_name, table.table_name)
    } else if let Some(table_name) = param.table {
        let Some(datasource_name) = param.datasource else {
            return Err(ApiError::Validation("Param datasource is required since table is passed".to_owned()));
        };
        let (table, _) = AccessService::require_table_role(&state, op_user_id, Either::Right((datasource_name, table_name)), RoleEnum::Read).await?;

        (table.datasource_name, table.table_name)
    } else {
        return Err(ApiError::Validation("Param table_id or table is required".to_owned()));
    };
    Ok((datasource_name, table_name))
}