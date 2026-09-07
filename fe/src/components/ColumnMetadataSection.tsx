import { Dialog } from '@ark-ui/solid';
import {
  ChevronDown,
  Columns3,
  KeyRound,
  ListPlus,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-solid';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  batchCreateColumnMetadata,
  createColumnMetadata,
  deleteColumnMetadata,
  getPhysicalColumns,
  refreshPhysicalColumns,
  updateColumnMetadata,
} from '../api';
import { DISPLAY_NAME_MAX_LENGTH, NAME_MAX_LENGTH } from '../constants';
import { physicalMetadataDisplayName } from '../physicalMetadata';
import {
  TableStatusEnum,
  type ColumnMetadataConfig,
  type ColumnMetadataRecord,
  type PhysicalColumnItem,
  type Value,
} from '../types';
import BooleanSwitch from './BooleanSwitch';

interface ColumnMetadataSectionProps {
  datasource: string;
  table: string;
  tableStatus: TableStatusEnum;
  canInspectPhysical: boolean;
  columns?: ColumnMetadataRecord[];
  loading: boolean;
  error?: Error;
  onChanged: () => unknown;
}

interface ColumnFormValue {
  name: string;
  display_name: string;
  data_type: ColumnMetadataConfig['data_type'];
  optional: boolean;
  is_primary_key: boolean;
  sortable: boolean;
  hidden_on_create: boolean;
  is_json: boolean;
  pattern: string;
  search_enabled: boolean;
  search_default_value: string;
}

interface BatchColumnFormRow extends PhysicalColumnItem {
  display_name: string;
}

const EMPTY_FORM: ColumnFormValue = {
  name: '',
  display_name: '',
  data_type: 'text',
  optional: false,
  is_primary_key: false,
  sortable: false,
  hidden_on_create: false,
  is_json: false,
  pattern: '',
  search_enabled: false,
  search_default_value: '""',
};

