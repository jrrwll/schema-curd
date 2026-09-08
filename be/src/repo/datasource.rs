use std::collections::HashMap;

use chrono::Utc;
use sqlx::QueryBuilder;

use crate::{
    api::DatasourceListParam,
    common::db::DbPool,
    model::{CreateDatasource, DatasourceEntity, UpdateDatasource},
};

pub struct DatasourceRepo;

impl DatasourceRepo {
    pub async fn get(pool: &DbPool, id: i64) -> Result<Option<DatasourceEntity>, sqlx::Error> {
        sqlx::query_as!(
            DatasourceEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , name, display_name, disabled as `disabled: _`, url, username, password, config
            from datasource_info
            where id = ? and deleted_at = 0
            ",
            id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn get_by_name(pool: &DbPool, datasource_name: String) -> Result<Option<DatasourceEntity>, sqlx::Error> {
        sqlx::query_as!(
            DatasourceEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , name, display_name, disabled as `disabled: _`, url, username, password, config
            from datasource_info
            where name = ? and deleted_at = 0
            ",
            datasource_name
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn get_multi(pool: &DbPool, ids: Vec<i64>, names: Vec<String>) -> Result<HashMap<String, DatasourceEntity>, sqlx::Error> {
        if ids.is_empty() && names.is_empty() {
            return Ok(HashMap::new());
        }
        let mut query_builder = QueryBuilder::new(
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , name, display_name, disabled as `disabled: _`, url, username, password, config
            from datasource_info
            where deleted_at = 0
            "
        );
        if !ids.is_empty() {
            query_builder.push(" and id in (");
            let mut separated = query_builder.separated(", ");
            for id in &ids {
                separated.push_bind(*id);
            }
            query_builder.push(")");
        }
        if !names.is_empty() {
            query_builder.push(" and name in (");
            let mut separated = query_builder.separated(", ");
            for name in names {
                separated.push_bind(name);
            }
            query_builder.push(")");
        }

        let rows = query_builder
            .build_query_as::<DatasourceEntity>()
            .fetch_all(pool).await?;
        Ok(rows.into_iter().map(|v| (v.name.clone(), v)).collect())
    }

    pub async fn list(
        pool: &DbPool,
        param: DatasourceListParam,
    ) -> Result<(i64, Vec<DatasourceEntity>), sqlx::Error> {
        let (limit, offset) = param.page.get_limit_offset();

        let name = param.name.as_ref().map(|value| format!("%{value}%"));
        let display_name = param
            .display_name
            .as_ref()
            .map(|value| format!("%{value}%"));
        let url = param.url.as_ref().map(|value| format!("%{value}%"));
        let disabled = param.disabled;

        let total: i64 = sqlx::query_scalar!(
            "
            select count(*)
            from datasource_info
            where deleted_at = 0
                and coalesce(disabled = ?, true)
                and coalesce(lower(name) like lower(?), true)
                and coalesce(lower(display_name) like lower(?), true)
                and coalesce(lower(url) like lower(?), true)
            ",
            disabled, name, display_name, url,
        )
        .fetch_one(pool)
        .await?;

        if total < offset {
            return Ok((total, Vec::new()));
        }

        let rows = sqlx::query_as!(
            DatasourceEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , name, display_name, disabled as `disabled: _`, url, username, password, config
            from datasource_info
            where deleted_at = 0
                and coalesce(disabled = ?, true)
                and coalesce(lower(name) like lower(?), true)
                and coalesce(lower(display_name) like lower(?), true)
                and coalesce(lower(url) like lower(?), true)
            order by id limit ? offset ?
            ",
            disabled, name, display_name, url,
            limit, offset,
        )
        .fetch_all(pool)
        .await?;

        Ok((total, rows))
    }

    pub async fn list_permitted(
        pool: &DbPool,
        param: DatasourceListParam,
        op_user_id: i64,
    ) -> Result<(i64, Vec<DatasourceEntity>), sqlx::Error> {
        let (limit, offset) = param.page.get_limit_offset();

        let name = param.name.as_ref().map(|value| format!("%{value}%"));
        let display_name = param
            .display_name
            .as_ref()
            .map(|value| format!("%{value}%"));
        let url = param.url.as_ref().map(|value| format!("%{value}%"));
        // disabled filter is only works for super admin

        let total: i64 = sqlx::query_scalar!(
            "
            select count(*)
            from datasource_info ds
            inner join sys_user_role ur
                on ds.id = ur.resource_id and ur.resource_type = 'datasource' and ur.user_id = ? and ur.deleted_at = 0
            where ds.deleted_at = 0 and ds.disabled = 0
                and coalesce(lower(ds.name) like lower(?), true)
                and coalesce(lower(ds.display_name) like lower(?), true)
                and coalesce(lower(ds.url) like lower(?), true)
            ",
            op_user_id,
            name, display_name, url,
        )
        .fetch_one(pool)
        .await?;

        if total < offset {
            return Ok((total, Vec::new()));
        }

        let rows = sqlx::query_as!(
            DatasourceEntity,
            "
            select ds.id, ds.created_at, ds.updated_at, ds.deleted_at, ds.created_by, ds.updated_by
                , ds.name, ds.display_name, ds.disabled as `disabled: _`, ds.url, ds.username, ds.password, ds.config
            from datasource_info ds
            inner join sys_user_role ur
                on ds.id = ur.resource_id and ur.resource_type = 'datasource' and ur.user_id = ? and ur.deleted_at = 0
            where ds.deleted_at = 0 and ds.disabled = 0
                and coalesce(lower(ds.name) like lower(?), true)
                and coalesce(lower(ds.display_name) like lower(?), true)
                and coalesce(lower(ds.url) like lower(?), true)
                order by ds.updated_at desc limit ? offset ?
            ",
            op_user_id,
            name, display_name, url,
            limit, offset,
        )
        .fetch_all(pool)
        .await?;

        Ok((total, rows))
    }

    pub async fn create(
        pool: &DbPool,
        entity: CreateDatasource,
        op_user_id: i64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "
            insert into datasource_info (created_by, updated_by, name, url, username, password, display_name, config)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            ",
            op_user_id,
            op_user_id,
            entity.name,
            entity.url,
            entity.username,
            entity.password,
            entity.display_name,
            entity.config,
        ).execute(pool).await?;
        Ok(())
    }

    pub async fn update(
        pool: &DbPool,
        entity: UpdateDatasource,
        op_user_id: i64,
    ) -> Result<bool, sqlx::Error> {
        let affected = sqlx::query!(
            "
            update datasource_info
            set url = ?, username = ?, password = coalesce(?, password),
                display_name = ?, config = ?, updated_by = ?, updated_at = current_timestamp
            where id = ? and deleted_at = 0
            ",
            entity.url,
            entity.username,
            entity.password,
            entity.display_name,
            entity.config,
            op_user_id,
            entity.id,
        )
        .execute(pool)
        .await
        .map(|result| result.rows_affected())?;
        Ok(affected > 0)
    }

    pub async fn delete(
        pool: &DbPool,
        id: i64,
        datasource_name: String,
        op_user_id: i64,
    ) -> Result<bool, sqlx::Error> {
        let mut transaction = pool.begin().await?;
        let deleted_at = Utc::now().timestamp_millis();

        let affected = sqlx::query!(
            "
            update datasource_info set deleted_at = ?, updated_by = ?, updated_at = current_timestamp
            where id = ? and deleted_at = 0
            ",
            deleted_at,
            op_user_id,
            id,
        ).execute(&mut *transaction).await
        .map(|result| result.rows_affected())?;
        if affected == 0 {
            transaction.rollback().await?;
            return Ok(false);
        }

        sqlx::query!(
            "
            update table_info set deleted_at = ?, updated_by = ?, updated_at = current_timestamp
            where datasource_name = ? and deleted_at = 0
            ",
            deleted_at,
            op_user_id,
            datasource_name.clone(),
        )
        .execute(&mut *transaction)
        .await?;

        sqlx::query!(
            "
            update sys_user_role set deleted_at = ?, deleted_by = ?
            where resource_type = 'datasource' and resource_id = ? and deleted_at = 0
            ",
            deleted_at,
            op_user_id,
            id,
        )
        .execute(&mut *transaction)
        .await?;

        sqlx::query!(
            "
            update sys_user_role set deleted_at = ?, deleted_by = ?
            where resource_type = 'table'
                and resource_id in
                    (select cast(id as char) from table_info where datasource_name = ?)
                and deleted_at = 0
            ",
            deleted_at,
            op_user_id,
            datasource_name,
        )
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;
        Ok(true)
    }
}
