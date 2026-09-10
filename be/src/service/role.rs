use std::collections::{HashMap, HashSet};

use anyhow::Context;
use corers::{api::PageResult, axum::ApiError};

use crate::common::error::ErrorCode;
use crate::model::{CreateUserRole, RoleEntity, UserEntity};
use crate::repo::UserRepo;
use crate::service::{AccessService, RoleCacheService};
use crate::util::{Either, format_datetime};
use crate::{api::*, common::state::ApiState, repo::RoleRepo};

pub struct RoleService;

impl RoleService {
    pub async fn list(state: &ApiState, param: RoleListParam) -> Result<PageResult<RoleListResult>, ApiError> {
        let (total, items) = RoleRepo::list(&state.pool, param).await.map_err(ApiError::unknown)?;
        if items.is_empty() {
            return Ok((total, Vec::new()).into());
        }
        let user_ids: Vec<i64> = items.iter().map(|v| v.user_id).collect::<HashSet<_>>().into_iter().collect();
        let user_map = UserRepo::get_multi(&state.pool, user_ids).await.map_err(ApiError::unknown)?;

        let items: Vec<RoleListResult> = items
            .into_iter()
            .map(|v| convert_role_result(v, &user_map))
            .collect::<Result<_, _>>()?;
        let result = (total, items).into();
        Ok(result)
    }

