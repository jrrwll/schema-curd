import {
  ChevronRight,
  Database,
  LoaderCircle,
  RotateCw,
  Search,
  ShieldX,
  Table2,
  TriangleAlert,
  X,
} from 'lucide-solid';
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';
import {
  getDiscoveryDatasourceDetail,
  getDiscoveryDatasources,
  getDiscoveryTables,
  getTableMetadataDetail,
} from '../api';
import DatasourceSelectionDialog from '../components/DatasourceSelectionDialog';
import { MAX_ENTITY_TABLE_RESULTS, SEARCH_DEBOUNCE_MS } from '../constants';
import type {
  DiscoveryDatasourceDetail,
  DiscoveryDatasourceItem,
  DiscoveryTableItem,
  RouteState,
  TableMetadataDetailRecord,
} from '../types';
import CreatePage from './CreatePage';
import ListPage from './ListPage';

interface EntityWorkspacePageProps {
  route: RouteState;
  navigate: (url: string, replace?: boolean) => void;
}

export default function EntityWorkspacePage(props: EntityWorkspacePageProps) {
  const [selectedDatasource, setSelectedDatasource] = createSignal<DiscoveryDatasourceDetail | null>(null);
  const [selectedDatasourceLoading, setSelectedDatasourceLoading] = createSignal(false);
  const [selectedDatasourceError, setSelectedDatasourceError] = createSignal('');
  const [datasourceDialogOpen, setDatasourceDialogOpen] = createSignal(!props.route.datasource);

  const [tableKeyword, setTableKeyword] = createSignal('');
  const [tables, setTables] = createSignal<DiscoveryTableItem[]>([]);
  const [tableTotal, setTableTotal] = createSignal(0);
  const [tablesLoading, setTablesLoading] = createSignal(false);
  const [tableError, setTableError] = createSignal('');
  const [editingTableSelection, setEditingTableSelection] = createSignal(false);
  const [selectedTable, setSelectedTable] = createSignal<TableMetadataDetailRecord | null>(null);
  const [tableDetailLoading, setTableDetailLoading] = createSignal(false);
  const [tableDetailError, setTableDetailError] = createSignal('');

  let datasourceRequestId = 0;
  let loadingDatasource: string | null = null;
  let tableRequestId = 0;
  let tableDetailRequestId = 0;
  let loadedDatasource: string | null = null;
  let loadedTableDetail: string | null = null;
  let lastTableQueryKey: string | null = null;
  let tableSearchInput: HTMLInputElement | undefined;

  const filteredTables = createMemo(() => {
    const keyword = tableKeyword().trim().toLocaleLowerCase();
    if (!keyword) return tables();
    return tables().filter(
      (table) =>
        table.name.toLocaleLowerCase().includes(keyword)
        || table.display_name.toLocaleLowerCase().includes(keyword),
    );
  });

  const selectedTableItem = createMemo(() =>
    tables().find((table) => String(table.id) === props.route.table),
  );

  async function loadSelectedDatasource(id: string) {
    if (loadingDatasource === id) return;
    loadingDatasource = id;
    const requestId = ++datasourceRequestId;
    setSelectedDatasourceLoading(true);
    setSelectedDatasourceError('');
    try {
      const datasource = await getDiscoveryDatasourceDetail(Number(id));
      if (requestId !== datasourceRequestId) return;
      setSelectedDatasource(datasource);
    } catch (error) {
      if (requestId !== datasourceRequestId) return;
      setSelectedDatasourceError((error as Error).message);
      setDatasourceDialogOpen(true);
    } finally {
      if (requestId === datasourceRequestId) {
        loadingDatasource = null;
        setSelectedDatasourceLoading(false);
      }
    }
  }

  async function loadTables(datasource: string, keyword = '') {
    const normalizedKeyword = keyword.trim();
    lastTableQueryKey = `${datasource}\u0000${normalizedKeyword.toLocaleLowerCase()}`;
    const requestId = ++tableRequestId;
    setTablesLoading(true);
    setTableError('');
    setTables([]);
    setTableTotal(0);
    try {
      const result = await getDiscoveryTables({
        datasource: Number(datasource),
        keyword: normalizedKeyword || undefined,
        page_no: 1,
        page_size: MAX_ENTITY_TABLE_RESULTS,
      });
      if (requestId !== tableRequestId) return;
      setTables(result.items);
      setTableTotal(result.total);
    } catch (error) {
      if (requestId !== tableRequestId) return;
      setTableError((error as Error).message);
    } finally {
      if (requestId === tableRequestId) setTablesLoading(false);
    }
  }

  async function loadTableDetail(datasource: string, table: string) {
    const requestId = ++tableDetailRequestId;
    setTableDetailLoading(true);
    setTableDetailError('');
    setSelectedTable(null);
    try {
      const detail = await getTableMetadataDetail({ datasource, id: Number(table) });
      if (requestId !== tableDetailRequestId) return;
      setSelectedTable(detail);
    } catch (error) {
      if (requestId !== tableDetailRequestId) return;
      setTableDetailError((error as Error).message);
    } finally {
      if (requestId === tableDetailRequestId) setTableDetailLoading(false);
    }
  }

  function selectDatasource(datasource: DiscoveryDatasourceItem) {
    setSelectedDatasourceError('');
    setDatasourceDialogOpen(false);
    if (props.route.datasource === String(datasource.id)) return;
    setEditingTableSelection(false);
    setTableKeyword('');
    const params = new URLSearchParams({ datasource: String(datasource.id) });
    props.navigate(`/entity?${params}`);
  }

  function updateTableKeyword(keyword: string) {
    setTableKeyword(keyword);
  }

  function selectTable(table: DiscoveryTableItem) {
    const datasource = props.route.datasource;
    if (!datasource) return;
    setEditingTableSelection(false);
    setTableKeyword(table.name);
    if (props.route.table === String(table.id)) {
      return;
    }
    const params = new URLSearchParams({
      datasource,
      table: String(table.id),
    });
    props.navigate(`/entity?${params}`);
  }

  function clearSelectedTable() {
    setEditingTableSelection(true);
    setTableKeyword('');
    queueMicrotask(() => tableSearchInput?.focus());
  }

  createEffect(() => {
    const datasource = props.route.datasource;
    if (!datasource) {
      datasourceRequestId += 1;
      loadingDatasource = null;
      setSelectedDatasource(null);
      setSelectedDatasourceError('');
      setSelectedDatasourceLoading(false);
      setDatasourceDialogOpen(true);
      return;
    }
    if (String(selectedDatasource()?.id ?? '') !== datasource && loadingDatasource !== datasource) {
      void loadSelectedDatasource(datasource);
    }
  });

  createEffect(() => {
    const datasource = props.route.datasource;
    if (datasource === loadedDatasource) return;
    loadedDatasource = datasource;
    setEditingTableSelection(false);
    if (!datasource) {
      tableRequestId += 1;
      setTables([]);
      setTableTotal(0);
      setTableError('');
      return;
    }
    void loadTables(datasource);
  });

  createEffect(() => {
    const datasource = props.route.datasource;
    const keyword = tableKeyword().trim();
    if (!datasource || (props.route.table && !editingTableSelection())) return;
    const queryKey = `${datasource}\u0000${keyword.toLocaleLowerCase()}`;
    if (queryKey === lastTableQueryKey) return;
    const timeout = window.setTimeout(
      () => void loadTables(datasource, keyword),
      SEARCH_DEBOUNCE_MS,
    );
    onCleanup(() => window.clearTimeout(timeout));
  });

  createEffect(() => {
    const datasource = selectedDatasource();
    const table = props.route.table;
    const datasourceName = datasource && String(datasource.id) === props.route.datasource
      ? datasource.name
      : null;
    const detailKey = datasourceName && table ? `${datasourceName}\u0000${table}` : null;
    if (detailKey === loadedTableDetail) return;
    loadedTableDetail = detailKey;
    setEditingTableSelection(false);
    if (!datasourceName || !table) {
      tableDetailRequestId += 1;
      setSelectedTable(null);
      setTableDetailError('');
      setTableDetailLoading(false);
      return;
    }
    void loadTableDetail(datasourceName, table);
  });

  return (
    <>
      <main class="entity-workspace">
      <aside class="entity-picker-panel">
        <header class="entity-picker-header">
          <strong>实体数据</strong>
          <span>选择数据源和数据表</span>
        </header>

        <div class="entity-picker-controls">
          <span class="entity-picker-label">数据源</span>
          <Show when={String(selectedDatasource()?.id ?? '') === props.route.datasource ? selectedDatasource() : null} fallback={
            <button
              type="button"
              class="entity-selected-datasource entity-selected-datasource-empty"
              onClick={() => setDatasourceDialogOpen(true)}
            >
              <Show when={!selectedDatasourceLoading()} fallback={
                <><LoaderCircle class="spin" size={17} /><span>正在加载数据源</span></>
              }>
                <Database size={17} />
                <span>{selectedDatasourceError() || '选择数据源'}</span>
                <ChevronRight size={16} />
              </Show>
            </button>
          }>
            {(datasource) => (
              <button
                type="button"
                class="entity-selected-datasource"
                title="更换数据源"
                onClick={() => setDatasourceDialogOpen(true)}
              >
                <span class="entity-selected-datasource-icon"><Database size={17} /></span>
                <span class="entity-selected-datasource-copy">
                  <strong>{datasource().display_name}</strong>
                  <code>{datasource().name}</code>
                </span>
                <small>{datasource().table_count}</small>
                <ChevronRight size={16} />
              </button>
            )}
          </Show>

          <label class="entity-picker-label" for="entity-table">数据表</label>
          <div class="entity-picker-input" classList={{ 'has-selection': Boolean(props.route.table && !editingTableSelection()) }}>
            <Search size={15} />
            <Show when={props.route.table && !editingTableSelection() ? props.route.table : null} fallback={
              <input
                ref={tableSearchInput}
                id="entity-table"
                type="search"
                autocomplete="off"
                placeholder={props.route.datasource ? '筛选数据表' : '请先选择数据源'}
                disabled={!props.route.datasource}
                value={tableKeyword()}
                onInput={(event) => updateTableKeyword(event.currentTarget.value)}
              />
            }>
              {(_tableId) => (
                <span class="entity-table-tag" title={selectedTable()?.name ?? selectedTableItem()?.name}>
                  <Table2 size={13} />
                  <span class="entity-table-tag-copy">
                    <strong>{selectedTable()?.display_name ?? selectedTableItem()?.display_name ?? props.route.table}</strong>
                    <code>{selectedTable()?.name ?? selectedTableItem()?.name ?? props.route.table}</code>
                  </span>
                  <button type="button" title="清除数据表" aria-label="清除数据表" onClick={clearSelectedTable}>
                    <X size={13} />
                  </button>
                </span>
              )}
            </Show>
            <Show when={tablesLoading()}><LoaderCircle class="spin" size={14} /></Show>
          </div>
        </div>

        <div class="entity-table-summary">
          <span>数据表列表</span>
          <Show when={props.route.datasource}>
            <small>{filteredTables().length} / {Math.min(tableTotal(), MAX_ENTITY_TABLE_RESULTS)}</small>
          </Show>
        </div>
        <div class="entity-table-list">
          <Show when={tableError()}>
            <div class="entity-picker-error">
              <span>{tableError()}</span>
              <button
                title="重试加载数据表"
                aria-label="重试加载数据表"
                onClick={() => props.route.datasource && void loadTables(props.route.datasource)}
              >
                <RotateCw size={14} />
              </button>
            </div>
          </Show>
          <Show when={tablesLoading()}>
            <div class="entity-picker-loading"><LoaderCircle class="spin" size={15} />正在加载数据表</div>
          </Show>
          <Show when={!props.route.datasource && !tablesLoading()}>
            <div class="entity-picker-empty"><Database size={17} />请先选择数据源</div>
          </Show>
          <Show when={props.route.datasource && !tablesLoading() && !tableError()}>
            <For each={filteredTables()} fallback={
              <div class="entity-picker-empty"><Table2 size={17} />没有匹配的数据表</div>
            }>
              {(table) => (
                <button
                  type="button"
                  class="entity-table-option"
                  classList={{ selected: props.route.table === String(table.id) }}
                  onClick={() => selectTable(table)}
                >
                  <span>{table.display_name}</span>
                  <code>{table.name}</code>
                </button>
              )}
            </For>
            <Show when={tableTotal() > MAX_ENTITY_TABLE_RESULTS}>
              <div class="entity-picker-limit">仅显示前 {MAX_ENTITY_TABLE_RESULTS} 项</div>
            </Show>
          </Show>
        </div>
      </aside>

      <section class="entity-workspace-main">
        <Switch>
          <Match when={selectedTable() && selectedDatasource() ? selectedTable() : null}>
            {(table) => (
              <Switch>
                <Match when={props.route.pathname === '/entity/create' && !table().readonly && selectedDatasource() && table().role_action === 'write'}>
                  <CreatePage datasourceId={selectedDatasource()!.id} datasource={selectedDatasource()!.name} table={table()} navigate={props.navigate} />
                </Match>
                <Match when={props.route.pathname === '/entity/create'}>
                  <div class="entity-selection-state app-error">
                    <ShieldX size={19} />{table().readonly ? '该数据表仅支持查看' : '没有新增权限'}
                  </div>
                </Match>
                <Match when>
                  <ListPage
                    embedded
                    canWrite={Boolean(!table().readonly && selectedDatasource() && table().role_action === 'write')}
                    datasourceId={selectedDatasource()!.id}
                    datasource={selectedDatasource()!.name}
                    table={table()}
                    navigate={props.navigate}
                  />
                </Match>
              </Switch>
            )}
          </Match>
          <Match when={props.route.table && tableDetailLoading()}>
            <div class="entity-selection-state"><LoaderCircle class="spin" size={19} />正在加载数据表</div>
          </Match>
          <Match when={props.route.table && tableDetailError()}>
            <div class="entity-selection-state app-error"><TriangleAlert size={19} />{tableDetailError()}</div>
          </Match>
          <Match when={props.route.table}>
            <div class="entity-selection-state"><TriangleAlert size={19} />未找到数据表</div>
          </Match>
          <Match when>
            <div class="entity-selection-state">
              <Table2 size={19} />
              {props.route.datasource ? '请选择数据表' : '请先选择数据源'}
            </div>
          </Match>
        </Switch>
        </section>
      </main>
      <DatasourceSelectionDialog
        open={datasourceDialogOpen()}
        selectedId={selectedDatasource()?.id ?? null}
        loadPage={getDiscoveryDatasources}
        onOpenChange={setDatasourceDialogOpen}
        onSelect={selectDatasource}
      />
    </>
  );
}
