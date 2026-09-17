import { ChevronRight, Database, LoaderCircle } from 'lucide-solid';
import { Show, createMemo, createResource, createSignal } from 'solid-js';
import { getDatasourceDetail } from '../api/datasource';
import { getDiscoveryDatasourcePage, getDiscoveryDatasources } from '../api/discovery';
import { ApiRequestError } from '../api/client';
import DatasourceSelectionDialog from '../components/DatasourceSelectionDialog';
import type { DiscoveryDatasourceItem } from '../types/discovery';
import TableMetadataListPage from './TableMetadataListPage';

interface Props { datasource: string | null; canGrant: boolean; navigate: (url: string) => void; }

export default function TableWorkspacePage(props: Props) {
  const datasourceName = () => props.datasource || undefined;
  const [dialogOpen, setDialogOpen] = createSignal(!props.datasource);
  const [selected] = createResource(datasourceName, async (name) => (await getDiscoveryDatasources({ datasource: name }))[0]);
  const [detail] = createResource(() => selected.error ? undefined : selected()?.id, async (id) => {
    try { return await getDatasourceDetail(id); }
    catch (reason) { if (reason instanceof ApiRequestError && reason.status === 403) return null; throw reason; }
  });
  const selectedValue = createMemo(() => selected.error ? undefined : selected());
  const detailValue = createMemo(() => detail.error ? undefined : detail());
  const currentDatasource = createMemo(() => selectedValue()?.name === datasourceName() ? selectedValue() : undefined);
  const currentDetail = createMemo(() => detailValue()?.name === datasourceName() ? detailValue() : undefined);

  function selectDatasource(datasource: DiscoveryDatasourceItem) {
    setDialogOpen(false); props.navigate(`/meta/table?datasource=${encodeURIComponent(datasource.name)}`);
  }

  return <>
    <main class="page-shell table-workspace">
      <header class="page-header table-workspace-header"><div><h1>数据表</h1><div class="datasource-summary">管理数据表及数据列配置</div></div><div class="table-page-datasource">
        <button type="button" class="entity-selected-datasource" classList={{ 'entity-selected-datasource-empty': !currentDatasource() }} onClick={() => setDialogOpen(true)}>
          <Show when={currentDatasource()} fallback={<Show when={!selected.loading} fallback={<><LoaderCircle class="spin" size={17} /><span>正在加载数据源</span></>}><Database size={17} /><span>{selected.error?.message || (props.datasource ? '未找到数据源' : '选择数据源')}</span><ChevronRight size={16} /></Show>}>
            {(datasource) => <><span class="entity-selected-datasource-icon"><Database size={17} /></span><span class="entity-selected-datasource-copy"><strong>{datasource().display_name}</strong><code>{datasource().name}</code></span><ChevronRight size={16} /></>}
          </Show>
        </button>
      </div></header>
      <Show when={detail.error}><div class="notice notice-error">{detail.error?.message}</div></Show>
      <TableMetadataListPage datasource={currentDatasource()?.name ?? null} datasourceWrite={currentDetail()?.effective_role === 'write'} canGrant={props.canGrant} navigate={props.navigate} />
    </main>
    <DatasourceSelectionDialog open={dialogOpen()} selectedId={currentDatasource()?.id ?? null} loadPage={getDiscoveryDatasourcePage} onOpenChange={setDialogOpen} onSelect={selectDatasource} />
  </>;
}
