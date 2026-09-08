use anyhow::Context;
use corers::axum::ApiError;

use crate::{api::EntityListParam, model::{BindValue, EntityListFilter, EntityListPlan, embed::{FilterOperator, OrderByConfig}}, repo::ResolvedTable};
use crate::service::DatasourceTableConfig;
use super::value::normalize_value;

pub fn build_list_plan(
    config: &DatasourceTableConfig,
    param: &EntityListParam,
) -> Result<EntityListPlan, ApiError> {
    let mut unknown: Vec<_> = param
        .condition
        .keys()
        .filter(|name| !config.columns.contains_key(*name))
        .cloned()
        .collect();
    if !unknown.is_empty() {
        unknown.sort();
        return Err(ApiError::Validation(format!(
            "Unconfigured query columns: {}",
            unknown.join(", ")
        )));
    }

    let mut filters = config
        .table_config
        .select_fixed_where
        .iter()
        .map(|condition| {
            let values = if condition.operator.accepts_multiple_values() {
                condition
                    .value
                    .as_array()
                    .expect("Collection filter was validated")
                    .iter()
                    .map(|v|v.try_into())
                    .collect::<Result<Vec<_>, ApiError>>()?
            } else {
                let value: BindValue = (&condition.value).try_into()?;
                vec![value]
            };
            Ok(EntityListFilter {
                column: condition.column.clone(),
                operator: condition.operator,
                values,
            })
        })
        .collect::<Result<Vec<_>, ApiError>>()?;

    let mut conditions: Vec<_> = param.condition.iter().collect();
    conditions.sort_by_key(|(name, _)| *name);
    for (name, raw_value) in conditions {
        if raw_value.is_null() || raw_value.as_str().is_some_and(str::is_empty) {
            continue;
        }
        let column = config.columns
            .get(name)
            .with_context(|| "Unexpect error: missing column {name}")?;
        let mut value = normalize_value(raw_value, column, &config.datasource_config, false)?;
        let operator = if column.is_numeric() || column.is_bool() {
            FilterOperator::Equal
        } else {
            let BindValue::String(text) = value else {
                unreachable!("Text column normalizes to string")
            };
            value = BindValue::String(format!("%{text}%"));
            FilterOperator::Like
        };
        filters.push(EntityListFilter {
            column: name.clone(),
            operator,
            values: vec![value],
        });
    }

    let order_by = build_order_by(param, resolved)?;

    Ok(EntityListPlan {
        filters,
        order_by,
        page_no: param.page.page_no,
        page_size: param.page.page_size,
    })
}

fn build_order_by(param: &EntityListParam, resolved: &ResolvedTable) -> Result<Vec<OrderByConfig>, ApiError> {
    let order_by = if let Some(order_by) = &param.order_by {
        let column = resolved
            .table.columns
            .get(&order_by.sort)
            .filter(|column| column.sortable)
            .ok_or_else(|| ApiError::Validation("Field does not support sorting".to_owned()))?;
        vec![OrderByConfig {
            sort: column.name.clone(),
            desc: order_by.desc,
        }]
    } else if !resolved.table.table_config.default_order_by.is_empty() {
        resolved.table.table_config.default_order_by.clone()
    } else {
        resolved
            .table.table_config
            .primary_keys.iter().map(|column| OrderByConfig {
                sort: column.clone(),
                desc: true,
            })
            .collect()
    };
    Ok(order_by)
}