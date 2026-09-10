use corers::axum::ApiError;
use serde_json::Value;

use crate::model::embed::{FilterOperator, OrderByConfig};

#[derive(Debug, Clone, PartialEq)]
pub enum BindValue {
    Null,
    String(String),
    Integer(i64),
    Unsigned(u64),
    Float(f64),
    Bool(bool),
}

impl TryFrom<&Value> for BindValue {
    type Error = ApiError;

    fn try_from(value: &Value) -> Result<Self, Self::Error> {
        match value {
            Value::Null => Ok(BindValue::Null),
            Value::Bool(value) => Ok(BindValue::Bool(*value)),
            Value::String(value) => Ok(BindValue::String(value.clone())),
            Value::Number(value) => value
                .as_i64()
                .map(BindValue::Integer)
                .or_else(|| value.as_u64().map(BindValue::Unsigned))
                .or_else(|| value.as_f64().map(BindValue::Float))
                .ok_or_else(|| ApiError::Validation("Fixed value number is out of range".to_owned())),
            Value::Array(_) | Value::Object(_) => {
                Err(ApiError::Validation("Config insert_fixed_value does not support arrays or objects".to_owned()))
            }
        }
    }
}

#[derive(Debug)]
pub struct EntityListPlan {
    pub filters: Vec<EntityListFilter>,
    pub order_by: Vec<OrderByConfig>,
    pub page_no: u32,
    pub page_size: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EntityListFilter {
    pub column: String,
    pub operator: FilterOperator,
    pub values: Vec<BindValue>,
}
