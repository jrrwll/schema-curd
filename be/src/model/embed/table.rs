use crate::model::TableEntity;
use crate::model::embed::ColumnConfig;
use crate::util::deserialize_config;
use corers::axum::ApiError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
// #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
// #[serde(try_from = "i32")]
// #[serde(into = "i32")]
// #[repr(i32)]
// pub enum TableStatusEnum {
//     Draft = 0,
//     Enabled = 1,
//     Disabled = 2,
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

#[derive(Debug)]
pub struct TableDetailConfig {
    pub table_name: String,
    pub table_config: TableConfig,
    pub columns: HashMap<String, ColumnConfig>,
}

impl TryFrom<TableEntity> for TableDetailConfig {
    type Error = ApiError;

    fn try_from(value: TableEntity) -> Result<Self, Self::Error> {
        let table_config: TableConfig = deserialize_config(value.table_config.clone())?;
        let columns_config: Vec<ColumnConfig> = deserialize_config(value.columns_config.clone())?;
        let columns = columns_config
            .into_iter()
            .map(|c| (c.name.clone(), c))
            .collect::<HashMap<_, _>>();
        let table_name = value.table_name.clone();
        Ok(Self { table_name, table_config, columns })
    }
}
