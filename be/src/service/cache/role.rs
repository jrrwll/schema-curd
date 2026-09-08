use std::{collections::HashMap, sync::Arc};

use anyhow::bail;
use chrono::Duration;

use crate::{infra::store::KvStore, model::embed::RoleEnum};

const KEY_PREFIX: &str = "role:";
const TTL_SECONDS: u64 = Duration::minutes(3).num_seconds() as u64;

pub struct RoleCacheService;

impl RoleCacheService {

    // datasource_info.id -> role
    pub async fn save_datasource_roles(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
        roles: &HashMap<i64, RoleEnum>,
    ) -> anyhow::Result<()> {
        let key = format!("{KEY_PREFIX}{user_id}:datasource");
        let value = serde_json::to_vec(roles)?;
        if !kv_store.set(key, value, TTL_SECONDS).await? {
            bail!("Save role failed");
        }
        Ok(())
    }

    pub async fn get_datasource_roles(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
    ) -> anyhow::Result<Option<HashMap<i64, RoleEnum>>> {
        let key = format!("{KEY_PREFIX}{user_id}:datasource");

        let Some(value) = kv_store.get(key.clone()).await? else {
            return Ok(None);
        };
        let result = serde_json::from_slice(&value)?;
        Ok(Some(result))
    }

    pub async fn remove_datasource_roles(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
    ) -> anyhow::Result<()> {
        let key = format!("{KEY_PREFIX}{user_id}:datasource");
        kv_store.delete(key).await
    }

    // table_info.id -> role
    pub async fn save_table_roles(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
        datasource_name: &str,
        roles: &HashMap<i64, RoleEnum>,
    ) -> anyhow::Result<()> {
        let key = format!("{KEY_PREFIX}{user_id}:table:{datasource_name}");

        let value = serde_json::to_vec(roles)?;
        if !kv_store.set(key, value, TTL_SECONDS).await? {
            bail!("Save role failed");
        }
        Ok(())
    }

    pub async fn get_table_roles(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
        datasource_name: &str,
    ) -> anyhow::Result<Option<HashMap<i64, RoleEnum>>> {
        let key = format!("{KEY_PREFIX}{user_id}:table:{datasource_name}");

        let Some(value) = kv_store.get(key.clone()).await? else {
            return Ok(None);
        };
        let result = serde_json::from_slice(&value)?;
        Ok(Some(result))
    }

    pub async fn remove_table_roles(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
        datasource_name: &str,
    ) -> anyhow::Result<()> {
        let key = format!("{KEY_PREFIX}{user_id}:table:{datasource_name}");
        kv_store.delete(key).await
    }
}
