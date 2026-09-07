use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use validator::Validate;

use crate::{api::PageParam, model::embed::OrderByConfig};

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct EntityListParam {
    #[serde(flatten)]
    pub page: PageParam,
    pub table_id: i64,
    #[serde(default)]
    pub condition: HashMap<String, Value>,
    #[serde(default)]
    pub order_by: Option<OrderByConfig>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct EntityCreateParam {
    pub table_id: i64,
    pub columns: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct EntityUpdateParam {
    pub table_id: i64,
    pub columns: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityUpdateResult {
    pub affected: u64,
}
