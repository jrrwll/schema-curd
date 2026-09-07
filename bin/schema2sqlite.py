#!/usr/bin/env python3

import json
import os
import re
import sqlite3
import sys
import tempfile
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = PROJECT_DIR / "be" / "schema.json"
SCHEMA_SQL = PROJECT_DIR / "be" / "migrations" / "schema.sqlite.sql"
IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")
DATA_TYPES = {"text", "int", "float", "bool"}
FILTER_OPERATORS = {
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "like",
    "not_like",
    "in",
    "not_in",
}
DATASOURCE_FIELDS = {
    "id",
    "name",
    "display_name",
    "url",
    "username",
    "password",
    "tables",
    "bool_as_int",
}
TABLE_FIELDS = {
    "name",
    "display_name",
    "columns",
    "insert_readonly",
    "insert_fixed_value",
    "list_fixed_where",
    "list_default_order_by",
}
COLUMN_FIELDS = {
    "name",
    "display_name",
    "data_type",
    "optional",
    "is_primary_key",
    "sortable",
    "hidden_on_create",
    "is_json",
    "pattern",
    "search_default_value",
}
FIXED_WHERE_FIELDS = {"column", "operator", "value"}
ORDER_BY_FIELDS = {"sort", "order"}


def require_string(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Field {field} must be a non-empty string")
    return value


def require_object(value, field):
    if not isinstance(value, dict):
        raise ValueError(f"Field {field} must be an object")
    return value


def validate_fields(value, allowed_fields, field):
    unknown_fields = set(value) - allowed_fields
    if unknown_fields:
        raise ValueError(
            f"Field {field} contains unsupported fields: {', '.join(sorted(unknown_fields))}"
        )


def validate_bool(value, field):
    if value is not None and not isinstance(value, bool):
        raise ValueError(f"Field {field} must be a boolean")


def validate_identifier(value, field):
    require_string(value, field)
    if not IDENTIFIER.fullmatch(value):
        raise ValueError(f"Field {field} is not a valid SQL identifier: {value}")


def validate_order_by(value, field):
    if not isinstance(value, list):
        raise ValueError(f"Field {field} must be an array")
    for index, item in enumerate(value, start=1):
        item_field = f"{field}[{index}]"
        require_object(item, item_field)
        validate_fields(item, ORDER_BY_FIELDS, item_field)
        validate_identifier(item.get("sort"), f"{item_field}.sort")
        if item.get("order") not in ("asc", "desc"):
            raise ValueError(f"Field {item_field}.order must be asc or desc")


def validate_fixed_where(value, field):
    if not isinstance(value, list):
        raise ValueError(f"Field {field} must be an array")
    for index, item in enumerate(value, start=1):
        item_field = f"{field}[{index}]"
        require_object(item, item_field)
        validate_fields(item, FIXED_WHERE_FIELDS, item_field)
        validate_identifier(item.get("column"), f"{item_field}.column")
        if item.get("operator") not in FILTER_OPERATORS:
            raise ValueError(f"Field {item_field}.operator is invalid")
        operator = item.get("operator")
        value = item.get("value")
        if operator in ("in", "not_in"):
            if (
                not isinstance(value, list)
                or not value
                or any(item is None or isinstance(item, (list, dict)) for item in value)
            ):
                raise ValueError(
                    f"Field {item_field}.value must contain non-null scalars"
                )
        elif value is None or isinstance(value, (list, dict)):
            raise ValueError(f"Field {item_field}.value must be a non-null scalar")


def validate_column(column, field):
    require_object(column, field)
    validate_fields(column, COLUMN_FIELDS, field)
    validate_identifier(column.get("name"), f"{field}.name")
    require_string(column.get("display_name"), f"{field}.display_name")
    data_type = require_string(column.get("data_type"), f"{field}.data_type")
    if data_type not in DATA_TYPES:
        raise ValueError(f"Field {field}.data_type must be text, int, float, or bool")
    for optional_field in (
        "optional",
        "is_primary_key",
        "sortable",
        "hidden_on_create",
        "is_json",
    ):
        validate_bool(column.get(optional_field), f"{field}.{optional_field}")

    pattern = column.get("pattern")
    if pattern is not None:
        if not isinstance(pattern, str):
            raise ValueError(f"Field {field}.pattern must be a string")
        try:
            re.compile(f"^(?:{pattern})$")
        except re.error as error:
            raise ValueError(f"Field {field}.pattern is invalid: {error}") from error

    if "search_default_value" in column and isinstance(
        column["search_default_value"], (list, dict)
    ):
        raise ValueError(f"Field {field}.search_default_value must be a scalar")


def validate_table(table, field):
    require_object(table, field)
    validate_fields(table, TABLE_FIELDS, field)
    validate_identifier(table.get("name"), f"{field}.name")
    require_string(table.get("display_name"), f"{field}.display_name")

    columns = table.get("columns")
    if not isinstance(columns, list) or not columns:
        raise ValueError(f"Field {field}.columns must be a non-empty array")
    column_names = set()
    has_primary_key = False
    for column_index, column in enumerate(columns, start=1):
        column_field = f"{field}.columns[{column_index}]"
        validate_column(column, column_field)
        column_name = column["name"]
        if column_name in column_names:
            raise ValueError(f"Field {field} contains duplicate column name: {column_name}")
        column_names.add(column_name)
        has_primary_key = has_primary_key or column.get("is_primary_key") is True
    if not has_primary_key:
        raise ValueError(f"Field {field} must contain at least one is_primary_key")

    validate_bool(table.get("insert_readonly"), f"{field}.insert_readonly")

    if "insert_fixed_value" in table:
        fixed_value = require_object(
            table["insert_fixed_value"], f"{field}.insert_fixed_value"
        )
        for column_name, value in fixed_value.items():
            validate_identifier(column_name, f"{field}.insert_fixed_value key")
            if column_name in column_names:
                raise ValueError(
                    f"Field {field}.insert_fixed_value.{column_name} must not also appear in columns"
                )
            if isinstance(value, (list, dict)):
                raise ValueError(
                    f"Field {field}.insert_fixed_value.{column_name} must be a scalar"
                )

    if "list_fixed_where" in table:
        validate_fixed_where(table["list_fixed_where"], f"{field}.list_fixed_where")
    if "list_default_order_by" in table:
        validate_order_by(
            table["list_default_order_by"], f"{field}.list_default_order_by"
        )


def validate_schema(sources):
    if not isinstance(sources, list):
        raise ValueError("Schema root must be an array")

    datasource_ids = set()
    datasource_names = set()
    for source_index, source in enumerate(sources, start=1):
        field = f"datasource[{source_index}]"
        require_object(source, field)
        validate_fields(source, DATASOURCE_FIELDS, field)
        datasource_id = source.get("id", source_index)
        if (
            isinstance(datasource_id, bool)
            or not isinstance(datasource_id, int)
            or datasource_id <= 0
        ):
            raise ValueError(f"Field {field}.id must be a positive integer")
        if datasource_id in datasource_ids:
            raise ValueError(f"Duplicate datasource id: {datasource_id}")
        datasource_ids.add(datasource_id)

        datasource_name = require_string(source.get("name"), f"{field}.name")
        if datasource_name in datasource_names:
            raise ValueError(f"Duplicate datasource name: {datasource_name}")
        datasource_names.add(datasource_name)
        require_string(source.get("display_name"), f"{field}.display_name")
        url = require_string(source.get("url"), f"{field}.url")
        if not url.startswith(("mysql://", "postgres://", "postgresql://")):
            raise ValueError(
                f"Field {field}.url must use mysql, postgres, or postgresql protocol"
            )
        for optional_field in ("username", "password"):
            value = source.get(optional_field)
            if value is not None and not isinstance(value, str):
                raise ValueError(f"Field {field}.{optional_field} must be a string")
        validate_bool(source.get("bool_as_int"), f"{field}.bool_as_int")

        tables = source.get("tables")
        if not isinstance(tables, list):
            raise ValueError(f"Field {field}.tables must be an array")
        table_names = set()
        for table_index, table in enumerate(tables, start=1):
            table_field = f"{field}.tables[{table_index}]"
            validate_table(table, table_field)
            table_name = table["name"]
            if table_name in table_names:
                raise ValueError(f"Field {field} contains duplicate table name: {table_name}")
            table_names.add(table_name)


def config_json(value, excluded_fields):
    config = {key: item for key, item in value.items() if key not in excluded_fields}
    return json.dumps(config, ensure_ascii=False, separators=(",", ":"))


def populate_database(connection, sources):
    for index, source in enumerate(sources, start=1):
        datasource_id = source.get("id", index)
        if (
            isinstance(datasource_id, bool)
            or not isinstance(datasource_id, int)
            or datasource_id <= 0
        ):
            raise ValueError(f"Field datasource[{index}].id must be a positive integer")

        connection.execute(
            """
            insert into datasource_info
                (id, name, url, username, password, display_name, config)
            values (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datasource_id,
                source["name"],
                source["url"],
                source.get("username") or "",
                source.get("password") or "",
                source["display_name"],
                config_json(
                    source,
                    {
                        "id",
                        "name",
                        "url",
                        "username",
                        "password",
                        "display_name",
                        "tables",
                    },
                ),
            ),
        )

        for table in source["tables"]:
            connection.execute(
                """
                insert into table_info
                    (datasource_name, name, display_name, status, config)
                values (?, ?, ?, 1, ?)
                """,
                (
                    source["name"],
                    table["name"],
                    table["display_name"],
                    config_json(
                        table,
                        {"name", "display_name", "columns"},
                    ),
                ),
            )

            for column in table["columns"]:
                connection.execute(
                    """
                    insert into column_info
                        (datasource_name, table_name, name, display_name, is_primary_key, config)
                    values (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        source["name"],
                        table["name"],
                        column["name"],
                        column["display_name"],
                        column.get("is_primary_key") is True,
                        config_json(
                            column,
                            {"name", "display_name", "is_primary_key"},
                        ),
                    ),
                )


def convert(input_path):
    input_path = input_path.resolve(strict=True)
    output_path = input_path.with_name("schema.sqlite")
    if output_path.exists() or output_path.is_symlink():
        raise FileExistsError(f"Output path already exists: {output_path}")

    with input_path.open(encoding="utf-8") as source_file:
        sources = json.load(source_file)
    validate_schema(sources)

    schema_sql = SCHEMA_SQL.read_text(encoding="utf-8")
    temp_file = tempfile.NamedTemporaryFile(
        prefix=".schema.sqlite.tmp.", dir=input_path.parent, delete=False
    )
    temp_path = Path(temp_file.name)
    temp_file.close()

    try:
        connection = sqlite3.connect(temp_path)
        try:
            connection.executescript(schema_sql)
            with connection:
                populate_database(connection, sources)
        finally:
            connection.close()

        os.link(temp_path, output_path)
        temp_path.unlink()
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise

    return output_path


def main():
    if len(sys.argv) > 2:
        raise ValueError(f"Usage: {Path(sys.argv[0]).name} [schema.json]")
    input_path = Path(sys.argv[1]) if len(sys.argv) == 2 else DEFAULT_INPUT
    output_path = convert(input_path)
    print(f"SQLite schema created: {output_path}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, json.JSONDecodeError, sqlite3.Error, ValueError) as error:
        print(f"Schema2sqlite: {error}", file=sys.stderr)
        sys.exit(1)
