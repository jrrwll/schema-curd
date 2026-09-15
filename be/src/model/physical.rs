#[derive(sqlx::FromRow)]
pub struct PhysicalTableRow {
    pub name: String,
    pub comment: String,
}

#[derive(sqlx::FromRow)]
pub struct MySqlPhysicalColumnRow {
    pub name: String,
    pub database_type: String,
    pub nullable: i64,
    pub has_default: i64,
    pub generated_flag: i64,
    pub primary_key: i64,
    pub comment: String,
}

#[derive(sqlx::FromRow)]
pub struct PostgresPhysicalColumnRow {
    pub name: String,
    pub database_type: String,
    pub nullable: bool,
    pub has_default: bool,
    pub generated_flag: bool,
    pub primary_key: bool,
    pub comment: String,
}