    pub async fn grant(state: &ApiState, param: RoleGrantParam, op_user_id: i64) -> Result<(), ApiError> {
        let user_id = param.user_id;
        let role = param.role.to_string();
        let resource_type = param.resource_type.to_string();
        let resource_id = param.resource_id;

        let role_entity = RoleRepo::get_by_uk(&state.pool, user_id, resource_type.clone(), resource_id)
            .await
            .map_err(ApiError::unknown)?;
        if let Some(role_entity) = role_entity {
            if role_entity.role == role {
                return Ok(());
            } else {
                return Err(ErrorCode::role_cannot_grant(role_entity.id).into_error());
            }
        }

        let entity = CreateUserRole { user_id, role, resource_type, resource_id };
        RoleRepo::grant(&state.pool, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        Ok(())
    }

    pub async fn batch_grant_user(
        state: &ApiState, param: RoleBatchGrantUserParam, op_user_id: i64,
    ) -> Result<(), ApiError> {
        let resource_type = param.resource_type.to_string();
        let resource_id = param.resource_id;

        // check uk
        let items_cnt = param.items.len();
        let user_role_map: HashMap<i64, String> = param
            .items
            .into_iter()
            .map(|item| (item.user_id, item.role.to_string()))
            .collect();
        if user_role_map.len() != items_cnt {
            return Err(ApiError::Validation("duplicate role ids".to_owned()));
        }
        let user_ids = user_role_map.keys().cloned().collect::<Vec<_>>();

        let existing_user_roles = RoleRepo::get_user_ids(&state.pool, resource_type.clone(), resource_id, user_ids)
            .await
            .map_err(ApiError::unknown)?;
        let grant_items = if user_role_map.is_empty() {
            user_role_map
        } else {
            let mut grant_items = HashMap::new();
            for (user_id, role) in user_role_map {
                if let Some(existing_role) = existing_user_roles.get(&user_id) {
                    if existing_role == &role {
                        continue; // already has the role
                    }
                    return Err(ErrorCode::roles_cannot_grant.into_error());
                }
                grant_items.insert(user_id, role);
            }
            grant_items
        };

        let entities = grant_items
            .into_iter()
            .map(|(user_id, role)| CreateUserRole { user_id, role, resource_type: resource_type.clone(), resource_id })
            .collect::<Vec<_>>();
        RoleRepo::batch_grant(&state.pool, entities, op_user_id)
            .await
            .map_err(ApiError::unknown)
    }

    pub async fn batch_grant_resource(
        state: &ApiState, param: RoleBatchGrantResourceParam, op_user_id: i64,
    ) -> Result<(), ApiError> {
        let resource_type = param.resource_type.to_string();
        let user_id = param.user_id;

        let items_cnt = param.items.len();
        let resource_role_map: HashMap<i64, String> = param
            .items
            .into_iter()
            .map(|item| (item.resource_id, item.role.to_string()))
            .collect();
        if resource_role_map.len() != items_cnt {
            return Err(ApiError::Validation("duplicate resource ids".to_owned()));
        }
        let resource_ids = resource_role_map.keys().cloned().collect::<Vec<_>>();

        let existing_user_roles = RoleRepo::get_resource_ids(&state.pool, user_id, resource_type.clone(), resource_ids)
            .await
            .map_err(ApiError::unknown)?;
        let grant_items = if resource_role_map.is_empty() {
            resource_role_map
        } else {
            let mut grant_items = HashMap::new();
            for (resource_id, role) in resource_role_map {
                if let Some(existing_role) = existing_user_roles.get(&resource_id) {
                    if existing_role == &role {
                        continue; // already has the role
                    }
                    return Err(ErrorCode::roles_cannot_grant.into_error());
                }
                grant_items.insert(resource_id, role);
            }
            grant_items
        };

        let entities = grant_items
            .into_iter()
            .map(|(resource_id, role)| CreateUserRole {
                user_id,
                role,
                resource_type: resource_type.clone(),
                resource_id,
            })
            .collect::<Vec<_>>();
        RoleRepo::batch_grant(&state.pool, entities, op_user_id)
            .await
            .map_err(ApiError::unknown)
    }

    pub async fn revoke(state: &ApiState, id: i64, op_user_id: i64) -> Result<(), ApiError> {
        let role_entity = Self::get_role(state, id).await?;

        let found = RoleRepo::revoke(&state.pool, id, op_user_id).await.map_err(ApiError::unknown)?;
        if !found {
            return Err(ErrorCode::role_not_found(id).into_error());
        }
        // clear role cache
        let user_id = role_entity.user_id;
        RoleCacheService::remove_all_roles(state.kv_store.clone(), user_id).await?;
        Ok(())
    }

    pub async fn batch_revoke(state: &ApiState, ids: Vec<i64>, op_user_id: i64) -> Result<(), ApiError> {
        let users = RoleRepo::get_user_id_count(&state.pool, ids.clone())
            .await
            .map_err(ApiError::unknown)?;
        let record_cnt = users.iter().map(|(_, c)| *c).sum::<i64>() as usize;
        if record_cnt != ids.len() {
            return Err(ErrorCode::roles_not_found.into_error());
        }
        let user_ids: Vec<i64> = users.into_iter().map(|(user_id, _)| user_id).collect();

        let found = RoleRepo::batch_revoke(&state.pool, ids, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !found {
            return Err(ErrorCode::roles_not_found.into_error());
        }
        // clear role cache
        for user_id in user_ids {
            RoleCacheService::remove_all_roles(state.kv_store.clone(), user_id).await?;
        }
        Ok(())
    }

    pub async fn update(state: &ApiState, param: RoleUpdateParam, op_user_id: i64) -> Result<(), ApiError> {
        let id = param.id;
        let role = param.role.to_string();

        let role_entity = Self::get_role(state, id).await?;
        if role_entity.role == role {
            return Err(
                ErrorCode::role_already_existing(role_entity.resource_type, role_entity.resource_id).into_error()
            );
        }

        let user_id = role_entity.user_id;

        let entity = CreateUserRole {
            user_id,
            role,
            resource_type: role_entity.resource_type,
            resource_id: role_entity.resource_id,
        };
        let update_success = RoleRepo::update(&state.pool, id, entity, op_user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !update_success {
            return Err(ErrorCode::operate_failed.into_error());
        }
        Ok(())
    }

    pub async fn user_datasource_list(
        state: &ApiState, param: RoleUserListParam,
    ) -> Result<Vec<RoleUserResourceListResult>, ApiError> {
        let rows = RoleRepo::list_grantable_user_datasource(&state.pool, param)
            .await
            .map_err(ApiError::unknown)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn user_table_list(
        state: &ApiState, param: RoleUserListParam,
    ) -> Result<Vec<RoleUserResourceListResult>, ApiError> {
        let Some(datasource_name) = param.datasource_name.clone() else {
            return Err(ApiError::Validation("Param datasource_name is required".to_owned()));
        };
        let datasource = AccessService::verify_datasource(state, Either::Right(datasource_name)).await?;

        let rows = RoleRepo::list_grantable_user_table(&state.pool, datasource.name, param)
            .await
            .map_err(ApiError::unknown)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn datasource_user_list(
        state: &ApiState, param: RoleResourceListParam,
    ) -> Result<Vec<RoleUserResourceListResult>, ApiError> {
        let Some(datasource_name) = param.datasource_name.clone() else {
            return Err(ApiError::Validation("Param datasource_name is required".to_owned()));
        };
        let datasource = AccessService::verify_datasource(state, Either::Right(datasource_name)).await?;
        let rows = RoleRepo::list_grantable_datasource_user(&state.pool, datasource.id, param)
            .await
            .map_err(ApiError::unknown)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub async fn table_user_list(
        state: &ApiState, param: RoleResourceListParam,
    ) -> Result<Vec<RoleUserResourceListResult>, ApiError> {
        let Some(table_id) = param.table_id else {
            return Err(ApiError::Validation("Param table_id is required".to_owned()));
        };
        let table = AccessService::verify_table(state, Either::Left(table_id)).await?;
        let rows = RoleRepo::list_grantable_table_user(&state.pool, table.id, param)
            .await
            .map_err(ApiError::unknown)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_role(state: &ApiState, id: i64) -> Result<RoleEntity, ApiError> {
        RoleRepo::get(&state.pool, id)
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| ErrorCode::role_not_found(id).into_error())
    }
}

fn convert_role_result(entity: RoleEntity, user_map: &HashMap<i64, UserEntity>) -> Result<RoleListResult, ApiError> {
    let user_id = entity.user_id;
    Ok(RoleListResult {
        id: entity.id,
        created_at: format_datetime(entity.created_at),
        user_id,
        user_name: user_map.get(&user_id).map(|v| v.name.clone()).unwrap_or_default(),
        user_display_name: user_map.get(&user_id).map(|v| v.display_name.clone()).unwrap_or_default(),
        user_disabled: user_map.get(&user_id).map(|v| v.disabled).unwrap_or_default(),
        role: entity
            .role
            .parse()
            .with_context(|| "Invalid role: {entity.role}")
            .map_err(Into::<ApiError>::into)?,
        resource_type: entity
            .resource_type
            .parse()
            .with_context(|| "Invalid resource type: {entity.resource_type}")
            .map_err(Into::<ApiError>::into)?,
        resource_id: entity.resource_id,
    })
}
