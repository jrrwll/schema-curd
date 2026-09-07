use std::time::Duration;

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use kevy_embedded::{Config, Store};

use super::KvStore;

pub(super) struct KevyKvStore {
    store: Store,
}

impl KevyKvStore {
    pub(super) fn open() -> Result<Self> {
        Ok(Self {
            store: Store::open(Config::default())?,
        })
    }
}

#[async_trait]
impl KvStore for KevyKvStore {
    async fn get(&self, key: String) -> Result<Option<Vec<u8>>> {
        Ok(self.store.get(key.as_bytes())?)
    }

    async fn set(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool> {
        let ttl = Duration::from_secs(ttl_seconds);
        Ok(self
            .store
            .with(|store| store.set(key.as_bytes(), value, Some(ttl), false, false)))
    }

    async fn set_if_absent(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool> {
        let ttl = Duration::from_secs(ttl_seconds);
        Ok(self
            .store
            .with(|store| store.set(key.as_bytes(), value, Some(ttl), true, false)))
    }

    async fn move_if_value(
        &self,
        source_key: String,
        expected_value: Vec<u8>,
        destination_key: String,
        destination_value: Vec<u8>,
        ttl_seconds: u64,
    ) -> Result<bool> {
        self.store.with(|store| {
            let source = store
                .get(source_key.as_bytes())
                .map_err(kevy_store_error)?
                .map(|value| value.into_owned());
            let destination_exists = store.exists(&[destination_key.as_bytes()]) > 0;
            if source.as_deref() != Some(expected_value.as_slice()) || destination_exists {
                return Ok(false);
            }

            store.del(&[source_key.as_bytes()]);
            store.set(
                destination_key.as_bytes(),
                destination_value,
                Some(Duration::from_secs(ttl_seconds)),
                false,
                false,
            );
            Ok(true)
        })
    }

    async fn delete_prefix(&self, prefix: String) -> Result<()> {
        self.store.with(|store| {
            let keys = store
                .collect_keys(None, None)
                .into_iter()
                .filter(|key| key.starts_with(prefix.as_bytes()))
                .collect::<Vec<_>>();
            let keys = keys.iter().map(Vec::as_slice).collect::<Vec<_>>();
            store.del(&keys);
        });
        Ok(())
    }

    async fn increment_below(&self, key: String, limit: u64, ttl_seconds: u64) -> Result<bool> {
        self.store.with(|store| {
            let current = store
                .get(key.as_bytes())
                .map_err(kevy_store_error)?
                .map(|value| {
                    std::str::from_utf8(&value)
                        .context("Stored KV counter is not valid UTF-8")?
                        .parse::<u64>()
                        .context("Stored KV counter is not an unsigned integer")
                })
                .transpose()?
                .unwrap_or(0);
            if current >= limit {
                return Ok(false);
            }

            let next = store.incr_by(key.as_bytes(), 1).map_err(kevy_store_error)?;
            if next == 1 {
                store.expire(key.as_bytes(), Duration::from_secs(ttl_seconds));
            }
            Ok(true)
        })
    }
}

fn kevy_store_error(error: impl std::fmt::Debug) -> anyhow::Error {
    anyhow!("Kevy store operation failed: {error:?}")
}
