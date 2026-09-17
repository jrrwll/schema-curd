import { ChevronRight, Database, LoaderCircle, Search, ShieldX, Table2, TriangleAlert } from 'lucide-solid';
import { For, Match, Show, Switch, createMemo, createResource, createSignal } from 'solid-js';
import { getDiscoveryDatasourcePage, getDiscoveryDatasources, getDiscoveryTables } from '../api/discovery';
import { getTableMetadataDetail } from '../api/table';
import DatasourceSelectionDialog from '../components/DatasourceSelectionDialog';
import { createDebouncedValue } from '../debounce';
import type { DiscoveryDatasourceItem, DiscoveryTableItem } from '../types/discovery';
import type { EntityTableView } from '../types/entity';
import type { RouteState } from '../types/route';
import type { TableMetadataDetailRecord } from '../types/table';
import CreatePage from './CreatePage';
import ListPage from './ListPage';

interface Props { route: RouteState; navigate: (url: string, replace?: boolean) => void; }

function tableView(record: TableMetadataDetailRecord): EntityTableView {
  const primaryKeys = new Set(record.table_config.primary_keys);
  const sortableColumns = new Set(record.table_config.sortable_columns ?? []);
  return {
    id: record.id,
    name: record.name,
    display_name: record.display_name,
    search_default_value: record.table_config.search_default_value ?? {},
    insert_fixed_values: record.table_config.insert_fixed_values,
    columns: record.columns_config.map((column) => ({
      ...column,
      primary_key: primaryKeys.has(column.name),
      is_json: column.data_type === 'json',
      sortable: sortableColumns.has(column.name),
    })),
  };
}

