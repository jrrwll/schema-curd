use std::{collections::HashMap, sync::Arc};

use corers::axum::ApiError;

use crate::{
    common::{db::DbPool, state::ApiState},
    model::MetaTable,
    repo::{MetaRepo, RuntimeDatasourceConfig},
    util::deserialize_config,
};

pub struct MetaService;

impl MetaService {
    pub async fn load_registry_configs(
        pool: &DbPool,
    ) -> Result<HashMap<String, Arc<RuntimeDatasourceConfig>>, ApiError> {
        let (databases, tables) = MetaRepo::load_all_datasources(pool).await.map_err(ApiError::unknown)?;

        let mut table_map: HashMap<String, Vec<MetaTable>> = HashMap::new();
        for table in tables {
            table_map.entry(table.datasource_name.clone()).or_default().push(table);
        }

        let mut configs: HashMap<String, Arc<RuntimeDatasourceConfig>> = HashMap::with_capacity(databases.len());
        for database in databases {
            let config = RuntimeDatasourceConfig {
                url: database.url,
                username: database.username,
                password: database.password,
                config: deserialize_config(database.config)?,
            };
            configs.insert(database.name.clone(), Arc::new(config));
        }
        Ok(configs)
    }

    pub async fn reload_registry(state: &ApiState) -> Result<(), ApiError> {
        let configs = Self::load_registry_configs(&state.pool).await?;
        state.registry.reset_configs(configs).await;
        Ok(())
    }
}
