use crate::get_api_state;
use rexl::argparse::FromArgs;
use schema_curd::infra::db::DbPool;
use schema_curd::model::embed::{ColumnConfig, DatasourceConfig, TableConfig};
use schema_curd::util::deserialize_config;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufWriter;
use std::process;

#[derive(Debug, Serialize, FromArgs)]
pub struct DatasourceBackupCli {
    pub help: bool,
    #[arg_parser(position = 0)]
    pub output_path: Option<String>,
}

impl DatasourceBackupCli {
    pub async fn run_async(self) {
        let output_path = match self.output_path {
            Some(v) => v,
            None => "schema-curd.json".to_owned(),
        };

        let state = get_api_state();

        let datasources = match DatasourceRecord::query_all(&state.pool).await {
            Ok(datasources) => datasources,
            Err(e) => {
                eprintln!("query datasource failed: {}", e);
                process::exit(1)
            }
        };

        let mut results: Vec<DatasourceBackupRecord> = Vec::with_capacity(datasources.len());
        let mut table_cnt = 0;
        for datasource in datasources {
            let datasource_config: DatasourceConfig = match deserialize_config(datasource.config) {
                Ok(config) => config,
                Err(e) => {
                    eprintln!("deserialize datasource config failed: {}", e);
                    process::exit(1)
                }
            };

            let tables = match TableRecord::query_all(&state.pool, datasource.name.clone()).await {
                Ok(tables) => tables,
                Err(e) => {
                    eprintln!("query table failed: {}", e);
                    process::exit(1)
                }
            };
            table_cnt += tables.len();

            let tables = tables
                .into_iter()
                .map(|table| {
                    let config: TableConfig = match deserialize_config(table.table_config) {
                        Ok(config) => config,
                        Err(e) => {
                            eprintln!("deserialize table table_config failed: {}", e);
                            process::exit(1)
                        }
                    };
                    let columns: Vec<ColumnConfig> = match deserialize_config(table.columns_config) {
                        Ok(config) => config,
                        Err(e) => {
                            eprintln!("deserialize table columns_config failed: {}", e);
                            process::exit(1)
                        }
                    };
                    TableBackupRecord {
                        name: table.name,
                        display_name: table.display_name,
                        table_name: table.table_name,
                        config,
                        columns,
                    }
                })
                .collect();
            results.push(DatasourceBackupRecord {
                name: datasource.name,
                display_name: datasource.display_name,
                url: datasource.url,
                username: datasource.username,
                password: datasource.password,
                config: datasource_config,
                tables,
            });
        }

        let file = match File::create(output_path) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("failed to create output file: {}", e);
                process::exit(1)
            }
        };
        let mut writer = BufWriter::new(file);
        if let Err(e) = serde_json::to_writer_pretty(&mut writer, &results) {
            eprintln!("failed to serialize results: {}", e);
            process::exit(1)
        };

        println!("success to backup total {} datasources and {} tables", results.len(), table_cnt);
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatasourceBackupRecord {
    pub name: String,
    pub display_name: String,
    pub url: String,
    pub username: String,
    pub password: String,
    pub config: DatasourceConfig,
    pub tables: Vec<TableBackupRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableBackupRecord {
    pub name: String,
    pub display_name: String,
    pub table_name: String,
    pub config: TableConfig,
    pub columns: Vec<ColumnConfig>,
}

#[derive(Debug, sqlx::FromRow)]
struct DatasourceRecord {
    name: String,
    display_name: String,
    url: String,
    username: String,
    password: String,
    config: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct TableRecord {
    name: String,
    display_name: String,
    table_name: String,
    table_config: Option<String>,
    columns_config: Option<String>,
}

impl DatasourceRecord {
    async fn query_all(pool: &DbPool) -> Result<Vec<DatasourceRecord>, String> {
        sqlx::query_as!(
            DatasourceRecord,
            "
            select name, display_name, url, username, password, config
            from datasource_info
            where disabled = 0 and deleted_at = 0
            "
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
    }
}

impl TableRecord {
    async fn query_all(pool: &DbPool, datasource_name: String) -> Result<Vec<TableRecord>, String> {
        sqlx::query_as!(
            TableRecord,
            "
            select name, display_name, table_name, table_config, columns_config
            from table_info
            where disabled = 0 and deleted_at = 0
                and datasource_name = ?
            ",
            datasource_name
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
    }
}
