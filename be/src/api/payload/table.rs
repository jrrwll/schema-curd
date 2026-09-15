use corers::axum::ApiError;
use corers::time::format_datetime;
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::{
    api::{EffectiveRoleEnum, PageParam},
    model::embed::{ColumnConfig, TableConfig},
};
use crate::model::{DatasourceEntity, TableEntity};
use crate::util::deserialize_config;

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
    pub datasource_id: i64,
    pub datasource_display_name: String,
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

impl From<TableEntity> for TableListResult {
    fn from(value: TableEntity) -> Self {
        Self {
            id: value.id,
            created_at: format_datetime(value.created_at),
            updated_at: format_datetime(value.updated_at),
            datasource: value.datasource_name,
            name: value.name,
            display_name: value.display_name,
            disabled: value.disabled,
            effective_role: EffectiveRoleEnum::None,
        }
    }
}

impl TryFrom<(TableEntity, DatasourceEntity)> for TableDetailResult {
    type Error = ApiError;

    fn try_from((table, datasource): (TableEntity, DatasourceEntity)) -> Result<Self, Self::Error> {
        let table_config: TableConfig = deserialize_config(table.table_config.clone())?;
        let columns_config: Vec<ColumnConfig> = deserialize_config(table.columns_config.clone())?;

        let table_name = table.table_name.clone();
        Ok(Self {
            base: table.into(),
            table_name,
            table_config,
            columns_config,
            datasource_id: datasource.id,
            datasource_display_name: datasource.display_name,
        })
    }
}
