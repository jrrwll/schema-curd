use chrono::NaiveDateTime;

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