export default function EntityWorkspacePage(props: Props) {
  const datasourceName = () => props.route.datasource || undefined;
  const tableId = () => props.route.table ?? undefined;
  const [dialogOpen, setDialogOpen] = createSignal(!props.route.datasource);
  const [keyword, setKeyword] = createSignal('');
  const debouncedKeyword = createDebouncedValue(keyword);
  const [datasource] = createResource(datasourceName, async (name) => (await getDiscoveryDatasources({ datasource: name }))[0]);
  const datasourceValue = createMemo(() => datasource.error ? undefined : datasource());
  const [tables, { refetch: refetchTables }] = createResource(
    () => datasourceValue() ? { datasource_id: datasourceValue()!.id, keyword: debouncedKeyword().trim() || undefined } : undefined,
    getDiscoveryTables,
  );
  const [table] = createResource(tableId, getTableMetadataDetail);
  const tablesValue = createMemo(() => tables.error ? undefined : tables());
  const tableValue = createMemo(() => table.error ? undefined : table());
  const currentDatasource = createMemo(() => datasourceValue()?.name === datasourceName() ? datasourceValue() : undefined);
  const currentTable = createMemo(() => tableValue()?.id === tableId() ? tableValue() : undefined);
  const selectedItem = createMemo(() => tablesValue()?.find((item) => item.id === tableId()) ?? currentTable());
  const associationError = createMemo(() => {
    const record = currentTable();
    const selectedDatasourceName = datasourceName();
    if (!record || !selectedDatasourceName || record.datasource === selectedDatasourceName) return null;
    return `数据表 ${record.display_name} 不属于数据源 ${selectedDatasourceName}`;
  });
  const view = createMemo(() => {
    const record = currentTable();
    return record && !associationError() ? tableView(record) : null;
  });

  function selectDatasource(item: DiscoveryDatasourceItem) {
    setDialogOpen(false); setKeyword(''); props.navigate(`/entity?datasource=${encodeURIComponent(item.name)}`);
  }
  function selectTable(item: DiscoveryTableItem) {
    if (!props.route.datasource) return;
    props.navigate(`/entity?datasource=${encodeURIComponent(props.route.datasource)}&table=${item.id}`);
  }

  return <>
    <main class="entity-workspace">
      <aside class="entity-picker-panel">
        <header class="entity-picker-header"><strong>实体数据</strong><span>选择数据源和数据表</span></header>
        <div class="entity-picker-controls"><span class="entity-picker-label">数据源</span>
          <button type="button" class="entity-selected-datasource" classList={{ 'entity-selected-datasource-empty': !currentDatasource() }} onClick={() => setDialogOpen(true)}>
            <Show when={currentDatasource()} fallback={<Show when={!datasource.loading} fallback={<><LoaderCircle class="spin" size={17} /><span>正在加载数据源</span></>}><Database size={17} /><span>{datasource.error?.message || '选择数据源'}</span><ChevronRight size={16} /></Show>}>
              {(item) => <><span class="entity-selected-datasource-icon"><Database size={17} /></span><span class="entity-selected-datasource-copy"><strong>{item().display_name}</strong><code>{item().name}</code></span><ChevronRight size={16} /></>}
            </Show>
          </button>
          <label class="entity-picker-label" for="entity-table">数据表</label>
          <div class="entity-picker-input"><Search size={15} /><input id="entity-table" type="search" autocomplete="off" placeholder={props.route.datasource ? '筛选数据表' : '请先选择数据源'} disabled={!props.route.datasource} value={keyword()} onInput={(event) => setKeyword(event.currentTarget.value)} /><Show when={tables.loading}><LoaderCircle class="spin" size={14} /></Show></div>
        </div>
        <div class="entity-table-summary"><span>数据表列表</span><Show when={props.route.datasource}><small>{tablesValue()?.length ?? 0}</small></Show></div>
        <div class="entity-table-list">
          <Show when={tables.error}><div class="entity-picker-error"><span>{tables.error?.message}</span><button title="重试" onClick={() => void refetchTables()}>重试</button></div></Show>
          <Show when={!props.route.datasource && !tables.loading}><div class="entity-picker-empty"><Database size={17} />请先选择数据源</div></Show>
          <Show when={props.route.datasource && !tables.loading && !tables.error}><For each={tablesValue()} fallback={<div class="entity-picker-empty"><Table2 size={17} />没有匹配的数据表</div>}>{(item) => <button type="button" class="entity-table-option" classList={{ selected: tableId() === item.id }} onClick={() => selectTable(item)}><span>{item.display_name}</span><code>{item.name}</code></button>}</For></Show>
        </div>
      </aside>
      <section class="entity-workspace-main"><Switch>
        <Match when={view() && currentTable() ? { view: view()!, record: currentTable()! } : null}>{(current) => <Show when={current().record.id} keyed><Switch>
          <Match when={props.route.pathname === '/entity/create' && !current().record.table_config.readonly && current().record.effective_role === 'write'}><CreatePage datasource={datasourceName()!} table={current().view} navigate={props.navigate} /></Match>
          <Match when={props.route.pathname === '/entity/create'}><div class="entity-selection-state app-error"><ShieldX size={19} />{current().record.table_config.readonly ? '该数据表仅支持查看' : '没有新增权限'}</div></Match>
          <Match when><ListPage canWrite={!current().record.table_config.readonly && current().record.effective_role === 'write'} datasource={datasourceName()!} table={current().view} navigate={props.navigate} /></Match>
        </Switch></Show>}</Match>
        <Match when={props.route.table && table.loading}><div class="entity-selection-state"><LoaderCircle class="spin" size={19} />正在加载数据表</div></Match>
        <Match when={props.route.table && table.error}><div class="entity-selection-state app-error"><TriangleAlert size={19} />{table.error?.message}</div></Match>
        <Match when={associationError()}><div class="entity-selection-state app-error"><TriangleAlert size={19} />{associationError()}</div></Match>
        <Match when={props.route.table}><div class="entity-selection-state"><TriangleAlert size={19} />未找到数据表 {selectedItem()?.name}</div></Match>
        <Match when><div class="entity-selection-state"><Table2 size={19} />{props.route.datasource ? '请选择数据表' : '请先选择数据源'}</div></Match>
      </Switch></section>
    </main>
    <DatasourceSelectionDialog open={dialogOpen()} selectedId={currentDatasource()?.id ?? null} loadPage={getDiscoveryDatasourcePage} onOpenChange={setDialogOpen} onSelect={selectDatasource} />
  </>;
}
