use std::collections::HashMap;

use chrono::Utc;
use sqlx::QueryBuilder;

use crate::{api::{UserListParam}, common::db::DbPool, model::{CreateUser, UpdateUser, UserEntity}};

pub struct UserRepo;

impl UserRepo {

    pub async fn get(pool: &DbPool, id: i64) -> Result<Option<UserEntity>, sqlx::Error> {
        sqlx::query_as!(
            UserEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by, name, password, display_name, disabled as `disabled: _`, super_admin as `super_admin: _`
            from sys_user
            where id = ? and deleted_at = 0
            ",
            id
        ).fetch_optional(pool).await
    }

    pub async fn get_multi(pool: &DbPool, ids: Vec<i64>) -> Result<HashMap<i64, UserEntity>, sqlx::Error> {
        let mut query_builder = QueryBuilder::new(
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by, name, password, display_name, disabled as `disabled: _`, super_admin as `super_admin: _`
            from sys_user
            where deleted_at = 0 and id in (
            "
        );
        let mut separated = query_builder.separated(", ");
        for id in &ids {
            separated.push_bind(*id);
        }
        query_builder.push(")");

        let rows = query_builder
            .build_query_as::<UserEntity>()
            .fetch_all(pool).await?;
        Ok(rows.into_iter().map(|v| (v.id, v)).collect())
    }

    pub async fn list(pool: &DbPool, param: UserListParam) -> Result<(i64, Vec<UserEntity>), sqlx::Error> {
        let name = param.name.as_ref().map(|value| format!("%{value}%"));
        let (limit, offset) = param.page.get_limit_offset();

        let total: i64 = sqlx::query_scalar!(
            "
            select count(*)
            from sys_user
            where deleted_at = 0
              and coalesce(name like ? or display_name like ?, true)
              and disabled = coalesce(?, disabled)
            ",
            &name,
            &name,
            param.disabled,
        ).fetch_one(pool).await?;

        if total < offset {
            return Ok((total, Vec::new()));
        }

        let rows = sqlx::query_as!(
            UserEntity,
            "
            select id, created_at, updated_at, deleted_at, created_by, updated_by, name, password, display_name, disabled as `disabled: _`, super_admin as `super_admin: _`
            from sys_user
            where deleted_at = 0
              and coalesce(name like ? or display_name like ?, true)
              and disabled = coalesce(?, disabled)
            order by id
            limit ? offset ?
            ",
            &name,
            &name,
            param.disabled,
            limit,
            offset,
        ).fetch_all(pool).await?;
        
        Ok((total, rows))
    }
    
    pub async fn delete(pool: &DbPool, id: i64, op_user_id: i64) -> Result<bool, sqlx::Error> {
        let mut transaction = pool.begin().await?;

        let deleted_at = Utc::now().timestamp_millis();
        let rows_affected = sqlx::query!(
            "
            update sys_user 
            set deleted_at = ?, updated_by = ?, updated_at = current_timestamp
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
            update sys_user_role set deleted_at = ?
            where user_id = ? and deleted_at = 0
            ",
            deleted_at,
            id
        )
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(true)
    }

    pub async fn create(pool: &DbPool, user: CreateUser) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "
            insert into sys_user (created_by, updated_by, name, password, display_name)
            values (?, ?, ?, ?, ?)
            ",
            user.created_by,
            user.updated_by,
            user.name,
            user.password,
            user.display_name,
        ).execute(pool).await?;
        Ok(())
    }

    pub async fn update(pool: &DbPool, user: UpdateUser) -> Result<bool, sqlx::Error> {
        let affected = sqlx::query!(
            "
            update sys_user
            set updated_at = current_timestamp, updated_by = ?,
                password = coalesce(?, password),
                display_name = coalesce(?, display_name)
            where id = ? and deleted_at = 0 and disabled = 0
            ",
            user.updated_by,
            user.password,
            user.display_name,
            user.id,
        ).execute(pool).await
        .map(|result| result.rows_affected())?;
        Ok(affected > 0)
    }

    pub async fn set_disabled(pool: &DbPool, id: i64, op_user_id: i64, expect_disabled: bool, update_disabled: bool) -> Result<bool, sqlx::Error> {
        let affected = sqlx::query!(
            "
            update sys_user
            set disabled = ?, updated_by = ?, updated_at = current_timestamp
            where id = ? and disabled = ? and deleted_at = 0
            ",
            update_disabled,
            op_user_id,
            id,
            expect_disabled,
        ).execute(pool).await
        .map(|result| result.rows_affected())?;
        Ok(affected > 0)
    }
}