export default function ColumnMetadataSection(props: ColumnMetadataSectionProps) {
  const [search, setSearch] = createSignal('');
  const [editing, setEditing] = createSignal<ColumnMetadataRecord | null | undefined>(undefined);
  const [deleting, setDeleting] = createSignal<ColumnMetadataRecord | null>(null);
  const [form, setForm] = createSignal<ColumnFormValue>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [physicalColumns, setPhysicalColumns] = createSignal<PhysicalColumnItem[]>([]);
  const [physicalColumnsOpen, setPhysicalColumnsOpen] = createSignal(false);
  const [physicalColumnsLoading, setPhysicalColumnsLoading] = createSignal(false);
  const [physicalColumnsError, setPhysicalColumnsError] = createSignal('');
  const [batchRows, setBatchRows] = createSignal<BatchColumnFormRow[] | undefined>();
  const [batchLoading, setBatchLoading] = createSignal(false);
  const [batchSubmitting, setBatchSubmitting] = createSignal(false);
  const [batchError, setBatchError] = createSignal('');
  const patternError = createMemo(() => {
    const pattern = form().pattern;
    if (!pattern) return '';
    try {
      new RegExp(`^(?:${pattern})$`);
      return '';
    } catch {
      return '请输入合法的正则表达式';
    }
  });
  const filteredPhysicalColumns = createMemo(() => {
    const keyword = form().name.trim().toLocaleLowerCase();
    const configured = new Set((props.columns ?? []).map((column) => column.name));
    return physicalColumns().filter(
      (column) =>
        !configured.has(column.name)
        && (!keyword || column.name.toLocaleLowerCase().includes(keyword)),
    );
  });

  const filteredColumns = createMemo(() => {
    const keyword = search().trim().toLocaleLowerCase();
    if (!keyword) return props.columns ?? [];
    return (props.columns ?? []).filter(
      (column) =>
        column.name.toLocaleLowerCase().includes(keyword)
        || column.display_name.toLocaleLowerCase().includes(keyword),
    );
  });

  async function openCreate() {
    setForm({ ...EMPTY_FORM });
    setError('');
    setPhysicalColumnsError('');
    setEditing(null);
    if (!props.canInspectPhysical) {
      setPhysicalColumns([]);
      return;
    }
    setPhysicalColumnsLoading(true);
    try {
      const result = await getPhysicalColumns({ datasource: props.datasource, table: props.table });
      setPhysicalColumns(result.items);
    } catch (reason) {
      setPhysicalColumnsError((reason as Error).message);
    } finally {
      setPhysicalColumnsLoading(false);
    }
  }

  async function openBatchCreate() {
    setBatchRows([]);
    setBatchLoading(true);
    setBatchError('');
    try {
      const result = await getPhysicalColumns({ datasource: props.datasource, table: props.table });
      const configured = new Set((props.columns ?? []).map((column) => column.name));
      setBatchRows(result.items
        .filter((column) => !configured.has(column.name))
        .map((column) => ({
          ...column,
          display_name: physicalMetadataDisplayName(column.comment, column.name),
        })));
    } catch (reason) {
      setBatchError((reason as Error).message);
    } finally {
      setBatchLoading(false);
    }
  }

  function updateBatchRow(index: number, value: Partial<BatchColumnFormRow>) {
    setBatchRows((current) => current?.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...value } : row));
  }

  async function saveBatch(event: SubmitEvent) {
    event.preventDefault();
    const rows = batchRows() ?? [];
    if (rows.length === 0) return;
    setBatchSubmitting(true);
    setBatchError('');
    try {
      await batchCreateColumnMetadata({
        datasource: props.datasource,
        table: props.table,
        columns: rows.map(({ name, display_name, data_type, optional, primary_key }) => ({
          name,
          display_name,
          data_type,
          optional,
          is_primary_key: props.tableStatus === TableStatusEnum.Draft && primary_key,
        })),
      });
      setBatchRows(undefined);
      await props.onChanged();
    } catch (reason) {
      setBatchError((reason as Error).message);
    } finally {
      setBatchSubmitting(false);
    }
  }

  async function refreshColumnCandidates() {
    setPhysicalColumnsLoading(true);
    setPhysicalColumnsError('');
    try {
      const result = await refreshPhysicalColumns({ datasource: props.datasource, table: props.table });
      setPhysicalColumns(result.items);
      setPhysicalColumnsOpen(true);
    } catch (reason) {
      setPhysicalColumnsError((reason as Error).message);
    } finally {
      setPhysicalColumnsLoading(false);
    }
  }

  function selectPhysicalColumn(column: PhysicalColumnItem) {
    updateForm({
      name: column.name,
      display_name: form().display_name
        || physicalMetadataDisplayName(column.comment, column.name),
      data_type: column.data_type,
      optional: column.optional,
      is_primary_key: props.tableStatus === TableStatusEnum.Draft && column.primary_key,
    });
    setPhysicalColumnsOpen(false);
  }

  function openEdit(column: ColumnMetadataRecord) {
    setForm({
      name: column.name,
      display_name: column.display_name,
      data_type: column.config.data_type,
      optional: column.config.optional,
      is_primary_key: column.is_primary_key,
      sortable: column.config.sortable,
      hidden_on_create: column.config.hidden_on_create,
      is_json: column.config.is_json,
      pattern: column.config.pattern ?? '',
      search_enabled: column.config.search_default_value !== undefined,
      search_default_value: JSON.stringify(
        column.config.search_default_value === undefined
          ? ''
          : column.config.search_default_value,
      ),
    });
    setError('');
    setPhysicalColumnsError('');
    setEditing(column);
  }

  function updateForm(value: Partial<ColumnFormValue>) {
    setForm({ ...form(), ...value });
  }

  function buildConfig(): ColumnMetadataConfig {
    if (patternError()) throw new Error(patternError());
    let searchDefaultValue: Value | undefined;
    if (form().search_enabled) {
      const value = JSON.parse(form().search_default_value) as unknown;
      if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
        throw new Error('Search default value must be a JSON scalar');
      }
      searchDefaultValue = value as Value;
    }
    return {
      data_type: form().data_type,
      optional: form().optional,
      sortable: form().sortable,
      hidden_on_create: form().hidden_on_create,
      is_json: form().is_json,
      pattern: form().pattern || undefined,
      search_default_value: searchDefaultValue,
    };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const config = buildConfig();
      const current = editing();
      if (current) {
        await updateColumnMetadata({
          id: current.id,
          datasource: props.datasource,
          table: props.table,
          display_name: form().display_name,
          is_primary_key: form().is_primary_key,
          config,
        });
      } else {
        await createColumnMetadata({
          datasource: props.datasource,
          table: props.table,
          name: form().name,
          display_name: form().display_name,
          is_primary_key: form().is_primary_key,
          config,
        });
      }
      setEditing(undefined);
      await props.onChanged();
    } catch (reason) {
      setError(reason instanceof SyntaxError ? 'Search default value must be valid JSON' : (reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const column = deleting();
    if (!column) return;
    setSubmitting(true);
    setError('');
    try {
      await deleteColumnMetadata({
        id: column.id,
        datasource: props.datasource,
        table: props.table,
      });
      setDeleting(null);
      await props.onChanged();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section class="column-section">
      <div class="column-section-header">
        <div>
          <h2>数据列</h2>
          <span>{props.columns?.length ?? 0}</span>
        </div>
        <div class="column-toolbar">
          <label class="column-search">
            <Search size={15} />
            <input value={search()} placeholder="搜索数据列" onInput={(event) => setSearch(event.currentTarget.value)} />
          </label>
          <button type="button" class="button button-primary" onClick={() => void openCreate()}>
            <Plus size={16} />新增列
          </button>
          <Show when={props.canInspectPhysical}>
            <button type="button" class="button button-primary" onClick={() => void openBatchCreate()}>
              <ListPlus size={16} />批量新增列
            </button>
          </Show>
        </div>
      </div>

      <Show when={props.error}>
        <div class="notice notice-error">{props.error?.message}</div>
      </Show>
      <Show when={!props.loading} fallback={<div class="column-state"><LoaderCircle class="spin" size={18} />正在加载</div>}>
        <div class="column-grid">
          <div class="column-list-header" aria-hidden="true">
            <span>数据列</span>
            <span>类型</span>
            <span>属性</span>
            <span>校验规则</span>
            <span>操作</span>
          </div>
          <For each={filteredColumns()} fallback={<div class="column-empty">暂无数据列</div>}>
            {(column) => (
              <article class="column-card">
                <div class="column-card-heading">
                  <div class="column-card-title">
                    <Show when={column.is_primary_key}><span class="column-primary-key"><KeyRound size={11} />主键</span></Show>
                    <strong>{column.display_name}</strong>
                  </div>
                  <code>{column.name}</code>
                </div>
                <span class={`column-type column-type-${column.config.data_type}`}>{column.config.data_type}</span>
                <div class="column-card-flags">
                  <span>{column.config.optional ? '可选' : '必填'}</span>
                  <Show when={column.config.sortable}><span>可排序</span></Show>
                  <Show when={column.config.hidden_on_create}><span>创建时隐藏</span></Show>
                  <Show when={column.config.is_json}><span>JSON</span></Show>
                </div>
                <code class="column-pattern" classList={{ empty: !column.config.pattern }} title={column.config.pattern}>
                  {column.config.pattern ? `正则: ${column.config.pattern}` : '-'}
                </code>
                <div class="column-card-actions">
                  <button type="button" class="icon-button" title="编辑数据列" onClick={() => openEdit(column)}>
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    class="icon-button danger"
                    disabled={column.is_primary_key}
                    title={column.is_primary_key ? '请先在草稿态取消主键后再删除' : '删除数据列'}
                    onClick={() => {
                      setError('');
                      setDeleting(column);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>

      <Dialog.Root open={editing() !== undefined} onOpenChange={(details) => !details.open && setEditing(undefined)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content metadata-column-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><Columns3 size={18} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">{editing() ? '编辑数据列' : '新增数据列'}</Dialog.Title>
                    <div class="dialog-description">{form().name || 'column'}</div>
                  </div>
                </div>
                <div class="metadata-column-dialog-actions">
                  <Show when={!editing() && props.canInspectPhysical}>
                    <button type="button" class="button button-ghost" disabled={physicalColumnsLoading() || submitting()} onClick={() => void refreshColumnCandidates()}>
                      <RefreshCw classList={{ spin: physicalColumnsLoading() }} size={14} />刷新真实列
                    </button>
                  </Show>
                  <Dialog.CloseTrigger class="dialog-close" title="关闭"><X size={18} /></Dialog.CloseTrigger>
                </div>
              </div>
              <form onSubmit={save}>
                <div class="metadata-column-form">
                  <div class="form-field physical-column-field" onFocusOut={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPhysicalColumnsOpen(false);
                  }} onKeyDown={(event) => event.key === 'Escape' && setPhysicalColumnsOpen(false)}>
                    <span class="form-label">名称<b>*</b></span>
                    <input class="input form-input" required disabled={Boolean(editing())} maxlength={NAME_MAX_LENGTH} autocomplete="off" value={form().name} onFocus={() => setPhysicalColumnsOpen(true)} onInput={(event) => {
                      updateForm({ name: event.currentTarget.value });
                      setPhysicalColumnsOpen(true);
                    }} />
                    <Show when={!editing() && physicalColumnsOpen() && filteredPhysicalColumns().length > 0}>
                      <div class="physical-column-options" role="listbox">
                        <For each={filteredPhysicalColumns()}>{(column) => (
                          <button type="button" role="option" aria-selected={form().name === column.name} classList={{ selected: form().name === column.name }} onClick={() => selectPhysicalColumn(column)}>
                            <code>{column.name}</code><span>{column.data_type}</span><Show when={column.primary_key}><small>主键</small></Show>
                          </button>
                        )}</For>
                      </div>
                    </Show>
                  </div>
                  <label class="form-field">
                    <span class="form-label">展示名称<b>*</b></span>
                    <input class="input form-input" required maxlength={DISPLAY_NAME_MAX_LENGTH} value={form().display_name} onInput={(event) => updateForm({ display_name: event.currentTarget.value })} />
                  </label>
                  <label class="form-field">
                    <span class="form-label">数据类型<b>*</b></span>
                    <select class="input form-input" value={form().data_type} onChange={(event) => {
                      const data_type = event.currentTarget.value as ColumnMetadataConfig['data_type'];
                      updateForm({ data_type, is_json: data_type === 'text' && form().is_json });
                    }}>
                      <option value="text">text</option>
                      <option value="int">int</option>
                      <option value="float">float</option>
                      <option value="bool">bool</option>
                    </select>
                  </label>
                  <div class="form-field metadata-column-primary-field">
                    <span class="form-label">是否主键<code>is_primary_key</code></span>
                    <div class="metadata-column-primary-control">
                      <BooleanSwitch
                        checked={form().is_primary_key}
                        disabled={props.tableStatus !== TableStatusEnum.Draft}
                        label={form().is_primary_key ? '是' : '否'}
                        onChange={(value) => updateForm({ is_primary_key: value })}
                      />
                    </div>
                  </div>
                  <details class="advanced-settings column-advanced-settings" open>
                    <summary>
                      <span class="advanced-settings-title"><Settings2 size={15} />高级设置</span>
                      <span class="advanced-settings-state">
                        <span class="advanced-settings-closed">展开</span>
                        <span class="advanced-settings-open">收起</span>
                        <ChevronDown size={16} />
                      </span>
                    </summary>
                    <div class="metadata-column-advanced-body">
                      <label class="metadata-column-setting-row">
                        <code>pattern</code>
                        <input
                          class="input form-input"
                          classList={{ invalid: Boolean(patternError()) }}
                          aria-invalid={Boolean(patternError())}
                          aria-describedby={patternError() ? 'column-pattern-error' : undefined}
                          value={form().pattern}
                          onInput={(event) => updateForm({ pattern: event.currentTarget.value })}
                        />
                        <Show when={patternError()}>
                          <span id="column-pattern-error" class="field-error">{patternError()}</span>
                        </Show>
                      </label>
                      <div class="metadata-column-setting-row metadata-column-switch-row">
                        <BooleanSwitch checked={form().optional} label="optional" onChange={(value) => updateForm({ optional: value })} />
                      </div>
                      <div class="metadata-column-setting-row metadata-column-switch-row">
                        <BooleanSwitch checked={form().sortable} label="sortable" onChange={(value) => updateForm({ sortable: value })} />
                      </div>
                      <div class="metadata-column-setting-row metadata-column-switch-row">
                        <BooleanSwitch checked={form().hidden_on_create} label="hidden_on_create" onChange={(value) => updateForm({ hidden_on_create: value })} />
                      </div>
                      <div class="metadata-column-setting-row metadata-column-switch-row">
                        <BooleanSwitch checked={form().is_json} disabled={form().data_type !== 'text'} label="is_json" onChange={(value) => updateForm({ is_json: value })} />
                      </div>
                      <div class="metadata-column-setting-row metadata-column-search-default">
                        <code>search_default_value</code>
                        <div>
                          <BooleanSwitch checked={form().search_enabled} label={form().search_enabled ? '启用' : '禁用'} onChange={(value) => updateForm({ search_enabled: value })} />
                          <Show when={form().search_enabled}>
                            <input class="input form-input" value={form().search_default_value} onInput={(event) => updateForm({ search_default_value: event.currentTarget.value })} />
                          </Show>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
                <Show when={physicalColumnsError()}><div class="datasource-form-error notice notice-error">{physicalColumnsError()}</div></Show>
                <Show when={error()}><div class="datasource-form-error notice notice-error">{error()}</div></Show>
                <div class="dialog-actions">
                  <Dialog.CloseTrigger class="button button-ghost" disabled={submitting()}>取消</Dialog.CloseTrigger>
                  <button type="submit" class="button button-confirm" disabled={submitting() || Boolean(patternError())}>
                    <Show when={submitting()} fallback="保存"><LoaderCircle class="spin" size={15} />保存中</Show>
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={batchRows() !== undefined} onOpenChange={(details) => !details.open && setBatchRows(undefined)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content metadata-column-dialog metadata-batch-column-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><ListPlus size={18} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">批量新增数据列</Dialog.Title>
                    <div class="dialog-description">{props.table}</div>
                  </div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" disabled={batchSubmitting()} title="关闭"><X size={18} /></Dialog.CloseTrigger>
              </div>
              <form onSubmit={saveBatch}>
                <div class="metadata-batch-column-body">
                  <div class="metadata-batch-column-header" aria-hidden="true">
                    <span>名称</span><span>展示名称</span><span>数据类型</span><span>操作</span>
                  </div>
                  <Show when={!batchLoading()} fallback={<div class="column-state"><LoaderCircle class="spin" size={17} />正在加载物理列</div>}>
                    <For each={batchRows()} fallback={<div class="column-empty">没有可新增的物理列</div>}>
                      {(row, index) => (
                        <div class="metadata-batch-column-row">
                          <input class="input" disabled value={row.name} />
                          <input class="input" required maxlength={DISPLAY_NAME_MAX_LENGTH} value={row.display_name} onInput={(event) => updateBatchRow(index(), { display_name: event.currentTarget.value })} />
                          <select class="input" value={row.data_type} onChange={(event) => updateBatchRow(index(), { data_type: event.currentTarget.value as ColumnMetadataConfig['data_type'] })}>
                            <option value="text">text</option>
                            <option value="int">int</option>
                            <option value="float">float</option>
                            <option value="bool">bool</option>
                          </select>
                          <button type="button" class="icon-button danger" title="移除此列" onClick={() => setBatchRows((current) => current?.filter((_, rowIndex) => rowIndex !== index()))}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
                <Show when={batchError()}><div class="datasource-form-error notice notice-error">{batchError()}</div></Show>
                <div class="dialog-actions">
                  <Dialog.CloseTrigger class="button button-ghost" disabled={batchSubmitting()}>取消</Dialog.CloseTrigger>
                  <button type="submit" class="button button-confirm" disabled={batchSubmitting() || batchLoading() || (batchRows()?.length ?? 0) === 0}>
                    <Show when={batchSubmitting()} fallback="保存"><LoaderCircle class="spin" size={15} />保存中</Show>
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={deleting() !== null} onOpenChange={(details) => !details.open && setDeleting(null)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content datasource-delete-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon danger"><Trash2 size={18} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">删除数据列</Dialog.Title>
                    <div class="dialog-description">{deleting()?.display_name}</div>
                  </div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" disabled={submitting()} title="关闭"><X size={18} /></Dialog.CloseTrigger>
              </div>
              <div class="datasource-delete-message"><code>{deleting()?.name}</code></div>
              <Show when={error()}><div class="datasource-form-error notice notice-error">{error()}</div></Show>
              <div class="dialog-actions">
                <Dialog.CloseTrigger class="button button-ghost" disabled={submitting()}>取消</Dialog.CloseTrigger>
                <button type="button" class="button button-danger" disabled={submitting()} onClick={() => void confirmDelete()}>
                  <Show when={submitting()} fallback="确认删除"><LoaderCircle class="spin" size={15} />删除中</Show>
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </section>
  );
}
