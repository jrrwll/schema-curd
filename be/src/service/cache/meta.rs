use std::sync::Arc;

use anyhow::bail;
use chrono::Duration;

use crate::{api::{PhysicalColumnListResult, PhysicalTableListResult}, infra::store::KvStore};

const KEY_PREFIX: &str = "meta:";
const TTL_SECONDS: u64 = Duration::days(3).num_seconds() as u64;

pub struct MetaCacheService;

impl MetaCacheService {
    pub async fn save_tables(
        kv_store: Arc<dyn KvStore>,
        datasource_name: &str,
        tables: &Vec<PhysicalTableListResult>,
    ) -> anyhow::Result<()> {
        let key = format!("{KEY_PREFIX}{datasource_name}");
        let value = serde_json::to_vec(tables)?;
        if !kv_store.set(key, value, TTL_SECONDS).await? {
            bail!("Save meta tables failed");
        }
        Ok(())
    }

    pub async fn get_tables(
        kv_store: Arc<dyn KvStore>,
        datasource_name: &str,
    ) -> anyhow::Result<Option<Vec<PhysicalTableListResult>>> {
        let key = format!("{KEY_PREFIX}{datasource_name}");

        let Some(value) = kv_store.get(key.clone()).await? else {
            return Ok(None);
        };
        let result = serde_json::from_slice(&value)?;
        Ok(result)
    }

    pub async fn save_columns(
        kv_store: Arc<dyn KvStore>,
        datasource_name: &str,
        table_name: &str,
        columns: &Vec<PhysicalColumnListResult>,
    ) -> anyhow::Result<()> {
        let key = format!("{KEY_PREFIX}{datasource_name}:{table_name}");
        let value = serde_json::to_vec(columns)?;
        if !kv_store.set(key, value, TTL_SECONDS).await? {
            bail!("Save meta columns failed");
        }
        Ok(())
    }

    pub async fn get_columns(
        kv_store: Arc<dyn KvStore>,
        datasource_name: &str,
        table_name: &str,
    ) -> anyhow::Result<Option<Vec<PhysicalColumnListResult>>> {
        let key = format!("{KEY_PREFIX}{datasource_name}:{table_name}");

        let Some(value) = kv_store.get(key.clone()).await? else {
            return Ok(None);
        };
        let result = serde_json::from_slice(&value)?;
        Ok(result)
    }
}
