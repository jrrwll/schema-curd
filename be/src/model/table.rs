use chrono::NaiveDateTime;
use corers::axum::ApiError;
use corers::time::format_datetime;

use crate::model::DatasourceEntity;
use crate::{
    api::{EffectiveRoleEnum, TableDetailResult, TableListResult},
    model::embed::{ColumnConfig, TableConfig},
    util::deserialize_config,
};

#[derive(sqlx::FromRow)]
pub struct TableEntity {
    pub id: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: i64,
    pub created_by: Option<i64>,
    pub updated_by: Option<i64>,
    pub datasource_name: String,
    pub name: String,
    pub display_name: String,
    pub disabled: bool,
    pub table_name: String,
    pub table_config: Option<String>,
    pub columns_config: Option<String>,
}

pub struct CreateTable {
    pub datasource_name: String,
    pub name: String,
    pub display_name: String,
    pub table_name: String,
    pub table_config: String,
    pub columns_config: String,
}

pub struct UpdateTable {
    pub id: i64,
    pub display_name: String,
    pub table_config: String,
    pub columns_config: String,
}

#[derive(Clone, Default, sqlx::FromRow)]
pub struct MetaTable {
    pub id: i64,
    pub name: String,
    pub datasource_name: String,
    pub table_name: String,
    pub table_config: Option<String>,
    pub columns_config: Option<String>,
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
