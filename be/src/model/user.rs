use chrono::NaiveDateTime;

use crate::{api::UserListResult, util::format_datetime};

#[derive(sqlx::FromRow)]
pub struct UserEntity {
    pub id: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub created_by: Option<i64>,
    pub updated_by: Option<i64>,
    pub deleted_at: i64,
    pub name: String,
    pub password: String,
    pub display_name: String,
    pub disabled: bool,
    pub super_admin: bool,
}

pub struct CreateUser {
    pub created_by: i64,
    pub updated_by: i64,
    pub name: String,
    pub password: String,
    pub display_name: String,
}

pub struct UpdateUser {
    pub id: i64,
    pub updated_by: i64,
    pub password: Option<String>,
    pub display_name: Option<String>,
}

impl From<UserEntity> for UserListResult {
    fn from(value: UserEntity) -> Self {
        Self {
            id: value.id,
            created_at: format_datetime(value.created_at),
            updated_at: format_datetime(value.updated_at),
            name: value.name,
            display_name: value.display_name,
            disabled: value.disabled,
            super_admin: value.super_admin,
        }
    }
}
