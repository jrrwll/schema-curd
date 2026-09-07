import { ChevronRight, Database, LoaderCircle } from 'lucide-solid';
import { Show, createEffect, createResource, createSignal } from 'solid-js';
import { getDatasourceSummary, getDiscoveryDatasources } from '../api';
import DatasourceSelectionDialog from '../components/DatasourceSelectionDialog';
import type { DiscoveryDatasourceItem } from '../types';
import TableMetadataListPage from './TableMetadataListPage';

interface TableWorkspacePageProps {
  datasource: string | null;
  navigate: (url: string) => void;
}

export default function TableWorkspacePage(props: TableWorkspacePageProps) {
  const [datasourceDialogOpen, setDatasourceDialogOpen] = createSignal(!props.datasource);
  const [selectedDatasource, { refetch: refetchDatasource }] = createResource(
    () => {
      const id = Number(props.datasource);
      return Number.isInteger(id) && id > 0 ? id : undefined;
    },
    getDatasourceSummary,
  );

  createEffect(() => {
    if (!selectedDatasource.loading && props.datasource && !selectedDatasource()) {
      setDatasourceDialogOpen(true);
    }
  });

  function selectDatasource(datasource: DiscoveryDatasourceItem) {
    setDatasourceDialogOpen(false);
    props.navigate(`/meta/table?datasource=${datasource.id}`);
  }

  async function refreshDatasource() {
    await refetchDatasource();
  }

  return (
    <>
      <main class="page-shell table-workspace">
        <header class="page-header table-workspace-header">
          <div>
            <h1>数据表</h1>
            <div class="datasource-summary">管理数据表及数据列配置</div>
          </div>
          <div class="table-page-datasource">
            <Show when={selectedDatasource()} fallback={
              <button
                type="button"
                class="entity-selected-datasource entity-selected-datasource-empty"
                onClick={() => setDatasourceDialogOpen(true)}
              >
                <Show when={!selectedDatasource.loading} fallback={
                  <><LoaderCircle class="spin" size={17} /><span>正在加载数据源</span></>
                }>
                  <Database size={17} />
                  <span>
                    {selectedDatasource.error?.message
                      || (props.datasource ? '未找到数据源' : '选择数据源')}
                  </span>
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
          </div>
        </header>

        <TableMetadataListPage
          datasourceId={selectedDatasource()?.id ?? null}
          datasource={selectedDatasource()?.name ?? null}
          canCreate={selectedDatasource()?.role_action === 'write'}
          navigate={props.navigate}
          onChanged={refreshDatasource}
        />
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
