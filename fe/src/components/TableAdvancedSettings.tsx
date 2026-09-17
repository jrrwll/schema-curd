import { Plus, Trash2 } from 'lucide-solid';
import { For, Show } from 'solid-js';
import type { FixedWhereConfig } from '../types/table';
import BooleanSwitch from './BooleanSwitch';
import {
  tableAdvancedRowId,
  type DefaultOrderFormRow,
  type FixedValueFormRow,
  type FixedWhereFormRow,
  type TableAdvancedColumn,
  type TableAdvancedFormValue,
} from './tableAdvancedConfig';

type FilterOperator = FixedWhereConfig['operator'];

interface TableAdvancedSettingsProps {
  value: TableAdvancedFormValue;
  physicalColumns: TableAdvancedColumn[];
  logicalColumns: TableAdvancedColumn[];
  onChange: (value: TableAdvancedFormValue) => void;
}

interface TypedValueInputProps {
  column?: TableAdvancedColumn;
  value: string | null;
  onInput: (value: string | null) => void;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: 'like', label: 'like' },
  { value: 'not like', label: 'not like' },
  { value: 'in', label: 'in' },
  { value: 'not in', label: 'not in' },
];

function TypedValueInput(props: TypedValueInputProps) {
  const nullSelected = () => props.column?.optional === true && props.value === null;
  return (
    <div class="advanced-value-control">
      <Show
        when={props.column?.data_type === 'bool'}
        fallback={(
          <input
            class="input advanced-value-input"
            type={props.column?.data_type === 'int' || props.column?.data_type === 'float' ? 'number' : 'text'}
            step={props.column?.data_type === 'int' ? '1' : props.column?.data_type === 'float' ? 'any' : undefined}
            required={!nullSelected() && (props.column?.data_type === 'int' || props.column?.data_type === 'float')}
            disabled={nullSelected()}
            value={props.value ?? ''}
            onInput={(event) => props.onInput(event.currentTarget.value)}
          />
        )}
      >
        <select
          class="input advanced-value-input"
          required={!nullSelected()}
          disabled={nullSelected()}
          value={props.value ?? ''}
          onChange={(event) => props.onInput(event.currentTarget.value)}
        >
          <option value="" disabled>请选择</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </Show>
      <Show when={props.column?.optional}>
        <label class="advanced-null-toggle"><input type="checkbox" checked={props.value === null} onChange={(event) => props.onInput(event.currentTarget.checked ? null : '')} />NULL</label>
      </Show>
    </div>
  );
}

