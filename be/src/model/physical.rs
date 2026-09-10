use crate::{
    api::{PhysicalColumnListResult, PhysicalTableListResult},
    model::embed::DataType,
};

#[derive(sqlx::FromRow)]
pub struct PhysicalTableRow {
    name: String,
    comment: String,
}

#[derive(sqlx::FromRow)]
pub struct MySqlPhysicalColumnRow {
    name: String,
    database_type: String,
    nullable: i64,
    has_default: i64,
    generated_flag: i64,
    primary_key: i64,
    comment: String,
}

#[derive(sqlx::FromRow)]
pub struct PostgresPhysicalColumnRow {
    name: String,
    database_type: String,
    nullable: bool,
    has_default: bool,
    generated_flag: bool,
    primary_key: bool,
    comment: String,
}

impl From<PhysicalTableRow> for PhysicalTableListResult {
    fn from(value: PhysicalTableRow) -> Self {
        Self { name: value.name, comment: value.comment }
    }
}

impl From<MySqlPhysicalColumnRow> for PhysicalColumnListResult {
    fn from(value: MySqlPhysicalColumnRow) -> Self {
        Self {
            name: value.name,
            comment: value.comment,
            data_type: DataType::from_database_type(&value.database_type),
            optional: value.nullable != 0 || value.has_default != 0 || value.generated_flag != 0,
            primary_key: value.primary_key != 0,
        }
    }
}

impl From<PostgresPhysicalColumnRow> for PhysicalColumnListResult {
    fn from(value: PostgresPhysicalColumnRow) -> Self {
        Self {
            name: value.name,
            comment: value.comment,
            data_type: DataType::from_database_type(&value.database_type),
            optional: value.nullable || value.has_default || value.generated_flag,
            primary_key: value.primary_key,
        }
    }
}
