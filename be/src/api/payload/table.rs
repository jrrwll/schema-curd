use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::{api::{EffectiveRoleEnum, PageParam}, model::embed::{ColumnConfig, TableConfig}};

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct TableListParam {
    #[serde(flatten)]
    pub page: PageParam,
    #[serde(default)]
    pub datasource: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub disabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableListResult {
    pub id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub datasource: String,
    pub name: String,
    pub display_name: String,
    pub disabled: bool,
    pub effective_role: EffectiveRoleEnum,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableDetailResult {
    #[serde(flatten)]
    pub base: TableListResult,
    pub table_name: String,
    pub table_config: TableConfig,
    pub columns_config: Vec<ColumnConfig>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct TableCreateParam {
    pub datasource: String,
    pub name: String,
    pub display_name: String,
    pub table_name: String,
    pub table_config: TableConfig,
    pub columns_config: Vec<ColumnConfig>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct TableUpdateParam {
    pub id: i64,
    pub display_name: String,
    pub table_config: TableConfig,
    pub columns_config: Vec<ColumnConfig>,
}
