use std::{collections::HashMap, sync::Arc};

use corers::axum::ApiError;

use crate::{
    common::{db::DbPool, state::ApiState},
    model::{MetaTable, embed::ColumnConfig},
    repo::{MetaRepo, RuntimeDatasourceConfig, RuntimeDatasourceDetailConfig, RuntimeTableConfig},
    util::deserialize_config,
};

pub struct MetaService;

impl MetaService {
    pub async fn load_registry_configs(
        pool: &DbPool,
    ) -> Result<HashMap<String, Arc<RuntimeDatasourceDetailConfig>>, ApiError> {
        let (databases, tables) = MetaRepo::load_all_datasources(pool)
            .await
            .map_err(ApiError::unknown)?;

        let mut table_map: HashMap<String, Vec<MetaTable>> = HashMap::new();
        for table in tables {
            table_map
                .entry(table.datasource_name.clone())
                .or_default()
                .push(table);
        }

        let mut configs: HashMap<String, Arc<RuntimeDatasourceDetailConfig>> =
            HashMap::with_capacity(databases.len());
        for database in databases {
            let tables = table_map.get(&database.name).cloned().unwrap_or_default();

            let tables: HashMap<String, RuntimeTableConfig> = tables
                .into_iter()
                .map(convert_meta_table)
                .collect::<Result<_, _>>()?;

            let datasource_config = RuntimeDatasourceConfig {
                url: database.url,
                username: database.username,
                password: database.password,
                config: deserialize_config(database.config)?,
            };
            let config = RuntimeDatasourceDetailConfig {
                datasource: datasource_config,
                tables,
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

fn convert_meta_table(table: MetaTable) -> Result<(String, RuntimeTableConfig), ApiError> {
    let columns_config: Vec<ColumnConfig> = deserialize_config(table.columns_config)?;
    let columns = columns_config
        .into_iter()
        .map(|v| (v.name.clone(), v))
        .collect();

    Ok((
        table.table_name.clone(),
        RuntimeTableConfig {
            table_name: table.table_name,
            table_config: deserialize_config(table.table_config)?,
            columns,
        },
    ))
}
