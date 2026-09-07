import { Plus, Trash2 } from 'lucide-solid';
import { For, Show } from 'solid-js';
import type {
  FixedWhereConfig,
  TableMetadataConfig,
  Value,
} from '../types';
import BooleanSwitch from './BooleanSwitch';

type FilterOperator = FixedWhereConfig['operator'];

export interface FixedValueFormRow {
  id: number;
  column: string;
  value: string;
}

export interface FixedWhereFormRow {
  id: number;
  column: string;
  operator: FilterOperator;
  values: string[];
}

export interface DefaultOrderFormRow {
  id: number;
  sort: string;
  order: 'asc' | 'desc';
}

export interface TableAdvancedFormValue {
  readonly: boolean;
  fixed_value: FixedValueFormRow[];
  fixed_where: FixedWhereFormRow[];
  default_order_by: DefaultOrderFormRow[];
}

export interface TableAdvancedColumn {
  name: string;
  data_type: 'text' | 'int' | 'float' | 'bool';
}

interface TableAdvancedSettingsProps {
  value: TableAdvancedFormValue;
  columns: TableAdvancedColumn[];
  onChange: (value: TableAdvancedFormValue) => void;
}

interface TypedValueInputProps {
  column?: TableAdvancedColumn;
  value: string;
  onInput: (value: string) => void;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: 'like', label: 'like' },
  { value: 'not_like', label: 'not like' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
];

let nextRowId = 1;

function rowId() {
  const id = nextRowId;
  nextRowId += 1;
  return id;
}

export const EMPTY_TABLE_ADVANCED_FORM: TableAdvancedFormValue = {
  readonly: false,
  fixed_value: [],
  fixed_where: [],
  default_order_by: [],
};

export function tableAdvancedFormValue(config: TableMetadataConfig): TableAdvancedFormValue {
  return {
    readonly: config.insert_readonly,
    fixed_value: Object.entries(config.insert_fixed_value).map(([column, value]) => ({
      id: rowId(),
      column,
      value: formatValue(value),
    })),
    fixed_where: config.list_fixed_where.map((condition) => ({
      id: rowId(),
      column: condition.column,
      operator: condition.operator,
      values: (Array.isArray(condition.value) ? condition.value : [condition.value]).map(formatValue),
    })),
    default_order_by: config.list_default_order_by.map((order) => ({
      id: rowId(),
      sort: order.sort,
      order: order.order,
    })),
  };
}

export function buildTableAdvancedConfig(
  value: TableAdvancedFormValue,
  columns: TableAdvancedColumn[],
): TableMetadataConfig {
  const columnsByName = new Map(columns.map((column) => [column.name, column]));
  const fixedValue: Record<string, Value> = {};
  for (const row of value.fixed_value) {
    const column = requireColumn(row.column, columnsByName, 'insert_fixed_value');
    if (Object.hasOwn(fixedValue, row.column)) {
      throw new Error(`Column ${row.column} is duplicated in insert_fixed_value`);
    }
    fixedValue[row.column] = parseValue(row.value, column, 'insert_fixed_value');
  }

  const fixedWhere = value.fixed_where.map((row) => {
    const column = requireColumn(row.column, columnsByName, 'list_fixed_where');
    const multiple = row.operator === 'in' || row.operator === 'not_in';
    const values = row.values.map((item) => parseValue(item, column, 'list_fixed_where'));
    if (values.length === 0) {
      throw new Error('Field list_fixed_where requires at least one value');
    }
    return {
      column: row.column,
      operator: row.operator,
      value: multiple ? values : values[0],
    };
  });

  const usedSorts = new Set<string>();
  const defaultOrderBy = value.default_order_by.map((row) => {
    requireColumn(row.sort, columnsByName, 'list_default_order_by');
    if (usedSorts.has(row.sort)) {
      throw new Error(`Column ${row.sort} is duplicated in list_default_order_by`);
    }
    usedSorts.add(row.sort);
    return { sort: row.sort, order: row.order };
  });

  return {
    insert_readonly: value.readonly,
    insert_fixed_value: fixedValue,
    list_fixed_where: fixedWhere,
    list_default_order_by: defaultOrderBy,
  };
}

function requireColumn(
  name: string,
  columns: Map<string, TableAdvancedColumn>,
  field: string,
) {
  const column = columns.get(name);
  if (!column) throw new Error(`Field ${field} must select an existing column`);
  return column;
}

