import { Dialog } from '@ark-ui/solid';
import { ArrowRight, EllipsisVertical, LoaderCircle, Pencil, Plus, RefreshCw, Rocket, RotateCcw, Search, Table2, Trash2, X } from 'lucide-solid';
import { For, Match, Show, Switch, createResource, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { deleteTableMetadata, getTableMetadata, publishTableMetadata } from '../api';
import { DISPLAY_NAME_MAX_LENGTH, NAME_MAX_LENGTH } from '../constants';
import { TableStatusEnum, type TableMetadataFilters, type TableMetadataListRecord } from '../types';

interface TableMetadataListPageProps {
  datasourceId: number | null;
  datasource: string | null;
  canCreate: boolean;
  navigate: (url: string) => void;
  onChanged: () => Promise<unknown>;
}

export default function TableMetadataListPage(props: TableMetadataListPageProps) {
  const [draftFilters, setDraftFilters] = createSignal({ name: '', display_name: '' });
  const [filters, setFilters] = createSignal<TableMetadataFilters>({});
  const [deleting, setDeleting] = createSignal<TableMetadataListRecord | null>(null);
  const [submittingDelete, setSubmittingDelete] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [actionMenuTableId, setActionMenuTableId] = createSignal<number | null>(null);
  const [publishing, setPublishing] = createSignal<TableMetadataListRecord | null>(null);
  const [submittingPublish, setSubmittingPublish] = createSignal(false);
  const [publishError, setPublishError] = createSignal('');
  const [records, { refetch }] = createResource(
    () => props.datasource ? { filters: filters(), datasource: props.datasource } : null,
    ({ filters: currentFilters, datasource }) => getTableMetadata({
      ...currentFilters,
      datasource,
    }),
  );

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const draft = draftFilters();
    setFilters({
      name: draft.name.trim() || undefined,
      display_name: draft.display_name.trim() || undefined,
    });
  }

  function resetSearch() {
    setDraftFilters({ name: '', display_name: '' });
    setFilters({});
  }

  async function confirmDelete() {
    const table = deleting();
    if (!table) return;
    setSubmittingDelete(true);
    setDeleteError('');
    try {
      await deleteTableMetadata({ id: table.id, datasource: table.datasource });
      setDeleting(null);
      setMessage('数据表元数据已删除');
      await Promise.all([refetch(), props.onChanged()]);
    } catch (error) {
      setDeleteError((error as Error).message);
    } finally {
      setSubmittingDelete(false);
    }
  }

  async function confirmPublish() {
    const table = publishing();
    if (!table) return;
    setSubmittingPublish(true);
    setPublishError('');
    try {
      await publishTableMetadata({ id: table.id, datasource: table.datasource });
      setPublishing(null);
      setMessage('数据表已发布');
      await Promise.all([refetch(), props.onChanged()]);
    } catch (error) {
      setPublishError((error as Error).message);
    } finally {
      setSubmittingPublish(false);
    }
  }

  return (
    <section class="table-metadata-list">
      <form class="filter-band table-metadata-filter" onSubmit={submitSearch}>
        <div class="table-metadata-filter-heading">
          <div class="filter-title"><Search size={16} />数据表筛选</div>
          <div class="datasource-header-actions">
            <button type="button" class="button button-ghost" onClick={() => void refetch()} disabled={records.loading || !props.datasource}>
              <RefreshCw classList={{ spin: records.loading }} size={16} />刷新
            </button>
            <button
              type="button"
              class="button button-primary"
              disabled={!props.datasource || !props.canCreate}
              onClick={() => props.datasourceId && props.navigate(`/meta/table/create?datasource=${props.datasourceId}`)}
            >
              <Plus size={16} />新增数据表
            </button>
          </div>
        </div>
        <div class="datasource-filter-row">
          <label class="filter-field">
            <span>名称</span>
            <input class="input" maxlength={NAME_MAX_LENGTH} disabled={!props.datasource} value={draftFilters().name} onInput={(event) => setDraftFilters({ ...draftFilters(), name: event.currentTarget.value })} />
          </label>
          <label class="filter-field">
            <span>展示名称</span>
            <input class="input" maxlength={DISPLAY_NAME_MAX_LENGTH} disabled={!props.datasource} value={draftFilters().display_name} onInput={(event) => setDraftFilters({ ...draftFilters(), display_name: event.currentTarget.value })} />
          </label>
          <div class="datasource-filter-actions">
            <button type="button" class="icon-button" title="重置" aria-label="重置" onClick={resetSearch} disabled={records.loading}>
              <RotateCcw size={16} />
            </button>
            <button type="submit" class="button button-dark" disabled={records.loading || !props.datasource}>
              <Search size={16} />查询
            </button>
          </div>
        </div>
      </form>

      <Show when={records.error && props.datasource}>
        <div class="notice notice-error">{records.error?.message}</div>
      </Show>
      <Show when={message()}>
        <div class="notice notice-success">{message()}</div>
      </Show>

      <Switch>
        <Match when={props.datasource}>
          <section class="table-metadata-card-region">
            <header class="table-metadata-list-heading">
              <strong>列表</strong>
              <span>{records()?.length ?? 0} 个数据表</span>
            </header>
            <div class="table-metadata-card-list" aria-busy={records.loading}>
              <Show when={!records.loading} fallback={
                <div class="datasource-card-state"><LoaderCircle class="spin" size={18} />正在加载</div>
              }>
                <For each={records()} fallback={
                  <div class="datasource-card-state">暂无数据表</div>
                }>
                  {(table) => (
                    <article class="table-metadata-card" classList={{ 'datasource-card-unavailable': table.role_action === 'none' }}>
                      <div class="datasource-card-identity">
                        <span class="datasource-card-icon"><Table2 size={18} /></span>
                        <span>
                          <strong>{table.display_name}</strong>
                          <code>{table.name}</code>
                        </span>
                      </div>
                      <div class="metadata-table-state">
                        <span class={`table-status table-status-${table.status}`}>
                          {table.status === TableStatusEnum.Draft ? '草稿' : table.status === TableStatusEnum.Enabled ? '可用' : '禁用'}
                        </span>
                        <span>{table.column_count} 个数据列</span>
                      </div>
                      <div class="datasource-card-details">
                        <div class="datasource-card-time">
                          <span>创建时间</span>
                          <time>{table.created_at}</time>
                        </div>
                        <div class="datasource-card-time">
                          <span>更新时间</span>
                          <time>{table.updated_at}</time>
                        </div>
                      </div>
                      <div class="datasource-card-actions">
                        <button
                          class="icon-button"
                          title={table.role_action === 'write' ? '编辑表元数据' : '需要该数据表的写权限'}
                          disabled={table.role_action !== 'write'}
                          onClick={() => props.navigate(`/meta/table/update?datasource=${props.datasourceId}&table=${table.id}`)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          class="icon-button danger"
                          title={table.role_action === 'write' ? '删除数据表元数据' : '需要该数据表的写权限'}
                          disabled={table.role_action !== 'write'}
                          onClick={() => {
                            setDeleteError('');
                            setDeleting(table);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                        <div
                          class="user-action-menu"
                          onFocusOut={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActionMenuTableId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setActionMenuTableId(null);
                          }}
                        >
                          <button
                            type="button"
                            class="icon-button"
                            title="更多操作"
                            aria-label="更多操作"
                            aria-haspopup="menu"
                            aria-expanded={actionMenuTableId() === table.id}
                            onClick={() => setActionMenuTableId((current) => current === table.id ? null : table.id)}
                          ><EllipsisVertical size={16} /></button>
                          <Show when={actionMenuTableId() === table.id}>
                            <div class="user-action-menu-popup" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                disabled={table.role_action === 'none' || table.status !== TableStatusEnum.Enabled}
                                title={table.role_action === 'none' ? '需要该数据表的读权限' : table.status === TableStatusEnum.Enabled ? '查看实体数据' : '草稿或禁用表不可查看数据'}
                                onClick={() => props.navigate(`/entity?datasource=${props.datasourceId}&table=${table.id}`)}
                              >
                                <ArrowRight size={15} />查看数据
                              </button>
                              <Show when={table.status === TableStatusEnum.Draft}>
                                <button
                                  type="button"
                                  role="menuitem"
                                  class="success"
                                  disabled={table.role_action !== 'write' || !table.has_primary_key}
                                  title={table.role_action !== 'write' ? '需要该数据表的写权限' : table.has_primary_key ? '发布数据表' : '至少配置一个主键列后才能发布'}
                                  onClick={() => {
                                    setActionMenuTableId(null);
                                    setPublishError('');
                                    setPublishing(table);
                                  }}
                                >
                                  <Rocket size={15} />发布
                                </button>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </article>
                  )}
                </For>
              </Show>
            </div>
          </section>
        </Match>
        <Match when>
          <div class="table-workspace-empty"><Table2 size={19} />请选择数据源后管理数据表</div>
        </Match>
      </Switch>

      <Dialog.Root open={deleting() !== null} onOpenChange={(details) => !details.open && setDeleting(null)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content datasource-delete-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon danger"><Trash2 size={18} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">删除数据表</Dialog.Title>
                    <div class="dialog-description">{deleting()?.display_name}</div>
                  </div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" disabled={submittingDelete()} title="关闭">
                  <X size={18} />
                </Dialog.CloseTrigger>
              </div>
              <div class="datasource-delete-message">
                表配置和数据列配置将被删除，业务数据库中的真实表和数据不会受到影响。
              </div>
              <Show when={deleteError()}>
                <div class="datasource-form-error notice notice-error">{deleteError()}</div>
              </Show>
              <div class="dialog-actions">
                <Dialog.CloseTrigger class="button button-ghost" disabled={submittingDelete()}>取消</Dialog.CloseTrigger>
                <button class="button button-danger" disabled={submittingDelete()} onClick={() => void confirmDelete()}>
                  <Show when={submittingDelete()} fallback={<><Trash2 size={16} />确认删除</>}>
                    <LoaderCircle class="spin" size={16} />删除中
                  </Show>
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={publishing() !== null} onOpenChange={(details) => !details.open && setPublishing(null)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content datasource-delete-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><Rocket size={18} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">发布数据表</Dialog.Title>
                    <div class="dialog-description">{publishing()?.display_name}</div>
                  </div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" disabled={submittingPublish()} title="关闭"><X size={18} /></Dialog.CloseTrigger>
              </div>
              <div class="datasource-delete-message">发布后，该数据表将可用于实体数据查询和维护。</div>
              <Show when={publishError()}><div class="datasource-form-error notice notice-error">{publishError()}</div></Show>
              <div class="dialog-actions">
                <Dialog.CloseTrigger class="button button-ghost" disabled={submittingPublish()}>取消</Dialog.CloseTrigger>
                <button type="button" class="button button-confirm" disabled={submittingPublish()} onClick={() => void confirmPublish()}>
                  <Show when={submittingPublish()} fallback={<><Rocket size={15} />确认发布</>}>
                    <LoaderCircle class="spin" size={15} />发布中
                  </Show>
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </section>
  );
}
