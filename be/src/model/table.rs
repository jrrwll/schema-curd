use chrono::NaiveDateTime;

#[derive(sqlx::FromRow)]
pub struct TableEntity {
    pub id: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: i64,
    pub created_by: Option<i64>,
    pub updated_by: Option<i64>,
    pub datasource_name: String,
    pub name: String,
    pub display_name: String,
    pub disabled: bool,
    pub table_name: String,
    pub table_config: Option<String>,
    pub columns_config: Option<String>,
}

pub struct CreateTable {
    pub datasource_name: String,
    pub name: String,
    pub display_name: String,
    pub table_name: String,
    pub table_config: String,
    pub columns_config: String,
}

pub struct UpdateTable {
    pub id: i64,
    pub display_name: String,
    pub table_config: String,
    pub columns_config: String,
}
