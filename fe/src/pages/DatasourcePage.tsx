import { Dialog } from '@ark-ui/solid';
import {
  Database,
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
import { For, Show, createResource, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { deleteDatasource, getDatasources } from '../api';
import {
  CONNECTION_FIELD_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../constants';
import type { DatasourceFilters, DatasourceRecord } from '../types';

interface DatasourcePageProps {
  canCreate: boolean;
  navigate: (url: string) => void;
  onChanged: () => unknown;
}

export default function DatasourcePage(props: DatasourcePageProps) {
  const [draftFilters, setDraftFilters] = createSignal({ name: '', display_name: '', url: '' });
  const [filters, setFilters] = createSignal<DatasourceFilters>({});
  const [records, { refetch }] = createResource(filters, getDatasources);
  const [deleting, setDeleting] = createSignal<DatasourceRecord | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');
  const [message, setMessage] = createSignal<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function refresh() {
    await Promise.all([refetch(), props.onChanged()]);
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const draft = draftFilters();
    setFilters({
      name: draft.name.trim() || undefined,
      display_name: draft.display_name.trim() || undefined,
      url: draft.url.trim() || undefined,
    });
  }

  function resetSearch() {
    setDraftFilters({ name: '', display_name: '', url: '' });
    setFilters({});
  }

  async function confirmDelete() {
    const datasource = deleting();
    if (!datasource) return;
    setSubmitting(true);
    setServerError('');
    try {
      await deleteDatasource(datasource.id);
      setDeleting(null);
      setMessage({ kind: 'success', text: '数据源已删除' });
      await refresh();
    } catch (error) {
      setServerError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main class="page-shell datasource-shell">
      <header class="page-header">
        <div>
          <h1>数据源</h1>
          <div class="datasource-summary">
            {records()?.length ?? 0} 个数据源
          </div>
        </div>
        <div class="datasource-header-actions">
          <button class="button button-ghost" onClick={() => void refresh()} disabled={records.loading}>
            <RefreshCw classList={{ spin: records.loading }} size={16} />刷新
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
      <Show when={records.error}>
        <div class="notice notice-error">{records.error?.message}</div>
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
          <label class="filter-field">
            <span>连接 URL</span>
            <input
              class="input"
              maxlength={CONNECTION_FIELD_MAX_LENGTH}
              value={draftFilters().url}
              onInput={(event) => setDraftFilters({ ...draftFilters(), url: event.currentTarget.value })}
            />
          </label>
          <div class="datasource-filter-actions">
            <button
              type="button"
              class="icon-button"
              title="重置"
              aria-label="重置"
              onClick={resetSearch}
              disabled={records.loading}
            >
              <RotateCcw size={16} />
            </button>
            <button type="submit" class="button button-dark" disabled={records.loading}>
              <Search size={16} />查询
            </button>
          </div>
        </div>
      </form>

      <section class="datasource-card-list" aria-busy={records.loading}>
        <Show when={!records.loading} fallback={
          <div class="datasource-card-state"><LoaderCircle class="spin" size={18} />正在加载</div>
        }>
          <For each={records()} fallback={
            <div class="datasource-card-state">暂无数据源</div>
          }>
            {(datasource) => (
              <article class="datasource-card" classList={{ 'datasource-card-unavailable': datasource.role_action === 'none' }}>
                <div class="datasource-card-identity">
                  <span class="datasource-card-icon"><Database size={19} /></span>
                  <span>
                    <strong>{datasource.display_name}</strong>
                    <code>{datasource.name}</code>
                  </span>
                </div>
                <div class="datasource-card-connection">
                  <span>连接信息</span>
                  <code title={datasource.url}>{datasource.url}</code>
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
                    title={datasource.role_action !== 'none' ? '查看数据表' : '没有该数据源的读权限'}
                    disabled={datasource.role_action === 'none'}
                    onClick={() => props.navigate(`/meta/table?datasource=${datasource.id}`)}
                  >
                    <Table2 size={15} />数据表<span>{datasource.table_count}</span>
                  </button>
                  <button class="icon-button" title={datasource.role_action === 'write' ? '编辑数据源' : '需要该数据源的写权限'} disabled={datasource.role_action !== 'write'} onClick={() => props.navigate(`/meta/datasource/update?datasource=${datasource.id}`)}>
                    <Pencil size={15} />
                  </button>
                  <button class="icon-button danger" title={datasource.role_action === 'write' ? '删除数据源' : '需要该数据源的写权限'} disabled={datasource.role_action !== 'write'} onClick={() => {
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
