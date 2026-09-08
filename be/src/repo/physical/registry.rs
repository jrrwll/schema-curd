use std::{collections::HashMap, sync::Arc, time::Duration};

use anyhow::Context;
use moka::future::Cache;
use tokio::sync::RwLock;

use crate::repo::RuntimePool;

pub struct RuntimeDatasourceConfig {
    pub url: String,
    pub username: String,
    pub password: String,
}

pub struct RuntimeDatasource {
    pub config: Arc<RuntimeDatasourceConfig>,
    pub pool: RuntimePool,
}

pub struct PhysicalRegistry {
    pub configs: RwLock<HashMap<String, Arc<RuntimeDatasourceConfig>>>,
    pub pools: Cache<String, Arc<RuntimeDatasource>>,
}

impl PhysicalRegistry {
    pub fn new(configs: HashMap<String, Arc<RuntimeDatasourceConfig>>) -> Self {
        let pools = Cache::builder()
            .max_capacity(100)
            .time_to_idle(Duration::from_secs(30 * 60))
            .build();
        Self {
            configs: RwLock::new(configs),
            pools,
        }
    }

    pub async fn reset_configs(&self, new_configs: HashMap<String, Arc<RuntimeDatasourceConfig>>) {
        let mut configs = self.configs.write().await;
        *configs = new_configs;
        self.pools.invalidate_all();
    }

    pub async fn get(
        &self,
        datasource_name: String,
    ) -> anyhow::Result<Option<Arc<RuntimeDatasource>>> {
        let config = {
            let configs = self.configs.read().await;
            configs.get(&datasource_name).cloned()
        };
        // read lock releases here
        let Some(config) = config else {
            return Ok(None);
        };

        let runtime = self
            .pools
            .try_get_with(datasource_name.clone(), async move {
                let pool =
                    RuntimePool::connect_lazy(&config.url, &config.username, &config.password)?;
                Ok::<Arc<RuntimeDatasource>, anyhow::Error>(Arc::new(RuntimeDatasource {
                    config,
                    pool,
                }))
            })
            .await
            .map_err(|e| anyhow::anyhow!("{e:#}"))
            .with_context(|| format!("Failed to initialize datasource: {datasource_name}"))?;
        Ok(Some(runtime))
    }
}
