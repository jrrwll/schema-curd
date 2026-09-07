use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::model::embed::DataType;

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
