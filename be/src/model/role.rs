use chrono::NaiveDateTime;

#[derive(sqlx::FromRow)]
pub struct RoleEntity {
    pub id: i64,
    pub created_at: NaiveDateTime,
    pub created_by: Option<i64>,
    pub deleted_at: i64,
    pub deleted_by: Option<i64>,
    pub user_id: i64,
    pub role: String,
    pub resource_type: String,
    pub resource_id: i64,
}

#[derive(sqlx::FromRow)]
pub struct AuthUser {
    pub id: i64,
    pub password: String,
    pub disabled: bool,
}

#[derive(Clone)]
pub struct CreateUserRole {
    pub user_id: i64,
    pub role: String,
    pub resource_type: String,
    pub resource_id: i64,
}
