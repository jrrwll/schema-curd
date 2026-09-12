use anyhow::Context;
use sqlx::{Database, QueryBuilder};

use crate::model::embed::TableDetailConfig;
use crate::model::{BindValue, EntityListFilter, EntityListPlan};

pub fn build_create_query<DB: Database>(
    table: &str, values: Vec<(String, BindValue)>, quote: char,
) -> QueryBuilder<DB>
where
    for<'q> Option<String>: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> String: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> i64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> f64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> bool: sqlx::Encode<'q, DB> + sqlx::Type<DB>, {
    let mut builder = QueryBuilder::<DB>::new("insert into ");
    builder.push(identifier(table, quote)).push(" (");
    {
        let mut separated = builder.separated(", ");
        for (name, _) in &values {
            separated.push(identifier(name, quote));
        }
    }
    builder.push(") values (");
    for (index, (_, value)) in values.into_iter().enumerate() {
        if index > 0 {
            builder.push(", ");
        }
        push_bind(&mut builder, value);
    }
    builder.push(")");
    builder
}

pub fn build_update_query<DB: Database>(
    table: &str, values: Vec<(String, BindValue)>, where_values: Vec<(String, BindValue)>, quote: char,
) -> QueryBuilder<DB>
where
    for<'q> Option<String>: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> String: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> i64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> f64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> bool: sqlx::Encode<'q, DB> + sqlx::Type<DB>, {
    let mut builder = QueryBuilder::<DB>::new("update ");
    builder.push(identifier(table, quote)).push(" set ");
    for (index, (name, value)) in values.into_iter().enumerate() {
        if index > 0 {
            builder.push(", ");
        }
        builder.push(identifier(&name, quote)).push(" = ");
        push_bind(&mut builder, value);
    }
    builder.push(" where ");
    for (index, (name, value)) in where_values.into_iter().enumerate() {
        if index > 0 {
            builder.push(" and ");
        }
        builder.push(identifier(&name, quote)).push(" = ");
        push_bind(&mut builder, value);
    }
    builder
}

pub fn build_list_queries<DB: Database>(
    table: &TableDetailConfig, plan: EntityListPlan, quote: char, json_function: Option<&str>,
) -> anyhow::Result<(QueryBuilder<DB>, QueryBuilder<DB>)>
where
    for<'q> Option<String>: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> String: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> i64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> f64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> bool: sqlx::Encode<'q, DB> + sqlx::Type<DB>, {
    let mut count = QueryBuilder::<DB>::new("select count(*) from ");
    count.push(identifier(&table.table_name, quote));
    push_where(&mut count, plan.filters.clone(), quote)?;

    let mut query = QueryBuilder::<DB>::new("select ");
    match json_function {
        Some(json_function) => {
            query.push(json_function).push("(");
            {
                let mut separated = query.separated(", ");
                for (column_name, column_config) in &table.columns {
                    if !column_config.hidden_on_list {
                        separated.push_bind(column_name.clone());
                        separated.push(identifier(&column_name, quote));
                    }
                }
            }
            query.push(")");
        }
        None => {
            let mut separated = query.separated(", ");
            for (column_name, _) in &table.columns {
                separated.push(identifier(&column_name, quote));
            }
        }
    }
    query.push(" from ").push(identifier(&table.table_name, quote));
    push_where(&mut query, plan.filters, quote)?;
    query.push(" order by ");
    {
        let mut separated = query.separated(", ");
        for order in plan.order_by {
            separated.push(identifier(&order.sort, quote));
            separated
                .push_unseparated(" ")
                .push_unseparated(if order.desc { "desc" } else { "asc" });
        }
    }
    let limit = i64::from(plan.page_size);
    let offset = i64::try_from(u64::from(plan.page_no - 1) * u64::from(plan.page_size)).unwrap_or(i64::MAX);
    // limit ? maybe not supported
    query.push(" limit ").push(limit);
    query.push(" offset ").push(offset);
    Ok((count, query))
}

fn push_where<DB: Database>(
    builder: &mut QueryBuilder<DB>, filters: Vec<EntityListFilter>, quote: char,
) -> anyhow::Result<()>
where
    for<'q> Option<String>: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> String: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> i64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> f64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> bool: sqlx::Encode<'q, DB> + sqlx::Type<DB>, {
    if filters.is_empty() {
        return Ok(());
    }
    builder.push(" where ");
    for (index, filter) in filters.into_iter().enumerate() {
        if index > 0 {
            builder.push(" and ");
        }
        builder
            .push(identifier(&filter.column, quote))
            .push(" ")
            .push(filter.operator.to_string())
            .push(" ");
        if filter.operator.accepts_multiple_values() {
            builder.push("(");
            for (value_index, value) in filter.values.into_iter().enumerate() {
                if value_index > 0 {
                    builder.push(", ");
                }
                push_bind(builder, value);
            }
            builder.push(")");
        } else {
            let value = filter
                .values
                .into_iter()
                .next()
                .with_context(|| "Invalided filters: {filter.values}")?;
            push_bind(builder, value);
        }
    }
    Ok(())
}

fn push_bind<DB: Database>(builder: &mut QueryBuilder<DB>, value: BindValue)
where
    for<'q> Option<String>: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> String: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> i64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> f64: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> bool: sqlx::Encode<'q, DB> + sqlx::Type<DB>, {
    match value {
        BindValue::Null => {
            builder.push_bind(Option::<String>::None);
        }
        BindValue::String(value) => {
            builder.push_bind(value);
        }
        BindValue::Integer(value) => {
            builder.push_bind(value);
        }
        BindValue::Unsigned(value) => {
            builder.push_bind(i64::try_from(value).unwrap_or(i64::MAX));
        }
        BindValue::Float(value) => {
            builder.push_bind(value);
        }
        BindValue::Bool(value) => {
            builder.push_bind(value);
        }
    }
}

fn identifier(value: &str, quote: char) -> String {
    let escaped = value.replace(quote, &format!("{quote}{quote}"));
    format!("{quote}{escaped}{quote}")
}
