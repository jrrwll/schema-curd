use anyhow::Context;

use crate::{
    common::db::DbPool,
    model::{MetaDatasource, MetaTable},
};

pub struct MetaRepo;

impl MetaRepo {
    pub async fn load_all_datasources(pool: &DbPool) -> Result<(Vec<MetaDatasource>, Vec<MetaTable>), anyhow::Error> {
        let databases = sqlx::query_as!(
            MetaDatasource,
            "
            select id, name, url, username, password, config
            from datasource_info
            where deleted_at = 0 and disabled = 0
            order by id
            "
        )
        .fetch_all(pool)
        .await
        .context("Failed to query datasource info")?;

        let tables = sqlx::query_as!(
            MetaTable,
            "
            select id, name, datasource_name, table_name, table_config, columns_config
            from table_info
            where deleted_at = 0 and disabled = 0
            order by id
            "
        )
        .fetch_all(pool)
        .await
        .context("Failed to query table info")?;

        Ok((databases, tables))
    }
}
