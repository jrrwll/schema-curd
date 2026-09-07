use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

// #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
// #[serde(try_from = "i32")]
// #[serde(into = "i32")]
// #[repr(i32)]
// pub enum TableStatusEnum {
//     Draft = 0,
//     Enabled = 1,
//     Disabled = 2,
// }

// impl From<TableStatusEnum> for i32 {
//     fn from(value: TableStatusEnum) -> Self {
//         value as i32
//     }
// }

// impl TryFrom<i32> for TableStatusEnum {
//     type Error = String;

//     fn try_from(value: i32) -> Result<Self, Self::Error> {
//         match value {
//             0 => Ok(Self::Draft),
//             1 => Ok(Self::Enabled),
//             2 => Ok(Self::Disabled),
//             _ => Err(format!("Invalid table status {value}")),
//         }
//     }
// }

macro_rules! define_filter_operator {
    ($($variant:ident => $sql:literal),* $(,)?) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, strum::EnumString, strum::Display)]
        pub enum FilterOperator {
            $(
                #[serde(rename = $sql)]
                #[strum(serialize = $sql)]
                $variant,
            )*
        }
    };
}

define_filter_operator! {
    Equal => "=",
    NotEqual => "!=",
    GreaterThan => ">",
    GreaterThanOrEqual => ">=",
    LessThan => "<",
    LessThanOrEqual => "<=",
    Like => "like",
    NotLike => "not like",
    In => "in",
    NotIn => "not in",
}

impl FilterOperator {
    pub fn accepts_multiple_values(self) -> bool {
        matches!(self, Self::In | Self::NotIn)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FixedWhereConfig {
    pub column: String,
    pub operator: FilterOperator,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderByConfig {
    pub sort: String,
    pub desc: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct TableConfig {
    pub readonly: bool,
    pub primary_keys: Vec<String>,
    pub insert_fixed_values: HashMap<String, Value>,
    pub select_fixed_where: Vec<FixedWhereConfig>,
    pub default_order_by: Vec<OrderByConfig>,
}
