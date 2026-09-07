use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct DiscoveryDatasourceListParam {
    pub datasource_id: Option<i64>,
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscoveryDatasourceTableListResult {
    pub id: i64,
    pub name: String,
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct DiscoveryTableListParam {
    pub datasource_id: Option<i64>,
    pub table_id: Option<i64>,
    pub keyword: Option<String>,
}
