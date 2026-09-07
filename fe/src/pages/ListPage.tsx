import { Dialog, Pagination } from '@ark-ui/solid';
import { ArrowDown, ArrowUp, ArrowUpDown, Braces, Check, ChevronLeft, ChevronRight, Eye, FileDiff, Filter, LoaderCircle, Plus, RotateCcw, Search, X } from 'lucide-solid';
import { For, Index, Match, Show, Switch, batch, createEffect, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getEntities, updateEntity } from '../api';
import BooleanSwitch from '../components/BooleanSwitch';
import JsonViewer from '../components/JsonViewer';
import { ENTITY_PAGE_SIZE_OPTIONS } from '../constants';
import type { ColumnConfig, OrderByConfig, Row, TableConfig, Value } from '../types';
interface ListPageProps {
  embedded?: boolean;
  canWrite: boolean;
  datasourceId: number;
  datasource: string;
  table: TableConfig;
  navigate: (url: string) => void;
}

function inputValue(value: Value | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

interface FieldDiff {
  column: ColumnConfig;
  before: Value | undefined;
  after: Value | undefined;
}

interface JsonCellEdit {
  rowIndex: number;
  column: ColumnConfig;
}

function valuesEqual(column: ColumnConfig, before: Value | undefined, after: Value | undefined): boolean {
  if (column.data_type === 'bool') return Boolean(before) === Boolean(after);
  return inputValue(before) === inputValue(after);
}

function displayValue(column: ColumnConfig, value: Value | undefined): string {
  if (value === null || value === undefined || value === '') return '空值';
  if (column.data_type === 'bool') return Boolean(value) ? '是' : '否';
  return String(value);
}

export default function ListPage(props: ListPageProps) {
  const inputValueForColumn = (column: ColumnConfig, value: string): Value =>
    (column.data_type === 'int' || column.data_type === 'float') && value !== '' ? Number(value) : value;
  const searchDefaults = () =>
    Object.fromEntries(
      props.table.columns
        .filter(
          (column) =>
            column.search_default_value !== undefined,
        )
        .map((column) => [column.name, column.search_default_value ?? null]),
    ) as Record<string, Value>;
  const [rows, setRows] = createSignal<Row[]>([]);
  const [originalRows, setOriginalRows] = createSignal<Row[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal<number>(ENTITY_PAGE_SIZE_OPTIONS[0]);
  const [draftConditions, setDraftConditions] = createSignal<Record<string, Value>>(searchDefaults());
  const [conditions, setConditions] = createSignal<Record<string, Value>>(searchDefaults());
  const [orderBy, setOrderBy] = createSignal<OrderByConfig | null>(null);
  const [columnWidths, setColumnWidths] = createSignal<Record<string, number>>({});
  const [dirtyRows, setDirtyRows] = createSignal(new Set<number>());
  const [loading, setLoading] = createSignal(false);
  const [updating, setUpdating] = createSignal<number | null>(null);
  const [confirmingRow, setConfirmingRow] = createSignal<number | null>(null);
  const [detailRow, setDetailRow] = createSignal<number | null>(null);
  const [detailDraft, setDetailDraft] = createSignal<Row | null>(null);
  const [detailJsonValidity, setDetailJsonValidity] = createSignal<Record<string, boolean>>({});
  const [detailSaving, setDetailSaving] = createSignal(false);
  const [jsonCellEdit, setJsonCellEdit] = createSignal<JsonCellEdit | null>(null);
  const [jsonDraft, setJsonDraft] = createSignal('');
  const [jsonOriginal, setJsonOriginal] = createSignal('');
  const [jsonValid, setJsonValid] = createSignal(false);
  const [discardJsonOpen, setDiscardJsonOpen] = createSignal(false);
  const [message, setMessage] = createSignal<{ kind: 'error' | 'success'; text: string } | null>(null);
  let requestSequence = 0;
  let stopResizing: (() => void) | undefined;
  let jsonEditorDialog: HTMLDivElement | undefined;
  let focusJsonEditor: (() => void) | undefined;

  const pageCount = () => Math.max(1, Math.ceil(total() / pageSize()));

  async function loadRows() {
    const sequence = ++requestSequence;
    setLoading(true);
    setMessage(null);
    try {
      const data = await getEntities({
        datasource: props.datasource,
        table: props.table.name,
        page_no: page(),
        page_size: pageSize(),
        condition: conditions(),
        order_by: orderBy(),
      });
      if (sequence !== requestSequence) return;
      setRows(data.items.map((row) => ({ ...row })));
      setOriginalRows(data.items.map((row) => ({ ...row })));
      setTotal(data.total);
      setDirtyRows(new Set<number>());
      setConfirmingRow(null);
      setDetailRow(null);
      setDetailDraft(null);
      setJsonCellEdit(null);
    } catch (error) {
      if (sequence === requestSequence) setMessage({ kind: 'error', text: (error as Error).message });
    } finally {
      if (sequence === requestSequence) setLoading(false);
    }
  }

  createEffect(() => {
    props.datasource;
    props.table.name;
    setColumnWidths(
      Object.fromEntries(
        props.table.columns.map((column) => [column.name, column.primary_key ? 120 : 180]),
      ),
    );
    setOrderBy(null);
    setPage(1);
    const defaults = searchDefaults();
    setDraftConditions(defaults);
    setConditions(defaults);
  });

  createEffect(() => {
    props.datasource;
    props.table.name;
    page();
    pageSize();
    conditions();
    orderBy();
    void loadRows();
  });

  onCleanup(() => stopResizing?.());

  const actionColumnWidth = () => props.canWrite ? 154 : 84;
  const tableWidth = () =>
    props.table.columns.reduce(
      (sum, column) => sum + (columnWidths()[column.name] ?? 180),
      actionColumnWidth(),
    );

  function toggleSort(column: ColumnConfig) {
    if (!column.sortable) return;
    setPage(1);
    setOrderBy((current) => {
      if (!current || current.sort !== column.name) {
        return { sort: column.name, order: 'asc' };
      }
      if (current.order === 'asc') return { ...current, order: 'desc' };
      return null;
    });
  }

  function startResize(event: PointerEvent, column: ColumnConfig) {
    event.preventDefault();
    event.stopPropagation();
    stopResizing?.();
    const startX = event.clientX;
    const startWidth = columnWidths()[column.name] ?? 180;
    document.body.classList.add('is-resizing-column');
    const move = (moveEvent: PointerEvent) => {
      const width = Math.min(480, Math.max(100, startWidth + moveEvent.clientX - startX));
      setColumnWidths((current) => ({ ...current, [column.name]: width }));
    };
    const stop = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.body.classList.remove('is-resizing-column');
      stopResizing = undefined;
    };
    stopResizing = stop;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
  }

  function setCell(rowIndex: number, column: ColumnConfig, value: Value) {
    if (column.primary_key) return;
    setRows((current) => {
      const next = current.map((row, index) =>
        index === rowIndex ? { ...row, [column.name]: value } : row,
      );
      const changed = props.table.columns.some(
        (item) =>
          !item.primary_key &&
          !valuesEqual(item, originalRows()[rowIndex]?.[item.name], next[rowIndex]?.[item.name]),
      );
      setDirtyRows((dirty) => {
        const result = new Set(dirty);
        if (changed) result.add(rowIndex);
        else result.delete(rowIndex);
        return result;
      });
      return next;
    });
  }

  function rowDiff(rowIndex: number | null): FieldDiff[] {
    if (rowIndex === null) return [];
    const before = originalRows()[rowIndex];
    const after = rows()[rowIndex];
    if (!before || !after) return [];
    return props.table.columns
      .filter(
        (column) =>
          !column.primary_key &&
          !valuesEqual(column, before[column.name], after[column.name]),
      )
      .map((column) => ({
        column,
        before: before[column.name],
        after: after[column.name],
      }));
  }

  function rowIdentity(rowIndex: number | null): string {
    if (rowIndex === null) return '';
    return props.table.columns
      .filter((column) => column.primary_key)
      .map((column) => `${column.display_name}: ${displayValue(column, rows()[rowIndex]?.[column.name])}`)
      .join(' / ');
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    setPage(1);
    setConditions({ ...draftConditions() });
  }

  function resetSearch() {
    const defaults = searchDefaults();
    setDraftConditions(defaults);
    setPage(1);
    setConditions(defaults);
  }

  async function updateRow(rowIndex: number) {
    setUpdating(rowIndex);
    setMessage(null);
    try {
      await updateEntity({
        datasource: props.datasource,
        table: props.table.name,
        columns: rows()[rowIndex],
      });
      setDirtyRows((current) => {
        const next = new Set(current);
        next.delete(rowIndex);
        return next;
      });
      setOriginalRows((current) =>
        current.map((row, index) => (index === rowIndex ? { ...rows()[rowIndex] } : row)),
      );
      setConfirmingRow(null);
      setMessage({ kind: 'success', text: '更新成功' });
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    } finally {
      setUpdating(null);
    }
  }

  function validJson(value: Value | undefined) {
    try {
      JSON.parse(String(value ?? ''));
      return true;
    } catch {
      return false;
    }
  }

  function openJsonCellEditor(rowIndex: number, column: ColumnConfig) {
    const source = inputValue(rows()[rowIndex]?.[column.name]);
    setJsonOriginal(source);
    setJsonDraft(source);
    setJsonValid(validJson(source));
    setDiscardJsonOpen(false);
    setJsonCellEdit({ rowIndex, column });
  }

  function closeJsonCellEditor() {
    setDiscardJsonOpen(false);
    setJsonCellEdit(null);
    focusJsonEditor = undefined;
  }

  function requestJsonCellEditorClose() {
    if (jsonDraft() !== jsonOriginal()) setDiscardJsonOpen(true);
    else closeJsonCellEditor();
  }

  function handleJsonEditorBlur() {
    queueMicrotask(() => {
      if (
        jsonCellEdit()
        && jsonDraft() !== jsonOriginal()
        && !jsonEditorDialog?.contains(document.activeElement)
      ) {
        setDiscardJsonOpen(true);
      }
    });
  }

  function confirmJsonCellEdit() {
    const editing = jsonCellEdit();
    if (!editing || !jsonValid()) return;
    setCell(editing.rowIndex, editing.column, jsonDraft());
    closeJsonCellEditor();
  }

  function openDetail(rowIndex: number) {
    const draft = { ...rows()[rowIndex] };
    setDetailDraft(draft);
    setDetailJsonValidity(Object.fromEntries(
      props.table.columns
        .filter((column) => column.is_json)
        .map((column) => [column.name, validJson(draft[column.name])]),
    ));
    setDetailRow(rowIndex);
  }

  function setDetailCell(column: ColumnConfig, value: Value, valid?: boolean) {
    setDetailDraft((current) => current ? { ...current, [column.name]: value } : current);
    if (column.is_json && valid !== undefined) {
      setDetailJsonValidity((current) => ({ ...current, [column.name]: valid }));
    }
  }

  function detailChanged() {
    const rowIndex = detailRow();
    const draft = detailDraft();
    if (rowIndex === null || !draft) return false;
    return props.table.columns.some((column) =>
      !column.primary_key
      && !valuesEqual(column, rows()[rowIndex]?.[column.name], draft[column.name]));
  }

  function detailJsonIsValid() {
    return props.table.columns
      .filter((column) => column.is_json)
      .every((column) => detailJsonValidity()[column.name]);
  }

  async function saveDetail() {
    const rowIndex = detailRow();
    const draft = detailDraft();
    if (rowIndex === null || !draft || !detailChanged() || !detailJsonIsValid()) return;
    setDetailSaving(true);
    setMessage(null);
    try {
      await updateEntity({
        datasource: props.datasource,
        table: props.table.name,
        columns: draft,
      });
      setRows((current) => current.map((row, index) => index === rowIndex ? { ...draft } : row));
      setOriginalRows((current) => current.map((row, index) => index === rowIndex ? { ...draft } : row));
      setDirtyRows((current) => {
        const next = new Set(current);
        next.delete(rowIndex);
        return next;
      });
      setDetailRow(null);
      setDetailDraft(null);
      setMessage({ kind: 'success', text: '更新成功' });
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    } finally {
      setDetailSaving(false);
    }
  }

  return (
    <main class="page-shell" classList={{ 'entity-list-embedded': props.embedded }}>
      <header class="page-header">
        <div>
          <div class="eyebrow">数据表</div>
          <h1>{props.table.display_name}</h1>
          <div class="table-code">{props.table.name}</div>
        </div>
        <Show when={props.canWrite}>
          <button
            class="button button-primary"
            onClick={() =>
              props.navigate(
                `/entity/create?datasource=${props.datasourceId}&table=${props.table.id}`,
              )
            }
          >
            <Plus size={17} />新增
          </button>
        </Show>
      </header>

      <form class="filter-band" onSubmit={submitSearch}>
        <div class="filter-title"><Filter size={16} />字段筛选</div>
        <div class="entity-filter-row">
          <div class="filter-grid">
            <For each={props.table.columns}>
              {(column) => (
                <label class="filter-field">
                  <span>{column.display_name}</span>
                  <Show
                    when={column.data_type !== 'bool'}
                    fallback={
                      <div class="bool-filter">
                        <BooleanSwitch
                          checked={Boolean(draftConditions()[column.name])}
                          label={column.name in draftConditions() ? (draftConditions()[column.name] ? '是' : '否') : '不限'}
                          onChange={(checked) =>
                            setDraftConditions((current) => ({ ...current, [column.name]: checked }))
                          }
                        />
                        <Show when={column.name in draftConditions()}>
                          <button
                            type="button"
                            class="clear-bool"
                            onClick={() => {
                              const next = { ...draftConditions() };
                              delete next[column.name];
                              setDraftConditions(next);
                            }}
                          >不限</button>
                        </Show>
                      </div>
                    }
                  >
                    <input
                      class="input"
                      type={column.data_type === 'int' || column.data_type === 'float' ? 'number' : 'search'}
                      step={column.data_type === 'int' ? '1' : column.data_type === 'float' ? 'any' : undefined}
                      placeholder={column.data_type === 'int' || column.data_type === 'float' ? '精确匹配' : '模糊搜索'}
                      value={inputValue(draftConditions()[column.name])}
                      onInput={(event) =>
                        setDraftConditions((current) => ({
                          ...current,
                          [column.name]: inputValueForColumn(column, event.currentTarget.value),
                        }))
                      }
                    />
                  </Show>
                </label>
              )}
            </For>
          </div>
          <div class="entity-filter-actions">
            <button type="button" class="icon-button" title="重置" aria-label="重置" onClick={resetSearch} disabled={loading()}>
              <RotateCcw size={16} />
            </button>
            <button type="submit" class="button button-dark" disabled={loading()}><Search size={16} />查询</button>
          </div>
        </div>
      </form>

      <Show when={message()}>
        {(notice) => <div class={`notice notice-${notice().kind}`}>{notice().kind === 'success' && <Check size={15} />}{notice().text}</div>}
      </Show>

      <section class="table-region" aria-busy={loading()}>
        <div class="table-meta">
          <span>共 <strong>{total()}</strong> 条记录</span>
          <span>第 {page()} / {pageCount()} 页</span>
        </div>
        <div class="table-scroll">
          <table style={{ width: `${tableWidth()}px` }}>
            <colgroup>
              <For each={props.table.columns}>
                {(column) => <col style={{ width: `${columnWidths()[column.name] ?? 180}px` }} />}
              </For>
              <col style={{ width: `${actionColumnWidth()}px` }} />
            </colgroup>
            <thead>
              <tr>
                <For each={props.table.columns}>
                  {(column) => (
                    <th style={{ width: `${columnWidths()[column.name] ?? 180}px` }}>
                      <button
                        class="sort-button"
                        classList={{ sortable: column.sortable }}
                        disabled={!column.sortable}
                        title={column.sortable ? '切换排序' : undefined}
                        onClick={() => toggleSort(column)}
                      >
                        <span>{column.display_name}<small>{column.name}</small></span>
                        <Show when={column.sortable}>
                          <Show
                            when={orderBy()?.sort === column.name}
                            fallback={<ArrowUpDown size={14} />}
                          >
                            <Show when={orderBy()?.order === 'asc'} fallback={<ArrowDown size={14} />}>
                              <ArrowUp size={14} />
                            </Show>
                          </Show>
                        </Show>
                      </button>
                      <span
                        class="column-resizer"
                        title="拖动调整列宽"
                        onPointerDown={(event) => startResize(event, column)}
                      />
                    </th>
                  )}
                </For>
                <th class="action-column">操作</th>
              </tr>
            </thead>
            <tbody>
              <Show when={!loading()} fallback={<tr><td colSpan={props.table.columns.length + 1}><div class="table-state"><LoaderCircle class="spin" size={20} />正在加载</div></td></tr>}>
                <Index each={rows()} fallback={<tr><td colSpan={props.table.columns.length + 1}><div class="table-state">暂无数据</div></td></tr>}>
                  {(row, rowIndex) => (
                    <tr>
                      <For each={props.table.columns}>
                        {(column) => (
                          <td>
                            <Switch>
                              <Match when={column.is_json}>
                                <button
                                  type="button"
                                  class="json-cell-trigger"
                                  disabled={column.primary_key || !props.canWrite}
                                  title={props.canWrite ? '编辑 JSON' : '只读'}
                                  onClick={() => openJsonCellEditor(rowIndex, column)}
                                >
                                  <Braces size={13} />
                                  <span>{inputValue(row()[column.name]) || '空值'}</span>
                                </button>
                              </Match>
                              <Match when={column.data_type === 'bool'}>
                                <BooleanSwitch
                                  checked={Boolean(row()[column.name])}
                                  disabled={column.primary_key || !props.canWrite}
                                  label={row()[column.name] ? '是' : '否'}
                                  onChange={(checked) => setCell(rowIndex, column, checked)}
                                />
                              </Match>
                              <Match when>
                                <input
                                  class="cell-input"
                                  classList={{ 'cell-primary': column.primary_key }}
                                  disabled={column.primary_key || !props.canWrite}
                                  type={column.data_type === 'int' || column.data_type === 'float' ? 'number' : 'text'}
                                  step={column.data_type === 'int' ? '1' : column.data_type === 'float' ? 'any' : undefined}
                                  value={inputValue(row()[column.name])}
                                  onInput={(event) => setCell(rowIndex, column, inputValueForColumn(column, event.currentTarget.value))}
                                />
                              </Match>
                            </Switch>
                          </td>
                        )}
                      </For>
                      <td class="action-column">
                        <div class="entity-row-actions">
                          <button
                            class="button button-detail"
                            onClick={() => openDetail(rowIndex)}
                          >
                            <Eye size={14} />详情
                          </button>
                          <Show when={props.canWrite}>
                          <button
                            class="button button-update"
                            disabled={!dirtyRows().has(rowIndex) || updating() !== null}
                            onClick={() => setConfirmingRow(rowIndex)}
                          >
                            <Show when={updating() === rowIndex} fallback="更新"><LoaderCircle class="spin" size={15} />更新中</Show>
                          </button>
                          </Show>
                        </div>
                      </td>
                    </tr>
                  )}
                </Index>
              </Show>
            </tbody>
          </table>
        </div>
        <div class="pagination-footer">
          <Pagination.Root
            class="pagination"
            count={total()}
            page={page()}
            pageSize={pageSize()}
            siblingCount={2}
            boundaryCount={1}
            onPageChange={(details) => setPage(details.page)}
            translations={{
              rootLabel: '分页',
              prevTriggerLabel: '上一页',
              nextTriggerLabel: '下一页',
              itemLabel: ({ page: itemPage, totalPages }) => `第 ${itemPage} 页，共 ${totalPages} 页`,
            }}
          >
            <Pagination.PrevTrigger class="page-button page-arrow" disabled={loading()} title="上一页">
              <ChevronLeft size={17} />
            </Pagination.PrevTrigger>
            <Pagination.Context>
              {(context) => (
                <For each={context().pages}>
                  {(item, index) => (
                    <Show
                      when={item.type === 'page'}
                      fallback={<Pagination.Ellipsis class="page-ellipsis" index={index()}>...</Pagination.Ellipsis>}
                    >
                      <Pagination.Item class="page-button" type="page" value={item.type === 'page' ? item.value : 1}>
                        {item.type === 'page' ? item.value : ''}
                      </Pagination.Item>
                    </Show>
                  )}
                </For>
              )}
            </Pagination.Context>
            <Pagination.NextTrigger class="page-button page-arrow" disabled={loading()} title="下一页">
              <ChevronRight size={17} />
            </Pagination.NextTrigger>
          </Pagination.Root>
          <label class="page-size-control">
            <span>每页</span>
            <select
              value={pageSize()}
              disabled={loading()}
              onChange={(event) => {
                const nextPageSize = Number(event.currentTarget.value);
                batch(() => {
                  setPage(1);
                  setPageSize(nextPageSize);
                });
              }}
            >
              <For each={ENTITY_PAGE_SIZE_OPTIONS}>
                {(size) => <option value={size}>{size}</option>}
              </For>
            </select>
            <span>条</span>
          </label>
        </div>
      </section>

      <Dialog.Root
        open={confirmingRow() !== null}
        onOpenChange={(details) => {
          if (!details.open && updating() === null) setConfirmingRow(null);
        }}
        closeOnEscape={updating() === null}
        closeOnInteractOutside={updating() === null}
      >
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><FileDiff size={19} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">确认更新</Dialog.Title>
                    <Dialog.Description class="dialog-description">
                      {rowIdentity(confirmingRow())}
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.CloseTrigger
                  class="dialog-close"
                  disabled={updating() !== null}
                  title="关闭"
                >
                  <X size={18} />
                </Dialog.CloseTrigger>
              </div>
              <div class="diff-summary">
                以下 {rowDiff(confirmingRow()).length} 个字段将被更新
              </div>
              <div class="diff-list">
                <For each={rowDiff(confirmingRow())}>
                  {(diff) => (
                    <div class="diff-row">
                      <div class="diff-field">
                        <strong>{diff.column.display_name}</strong>
                        <code>{diff.column.name}</code>
                      </div>
                      <div class="diff-values">
                        <div class="diff-before">
                          <span>更新前</span>
                          <div>{displayValue(diff.column, diff.before)}</div>
                        </div>
                        <span class="diff-arrow">→</span>
                        <div class="diff-after">
                          <span>更新后</span>
                          <div>{displayValue(diff.column, diff.after)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div class="dialog-actions">
                <Dialog.CloseTrigger class="button button-ghost" disabled={updating() !== null}>
                  取消
                </Dialog.CloseTrigger>
                <button
                  class="button button-confirm"
                  disabled={updating() !== null || rowDiff(confirmingRow()).length === 0}
                  onClick={() => {
                    const rowIndex = confirmingRow();
                    if (rowIndex !== null) void updateRow(rowIndex);
                  }}
                >
                  <Show when={updating() !== null} fallback={<><Check size={16} />确认更新</>}>
                    <LoaderCircle class="spin" size={16} />更新中
                  </Show>
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root
        open={jsonCellEdit() !== null}
        closeOnEscape={false}
        closeOnInteractOutside={false}
        onOpenChange={(details) => !details.open && requestJsonCellEditorClose()}
      >
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" onClick={requestJsonCellEditorClose} />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content
              ref={jsonEditorDialog}
              class="dialog-content json-edit-dialog"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  requestJsonCellEditorClose();
                }
              }}
            >
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><Braces size={19} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">编辑 JSON</Dialog.Title>
                    <Dialog.Description class="dialog-description">
                      {jsonCellEdit()?.column.display_name} · {jsonCellEdit()?.column.name}
                    </Dialog.Description>
                  </div>
                </div>
                <button type="button" class="dialog-close" title="关闭" onClick={closeJsonCellEditor}><X size={18} /></button>
              </div>
              <div class="json-edit-body">
                <Show when={jsonCellEdit()}>
                  <JsonViewer
                    value={jsonDraft()}
                    readOnly={false}
                    onChange={(source, valid) => {
                      setJsonDraft(source);
                      setJsonValid(valid);
                    }}
                    onBlur={handleJsonEditorBlur}
                    onReady={(focus) => {
                      focusJsonEditor = focus;
                    }}
                  />
                  <Show when={!jsonValid()}><div class="json-editor-validation-error">请输入合法 JSON</div></Show>
                </Show>
              </div>
              <div class="dialog-actions">
                <button type="button" class="button button-ghost" onClick={closeJsonCellEditor}>取消</button>
                <button type="button" class="button button-confirm" disabled={!jsonValid()} onClick={confirmJsonCellEdit}>
                  <Check size={16} />确认
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={discardJsonOpen()} closeOnEscape={false} closeOnInteractOutside={false}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content discard-json-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><Braces size={19} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">丢弃 JSON 修改</Dialog.Title>
                    <Dialog.Description class="dialog-description">编辑器中有尚未确认的内容</Dialog.Description>
                  </div>
                </div>
              </div>
              <div class="discard-json-message">是否丢弃本次修改？</div>
              <div class="dialog-actions">
                <button
                  type="button"
                  class="button button-ghost"
                  onClick={() => {
                    setDiscardJsonOpen(false);
                    queueMicrotask(() => focusJsonEditor?.());
                  }}
                >
                  继续编辑
                </button>
                <button type="button" class="button button-danger" onClick={closeJsonCellEditor}>丢弃修改</button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root
        open={detailRow() !== null}
        closeOnEscape={!detailSaving()}
        closeOnInteractOutside={!detailSaving()}
        onOpenChange={(details) => {
          if (!details.open && !detailSaving()) {
            setDetailRow(null);
            setDetailDraft(null);
          }
        }}
      >
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content entity-detail-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><Eye size={19} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">数据详情</Dialog.Title>
                    <Dialog.Description class="dialog-description">
                      {rowIdentity(detailRow()) || props.table.display_name}
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" disabled={detailSaving()} title="关闭"><X size={18} /></Dialog.CloseTrigger>
              </div>
              <div class="entity-detail-list">
                <Show when={detailDraft()}>
                  <For each={props.table.columns}>
                    {(column) => (
                    <div class="entity-detail-row">
                      <div class="entity-detail-key">
                        <strong>{column.display_name}</strong>
                        <code>{column.name}</code>
                      </div>
                      <div class="entity-detail-value">
                        <Show
                          when={props.canWrite && !column.primary_key}
                          fallback={(
                            <Show
                              when={column.is_json}
                              fallback={displayValue(column, detailDraft()?.[column.name])}
                            >
                              <JsonViewer value={detailDraft()?.[column.name]} />
                            </Show>
                          )}
                        >
                          <Switch>
                            <Match when={column.is_json}>
                              <JsonViewer
                                value={detailDraft()?.[column.name]}
                                readOnly={false}
                                onChange={(source, valid) => setDetailCell(column, source, valid)}
                              />
                              <Show when={!detailJsonValidity()[column.name]}>
                                <div class="json-editor-validation-error">请输入合法 JSON</div>
                              </Show>
                            </Match>
                            <Match when={column.data_type === 'bool'}>
                              <BooleanSwitch
                                checked={Boolean(detailDraft()?.[column.name])}
                                label={detailDraft()?.[column.name] ? '是' : '否'}
                                onChange={(checked) => setDetailCell(column, checked)}
                              />
                            </Match>
                            <Match when>
                              <input
                                class="input entity-detail-input"
                                type={column.data_type === 'int' || column.data_type === 'float' ? 'number' : 'text'}
                                step={column.data_type === 'int' ? '1' : column.data_type === 'float' ? 'any' : undefined}
                                value={inputValue(detailDraft()?.[column.name])}
                                onInput={(event) => setDetailCell(column, inputValueForColumn(column, event.currentTarget.value))}
                              />
                            </Match>
                          </Switch>
                        </Show>
                      </div>
                    </div>
                    )}
                  </For>
                </Show>
              </div>
              <div class="dialog-actions">
                <Dialog.CloseTrigger class="button button-ghost" disabled={detailSaving()}>关闭</Dialog.CloseTrigger>
                <Show when={props.canWrite}>
                  <button
                    type="button"
                    class="button button-confirm"
                    disabled={detailSaving() || !detailChanged() || !detailJsonIsValid()}
                    onClick={() => void saveDetail()}
                  >
                    <Show when={detailSaving()} fallback={<><Check size={16} />保存</>}>
                      <LoaderCircle class="spin" size={16} />保存中
                    </Show>
                  </button>
                </Show>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </main>
  );
}