function parseValue(value: string, column: TableAdvancedColumn, field: string): Value {
  if (column.data_type === 'text') return value;
  if (column.data_type === 'bool') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Field ${field}.${column.name} must be a boolean`);
  }
  if (value.trim() === '') {
    throw new Error(`Field ${field}.${column.name} is required`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Field ${field}.${column.name} must be a number`);
  }
  if (column.data_type === 'int' && !Number.isSafeInteger(parsed)) {
    throw new Error(`Field ${field}.${column.name} must be an integer`);
  }
  return parsed;
}

function formatValue(value: Value) {
  return value === null ? '' : String(value);
}

function TypedValueInput(props: TypedValueInputProps) {
  return (
    <Show
      when={props.column?.data_type === 'bool'}
      fallback={(
        <input
          class="input advanced-value-input"
          type={props.column?.data_type === 'int' || props.column?.data_type === 'float' ? 'number' : 'text'}
          step={props.column?.data_type === 'int' ? '1' : props.column?.data_type === 'float' ? 'any' : undefined}
          required
          value={props.value}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
      )}
    >
      <select
        class="input advanced-value-input"
        required
        value={props.value}
        onChange={(event) => props.onInput(event.currentTarget.value)}
      >
        <option value="" disabled>请选择</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </Show>
  );
}

