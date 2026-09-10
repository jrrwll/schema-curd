use std::collections::HashMap;

use anyhow::Context;
use chrono::{NaiveDate, NaiveDateTime};
use serde_json::{Map, Number, Value};
use sqlx::{
    Column, Row, TypeInfo, ValueRef,
    mysql::{MySqlRow, types::MySqlTime},
};

use crate::model::embed::{ColumnConfig, DataType};

pub fn mysql_row_to_value(row: &MySqlRow, columns: &HashMap<String, ColumnConfig>) -> anyhow::Result<Value> {
    let mut object = Map::with_capacity(columns.len());

    for (index, (column_name, column)) in columns.iter().enumerate() {
        let value = mysql_column_value(row, index, column)
            .with_context(|| format!("Failed to decode column {}", column_name))?;
        object.insert(column.name.clone(), value);
    }
    Ok(Value::Object(object))
}

fn mysql_column_value(row: &MySqlRow, index: usize, column: &ColumnConfig) -> anyhow::Result<Value> {
    if row.try_get_raw(index)?.is_null() {
        return Ok(Value::Null);
    }

    Ok(match column.data_type {
        DataType::Text | DataType::Json => Value::String(mysql_text_value(row, index)?),
        DataType::Int => {
            if row.column(index).type_info().name().contains("UNSIGNED") {
                Value::Number(row.try_get::<u64, _>(index)?.into())
            } else {
                Value::Number(row.try_get::<i64, _>(index)?.into())
            }
        }
        DataType::Float => {
            let value = if row.column(index).type_info().name() == "DECIMAL" {
                row.try_get_unchecked::<String, _>(index)?.parse::<f64>()?
            } else {
                row.try_get::<f64, _>(index)?
            };
            Value::Number(Number::from_f64(value).ok_or_else(|| anyhow::anyhow!("Float value is not finite"))?)
        }
        DataType::Bool => Value::Bool(row.try_get::<bool, _>(index)?),
    })
}

fn mysql_text_value(row: &MySqlRow, index: usize) -> anyhow::Result<String> {
    Ok(match row.column(index).type_info().name() {
        "DATE" => row.try_get::<NaiveDate, _>(index)?.to_string(),
        "DATETIME" | "TIMESTAMP" => row.try_get::<NaiveDateTime, _>(index)?.to_string(),
        "TIME" => row.try_get::<MySqlTime, _>(index)?.to_string(),
        "YEAR" => row.try_get::<u16, _>(index)?.to_string(),
        _ => row.try_get_unchecked::<String, _>(index)?,
    })
}
