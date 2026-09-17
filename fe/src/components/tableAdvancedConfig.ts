import type { Value } from '../types/common';
import type { FixedWhereConfig, TableConfig } from '../types/table';

export interface FixedValueFormRow {
  id: number;
  column: string;
  value: string | null;
}

export interface FixedWhereFormRow {
  id: number;
  column: string;
  operator: FixedWhereConfig['operator'];
  values: Array<string | null>;
}

export interface DefaultOrderFormRow {
  id: number;
  sort: string;
  order: 'asc' | 'desc';
}

export interface TableAdvancedFormValue {
  primary_keys: string[];
  readonly: boolean;
  sortable_columns: string[];
  search_default_value: FixedValueFormRow[];
  fixed_value: FixedValueFormRow[];
  fixed_where: FixedWhereFormRow[];
  default_order_by: DefaultOrderFormRow[];
}

export interface TableAdvancedColumn {
  name: string;
  data_type: 'text' | 'int' | 'float' | 'bool' | 'json';
  optional: boolean;
}

let nextRowId = 1;

export function tableAdvancedRowId() {
  const id = nextRowId;
  nextRowId += 1;
  return id;
}

export const EMPTY_TABLE_ADVANCED_FORM: TableAdvancedFormValue = {
  primary_keys: [],
  readonly: false,
  sortable_columns: [],
  search_default_value: [],
  fixed_value: [],
  fixed_where: [],
  default_order_by: [],
};

export function tableAdvancedFormValue(config: TableConfig): TableAdvancedFormValue {
  return {
    primary_keys: config.primary_keys ?? [],
    readonly: config.readonly,
    sortable_columns: config.sortable_columns ?? [],
    search_default_value: Object.entries(config.search_default_value ?? {}).map(([column, value]) => ({
      id: tableAdvancedRowId(),
      column,
      value: formatValue(value),
    })),
    fixed_value: Object.entries(config.insert_fixed_values).map(([column, value]) => ({
      id: tableAdvancedRowId(),
      column,
      value: formatValue(value),
    })),
    fixed_where: config.select_fixed_where.map((condition) => ({
      id: tableAdvancedRowId(),
      column: condition.column,
      operator: condition.operator,
      values: (Array.isArray(condition.value) ? condition.value : [condition.value]).map(formatValue),
    })),
    default_order_by: config.default_order_by.map((order) => ({
      id: tableAdvancedRowId(),
      sort: order.sort,
      order: order.desc ? 'desc' : 'asc',
    })),
  };
}

export function buildTableAdvancedConfig(
  value: TableAdvancedFormValue,
  physicalColumns: TableAdvancedColumn[],
  logicalColumns: TableAdvancedColumn[],
): TableConfig {
  const physicalByName = new Map(physicalColumns.map((column) => [column.name, column]));
  const logicalByName = new Map(logicalColumns.map((column) => [column.name, column]));
  const primaryKeys = uniqueColumns(value.primary_keys, physicalByName, 'primary_keys');
  const sortableColumns = uniqueColumns(value.sortable_columns, logicalByName, 'sortable_columns');
  const searchDefaultValue: Record<string, Value> = {};
  for (const row of value.search_default_value) {
    const column = requireColumn(row.column, logicalByName, 'search_default_value');
    if (Object.hasOwn(searchDefaultValue, row.column)) throw new Error(`Column ${row.column} is duplicated in search_default_value`);
    searchDefaultValue[row.column] = parseValue(row.value, column, 'search_default_value');
  }
  const fixedValue: Record<string, Value> = {};
  for (const row of value.fixed_value) {
    const column = requireColumn(row.column, physicalByName, 'insert_fixed_values');
    if (Object.hasOwn(fixedValue, row.column)) throw new Error(`Column ${row.column} is duplicated in insert_fixed_values`);
    fixedValue[row.column] = parseValue(row.value, column, 'insert_fixed_values');
  }

  const fixedWhere = value.fixed_where.map((row) => {
    const column = requireColumn(row.column, physicalByName, 'select_fixed_where');
    const multiple = row.operator === 'in' || row.operator === 'not in';
    const values = row.values.map((item) => parseValue(item, column, 'select_fixed_where'));
    if (values.length === 0) throw new Error('Field select_fixed_where requires at least one value');
    return { column: row.column, operator: row.operator, value: multiple ? values : values[0] };
  });

  const usedSorts = new Set<string>();
  const defaultOrderBy = value.default_order_by.map((row) => {
    requireColumn(row.sort, physicalByName, 'default_order_by');
    if (usedSorts.has(row.sort)) throw new Error(`Column ${row.sort} is duplicated in default_order_by`);
    usedSorts.add(row.sort);
    return { sort: row.sort, desc: row.order === 'desc' };
  });

  return {
    readonly: value.readonly,
    primary_keys: primaryKeys,
    sortable_columns: sortableColumns,
    search_default_value: searchDefaultValue,
    insert_fixed_values: fixedValue,
    select_fixed_where: fixedWhere,
    default_order_by: defaultOrderBy,
  };
}

export function tableAdvancedReferencedColumns(value: TableAdvancedFormValue): ReadonlySet<string> {
  return new Set([
    ...value.sortable_columns,
    ...value.search_default_value.map((row) => row.column),
  ].filter(Boolean));
}

export function clearColumnDependentAdvanced(value: TableAdvancedFormValue): TableAdvancedFormValue {
  return {
    ...value,
    primary_keys: [],
    sortable_columns: [],
    search_default_value: [],
    fixed_value: [],
    fixed_where: [],
    default_order_by: [],
  };
}

function uniqueColumns(names: string[], columns: Map<string, TableAdvancedColumn>, field: string) {
  const used = new Set<string>();
  return names.map((name) => {
    requireColumn(name, columns, field);
    if (used.has(name)) throw new Error(`Column ${name} is duplicated in ${field}`);
    used.add(name);
    return name;
  });
}

function requireColumn(name: string, columns: Map<string, TableAdvancedColumn>, field: string) {
  const column = columns.get(name);
  if (!column) throw new Error(`Field ${field} must select an existing column`);
  return column;
}

function parseValue(value: string | null, column: TableAdvancedColumn, field: string): Value {
  if (value === null) {
    if (column.optional) return null;
    throw new Error(`Field ${field}.${column.name} cannot be NULL`);
  }
  if (column.data_type === 'text') return value;
  if (column.data_type === 'json') {
    try {
      JSON.parse(value);
    } catch {
      throw new Error(`Field ${field}.${column.name} must be valid JSON`);
    }
    return value;
  }
  if (column.data_type === 'bool') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Field ${field}.${column.name} must be a boolean`);
  }
  if (value.trim() === '') throw new Error(`Field ${field}.${column.name} is required`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Field ${field}.${column.name} must be a number`);
  if (column.data_type === 'int' && !Number.isSafeInteger(parsed)) throw new Error(`Field ${field}.${column.name} must be an integer`);
  return parsed;
}

function formatValue(value: Value) {
  return value === null ? null : String(value);
}
