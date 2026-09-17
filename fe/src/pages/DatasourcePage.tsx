import { Dialog } from '@ark-ui/solid';
import {
  Database,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-solid';
import { For, Show, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { deleteDatasource, getDatasources } from '../api/datasource';
import PageSizeSelect from '../components/PageSizeSelect';
import PaginationControl from '../components/PaginationControl';
import {
  DEFAULT_PAGE_SIZE,
  DISPLAY_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../constants';
import { createPagedResource } from '../createPagedResource';
import type { DatasourceFilters, DatasourceRecord } from '../types/datasource';

interface DatasourcePageProps {
  canCreate: boolean;
  canDelete: boolean;
  navigate: (url: string) => void;
}

export default function DatasourcePage(props: DatasourcePageProps) {
  const [draftFilters, setDraftFilters] = createSignal({ name: '', display_name: '' });
  const [filters, setFilters] = createSignal<DatasourceFilters>({ page_no: 1, page_size: DEFAULT_PAGE_SIZE });
  const records = createPagedResource(
    () => filters(),
    getDatasources,
    (page) => setFilters((current) => ({ ...current, page_no: page })),
  );
  const [deleting, setDeleting] = createSignal<DatasourceRecord | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');
  const [message, setMessage] = createSignal<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function refresh() {
    await records.refetch();
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const draft = draftFilters();
    setFilters({
      name: draft.name.trim() || undefined,
      display_name: draft.display_name.trim() || undefined,
      page_no: 1,
      page_size: filters().page_size,
    });
  }

  function resetSearch() {
    setDraftFilters({ name: '', display_name: '' });
    setFilters((value) => ({ page_no: 1, page_size: value.page_size }));
  }

  async function confirmDelete() {
    const datasource = deleting();
    if (!datasource) return;
    setSubmitting(true);
    setServerError('');
    try {
      await deleteDatasource(datasource.name);
    } catch (error) {
      setServerError((error as Error).message);
      setSubmitting(false);
      return;
    }
    setDeleting(null);
    setMessage({ kind: 'success', text: '数据源已删除' });
    await refresh().catch(() => undefined);
    setSubmitting(false);
  }

  return (
    <main class="page-shell datasource-shell">
      <header class="page-header">
        <div>
          <h1>数据源</h1>
      <div class="datasource-summary">
            {records.data()?.total ?? 0} 个数据源
          </div>
        </div>
        <div class="datasource-header-actions">
          <button class="button button-ghost" onClick={() => void refresh()} disabled={records.loading()}>
            <RefreshCw classList={{ spin: records.loading() }} size={16} />刷新
          </button>
          <Show when={props.canCreate}>
            <button class="button button-primary" onClick={() => props.navigate('/meta/datasource/create')}>
              <Plus size={16} />新增数据源
            </button>
          </Show>
        </div>
      </header>

      <Show when={message()}>
        {(current) => <div class={`notice notice-${current().kind}`}>{current().text}</div>}
      </Show>
      <Show when={records.error()}>
        <div class="notice notice-error">{records.error()?.message}</div>
      </Show>

      <form class="filter-band datasource-filter" onSubmit={submitSearch}>
        <div class="filter-title"><Search size={16} />数据源筛选</div>
        <div class="datasource-filter-row">
          <label class="filter-field">
            <span>名称</span>
            <input
              class="input"
              maxlength={NAME_MAX_LENGTH}
              value={draftFilters().name}
              onInput={(event) => setDraftFilters({ ...draftFilters(), name: event.currentTarget.value })}
            />
          </label>
          <label class="filter-field">
            <span>展示名称</span>
            <input
              class="input"
              maxlength={DISPLAY_NAME_MAX_LENGTH}
              value={draftFilters().display_name}
              onInput={(event) => setDraftFilters({ ...draftFilters(), display_name: event.currentTarget.value })}
            />
          </label>
          <div class="datasource-filter-actions">
            <button
              type="button"
              class="icon-button"
              title="重置"
              aria-label="重置"
              onClick={resetSearch}
              disabled={records.loading()}
            >
              <RotateCcw size={16} />
            </button>
            <button type="submit" class="button button-dark" disabled={records.loading()}>
              <Search size={16} />查询
            </button>
          </div>
        </div>
      </form>

      <section class="datasource-card-list" aria-busy={records.loading()}>
        <Show when={!records.loading() && !records.error()} fallback={
          <Show when={records.loading()}>
            <div class="datasource-card-state"><LoaderCircle class="spin" size={18} />正在加载</div>
          </Show>
        }>
          <For each={records.data()?.items} fallback={
            <div class="datasource-card-state">暂无数据源</div>
          }>
            {(datasource) => (
              <article class="datasource-card">
                <div class="datasource-card-identity">
                  <span class="datasource-card-icon"><Database size={19} /></span>
                  <span>
                    <strong>{datasource.display_name}</strong>
                    <code>{datasource.name}</code>
                  </span>
                </div>
                <div class="datasource-card-details">
                  <div class="datasource-card-time">
                    <span>创建时间</span>
                    <time>{datasource.created_at}</time>
                  </div>
                  <div class="datasource-card-time">
                    <span>更新时间</span>
                    <time>{datasource.updated_at}</time>
                  </div>
                </div>
                <div class="datasource-card-actions">
                  <button
                    class="button button-primary datasource-card-table-action"
                    title="查看数据表"
                    onClick={() => props.navigate(`/meta/table?datasource=${encodeURIComponent(datasource.name)}`)}
                  >
                    <Table2 size={15} />数据表
                  </button>
                  <button class="icon-button" title={datasource.effective_role === 'write' ? '编辑数据源' : '需要该数据源的写权限'} disabled={datasource.effective_role !== 'write'} onClick={() => props.navigate(`/meta/datasource/update?datasource=${encodeURIComponent(datasource.name)}`)}>
                    <Pencil size={15} />
                  </button>
                  <Show when={props.canDelete}>
                    <button class="icon-button" title="按此数据源授权" onClick={() => props.navigate(`/grant/resource?resource_type=datasource&resource_name=${encodeURIComponent(datasource.name)}`)}>
                      <KeyRound size={15} />
                    </button>
                  </Show>
                  <button class="icon-button danger" title={props.canDelete ? '删除数据源' : '仅超级管理员可删除数据源'} disabled={!props.canDelete} onClick={() => {
                    setServerError('');
                    setDeleting(datasource);
                  }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            )}
          </For>
        </Show>
      </section>

      <Show when={(records.data()?.total ?? 0) > 0}>
        <footer class="grant-pagination">
          <PaginationControl count={records.data()?.total ?? 0} page={filters().page_no} pageSize={filters().page_size} loading={records.loading()} onPageChange={(page) => setFilters((value) => ({ ...value, page_no: page }))} />
          <PageSizeSelect class="page-size-inline" value={filters().page_size} disabled={records.loading()} onChange={(pageSize) => setFilters((value) => ({ ...value, page_no: 1, page_size: pageSize }))} />
        </footer>
      </Show>

      <Dialog.Root open={deleting() !== null} onOpenChange={(details) => !details.open && setDeleting(null)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content datasource-delete-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon danger"><Trash2 size={18} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">删除数据源</Dialog.Title>
                    <div class="dialog-description">{deleting()?.display_name}</div>
                  </div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" disabled={submitting()} title="关闭"><X size={18} /></Dialog.CloseTrigger>
              </div>
              <div class="datasource-delete-message">
                该数据源关联的表配置和角色授权也会被删除。
              </div>
              <Show when={serverError()}>
                <div class="datasource-form-error notice notice-error">{serverError()}</div>
              </Show>
              <div class="dialog-actions">
                <Dialog.CloseTrigger class="button button-ghost" disabled={submitting()}>取消</Dialog.CloseTrigger>
                <button class="button button-danger" disabled={submitting()} onClick={() => void confirmDelete()}>
                  <Show when={submitting()} fallback={<><Trash2 size={16} />确认删除</>}>
                    <LoaderCircle class="spin" size={16} />删除中
                  </Show>
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </main>
  );
}
