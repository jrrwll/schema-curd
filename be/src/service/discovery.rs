use corers::axum::ApiError;

use crate::{
    api::*, common::state::ApiState, model::embed::RoleEnum, repo::DiscoveryRepo, service::AccessService, util::Either,
};

pub struct DiscoveryService;

impl DiscoveryService {
    pub async fn list_datasources(
        state: &ApiState, param: DiscoveryDatasourceListParam, op_user_id: i64,
    ) -> Result<Vec<DiscoveryDatasourceTableListResult>, ApiError> {
        let user = AccessService::verify_user(state, op_user_id).await?;
        if user.super_admin {
            if let Some(datasource_id) = param.datasource_id {
                let datasource = AccessService::verify_datasource(state, Either::Left(datasource_id)).await?;
                return Ok(vec![DiscoveryDatasourceTableListResult {
                    id: datasource.id,
                    name: datasource.name,
                    display_name: datasource.display_name,
                }]);
            }

            return DiscoveryRepo::list_all_datasources(&state.pool, param)
                .await
                .map_err(ApiError::unknown)
                .map(|v| v.into_iter().map(Into::into).collect());
        }

        if let Some(datasource_id) = param.datasource_id {
            let datasource = AccessService::verify_datasource(state, Either::Left(datasource_id)).await?;
            AccessService::permit_table_list(state, op_user_id, datasource.name.clone()).await?;
            return Ok(vec![DiscoveryDatasourceTableListResult {
                id: datasource.id,
                name: datasource.name,
                display_name: datasource.display_name,
            }]);
        }

        DiscoveryRepo::list_datasources(&state.pool, param, op_user_id)
            .await
            .map_err(ApiError::unknown)
            .map(|v| v.into_iter().map(Into::into).collect())
    }

    pub async fn list_tables(
        state: &ApiState, param: DiscoveryTableListParam, op_user_id: i64,
    ) -> Result<Vec<DiscoveryDatasourceTableListResult>, ApiError> {
        let user = AccessService::verify_user(state, op_user_id).await?;
        if user.super_admin {
            if let Some(table_id) = param.table_id {
                let table = AccessService::verify_table(state, Either::Left(table_id)).await?;
                return Ok(vec![DiscoveryDatasourceTableListResult {
                    id: table.id,
                    name: table.name,
                    display_name: table.display_name,
                }]);
            }
            let Some(datasource_id) = param.datasource_id else {
                return Err(ApiError::Validation("datasource_id is required".to_owned()));
            };
            let datasource = AccessService::verify_datasource(state, Either::Left(datasource_id)).await?;
            return DiscoveryRepo::list_all_tables(&state.pool, datasource.name, param)
                .await
                .map_err(ApiError::unknown)
                .map(|v| v.into_iter().map(Into::into).collect());
        }

        if let Some(table_id) = param.table_id {
            let (table, _) =
                AccessService::require_table_role(state, op_user_id, Either::Left(table_id), RoleEnum::Read).await?;
            return Ok(vec![DiscoveryDatasourceTableListResult {
                id: table.id,
                name: table.name,
                display_name: table.display_name,
            }]);
        }

        let Some(datasource_id) = param.datasource_id else {
            return Err(ApiError::Validation("datasource_id is required".to_owned()));
        };
        let datasource = AccessService::verify_datasource(state, Either::Left(datasource_id)).await?;
        if AccessService::has_datasource_role(state, op_user_id, datasource_id, RoleEnum::Read).await? {
            return DiscoveryRepo::list_all_tables(&state.pool, datasource.name, param)
                .await
                .map_err(ApiError::unknown)
                .map(|v| v.into_iter().map(Into::into).collect());
        }
        DiscoveryRepo::list_tables(&state.pool, datasource.name, param, op_user_id)
            .await
            .map_err(ApiError::unknown)
            .map(|v| v.into_iter().map(Into::into).collect())
    }
}
