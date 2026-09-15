use chrono::NaiveDateTime;

#[derive(sqlx::FromRow)]
pub struct DatasourceEntity {
    pub id: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: i64,
    pub created_by: Option<i64>,
    pub updated_by: Option<i64>,
    pub name: String,
    pub display_name: String,
    pub disabled: bool,
    pub url: String,
    pub username: String,
    pub password: String,
    pub config: Option<String>,
}

pub struct CreateDatasource {
    pub name: String,
    pub url: String,
    pub username: String,
    pub password: String,
    pub display_name: String,
    pub config: String,
}

pub struct UpdateDatasource {
    pub id: i64,
    pub url: String,
    pub username: String,
    pub password: Option<String>,
    pub display_name: String,
    pub config: String,
}

#[derive(sqlx::FromRow)]
pub struct MetaDatasource {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub username: String,
    pub password: String,
    pub config: Option<String>,
}
