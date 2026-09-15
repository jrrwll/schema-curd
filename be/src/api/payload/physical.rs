use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::model::embed::DataType;
use crate::model::{MySqlPhysicalColumnRow, PhysicalTableRow, PostgresPhysicalColumnRow};

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct TestDatasourceParam {
    #[serde(default)]
    pub id: Option<i64>,
    pub url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestDatasourceResult {
    pub database_type: String,
    pub version: String,
    pub database: String,
    pub cost_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct PhysicalTableListParam {
    pub datasource: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhysicalTableListResult {
    pub name: String,
    pub comment: String,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct PhysicalColumnListParam {
    pub table_id: Option<i64>,
    pub datasource: Option<String>,
    pub table: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhysicalColumnListResult {
    pub name: String,
    pub comment: String,
    pub data_type: DataType,
    pub optional: bool,
    pub primary_key: bool,
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
