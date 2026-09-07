use serde::{Serialize, Deserialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DataType {
    Text,
    Int,
    Float,
    Bool,
    Json,
}

impl DataType {

    pub fn from_database_type(database_type: &str) -> Self {
        let normalized = database_type.to_ascii_lowercase();
        let base_type = normalized
            .split_once('(')
            .map_or(normalized.as_str(), |(base, _)| base)
            .trim();
        match base_type {
            "tinyint" | "smallint" | "mediumint" | "int" | "integer" | "bigint" | "serial"
            | "bigserial" | "smallserial" => DataType::Int,
            "decimal" | "numeric" | "float" | "double" | "double precision" | "real" => DataType::Float,
            "bool" | "boolean" => DataType::Bool,
            _ => DataType::Text,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ColumnConfig {
    pub name: String,
    pub display_name: String,
    pub data_type: DataType,
    #[serde(default)]
    pub optional: bool,
    #[serde(default)]
    pub sortable: bool,
    #[serde(default)]
    pub hidden_on_create: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub search_default_value: Option<Value>,
}

impl ColumnConfig {
    pub fn is_bool(&self) -> bool {
        self.data_type == DataType::Bool
    }

    pub fn is_numeric(&self) -> bool {
        matches!(self.data_type, DataType::Int | DataType::Float)
    }
}
