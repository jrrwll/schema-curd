import { ArrowLeft, Braces, LoaderCircle, RefreshCw, Save } from 'lucide-solid';
import { Show, createMemo, createResource, createSignal } from 'solid-js';
import {
  createTableMetadata,
  getDatasources,
  getPhysicalColumns,
  getPhysicalTables,
  refreshPhysicalTables,
} from '../api';
import TableMetadataFormFields, {
  EMPTY_TABLE_METADATA_FORM,
  buildTableMetadataConfig,
  type TableMetadataFormValue,
} from '../components/TableMetadataFormFields';
import { MAX_PHYSICAL_TABLE_RESULTS } from '../constants';

interface TableMetadataCreatePageProps {
  datasourceId: string | null;
  navigate: (url: string) => void;
  onCreated: () => unknown;
}

export default function TableMetadataCreatePage(props: TableMetadataCreatePageProps) {
  const [form, setForm] = createSignal<TableMetadataFormValue>({ ...EMPTY_TABLE_METADATA_FORM });
  const [submitting, setSubmitting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');
  const [refreshing, setRefreshing] = createSignal(false);
  const [candidateError, setCandidateError] = createSignal('');
  const [datasources] = createResource(() => getDatasources());
  const datasource = () => datasources()?.find((item) => item.id === Number(props.datasourceId));
  const [physicalTables, { mutate }] = createResource(
    () => datasource()?.name,
    (datasource) => getPhysicalTables(datasource),
  );
  const selectedPhysicalTable = createMemo(() => {
    const name = form().name.trim();
    return physicalTables()?.items.find((table) => table.name === name);
  });
  const [physicalColumns] = createResource(
    () => {
      const current = datasource();
      const table = selectedPhysicalTable();
      return current && table ? { datasource: current.name, table: table.name } : undefined;
    },
    async (owner) => ({ owner, result: await getPhysicalColumns(owner) }),
  );
  const advancedColumns = () => {
    const loaded = physicalColumns();
    const selected = selectedPhysicalTable();
    return loaded && loaded.owner.table === selected?.name
      ? loaded.result.items.map((column) => ({
          name: column.name,
          data_type: column.data_type,
        }))
      : [];
  };

  const listUrl = () => `/meta/table?datasource=${props.datasourceId ?? ''}`;

  async function refreshCandidates() {
    const current = datasource();
    if (!current) return;
    setRefreshing(true);
    setCandidateError('');
    try {
      mutate(await refreshPhysicalTables(current.name));
    } catch (error) {
      setCandidateError((error as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const current = datasource();
    if (!current) return;
    setSubmitting(true);
    setServerError('');
    try {
      const config = buildTableMetadataConfig(form(), advancedColumns());
      const result = await createTableMetadata({
        datasource: current.name,
        name: form().name,
        display_name: form().display_name,
        config,
      });
      await props.onCreated();
      props.navigate(`/meta/table/update?datasource=${current.id}&table=${result.id}`);
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
            <h1>新增数据表</h1>
            <div class="table-code">{datasource()?.name}</div>
          </div>
        </div>
      </header>

      <Show when={!datasources.loading} fallback={<div class="app-state"><LoaderCircle class="spin" size={18} />正在加载</div>}>
        <Show when={datasource()} fallback={<div class="app-state app-error">Datasource not found</div>}>
          <form class="create-form" onSubmit={submit}>
          <div class="form-heading">
            <h2><Braces size={16} />元数据配置</h2>
            <button type="button" class="button button-ghost physical-table-refresh" disabled={physicalTables.loading || refreshing()} onClick={() => void refreshCandidates()}>
              <RefreshCw classList={{ spin: refreshing() }} size={15} />刷新真实表
            </button>
          </div>
          <TableMetadataFormFields
            value={form()}
            physicalTables={physicalTables()?.items ?? []}
            columns={advancedColumns()}
            onChange={setForm}
          />
          <Show when={physicalTables.loading}><div class="physical-table-status"><LoaderCircle class="spin" size={14} />正在加载真实数据表</div></Show>
          <Show when={physicalColumns.loading}><div class="physical-table-status"><LoaderCircle class="spin" size={14} />正在加载真实数据列</div></Show>
          <Show when={physicalTables()?.truncated}><div class="physical-table-status">真实表超过 {MAX_PHYSICAL_TABLE_RESULTS} 个，仅缓存前 {MAX_PHYSICAL_TABLE_RESULTS} 个</div></Show>
          <Show when={physicalTables.error || candidateError()}><div class="datasource-form-error notice notice-error">{candidateError() || physicalTables.error?.message}</div></Show>
          <Show when={physicalColumns.error}><div class="datasource-form-error notice notice-error">{physicalColumns.error?.message}</div></Show>
          <Show when={serverError()}>
            <div class="datasource-form-error notice notice-error">{serverError()}</div>
          </Show>
          <div class="form-actions">
            <button type="button" class="button button-ghost" onClick={() => props.navigate(listUrl())}>取消</button>
            <button class="button button-confirm" type="submit" disabled={submitting()}>
              <Show when={submitting()} fallback={<><Save size={16} />创建</>}>
                <LoaderCircle class="spin" size={16} />创建中
              </Show>
            </button>
          </div>
          </form>
        </Show>
      </Show>
    </main>
  );
}
