use crate::common::db::DbPool;
use crate::model::AuthUser;

pub struct AuthRepo;

impl AuthRepo {
    pub async fn find_user(pool: &DbPool, name: &str) -> Result<Option<AuthUser>, sqlx::Error> {
        sqlx::query_as!(
            AuthUser,
            "
            select id, password, disabled as `disabled: _` from sys_user
            where name = ? and deleted_at = 0
            ",
            name,
        ).fetch_optional(pool).await
    }

    pub async fn is_user_active(
        pool: &DbPool,
        user_id: i64,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query_scalar!(
            "
            select 1 from sys_user
            where id = ? and deleted_at = 0 and disabled = false
            limit 1
            ",
            user_id,
        ).fetch_optional(pool).await?;
        Ok(result.is_some())
    }

}
