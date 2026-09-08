use crate::model::embed::{ColumnConfig, DatasourceConfig, TableConfig};
use std::collections::HashMap;

pub struct DatasourceTableConfig {
    pub datasource_config: DatasourceConfig,
    pub table_name: String,
    pub table_config: TableConfig,
    pub columns: HashMap<String, ColumnConfig>,
}
