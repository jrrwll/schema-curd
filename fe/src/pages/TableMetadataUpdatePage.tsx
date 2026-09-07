import { ArrowLeft, Braces, LoaderCircle, Save, ShieldX, TriangleAlert } from 'lucide-solid';
import { Match, Show, Switch, createEffect, createResource, createSignal } from 'solid-js';
import {
  getColumnMetadata,
  getDatasources,
  getPhysicalColumns,
  getTableMetadataDetail,
  updateTableMetadata,
} from '../api';
import ColumnMetadataSection from '../components/ColumnMetadataSection';
import TableMetadataFormFields, {
  buildTableMetadataConfig,
  tableMetadataFormValue,
  type TableMetadataFormValue,
} from '../components/TableMetadataFormFields';
import { TableStatusEnum } from '../types';

interface TableMetadataUpdatePageProps {
  tableId: string | null;
  datasourceId: string | null;
  navigate: (url: string) => void;
  onUpdated: () => unknown;
}

export default function TableMetadataUpdatePage(props: TableMetadataUpdatePageProps) {
  const id = () => Number(props.tableId);
  const [datasources] = createResource(() => getDatasources());
  const datasourceRecord = () =>
    datasources()?.find((item) => item.id === Number(props.datasourceId));
  const [record, { refetch }] = createResource(
    () => {
      const tableId = id();
      const datasource = datasourceRecord();
      return tableId > 0 && datasource
        ? { id: tableId, datasource: datasource.name }
        : undefined;
    },
    getTableMetadataDetail,
  );
  const [columns, { refetch: refetchColumns }] = createResource(
    () => {
      const current = record();
      return current ? { datasource: current.datasource, table: current.name } : undefined;
    },
    getColumnMetadata,
  );
  const [physicalColumns] = createResource(
    () => {
      const current = record();
      return current && datasourceRecord()?.role_action === 'write'
        ? { datasource: current.datasource, table: current.name }
        : undefined;
    },
    getPhysicalColumns,
  );
  const [form, setForm] = createSignal<TableMetadataFormValue>();
  const [loadedId, setLoadedId] = createSignal<number | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');
  const [saved, setSaved] = createSignal(false);

  const table = () => record();
  const datasource = () => table()?.datasource ?? datasourceRecord()?.name;
  const advancedColumns = () => (physicalColumns()?.items ?? table()?.columns ?? []).map((column) => ({
    name: column.name,
    data_type: column.data_type,
  }));
  const canInspectPhysical = () => datasourceRecord()?.role_action === 'write';
  const listUrl = () => `/meta/table?datasource=${props.datasourceId ?? ''}`;

  createEffect(() => {
    const current = table();
    if (!current || loadedId() === current.id) return;
    setForm(tableMetadataFormValue(current.name, current.display_name, current.config));
    setLoadedId(current.id);
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const values = form();
    const current = table();
    if (!values || !current) return;
    setSubmitting(true);
    setServerError('');
    setSaved(false);
    try {
      const config = buildTableMetadataConfig(values, advancedColumns());
      await updateTableMetadata({
        id: current.id,
        datasource: current.datasource,
        display_name: values.display_name,
        config,
      });
      await Promise.all([refetch(), props.onUpdated()]);
      setSaved(true);
    } catch (error) {
      setServerError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main class="page-shell metadata-form-shell">
      <header class="page-header create-header">
        <div class="header-with-back">
          <button class="icon-button" title="返回表元数据列表" onClick={() => props.navigate(listUrl())}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <div class="eyebrow">表元数据</div>
            <h1>编辑数据表</h1>
            <div class="table-title-meta">
              <span class="table-code">{table()?.name ?? props.tableId}</span>
              <Show when={table()}>
                {(current) => <span class={`table-status table-status-${current().status}`}>{current().status === TableStatusEnum.Draft ? '草稿' : current().status === TableStatusEnum.Enabled ? '可用' : '禁用'}</span>}
              </Show>
            </div>
          </div>
        </div>
      </header>

      <Switch>
        <Match when={(datasources.loading || record.loading) && !record()}>
          <div class="app-state"><LoaderCircle class="spin" size={18} />正在加载</div>
        </Match>
        <Match when={datasources.error || record.error}>
          <div class="app-state app-error"><TriangleAlert size={20} />{datasources.error?.message || record.error?.message}</div>
        </Match>
        <Match when={!table()}>
          <div class="app-state app-error"><TriangleAlert size={20} />Table metadata not found</div>
        </Match>
        <Match when={table()?.role_action !== 'write'}>
          <div class="app-state app-error"><ShieldX size={20} />没有修改该数据表的权限</div>
        </Match>
        <Match when={form()}>
          {(value) => (
            <>
              <form class="create-form table-config-form" onSubmit={submit}>
                <div class="form-heading">
                  <h2><Braces size={16} />表配置</h2>
                  <span>table_info</span>
                </div>
                <TableMetadataFormFields
                  value={value()}
                  editing
                  columns={advancedColumns()}
                  onChange={setForm}
                />
                <Show when={columns.error}>
                  <div class="datasource-form-error notice notice-error">{columns.error?.message}</div>
                </Show>
                <Show when={physicalColumns.error}>
                  <div class="datasource-form-error notice notice-error">{physicalColumns.error?.message}</div>
                </Show>
                <Show when={saved()}><div class="datasource-form-error notice notice-success">表配置已保存</div></Show>
                <Show when={serverError()}>
                  <div class="datasource-form-error notice notice-error">{serverError()}</div>
                </Show>
                <div class="form-actions">
                  <button type="button" class="button button-ghost" onClick={() => props.navigate(listUrl())}>返回列表</button>
                  <button
                    class="button button-confirm"
                    type="submit"
                    disabled={submitting() || columns.loading || physicalColumns.loading || Boolean(columns.error || physicalColumns.error)}
                  >
                    <Show when={submitting()} fallback={<><Save size={16} />保存表配置</>}>
                      <LoaderCircle class="spin" size={16} />保存中
                    </Show>
                  </button>
                </div>
              </form>
              <ColumnMetadataSection
                datasource={table()!.datasource}
                table={table()!.name}
                tableStatus={table()!.status}
                canInspectPhysical={canInspectPhysical()}
                columns={columns()}
                loading={columns.loading}
                error={columns.error}
                onChanged={async () => {
                  await Promise.all([refetch(), refetchColumns(), props.onUpdated()]);
                }}
              />
            </>
          )}
        </Match>
      </Switch>
    </main>
  );
}
