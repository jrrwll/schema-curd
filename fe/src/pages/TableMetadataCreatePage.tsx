import { ArrowLeft, Braces, LoaderCircle, RefreshCw, Save, ShieldX, TriangleAlert } from 'lucide-solid';
import { Match, Show, Switch, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import { getDatasourceDetailByName } from '../api/datasource';
import { getPhysicalColumns, getPhysicalTables, refreshPhysicalColumns, refreshPhysicalTables } from '../api/physical';
import { createTableMetadata } from '../api/table';
import ColumnMetadataSection, { columnConfigValue, validateColumnConfigs } from '../components/ColumnMetadataSection';
import TableMetadataFormFields, { EMPTY_TABLE_METADATA_FORM, buildTableMetadataConfig, type TableMetadataFormValue } from '../components/TableMetadataFormFields';
import { clearColumnDependentAdvanced, tableAdvancedReferencedColumns } from '../components/tableAdvancedConfig';
import type { PhysicalColumnItem } from '../types/physical';
import type { ColumnConfig } from '../types/table';

interface Props { datasource: string | null; navigate: (url: string) => void; }

export default function TableMetadataCreatePage(props: Props) {
  const [datasource] = createResource(() => props.datasource || undefined, getDatasourceDetailByName);
  const datasourceValue = createMemo(() => datasource.error ? undefined : datasource());
  const [physicalTables, { mutate }] = createResource(() => datasourceValue()?.effective_role === 'write' ? datasourceValue()!.name : undefined, getPhysicalTables);
  const physicalTablesValue = createMemo(() => physicalTables.error ? undefined : physicalTables());
  const [form, setForm] = createSignal<TableMetadataFormValue>({
    ...EMPTY_TABLE_METADATA_FORM,
    advanced: {
      ...EMPTY_TABLE_METADATA_FORM.advanced,
      primary_keys: [],
      sortable_columns: [],
      search_default_value: [],
      fixed_value: [],
      fixed_where: [],
      default_order_by: [],
    },
  });
  const [columns, setColumns] = createSignal<ColumnConfig[]>([]);
  const [physicalColumns, setPhysicalColumns] = createSignal<PhysicalColumnItem[]>([]);
  const [submitting, setSubmitting] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [error, setError] = createSignal('');
  const listUrl = () => `/meta/table?datasource=${encodeURIComponent(props.datasource ?? '')}`;
  let active = true;
  onCleanup(() => { active = false; });

  async function loadColumns(refresh: boolean) {
    const current = datasourceValue();
    const table = form().table_name.trim();
    if (!current || !table) throw new Error('请先选择物理表');
    const result = await (refresh ? refreshPhysicalColumns({ datasource: current.name, table }) : getPhysicalColumns({ datasource: current.name, table }));
    if (datasourceValue()?.name === current.name && form().table_name.trim() === table) setPhysicalColumns(result);
    return result;
  }

  async function refreshTables() {
    const current = datasourceValue(); if (!current) return;
    setRefreshing(true); setError('');
    try { mutate(await refreshPhysicalTables(current.name)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setRefreshing(false); }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const current = datasourceValue(); if (!current) return;
    if (form().advanced.primary_keys.length === 0) { setError('请至少设置一个主键列'); return; }
    setSubmitting(true); setError('');
    try {
      const columnsConfig = columns().map(columnConfigValue);
      validateColumnConfigs(columnsConfig);
      await createTableMetadata({
        datasource: current.name,
        name: form().name.trim(),
        display_name: form().display_name.trim(),
        table_name: form().table_name.trim(),
        table_config: buildTableMetadataConfig(form(), physicalColumns(), columnsConfig),
        columns_config: columnsConfig,
      });
      if (!active) return;
      props.navigate(listUrl());
    } catch (reason) { setError((reason as Error).message); }
    finally { setSubmitting(false); }
  }

  return <main class="page-shell metadata-form-shell">
    <header class="page-header create-header"><div class="header-with-back"><button class="icon-button" title="返回表元数据列表" onClick={() => props.navigate(listUrl())}><ArrowLeft size={19} /></button><div><div class="eyebrow">表元数据</div><h1>新增数据表</h1><div class="table-code">{datasourceValue()?.name}</div></div></div></header>
    <Switch>
      <Match when={datasource.loading}><div class="app-state"><LoaderCircle class="spin" size={18} />正在加载</div></Match>
      <Match when={datasource.error || !datasourceValue()}><div class="app-state app-error"><TriangleAlert size={20} />{datasource.error?.message || '未找到数据源'}</div></Match>
      <Match when={datasourceValue()?.effective_role !== 'write'}><div class="app-state app-error"><ShieldX size={20} />没有在该数据源创建表配置的权限</div></Match>
      <Match when>
        <form class="create-form" onSubmit={submit}>
          <fieldset class="form-disabled-scope" disabled={submitting()}>
          <div class="form-heading"><h2><Braces size={16} />元数据配置</h2><button type="button" class="button button-ghost physical-table-refresh" disabled={physicalTables.loading || refreshing()} onClick={() => void refreshTables()}><RefreshCw classList={{ spin: refreshing() }} size={15} />刷新真实表</button></div>
          <TableMetadataFormFields value={form()} physicalTables={physicalTablesValue() ?? []} physicalColumns={physicalColumns()} columns={columns()} onChange={(next) => {
            if (next.table_name !== form().table_name) {
              setColumns([]);
              setPhysicalColumns([]);
              setForm({ ...next, advanced: clearColumnDependentAdvanced(next.advanced) });
            } else {
              setForm(next);
            }
          }} />
          <Show when={physicalTables.loading}><div class="physical-table-status"><LoaderCircle class="spin" size={14} />正在加载真实数据表</div></Show>
          <ColumnMetadataSection columns={columns()} referencedColumns={tableAdvancedReferencedColumns(form().advanced)} canInspectPhysical loadPhysicalColumns={loadColumns} onChange={setColumns} />
          <Show when={error() || physicalTables.error}><div class="datasource-form-error notice notice-error">{error() || physicalTables.error?.message}</div></Show>
          <div class="form-actions"><button type="button" class="button button-ghost" onClick={() => props.navigate(listUrl())}>取消</button><button class="button button-confirm" type="submit" disabled={submitting() || columns().length === 0}><Show when={submitting()} fallback={<><Save size={16} />创建</>}><LoaderCircle class="spin" size={16} />创建中</Show></button></div>
          </fieldset>
        </form>
      </Match>
    </Switch>
  </main>;
}
