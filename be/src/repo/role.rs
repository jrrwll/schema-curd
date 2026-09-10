use chrono::Utc;
use sqlx::{QueryBuilder, Row};
use std::collections::HashMap;

use crate::api::{RoleResourceListParam, RoleUserListParam};
use crate::common::constants::MAX_GRANT_LIST_COUNT;
use crate::model::RoleUserResource;
use crate::{
    api::RoleListParam,
    common::db::DbPool,
    model::{CreateUserRole, RoleEntity},
};

pub struct RoleRepo;

impl RoleRepo {
    pub async fn get(pool: &DbPool, id: i64) -> Result<Option<RoleEntity>, sqlx::Error> {
        sqlx::query_as!(
            RoleEntity,
            "
            select * from sys_user_role
            where id = ? and deleted_at = 0
            ",
            id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn get_by_uk(
        pool: &DbPool, user_id: i64, resource_type: String, resource_id: i64,
    ) -> Result<Option<RoleEntity>, sqlx::Error> {
        sqlx::query_as!(
            RoleEntity,
            "
            select * from sys_user_role
            where user_id = ? and resource_type = ? and resource_id = ? and deleted_at = 0
            ",
            user_id,
            resource_type,
            resource_id
        )
        .fetch_optional(pool)
        .await
    }

    pub async fn get_datasource_roles(pool: &DbPool, user_id: i64) -> Result<Vec<RoleEntity>, sqlx::Error> {
        let rows = sqlx::query_as!(
            RoleEntity,
            "
            select * from sys_user_role
            where user_id = ? and resource_type = 'datasource' and deleted_at = 0
            ",
            user_id,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn get_table_roles(
        pool: &DbPool, user_id: i64, datasource_name: String,
    ) -> Result<Vec<RoleEntity>, sqlx::Error> {
        let rows = sqlx::query_as!(
            RoleEntity,
            "
            select r.*
            from sys_user_role r
            inner join table_info t
                on r.resource_id = t.id and t.datasource_name = ? and t.deleted_at = 0
            where r.user_id = ? and r.resource_type = 'table' and r.deleted_at = 0
            ",
            datasource_name,
            user_id,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn get_all_roles(pool: &DbPool, user_id: i64) -> Result<Vec<RoleEntity>, sqlx::Error> {
        let rows = sqlx::query_as!(
            RoleEntity,
            "
            select * from sys_user_role
            where user_id = ? and deleted_at = 0
            ",
            user_id,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn get_user_ids(
        pool: &DbPool, resource_type: String, resource_id: i64, user_ids: Vec<i64>,
    ) -> Result<HashMap<i64, String>, sqlx::Error> {
        let mut query_builder = QueryBuilder::new(
            "
            select user_id, role from sys_user_role
            where deleted_at = 0
            ",
        );
        query_builder.push(" and resource_type = ").push_bind(resource_type);
        query_builder.push(" and resource_id = ").push_bind(resource_id);

        query_builder.push(" and user_ids in (");
        let mut separated = query_builder.separated(", ");
        for id in &user_ids {
            separated.push_bind(*id);
        }
        query_builder.push(")");

        let rows = query_builder
            .build()
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|row| (row.get("user_id"), row.get("role")))
            .collect();
        Ok(rows)
    }

    pub async fn get_resource_ids(
        pool: &DbPool, user_id: i64, resource_type: String, resource_ids: Vec<i64>,
    ) -> Result<HashMap<i64, String>, sqlx::Error> {
        let mut query_builder = QueryBuilder::new(
            "
                select resource_id, role from sys_user_role
                where deleted_at = 0
                ",
        );
        query_builder.push(" and user_id = ").push_bind(user_id);
        query_builder.push(" and resource_type = ").push_bind(resource_type);

        query_builder.push(" and resource_id in (");
        let mut separated = query_builder.separated(", ");
        for id in &resource_ids {
            separated.push_bind(*id);
        }
        query_builder.push(")");

        let rows = query_builder
            .build()
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|row| (row.get("resource_id"), row.get("role")))
            .collect();
        Ok(rows)
    }

    pub async fn get_user_id_count(pool: &DbPool, ids: Vec<i64>) -> Result<Vec<(i64, i64)>, sqlx::Error> {
        let mut query_builder = QueryBuilder::new(
            "
            select user_id, count(1) as cnt from sys_user_role
            where deleted_at = 0 and id in (
            ",
        );
        let mut separated = query_builder.separated(", ");
        for id in &ids {
            separated.push_bind(*id);
        }
        query_builder.push(")");
        query_builder.push(" group by user_id");

        let rows = query_builder
            .build()
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|row| (row.get("user_id"), row.get("cnt")))
            .collect();
        Ok(rows)
    }

    pub async fn list_grantable_user_datasource(
        pool: &DbPool, param: RoleUserListParam,
    ) -> Result<Vec<RoleUserResource>, sqlx::Error> {
        let user_id = param.user_id;
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));

        let rows = sqlx::query_as!(
            RoleUserResource,
            "
            select ds.id,
                ds.name,
                ds.display_name
            from datasource_info ds
            where ds.deleted_at = 0
                and ds.disabled = 0
                and (
                    coalesce(lower(ds.name) like lower(?), true)
                    or
                    coalesce(lower(ds.display_name) like lower(?), true)
                )
                and not exists (
                    select 1
                    from sys_user_role ur
                    where ur.user_id = ?
                        and ur.resource_type = 'datasource'
                        and ur.resource_id = ds.id
                        and ur.deleted_at = 0
                )
            order by ds.updated_at desc
            limit ?
            ",
            keyword,
            keyword,
            user_id,
            MAX_GRANT_LIST_COUNT,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn list_grantable_user_table(
        pool: &DbPool, datasource_name: String, param: RoleUserListParam,
    ) -> Result<Vec<RoleUserResource>, sqlx::Error> {
        let user_id = param.user_id;
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));

        let rows = sqlx::query_as!(
            RoleUserResource,
            "
            select ti.id,
                ti.name,
                ti.display_name
            from table_info ti
            where ti.datasource_name = ?
                and ti.deleted_at = 0
                and ti.disabled = 0
                and (
                    coalesce(lower(ti.name) like lower(?), true)
                    or
                    coalesce(lower(ti.display_name) like lower(?), true)
                )
                and not exists (
                    select 1
                    from sys_user_role ur
                    where ur.user_id = ?
                        and ur.resource_type = 'table'
                        and ur.resource_id = ti.id
                        and ur.deleted_at = 0
                )
            order by ti.updated_at desc
            limit ?
            ",
            datasource_name,
            keyword,
            keyword,
            user_id,
            MAX_GRANT_LIST_COUNT,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn list_grantable_datasource_user(
        pool: &DbPool, datasource_id: i64, param: RoleResourceListParam,
    ) -> Result<Vec<RoleUserResource>, sqlx::Error> {
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));

        let rows = sqlx::query_as!(
            RoleUserResource,
            "
            select u.id,
                u.name,
                u.display_name
            from sys_user u
            where u.deleted_at = 0
                and u.disabled = 0
                and u.super_admin = 0
                and (
                    coalesce(lower(u.name) like lower(?), true)
                    or
                    coalesce(lower(u.display_name) like lower(?), true)
                )
                and not exists (
                    select 1
                    from sys_user_role ur
                    where ur.user_id = u.id
                        and ur.resource_type = 'datasource'
                        and ur.resource_id = ?
                        and ur.deleted_at = 0
                )
            order by u.updated_at desc
            limit ?
            ",
            keyword,
            keyword,
            datasource_id,
            MAX_GRANT_LIST_COUNT,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn list_grantable_table_user(
        pool: &DbPool, table_id: i64, param: RoleResourceListParam,
    ) -> Result<Vec<RoleUserResource>, sqlx::Error> {
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));

        let rows = sqlx::query_as!(
            RoleUserResource,
            "
            select u.id,
                u.name,
                u.display_name
            from sys_user u
            where u.deleted_at = 0
                and u.disabled = 0
                and u.super_admin = 0
                and (
                    coalesce(lower(u.name) like lower(?), true)
                    or
                    coalesce(lower(u.display_name) like lower(?), true)
                )
                and not exists (
                    select 1
                    from sys_user_role ur
                    where ur.user_id = u.id
                        and ur.resource_type = 'table'
                        and ur.resource_id = ?
                        and ur.deleted_at = 0
                )
            order by u.updated_at desc
            limit ?
            ",
            keyword,
            keyword,
            table_id,
            MAX_GRANT_LIST_COUNT,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows)
    }

    pub async fn list(pool: &DbPool, param: RoleListParam) -> Result<(i64, Vec<RoleEntity>), sqlx::Error> {
        let (limit, offset) = param.page.get_limit_offset();

        let mut count_sql = QueryBuilder::new(
            "
            select count(*) from sys_user_role
            where deleted_at = 0
            ",
        );
        push_list_filters(&mut count_sql, &param);

        let total: i64 = count_sql.build_query_scalar().fetch_one(pool).await?;

        let mut rows_sql = QueryBuilder::new(
            "
            select * from sys_user_role
            where deleted_at = 0
            ",
        );
        push_list_filters(&mut rows_sql, &param);
        rows_sql.push(
            "
            order by id desc limit ? offset ?
            ",
        );

        let rows: Vec<RoleEntity> = rows_sql.build_query_as().bind(limit).bind(offset).fetch_all(pool).await?;
        Ok((total, rows))
    }

    pub async fn grant(pool: &DbPool, entity: CreateUserRole, op_user_id: i64) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "
            insert into sys_user_role  (user_id, role, resource_type, resource_id, created_by)
            values (?, ?, ?, ?, ?)
            ",
            entity.user_id,
            entity.role,
            entity.resource_type,
            entity.resource_id,
            op_user_id,
        )
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn batch_grant(pool: &DbPool, entities: Vec<CreateUserRole>, op_user_id: i64) -> Result<(), sqlx::Error> {
        if entities.is_empty() {
            return Ok(());
        }
        let mut query_builder = QueryBuilder::new(
            "
            insert into sys_user_role (user_id, role, resource_type, resource_id, created_by)
            ",
        );
        query_builder.push_values(entities, |mut build, entity| {
            build
                .push_bind(entity.user_id)
                .push_bind(entity.role)
                .push_bind(entity.resource_type)
                .push_bind(entity.resource_id)
                .push_bind(op_user_id);
        });
        query_builder.build().execute(pool).await?;
        Ok(())
    }

    pub async fn revoke(pool: &DbPool, id: i64, op_user_id: i64) -> Result<bool, sqlx::Error> {
        let deleted_at = Utc::now().timestamp_millis();
        let affected = sqlx::query!(
            "
            update sys_user_role
            set deleted_at = ?, deleted_by = ?
            where id = ? and deleted_at = 0
            ",
            deleted_at,
            op_user_id,
            id,
        )
        .execute(pool)
        .await
        .map(|result| result.rows_affected())?;
        Ok(affected > 0)
    }

    pub async fn batch_revoke(pool: &DbPool, ids: Vec<i64>, op_user_id: i64) -> Result<bool, sqlx::Error> {
        let deleted_at = Utc::now().timestamp_millis();
        let mut query_builder = QueryBuilder::new(
            "
            update sys_user_role
            set deleted_at = ?, deleted_by = ?
            where deleted_at = 0 and id in (
            ",
        );
        let mut separated = query_builder.separated(", ");
        for id in &ids {
            separated.push_bind(*id);
        }
        query_builder.push(")");
        let affected = query_builder
            .build()
            .bind(deleted_at)
            .bind(op_user_id)
            .execute(pool)
            .await
            .map(|result| result.rows_affected())?;
        Ok(affected > 0)
    }

    pub async fn update(pool: &DbPool, id: i64, entity: CreateUserRole, op_user_id: i64) -> Result<bool, sqlx::Error> {
        let mut transaction = pool.begin().await?;

        let deleted_at = Utc::now().timestamp_millis();
        let rows_affected = sqlx::query!(
            "
            update sys_user_role
            set deleted_at = ?, deleted_by = ?
            where id = ? and deleted_at = 0
             ",
            deleted_at,
            op_user_id,
            id,
        )
        .execute(&mut *transaction)
        .await
        .map(|v| v.rows_affected())?;
        if rows_affected == 0 {
            transaction.rollback().await?;
            return Ok(false);
        }

        sqlx::query!(
            "
            insert into sys_user_role  (user_id, role, resource_type, resource_id, created_by)
            values (?, ?, ?, ?, ?)
            ",
            entity.user_id,
            entity.role,
            entity.resource_type,
            entity.resource_id,
            op_user_id,
        )
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;
        Ok(true)
    }
}

fn push_list_filters<DB: sqlx::Database>(builder: &mut QueryBuilder<DB>, param: &RoleListParam)
where
    for<'q> i64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> String: sqlx::Encode<'q, DB> + sqlx::Type<DB>, {
    if let Some(resource_type) = param.resource_type {
        builder.push(" and resource_type = ?");
        builder.push_bind(resource_type.to_string());
    }

    if !param.resource_ids.is_empty() {
        builder.push(" and resource_id in (");
        {
            let mut separated = builder.separated(", ");
            for v in &param.resource_ids {
                separated.push_bind(v.to_string());
            }
        }
        builder.push(")");
    }

    if !param.user_ids.is_empty() {
        builder.push(" and user_id in (");
        {
            let mut separated = builder.separated(", ");
            for v in &param.user_ids {
                separated.push_bind(*v);
            }
        }
        builder.push(")");
    }

    if !param.roles.is_empty() {
        builder.push(" and role in (");
        {
            let mut separated = builder.separated(", ");
            for v in &param.roles {
                separated.push_bind(v.to_string());
            }
        }
        builder.push(")");
    }
}