export default function TableAdvancedSettings(props: TableAdvancedSettingsProps) {
  const physicalColumn = (name: string) => props.physicalColumns.find((item) => item.name === name);
  const logicalColumn = (name: string) => props.logicalColumns.find((item) => item.name === name);
  const usedPrimaryColumns = () => new Set(props.value.primary_keys);
  const usedSortableColumns = () => new Set(props.value.sortable_columns);
  const usedSearchColumns = () => new Set(props.value.search_default_value.map((row) => row.column));
  const usedFixedColumns = () => new Set(props.value.fixed_value.map((row) => row.column));
  const usedDefaultOrderColumns = () => new Set(props.value.default_order_by.map((row) => row.sort));

  function updatePrimaryKey(index: number, name: string) {
    props.onChange({ ...props.value, primary_keys: props.value.primary_keys.map((item, itemIndex) => itemIndex === index ? name : item) });
  }

  function updateSortableColumn(index: number, name: string) {
    props.onChange({ ...props.value, sortable_columns: props.value.sortable_columns.map((item, itemIndex) => itemIndex === index ? name : item) });
  }

  function updateSearchDefault(id: number, patch: Partial<FixedValueFormRow>) {
    props.onChange({
      ...props.value,
      search_default_value: props.value.search_default_value.map((row) => row.id === id ? { ...row, ...patch } : row),
    });
  }

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

  function firstAvailable(columns: TableAdvancedColumn[], used: Set<string>) {
    return columns.find((item) => !used.has(item.name))?.name ?? '';
  }

  return (
    <div class="table-advanced-fields">
      <section class="table-advanced-group">
        <header>
          <code>primary_keys</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={usedPrimaryColumns().size >= props.physicalColumns.length}
            onClick={() => props.onChange({
              ...props.value,
              primary_keys: [...props.value.primary_keys, firstAvailable(props.physicalColumns, usedPrimaryColumns())],
            })}
          >
            <Plus size={14} />新增
          </button>
        </header>
        <div class="advanced-row-list">
          <For each={props.value.primary_keys}>
            {(name, index) => (
              <div class="advanced-config-row advanced-column-row">
                <select
                  class="input"
                  classList={{ invalid: !physicalColumn(name) }}
                  aria-label="主键数据列"
                  required
                  value={name}
                  onChange={(event) => updatePrimaryKey(index(), event.currentTarget.value)}
                >
                  <Show when={name && !physicalColumn(name)}><option value={name} selected>{name} · 不可用</option></Show>
                  <For each={props.physicalColumns.filter((item) => item.name === name || !usedPrimaryColumns().has(item.name))}>
                    {(item) => <option value={item.name} selected={item.name === name}>{item.name} · {item.data_type}</option>}
                  </For>
                </select>
                <button type="button" class="icon-button danger" title="删除主键" onClick={() => props.onChange({ ...props.value, primary_keys: props.value.primary_keys.filter((_, itemIndex) => itemIndex !== index()) })}><Trash2 size={15} /></button>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="table-advanced-group">
        <header>
          <code>readonly</code>
          <BooleanSwitch
            checked={props.value.readonly}
            label="只读"
            onChange={(readonly) => props.onChange({ ...props.value, readonly })}
          />
        </header>
      </section>
      <section class="table-advanced-group">
        <header>
          <code>sortable_columns</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={usedSortableColumns().size >= props.logicalColumns.length}
            onClick={() => props.onChange({
              ...props.value,
              sortable_columns: [...props.value.sortable_columns, firstAvailable(props.logicalColumns, usedSortableColumns())],
            })}
          >
            <Plus size={14} />新增
          </button>
        </header>
        <div class="advanced-row-list">
          <For each={props.value.sortable_columns}>
            {(name, index) => (
              <div class="advanced-config-row advanced-column-row">
                <select
                  class="input"
                  classList={{ invalid: !logicalColumn(name) }}
                  aria-label="可排序数据列"
                  required
                  value={name}
                  onChange={(event) => updateSortableColumn(index(), event.currentTarget.value)}
                >
                  <Show when={name && !logicalColumn(name)}><option value={name} selected>{name} · 不可用</option></Show>
                  <For each={props.logicalColumns.filter((item) => item.name === name || !usedSortableColumns().has(item.name))}>
                    {(item) => <option value={item.name} selected={item.name === name}>{item.name} · {item.data_type}</option>}
                  </For>
                </select>
                <button type="button" class="icon-button danger" title="删除可排序列" onClick={() => props.onChange({ ...props.value, sortable_columns: props.value.sortable_columns.filter((_, itemIndex) => itemIndex !== index()) })}><Trash2 size={15} /></button>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="table-advanced-group">
        <header>
          <code>search_default_value</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={usedSearchColumns().size >= props.logicalColumns.length}
            onClick={() => props.onChange({
              ...props.value,
              search_default_value: [...props.value.search_default_value, {
                id: tableAdvancedRowId(),
                column: firstAvailable(props.logicalColumns, usedSearchColumns()),
                value: '',
              }],
            })}
          >
            <Plus size={14} />新增
          </button>
        </header>
        <div class="advanced-row-list">
          <For each={props.value.search_default_value}>
            {(row) => (
              <div class="advanced-config-row advanced-fixed-row">
                <select
                  class="input"
                  classList={{ invalid: !logicalColumn(row.column) }}
                  aria-label="默认搜索数据列"
                  required
                  value={row.column}
                  onChange={(event) => updateSearchDefault(row.id, { column: event.currentTarget.value, value: '' })}
                >
                  <Show when={row.column && !logicalColumn(row.column)}><option value={row.column} selected>{row.column} · 不可用</option></Show>
                  <For each={props.logicalColumns.filter((item) => item.name === row.column || !usedSearchColumns().has(item.name))}>
                    {(item) => <option value={item.name} selected={item.name === row.column}>{item.name} · {item.data_type}</option>}
                  </For>
                </select>
                <TypedValueInput column={logicalColumn(row.column)} value={row.value} onInput={(value) => updateSearchDefault(row.id, { value })} />
                <button type="button" class="icon-button danger" title="删除默认搜索值" onClick={() => props.onChange({ ...props.value, search_default_value: props.value.search_default_value.filter((item) => item.id !== row.id) })}><Trash2 size={15} /></button>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="table-advanced-group">
        <header>
          <code>insert_fixed_values</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={usedFixedColumns().size >= props.physicalColumns.length}
            onClick={() => props.onChange({
              ...props.value,
              fixed_value: [...props.value.fixed_value, {
                id: tableAdvancedRowId(),
                column: firstAvailable(props.physicalColumns, usedFixedColumns()),
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
                  classList={{ invalid: !physicalColumn(row.column) }}
                  aria-label="固定值数据列"
                  required
                  value={row.column}
                  onChange={(event) => updateFixedValue(row.id, { column: event.currentTarget.value, value: '' })}
                >
                  <Show when={row.column && !physicalColumn(row.column)}>
                    <option value={row.column} selected>{row.column} · 不可用</option>
                  </Show>
                  <For each={props.physicalColumns.filter((item) => item.name === row.column || !usedFixedColumns().has(item.name))}>
                    {(item) => <option value={item.name} selected={item.name === row.column}>{item.name} · {item.data_type}</option>}
                  </For>
                </select>
                <TypedValueInput column={physicalColumn(row.column)} value={row.value} onInput={(value) => updateFixedValue(row.id, { value })} />
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
          <code>select_fixed_where</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={props.physicalColumns.length === 0}
            onClick={() => props.onChange({
              ...props.value,
              fixed_where: [...props.value.fixed_where, {
                id: tableAdvancedRowId(),
                column: props.physicalColumns[0]?.name ?? '',
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
              const multiple = () => row.operator === 'in' || row.operator === 'not in';
              return (
                <div class="advanced-config-row advanced-condition-row">
                  <select
                    class="input"
                    classList={{ invalid: !physicalColumn(row.column) }}
                    aria-label="条件数据列"
                    required
                    value={row.column}
                    onChange={(event) => updateFixedWhere(row.id, { column: event.currentTarget.value, values: [''] })}
                  >
                    <Show when={row.column && !physicalColumn(row.column)}>
                      <option value={row.column} selected>{row.column} · 不可用</option>
                    </Show>
                    <For each={props.physicalColumns}>{(item) => <option value={item.name} selected={item.name === row.column}>{item.name} · {item.data_type}</option>}</For>
                  </select>
                  <select
                    class="input"
                    aria-label="比较运算符"
                    value={row.operator}
                    onChange={(event) => {
                      const operator = event.currentTarget.value as FilterOperator;
                      const nextMultiple = operator === 'in' || operator === 'not in';
                      updateFixedWhere(row.id, {
                        operator,
                        values: nextMultiple ? row.values : [row.values[0] ?? ''],
                      });
                    }}
                  >
                    <For each={OPERATORS}>{(operator) => <option value={operator.value} selected={operator.value === row.operator}>{operator.label}</option>}</For>
                  </select>
                  <div class="advanced-condition-values">
                    <For each={multiple() ? row.values : row.values.slice(0, 1)}>
                      {(value, index) => (
                        <div>
                          <TypedValueInput
                            column={physicalColumn(row.column)}
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
          <code>default_order_by</code>
          <button
            type="button"
            class="button button-ghost advanced-add-button"
            disabled={usedDefaultOrderColumns().size >= props.physicalColumns.length}
            onClick={() => props.onChange({
              ...props.value,
              default_order_by: [...props.value.default_order_by, {
                id: tableAdvancedRowId(),
                sort: firstAvailable(props.physicalColumns, usedDefaultOrderColumns()),
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
                  classList={{ invalid: !physicalColumn(row.sort) }}
                  aria-label="排序数据列"
                  required
                  value={row.sort}
                  onChange={(event) => updateDefaultOrder(row.id, { sort: event.currentTarget.value })}
                >
                  <Show when={row.sort && !physicalColumn(row.sort)}>
                    <option value={row.sort} selected>{row.sort} · 不可用</option>
                  </Show>
                  <For each={props.physicalColumns.filter((item) => item.name === row.sort || !usedDefaultOrderColumns().has(item.name))}>
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
