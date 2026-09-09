use std::sync::Arc;

use crate::common::db::{DbPool, connect_database};
use crate::repo::PhysicalRegistry;
use crate::service::MetaService;
use crate::{
    common::config::AppConfig,
    infra::store::{KvStore, open_kv_store},
};

#[derive(Clone)]
pub struct ApiState {
    pub config: Arc<AppConfig>,
    pub pool: Arc<DbPool>,
    pub kv_store: Arc<dyn KvStore>,
    pub registry: Arc<PhysicalRegistry>,
}

impl ApiState {
    pub async fn new(config: AppConfig) -> anyhow::Result<Self> {
        let pool = connect_database(&config.database_url).await?;
        let kv_store = open_kv_store(config.kv_store_url.as_deref()).await?;
        let registry_configs = MetaService::load_registry_configs(&pool).await?;

        Ok(Self {
            config: Arc::new(config),
            pool: Arc::new(pool),
            kv_store,
            registry: Arc::new(PhysicalRegistry::new(registry_configs)),
        })
    }
}
