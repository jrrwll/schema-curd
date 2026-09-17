import { ArrowLeft, Braces, LoaderCircle, Save, ShieldX, TriangleAlert } from 'lucide-solid';
import { Match, Show, Switch, createEffect, createMemo, createResource, createSignal } from 'solid-js';
import { getPhysicalColumns, refreshPhysicalColumns } from '../api/physical';
import { getTableMetadataDetail, updateTableMetadata } from '../api/table';
import ColumnMetadataSection, { columnConfigValue, validateColumnConfigs } from '../components/ColumnMetadataSection';
import TableMetadataFormFields, { buildTableMetadataConfig, tableMetadataFormValue, type TableMetadataFormValue } from '../components/TableMetadataFormFields';
import { tableAdvancedReferencedColumns } from '../components/tableAdvancedConfig';
import type { PhysicalColumnItem } from '../types/physical';
import type { ColumnConfig } from '../types/table';

interface Props { tableId: number | null; datasource: string | null; navigate: (url: string, replace?: boolean) => void; }

export default function TableMetadataUpdatePage(props: Props) {
  const id = () => props.tableId ?? 0;
  const [record] = createResource(() => Number.isInteger(id()) && id() > 0 ? id() : undefined, getTableMetadataDetail);
  const recordValue = createMemo(() => record.error ? undefined : record());
  const [form, setForm] = createSignal<TableMetadataFormValue>();
  const [columns, setColumns] = createSignal<ColumnConfig[]>([]);
  const [physicalColumns, setPhysicalColumns] = createSignal<PhysicalColumnItem[]>([]);
  const [loadedId, setLoadedId] = createSignal<number | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [saved, setSaved] = createSignal(false);
  const listUrl = () => `/meta/table?datasource=${encodeURIComponent(recordValue()?.datasource ?? props.datasource ?? '')}`;
  let normalizedUrl = '';

  createEffect(() => {
    const current = recordValue(); if (!current) return;
    const canonicalUrl = `/meta/table/update?datasource=${encodeURIComponent(current.datasource)}&table=${current.id}`;
    if (props.datasource !== current.datasource && normalizedUrl !== canonicalUrl) {
      normalizedUrl = canonicalUrl;
      props.navigate(canonicalUrl, true);
    }
    if (loadedId() === current.id) return;
    const logicalColumns = current.columns_config.map(columnConfigValue);
    const primaryKeys = new Set(current.table_config.primary_keys);
    setForm(tableMetadataFormValue(current.name, current.table_name, current.display_name, current.table_config));
    setColumns(logicalColumns);
    setPhysicalColumns(logicalColumns.map((column) => ({ ...column, comment: column.display_name, primary_key: primaryKeys.has(column.name) })));
    setLoadedId(current.id);
    void loadColumns(false).catch((reason) => setError((reason as Error).message));
  });

  async function loadColumns(refresh: boolean) {
    const tableId = id();
    const result = await (refresh ? refreshPhysicalColumns({ table_id: tableId }) : getPhysicalColumns({ table_id: tableId }));
    if (id() === tableId) setPhysicalColumns(result);
    return result;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const current = recordValue(); const values = form(); if (!current || !values) return;
    if (values.advanced.primary_keys.length === 0) { setError('请至少设置一个主键列'); setSaved(false); return; }
    setSubmitting(true); setError(''); setSaved(false);
    try {
      const columnsConfig = columns().map(columnConfigValue);
      validateColumnConfigs(columnsConfig);
      await updateTableMetadata({ id: current.id, display_name: values.display_name.trim(), table_config: buildTableMetadataConfig(values, physicalColumns(), columnsConfig), columns_config: columnsConfig });
      setSaved(true);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSubmitting(false); }
  }

  return <main class="page-shell metadata-form-shell">
    <header class="page-header create-header"><div class="header-with-back"><button class="icon-button" title="返回表元数据列表" onClick={() => props.navigate(listUrl())}><ArrowLeft size={19} /></button><div><div class="eyebrow">表元数据</div><h1>编辑数据表</h1><div class="table-code">{recordValue()?.name ?? props.tableId}</div></div></div></header>
    <Switch>
      <Match when={record.loading}><div class="app-state"><LoaderCircle class="spin" size={18} />正在加载</div></Match>
      <Match when={record.error || !recordValue()}><div class="app-state app-error"><TriangleAlert size={20} />{record.error?.message || '未找到数据表'}</div></Match>
      <Match when={recordValue()?.effective_role !== 'write'}><div class="app-state app-error"><ShieldX size={20} />没有修改该数据表的权限</div></Match>
      <Match when={form()}>{(value) => <form class="create-form table-config-form" onSubmit={submit}>
        <fieldset class="form-disabled-scope" disabled={submitting()}>
        <div class="form-heading"><h2><Braces size={16} />表配置</h2><span>{recordValue()?.table_name}</span></div>
        <TableMetadataFormFields value={value()} editing physicalColumns={physicalColumns()} columns={columns()} onChange={setForm} />
        <ColumnMetadataSection columns={columns()} referencedColumns={tableAdvancedReferencedColumns(value().advanced)} canInspectPhysical loadPhysicalColumns={loadColumns} onChange={setColumns} />
        <Show when={saved()}><div class="datasource-form-error notice notice-success">表配置已保存</div></Show><Show when={error()}><div class="datasource-form-error notice notice-error">{error()}</div></Show>
        <div class="form-actions"><button type="button" class="button button-ghost" onClick={() => props.navigate(listUrl())}>返回列表</button><button class="button button-confirm" type="submit" disabled={submitting()}><Show when={submitting()} fallback={<><Save size={16} />保存</>}><LoaderCircle class="spin" size={16} />保存中</Show></button></div>
        </fieldset>
      </form>}</Match>
    </Switch>
  </main>;
}
