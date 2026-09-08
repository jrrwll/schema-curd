use chrono::Utc;
use sqlx::QueryBuilder;

use crate::{
    api::TableListParam,
    common::db::DbPool,
    model::{CreateTable, TableEntity, UpdateTable},
};

pub struct TableRepo;

impl TableRepo {
    pub async fn get(pool: &DbPool, id: i64) -> Result<Option<TableEntity>, sqlx::Error> {
        sqlx::query_as!(
            TableEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , datasource_name, name, display_name, disabled as `disabled: _`, table_name, table_config, columns_config
            from table_info
            where id = ? and deleted_at = 0
            ",
            id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn get_by_name(
        pool: &DbPool,
        name: String,
        datasource_name: String,
    ) -> Result<Option<TableEntity>, sqlx::Error> {
        sqlx::query_as!(
            TableEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , datasource_name, name, display_name, disabled as `disabled: _`, table_name, table_config, columns_config
            from table_info
            where name = ? and datasource_name = ? and deleted_at = 0
            ",
            name, datasource_name,
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn get_multi_by_ids_or_datasource_names(
        pool: &DbPool,
        ids: Vec<i64>,
        datasource_names: Vec<String>,
    ) -> Result<Vec<TableEntity>, sqlx::Error> {
        if ids.is_empty() && datasource_names.is_empty() {
            return Ok(Vec::new());
        }
        let mut query_builder = QueryBuilder::new(
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , datasource_name, name, display_name, disabled as `disabled: _`, table_name, table_config, columns_config
            from table_info
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
        if !datasource_names.is_empty() {
            query_builder.push(" and datasource_name in (");
            let mut separated = query_builder.separated(", ");
            for datasource_name in datasource_names {
                separated.push_bind(datasource_name);
            }
            query_builder.push(")");
        }

        let rows = query_builder
            .build_query_as::<TableEntity>()
            .fetch_all(pool)
            .await?;

        // let mut grouped: HashMap<String, Vec<TableEntity>> = HashMap::new();
        // for row in rows {
        //     let datasource_name = row.datasource_name.clone();
        //     grouped.entry(datasource_name).or_insert_with(Vec::new).push(row);
        // }
        // Ok(grouped)
        Ok(rows)
    }

    pub async fn list(
        pool: &DbPool,
        param: TableListParam,
    ) -> Result<(i64, Vec<TableEntity>), sqlx::Error> {
        let (limit, offset) = param.page.get_limit_offset();

        let datasource_name = param.datasource;
        let name = param.name.as_ref().map(|value| format!("%{value}%"));
        let display_name = param
            .display_name
            .as_ref()
            .map(|value| format!("%{value}%"));
        let disabled = param.disabled;

        let total: i64 = sqlx::query_scalar!(
            "
            select count(*)
            from table_info
            where deleted_at = 0
              and datasource_name = ?
              and coalesce(lower(name) like lower(?), true)
              and coalesce(lower(display_name) like lower(?), true)
              and disabled = coalesce(?, disabled)
            ",
            datasource_name.clone(),
            name,
            display_name,
            disabled
        )
        .fetch_one(pool)
        .await?;

        if total < offset {
            return Ok((total, Vec::new()));
        }

        let rows = sqlx::query_as!(
            TableEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by
                , datasource_name, name, display_name, disabled as `disabled: _`, table_name, table_config, columns_config
            from table_info
            where deleted_at = 0
                and datasource_name = ?
                and coalesce(lower(name) like lower(?), true)
                and coalesce(lower(display_name) like lower(?), true)
                and disabled = coalesce(?, disabled)
            order by id limit ? offset ?
            ",
            datasource_name, name, display_name, disabled,
            limit, offset,
        ).fetch_all(pool).await?;

        Ok((total, rows))
    }

    pub async fn create(
        pool: &DbPool,
        entity: CreateTable,
        op_user_id: i64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "
            insert into table_info (created_by, updated_by, datasource_name, name, display_name, table_name, table_config, columns_config)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            ",
            op_user_id,
            op_user_id,
            entity.datasource_name,
            entity.name,
            entity.display_name,
            entity.table_name,
            entity.table_config,
            entity.columns_config,
        ).execute(pool).await?;
        Ok(())
    }

    pub async fn update(
        pool: &DbPool,
        entity: UpdateTable,
        op_user_id: i64,
    ) -> Result<bool, sqlx::Error> {
        let affected = sqlx::query!(
            "
            update table_info
            set display_name = ?, table_config = ?, columns_config = ?, updated_by = ?, updated_at = current_timestamp
            where id = ? and deleted_at = 0
            ",
            entity.display_name,
            entity.table_config,
            entity.columns_config,
            op_user_id,
            entity.id,
        ).execute(pool).await
        .map(|result| result.rows_affected())?;
        Ok(affected > 0)
    }

    pub async fn delete(pool: &DbPool, id: i64, op_user_id: i64) -> Result<bool, sqlx::Error> {
        let mut transaction = pool.begin().await?;
        let deleted_at = Utc::now().timestamp_millis();

        let affected = sqlx::query!(
            "
            update table_info set deleted_at = ?, updated_by = ?, updated_at = current_timestamp
             where id = ? and deleted_at = 0
            ",
            deleted_at,
            op_user_id,
            id,
        )
        .execute(&mut *transaction)
        .await
        .map(|result| result.rows_affected())?;
        if affected == 0 {
            transaction.rollback().await?;
            return Ok(false);
        }

        sqlx::query!(
            "
            update sys_user_role set deleted_at = ?, deleted_by = ?
            where resource_type = 'table'
               and resource_id = cast(? as char)
               and deleted_at = 0
            ",
            deleted_at,
            op_user_id,
            id,
        )
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;
        Ok(true)
    }
}
