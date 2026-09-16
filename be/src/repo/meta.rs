use anyhow::Context;

use crate::{
    infra::db::DbPool,
    model::MetaDatasource,
};

pub struct MetaRepo;

impl MetaRepo {
    pub async fn load_all_datasource(pool: &DbPool) -> anyhow::Result<Vec<MetaDatasource>> {
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

        Ok(databases)
    }
}
