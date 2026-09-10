use std::collections::HashMap;

use corers::axum::ApiError;
use serde_json::Value;

use crate::model::embed::TableDetailConfig;
use crate::{
    model::{
        BindValue,
        embed::{ColumnConfig, DataType, DatasourceConfig},
    },
    util::is_pattern_match,
};

pub fn validate_columns(
    config: &TableDetailConfig, datasource_config: &DatasourceConfig, values: &HashMap<String, Value>, creating: bool,
) -> Result<HashMap<String, BindValue>, ApiError> {
    let mut unknown: Vec<_> = values
        .keys()
        .filter(|name| !config.columns.contains_key(*name))
        .cloned()
        .collect();
    if !unknown.is_empty() {
        unknown.sort();
        return Err(ApiError::Validation(format!("Unconfigured columns: {}", unknown.join(", "))));
    }

    let mut result = HashMap::new();
    for (column_name, column) in &config.columns {
        let is_primary_key = config.table_config.primary_keys.contains(&column_name);
        if creating && (is_primary_key || column.hidden_on_create) {
            continue;
        }

        // optional
        let Some(value) = values.get(&column.name) else {
            if creating && !column.optional {
                return Err(ApiError::Validation(format!("Field {} is required", column.display_name)));
            }
            continue;
        };

        if value.is_null() || value.as_str().is_some_and(str::is_empty) {
            if !column.optional {
                return Err(ApiError::Validation(format!("Field {} is required", column.display_name)));
            }
            result.insert(column_name.clone(), BindValue::Null);
        } else {
            let normalized_value = normalize_value(value, column, datasource_config, true)?;
            result.insert(column_name.clone(), normalized_value);
        }
    }
    Ok(result)
}

pub fn normalize_value(
    value: &Value, column: &ColumnConfig, datasource_config: &DatasourceConfig, validate_pattern: bool,
) -> Result<BindValue, ApiError> {
    if column.is_bool() {
        let Value::Bool(boolean) = value else {
            return Err(ApiError::Validation(format!("Field {} must be a boolean", column.display_name)));
        };
        return Ok(if datasource_config.bool_as_int {
            BindValue::Integer(i64::from(*boolean))
        } else {
            BindValue::Bool(*boolean)
        });
    }
    if column.data_type == DataType::Int {
        return value
            .as_i64()
            .map(BindValue::Integer)
            .ok_or_else(|| ApiError::Validation(format!("Field {} must be an integer", column.display_name)));
    }
    if column.data_type == DataType::Float {
        return value
            .as_f64()
            .map(BindValue::Float)
            .ok_or_else(|| ApiError::Validation(format!("Field {} must be a float", column.display_name)));
    }

    let Value::String(text) = value else {
        return Err(ApiError::Validation(format!("Field {} must be a string", column.display_name)));
    };
    if validate_pattern {
        if let Some(pattern) = &column.pattern
            && !is_pattern_match(text, pattern)?
        {
            return Err(ApiError::Validation(format!("Field {} has an invalid format", column.display_name)));
        }
    }

    Ok(BindValue::String(text.clone()))
}
