mod build;
mod mysql;

use anyhow::Context;
use serde_json::Value;
use sqlx::{MySql, Postgres, mysql::MySqlRow, types::Json};

use crate::{
    model::{BindValue, EntityListPlan},
    repo::{RuntimePool, RuntimeTableConfig},
};

use build::*;
use mysql::mysql_row_to_value;

pub struct EntityRepo<'a> {
    pool: &'a RuntimePool,
    table: &'a RuntimeTableConfig,
}

impl<'a> EntityRepo<'a> {
    pub fn new(pool: &'a RuntimePool, table: &'a RuntimeTableConfig) -> Self {
        Self { pool, table }
    }

    pub async fn create(&self, values: Vec<(String, BindValue)>) -> anyhow::Result<()> {
        match self.pool {
            RuntimePool::MySql(pool) => {
                build_create_query::<MySql>(&self.table.table_name, values, '`')
                    .build()
                    .execute(pool)
                    .await
                    .context("Failed to create mysql database record")?;
            }
            RuntimePool::Postgres(pool) => {
                build_create_query::<Postgres>(&self.table.table_name, values, '"')
                    .build()
                    .execute(pool)
                    .await
                    .context("Failed to create postgres database record")?;
            }
        }
        Ok(())
    }

    pub async fn update(
        &self,
        values: Vec<(String, BindValue)>,
        where_values: Vec<(String, BindValue)>,
    ) -> anyhow::Result<u64> {
        let affected = match self.pool {
            RuntimePool::MySql(pool) => {
                build_update_query::<MySql>(&self.table.table_name, values, where_values, '`')
                    .build()
                    .execute(pool)
                    .await
                    .context("Failed to update mysql database record")?
                    .rows_affected()
            }
            RuntimePool::Postgres(pool) => {
                build_update_query::<Postgres>(&self.table.table_name, values, where_values, '"')
                    .build()
                    .execute(pool)
                    .await
                    .context("Failed to update postgres database record")?
                    .rows_affected()
            }
        };
        Ok(affected)
    }

    pub async fn list(&self, plan: EntityListPlan) -> anyhow::Result<(u64, Vec<Value>)> {
        match self.pool {
            RuntimePool::MySql(pool) => {
                let (mut count, mut query) =
                    build_list_queries::<MySql>(self.table, plan, '`', None, false)?;
                let total: i64 = count
                    .build_query_scalar()
                    .fetch_one(pool)
                    .await
                    .context("Failed to query mysql record count")?;
                let rows: Vec<MySqlRow> = query
                    .build()
                    .fetch_all(pool)
                    .await
                    .context("Failed to query mysql records")?;
                let items = rows
                    .iter()
                    .map(|row| mysql_row_to_value(row, &self.table.columns))
                    .collect::<anyhow::Result<Vec<_>>>()?;
                Ok((total.max(0) as u64, items))
            }
            RuntimePool::Postgres(pool) => {
                let (mut count, mut query) = build_list_queries::<Postgres>(
                    self.table,
                    plan,
                    '"',
                    Some("jsonb_build_object"),
                    true,
                )?;
                let total: i64 = count
                    .build_query_scalar()
                    .fetch_one(pool)
                    .await
                    .context("Failed to query postgres record count")?;
                let items: Vec<Json<Value>> = query
                    .build_query_scalar()
                    .fetch_all(pool)
                    .await
                    .context("Failed to query postgres records")?;
                Ok((
                    total.max(0) as u64,
                    items.into_iter().map(|item| item.0).collect(),
                ))
            }
        }
    }
}
