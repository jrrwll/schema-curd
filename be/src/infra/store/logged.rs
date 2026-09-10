use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use tracing::error;

use super::KvStore;

pub(super) struct LoggedKvStore {
    backend: &'static str,
    inner: Arc<dyn KvStore>,
}

impl LoggedKvStore {
    pub fn new(backend: &'static str, inner: Arc<dyn KvStore>) -> Self {
        Self { backend, inner }
    }

    fn log_error<T>(&self, operation: &'static str, result: &anyhow::Result<T>) {
        if let Err(source) = result {
            error!(
                backend = self.backend,
                operation,
                error = ?source,
                "third-party KV service operation failed"
            );
        }
    }
}

#[async_trait]
impl KvStore for LoggedKvStore {
    async fn get(&self, key: String) -> Result<Option<Vec<u8>>> {
        let result = self.inner.get(key).await;
        self.log_error("get", &result);
        result
    }

    async fn set(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool> {
        let result = self.inner.set(key, value, ttl_seconds).await;
        self.log_error("set_if_absent", &result);
        result
    }

    async fn set_if_absent(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool> {
        let result = self.inner.set_if_absent(key, value, ttl_seconds).await;
        self.log_error("set_if_absent", &result);
        result
    }

    async fn move_if_value(
        &self, source_key: String, expected_value: Vec<u8>, destination_key: String, destination_value: Vec<u8>,
        ttl_seconds: u64,
    ) -> Result<bool> {
        let result = self
            .inner
            .move_if_value(source_key, expected_value, destination_key, destination_value, ttl_seconds)
            .await;
        self.log_error("move_if_value", &result);
        result
    }

    async fn delete(&self, key: String) -> Result<()> {
        let result = self.inner.delete(key).await;
        self.log_error("delete", &result);
        result
    }

    async fn delete_prefix(&self, prefix: String) -> Result<()> {
        let result = self.inner.delete_prefix(prefix).await;
        self.log_error("delete_prefix", &result);
        result
    }

    async fn increment_below(&self, key: String, limit: u64, ttl_seconds: u64) -> Result<bool> {
        let result = self.inner.increment_below(key, limit, ttl_seconds).await;
        self.log_error("increment_below", &result);
        result
    }
}