export default function TableAdvancedSettings(props: TableAdvancedSettingsProps) {
  const column = (name: string) => props.columns.find((item) => item.name === name);
  const usedFixedColumns = () => new Set(props.value.fixed_value.map((row) => row.column));
  const usedSortColumns = () => new Set(props.value.default_order_by.map((row) => row.sort));

  function updateFixedValue(id: number, patch: Partial<FixedValueFormRow>) {
    props.onChange({
      ...props.value,
      fixed_value: props.value.fixed_value.map((row) => row.id === id ? { ...row, ...patch } : row),
    });
  }

  function updateFixedWhere(id: number, patch: Partial<FixedWhereFormRow>) {
    props.onChange({
      ...props.value,
      fixed_where: props.value.fixed_where.map((row) => row.id === id ? { ...row, ...patch } : row),
    });
  }

  function updateDefaultOrder(id: number, patch: Partial<DefaultOrderFormRow>) {
    props.onChange({
      ...props.value,
      default_order_by: props.value.default_order_by.map((row) => row.id === id ? { ...row, ...patch } : row),
    });
  }

  function firstAvailable(used: Set<string>) {
    return props.columns.find((item) => !used.has(item.name))?.name ?? '';
  }

  return (
    <div class="table-advanced-fields">
      <section class="table-advanced-group">
        <header>
          <code>insert_readonly</code>
          <BooleanSwitch
            checked={props.value.readonly}
            label="只读"
            onChange={(readonly) => props.onChange({ ...props.value, readonly })}
          />
        </header>
      </section>
      <section class="table-advanced-group">
        <header>
          <code>insert_fixed_value</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={usedFixedColumns().size >= props.columns.length}
            onClick={() => props.onChange({
              ...props.value,
              fixed_value: [...props.value.fixed_value, {
                id: rowId(),
                column: firstAvailable(usedFixedColumns()),
                value: '',
              }],
            })}
          >
            <Plus size={14} />新增
          </button>
        </header>
        <div class="advanced-row-list">
          <For each={props.value.fixed_value}>
            {(row) => (
              <div class="advanced-config-row advanced-fixed-row">
                <select
                  class="input"
                  classList={{ invalid: !column(row.column) }}
                  aria-label="固定值数据列"
                  required
                  value={row.column}
                  onChange={(event) => updateFixedValue(row.id, { column: event.currentTarget.value, value: '' })}
                >
                  <Show when={row.column && !column(row.column)}>
                    <option value={row.column} selected>{row.column} · 不可用</option>
                  </Show>
                  <For each={props.columns.filter((item) => item.name === row.column || !usedFixedColumns().has(item.name))}>
                    {(item) => <option value={item.name} selected={item.name === row.column}>{item.name} · {item.data_type}</option>}
                  </For>
                </select>
                <TypedValueInput column={column(row.column)} value={row.value} onInput={(value) => updateFixedValue(row.id, { value })} />
                <button
                  type="button"
                  class="icon-button danger"
                  title="删除固定值"
                  onClick={() => props.onChange({ ...props.value, fixed_value: props.value.fixed_value.filter((item) => item.id !== row.id) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="table-advanced-group">
        <header>
          <code>list_fixed_where</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={props.columns.length === 0}
            onClick={() => props.onChange({
              ...props.value,
              fixed_where: [...props.value.fixed_where, {
                id: rowId(),
                column: props.columns[0]?.name ?? '',
                operator: '=',
                values: [''],
              }],
            })}
          >
            <Plus size={14} />新增
          </button>
        </header>
        <div class="advanced-row-list">
          <For each={props.value.fixed_where}>
            {(row) => {
              const multiple = () => row.operator === 'in' || row.operator === 'not_in';
              return (
                <div class="advanced-config-row advanced-condition-row">
                  <select
                    class="input"
                    classList={{ invalid: !column(row.column) }}
                    aria-label="条件数据列"
                    required
                    value={row.column}
                    onChange={(event) => updateFixedWhere(row.id, { column: event.currentTarget.value, values: [''] })}
                  >
                    <Show when={row.column && !column(row.column)}>
                      <option value={row.column} selected>{row.column} · 不可用</option>
                    </Show>
                    <For each={props.columns}>{(item) => <option value={item.name} selected={item.name === row.column}>{item.name} · {item.data_type}</option>}</For>
                  </select>
                  <select
                    class="input"
                    aria-label="比较运算符"
                    value={row.operator}
                    onChange={(event) => updateFixedWhere(row.id, {
                      operator: event.currentTarget.value as FilterOperator,
                      values: multiple() ? [row.values[0] ?? ''] : row.values,
                    })}
                  >
                    <For each={OPERATORS}>{(operator) => <option value={operator.value} selected={operator.value === row.operator}>{operator.label}</option>}</For>
                  </select>
                  <div class="advanced-condition-values">
                    <For each={multiple() ? row.values : row.values.slice(0, 1)}>
                      {(value, index) => (
                        <div>
                          <TypedValueInput
                            column={column(row.column)}
                            value={value}
                            onInput={(next) => updateFixedWhere(row.id, {
                              values: row.values.map((item, itemIndex) => itemIndex === index() ? next : item),
                            })}
                          />
                          <Show when={multiple() && row.values.length > 1}>
                            <button
                              type="button"
                              class="icon-button"
                              title="删除值"
                              onClick={() => updateFixedWhere(row.id, { values: row.values.filter((_, itemIndex) => itemIndex !== index()) })}
                            >
                              <Trash2 size={13} />
                            </button>
                          </Show>
                        </div>
                      )}
                    </For>
                    <Show when={multiple()}>
                      <button
                        type="button"
                        class="button button-ghost advanced-value-add"
                        onClick={() => updateFixedWhere(row.id, { values: [...row.values, ''] })}
                      >
                        <Plus size={13} />增加值
                      </button>
                    </Show>
                  </div>
                  <button
                    type="button"
                    class="icon-button danger"
                    title="删除条件"
                    onClick={() => props.onChange({ ...props.value, fixed_where: props.value.fixed_where.filter((item) => item.id !== row.id) })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </section>

      <section class="table-advanced-group">
        <header>
          <code>list_default_order_by</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={usedSortColumns().size >= props.columns.length}
            onClick={() => props.onChange({
              ...props.value,
              default_order_by: [...props.value.default_order_by, {
                id: rowId(),
                sort: firstAvailable(usedSortColumns()),
                order: 'desc',
              }],
            })}
          >
            <Plus size={14} />新增
          </button>
        </header>
        <div class="advanced-row-list">
          <For each={props.value.default_order_by}>
            {(row) => (
              <div class="advanced-config-row advanced-order-row">
                <select
                  class="input"
                  classList={{ invalid: !column(row.sort) }}
                  aria-label="排序数据列"
                  required
                  value={row.sort}
                  onChange={(event) => updateDefaultOrder(row.id, { sort: event.currentTarget.value })}
                >
                  <Show when={row.sort && !column(row.sort)}>
                    <option value={row.sort} selected>{row.sort} · 不可用</option>
                  </Show>
                  <For each={props.columns.filter((item) => item.name === row.sort || !usedSortColumns().has(item.name))}>
                    {(item) => <option value={item.name} selected={item.name === row.sort}>{item.name} · {item.data_type}</option>}
                  </For>
                </select>
                <select
                  class="input"
                  aria-label="排序方向"
                  value={row.order}
                  onChange={(event) => updateDefaultOrder(row.id, { order: event.currentTarget.value as 'asc' | 'desc' })}
                >
                  <option value="desc" selected={row.order === 'desc'}>desc</option>
                  <option value="asc" selected={row.order === 'asc'}>asc</option>
                </select>
                <button
                  type="button"
                  class="icon-button danger"
                  title="删除排序"
                  onClick={() => props.onChange({ ...props.value, default_order_by: props.value.default_order_by.filter((item) => item.id !== row.id) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}
