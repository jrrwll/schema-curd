use std::collections::HashSet;
use std::fs::File;
use std::io::BufReader;
use std::process;

use super::DatasourceBackupRecord;
use crate::get_api_state;
use rexl::argparse::FromArgs;
use schema_curd::common::db::DbPool;
use schema_curd::model::CreateTable;
use schema_curd::util::serialize_config;
use serde::Serialize;
use sqlx::QueryBuilder;

#[derive(Debug, Serialize, FromArgs)]
pub struct DatasourceRestoreCli {
    pub help: bool,
    #[arg_parser(position = 0)]
    pub input_path: String,
}

impl DatasourceRestoreCli {
    pub async fn run_async(self) {
        let file = match File::open(&self.input_path) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("failed to open file {}: {}", &self.input_path, e);
                process::exit(1)
            }
        };
        let reader = BufReader::new(file);
        let datasources: Vec<DatasourceBackupRecord> = match serde_json::from_reader(reader) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("failed to parse file {}: {}", &self.input_path, e);
                process::exit(1)
            }
        };
        if datasources.is_empty() {
            println!("no datasource to restore");
            return;
        }

        let state = get_api_state();
        let datasource_names = datasources
            .iter()
            .map(|v| v.name.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect::<Vec<String>>();
        match select_exist_names(&state.pool, datasource_names).await {
            Ok(exist_names) => {
                if !exist_names.is_empty() {
                    eprintln!("already existing datasource: {}", exist_names.join(", "));
                    process::exit(1)
                }
            }
            Err(e) => {
                eprintln!("failed to select exist datasource names: {}", e);
                process::exit(1)
            }
        }

        if let Err(e) = restore_all(&state.pool, datasources).await {
            eprintln!("failed to restore datasource: {}", e);
            process::exit(1)
        }

        println!("success to restore datasource: {:?}", "");
    }
}

async fn select_exist_names(pool: &DbPool, names: Vec<String>) -> Result<Vec<String>, String> {
    let mut query_builder = QueryBuilder::new(
        "
        select name
        from datasource_info
        where deleted_at = 0
            and name in (
        ",
    );
    let mut separated = query_builder.separated(", ");
    for name in &names {
        separated.push_bind(name);
    }
    query_builder.push(")");
    query_builder
        .build_query_scalar()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
}

async fn restore_all(pool: &DbPool, datasources: Vec<DatasourceBackupRecord>) -> Result<(), String> {
    let mut transaction = match pool.begin().await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("failed to begin transaction: {}", e);
            process::exit(1)
        }
    };
    for datasource in datasources {
        let datasource_name = datasource.name.clone();
        let config = serialize_config(&datasource.config).map_err(|e| e.to_string())?;
        let rows_affected = sqlx::query!(
            "
                insert into datasource_info
                    (name, display_name, url, username, password, config)
                values (?, ?, ?, ?, ?, ?)
                ",
            datasource.name,
            datasource.display_name,
            datasource.url,
            datasource.username,
            datasource.password,
            config
        )
        .execute(&mut *transaction)
        .await
        .map(|v| v.rows_affected())
        .map_err(|e| e.to_string())?;
        if rows_affected == 0 {
            transaction.rollback().await.map_err(|e| e.to_string())?;
            return Err(format!("failed to insert datasource: {}", datasource.name));
        }

        let tables = datasource
            .tables
            .into_iter()
            .map(|table| {
                let table_config = serialize_config(&table.config).map_err(|e| e.to_string())?;
                let columns_config = serialize_config(&table.columns).map_err(|e| e.to_string())?;
                Ok(CreateTable {
                    datasource_name: datasource_name.clone(),
                    name: table.name,
                    display_name: table.display_name,
                    table_name: table.table_name,
                    table_config,
                    columns_config,
                })
            })
            .collect::<Result<Vec<CreateTable>, String>>()?;
        let table_cnt = tables.len() as u64;

        let mut table_query_builder = QueryBuilder::new(
            "
            insert into table_info (datasource_name, name, display_name, table_name, table_config, columns_config)
            ",
        );
        table_query_builder.push_values(tables, |mut build, entity| {
            build
                .push_bind(entity.datasource_name)
                .push_bind(entity.name)
                .push_bind(entity.display_name)
                .push_bind(entity.table_name)
                .push_bind(entity.table_config)
                .push_bind(entity.columns_config);
        });
        let rows_affected = table_query_builder
            .build()
            .execute(&mut *transaction)
            .await
            .map(|v| v.rows_affected())
            .map_err(|e| e.to_string())?;
        if rows_affected != table_cnt {
            transaction.rollback().await.map_err(|e| e.to_string())?;
            return Err(format!(
                "failed to insert table, since expect rows_affected = {} but got {}",
                table_cnt, rows_affected
            ));
        }
    }
    Ok(())
}
