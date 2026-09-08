mod logged;
mod kevy;
mod redis;

use std::sync::Arc;

use anyhow::{Result, bail};
use async_trait::async_trait;
use tracing::error;

use logged::LoggedKvStore;
use kevy::KevyKvStore;
use redis::RedisKvStore;

#[async_trait]
pub trait KvStore: Send + Sync {
    async fn get(&self, key: String) -> Result<Option<Vec<u8>>>;

    async fn set(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool>;

    async fn set_if_absent(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool>;

    async fn move_if_value(
        &self,
        source_key: String,
        expected_value: Vec<u8>,
        destination_key: String,
        destination_value: Vec<u8>,
        ttl_seconds: u64,
    ) -> Result<bool>;

    async fn delete(&self, key: String) -> Result<()>;

    async fn delete_prefix(&self, prefix: String) -> Result<()>;

    async fn increment_below(&self, key: String, limit: u64, ttl_seconds: u64) -> Result<bool>;
}

pub async fn open_kv_store(url: Option<&str>) -> Result<Arc<dyn KvStore>> {
    match url {
        None => {
            let store = KevyKvStore::open().map_err(|source| {
                error!(backend = "kevy-embedded", error = ?source, "failed to initialize KV store");
                source
            })?;
            tracing::info!("Initialized embedded kevy KV store");
            Ok(Arc::new(LoggedKvStore::new(
                "kevy-embedded",
                Arc::new(store),
            )))
        }
        Some("") => bail!("KV_STORE_URL must not be empty"),
        Some(url) if url.starts_with("redis://") => {
            let store = RedisKvStore::open(url).await.map_err(|source| {
                error!(backend = "redis/kevy-server", error = ?source, "failed to initialize KV store");
                source
            })?;
            tracing::info!("Initialized Redis protocol KV store");
            Ok(Arc::new(LoggedKvStore::new(
                "redis/kevy-server",
                Arc::new(store),
            )))
        }
        Some(_) => bail!("KV_STORE_URL must use the redis:// scheme"),
    }
}
