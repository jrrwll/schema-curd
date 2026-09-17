import { ListPlus, LoaderCircle, Search, Trash2 } from 'lucide-solid';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { DISPLAY_NAME_MAX_LENGTH } from '../constants';
import { createDebouncedValue } from '../debounce';
import { physicalMetadataDisplayName } from '../physicalMetadata';
import type { PhysicalColumnItem } from '../types/physical';
import type { ColumnConfig, DataType } from '../types/table';
import BooleanSwitch from './BooleanSwitch';

interface ColumnMetadataSectionProps {
  columns: ColumnConfig[];
  referencedColumns?: ReadonlySet<string>;
  canInspectPhysical: boolean;
  loadPhysicalColumns?: (refresh: boolean) => Promise<PhysicalColumnItem[]>;
  onChange: (columns: ColumnConfig[]) => void;
}

export function columnConfigValue(column: ColumnConfig): ColumnConfig {
  const pattern = column.pattern?.trim() || undefined;
  return {
    name: column.name.trim(),
    display_name: column.display_name.trim(),
    data_type: column.data_type,
    optional: column.optional,
    ...(pattern ? { pattern } : {}),
  };
}

export function validateColumnConfigs(columns: ColumnConfig[]) {
  const names = new Set<string>();
  for (const column of columns) {
    const name = column.name.trim();
    if (!name) throw new Error('数据列名称不能为空');
    if (!column.display_name.trim()) throw new Error(`数据列 ${name} 的展示名称不能为空`);
    if (names.has(name)) throw new Error(`数据列 ${name} 已存在`);
    names.add(name);
    if (column.pattern?.trim()) {
      try { new RegExp(`^(?:${column.pattern.trim()})$`); }
      catch { throw new Error(`数据列 ${name} 的正则校验不是合法的正则表达式`); }
    }
  }
}

export default function ColumnMetadataSection(props: ColumnMetadataSectionProps) {
  const [search, setSearch] = createSignal('');
  const debouncedSearch = createDebouncedValue(search);
  const [error, setError] = createSignal('');
  const [syncing, setSyncing] = createSignal(false);
  const filteredColumns = createMemo(() => {
    const keyword = debouncedSearch().trim().toLocaleLowerCase();
    return props.columns.map((column, index) => ({ column, index })).filter(({ column }) =>
      !keyword || column.name.toLocaleLowerCase().includes(keyword) || column.display_name.toLocaleLowerCase().includes(keyword));
  });

  function updateColumn(index: number, patch: Partial<ColumnConfig>) {
    setError('');
    props.onChange(props.columns.map((column, itemIndex) => itemIndex === index ? { ...column, ...patch } : column));
  }

  function removeColumn(index: number) {
    const name = props.columns[index].name;
    if (props.referencedColumns?.has(name)) {
      setError(`数据列 ${name} 已被高级配置引用，请先删除相关规则`);
      return;
    }
    setError('');
    props.onChange(props.columns.filter((_, itemIndex) => itemIndex !== index));
  }

  function rowError(column: ColumnConfig, index: number) {
    const name = column.name.trim();
    if (name && props.columns.some((item, itemIndex) => itemIndex !== index && item.name.trim() === name)) return `数据列 ${name} 已存在`;
    if (column.pattern?.trim()) {
      try { new RegExp(`^(?:${column.pattern.trim()})$`); }
      catch { return '正则表达式不合法'; }
    }
    return '';
  }

  async function syncPhysicalColumns() {
    if (!props.loadPhysicalColumns) return;
    setSyncing(true);
    setError('');
    try {
      const result = await props.loadPhysicalColumns(true);
      const configured = new Set(props.columns.map((column) => column.name));
      const additions = result.filter((column) => !configured.has(column.name)).map<ColumnConfig>((column) => ({
        name: column.name,
        display_name: physicalMetadataDisplayName(column.comment, column.name),
        data_type: column.data_type,
        optional: column.optional,
      }));
      props.onChange([...props.columns, ...additions]);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section class="column-section">
      <div class="column-section-header">
        <div><h2>数据列</h2><span>{props.columns.length}</span></div>
        <div class="column-toolbar">
          <label class="column-search"><Search size={15} /><input value={search()} placeholder="搜索数据列" onInput={(event) => setSearch(event.currentTarget.value)} /></label>
          <Show when={props.canInspectPhysical && props.loadPhysicalColumns}>
            <button type="button" class="button button-ghost" disabled={syncing()} onClick={() => void syncPhysicalColumns()}>
              <Show when={!syncing()} fallback={<LoaderCircle class="spin" size={15} />}><ListPlus size={16} /></Show>同步物理列
            </button>
          </Show>
        </div>
      </div>
      <Show when={error()}><div class="notice notice-error">{error()}</div></Show>
      <div class="metadata-column-inline-wrap">
        <table class="metadata-column-inline-table">
          <thead><tr><th>name</th><th>display_name</th><th>data_type</th><th>optional</th><th>pattern</th><th aria-label="操作" /></tr></thead>
          <tbody>
            <For each={filteredColumns()} fallback={<tr><td class="metadata-column-empty" colSpan={6}>暂无数据列</td></tr>}>
              {({ column, index }) => {
                const issue = () => rowError(column, index);
                const referenced = () => props.referencedColumns?.has(column.name) === true;
                return <tr>
                  <td><input class="input metadata-column-name" classList={{ invalid: Boolean(issue()) && issue().includes('已存在') }} aria-label={`数据列 ${index + 1} 名称`} disabled value={column.name} title="物理列名不可修改" /></td>
                  <td><input class="input" aria-label={`数据列 ${index + 1} 展示名称`} required maxlength={DISPLAY_NAME_MAX_LENGTH} value={column.display_name} onInput={(event) => updateColumn(index, { display_name: event.currentTarget.value })} onBlur={() => updateColumn(index, { display_name: column.display_name.trim() })} /></td>
                  <td><select class="input" aria-label={`数据列 ${index + 1} 数据类型`} value={column.data_type} onChange={(event) => updateColumn(index, { data_type: event.currentTarget.value as DataType })}><option value="text">text</option><option value="int">int</option><option value="float">float</option><option value="bool">bool</option><option value="json">json</option></select></td>
                  <td><BooleanSwitch checked={column.optional} label={column.optional ? '可选' : '必填'} onChange={(optional) => updateColumn(index, { optional })} /></td>
                  <td>
                    <input class="input" classList={{ invalid: Boolean(issue()) && issue().includes('正则') }} aria-label={`数据列 ${index + 1} 正则校验`} value={column.pattern ?? ''} onInput={(event) => updateColumn(index, { pattern: event.currentTarget.value || undefined })} />
                    <Show when={issue()}>{(message) => <span class="field-error metadata-column-row-error">{message()}</span>}</Show>
                  </td>
                  <td class="metadata-column-inline-action"><button type="button" class="icon-button danger" disabled={referenced()} title={referenced() ? '该列已被高级设置引用' : '删除数据列'} onClick={() => removeColumn(index)}><Trash2 size={15} /></button></td>
                </tr>;
              }}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  );
}
