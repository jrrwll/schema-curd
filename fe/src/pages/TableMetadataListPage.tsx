import { Dialog } from '@ark-ui/solid';
import { ArrowRight, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, RotateCcw, Search, Table2, Trash2, X } from 'lucide-solid';
import { For, Match, Show, Switch, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { deleteTableMetadata, getTableMetadata } from '../api/table';
import PageSizeSelect from '../components/PageSizeSelect';
import PaginationControl from '../components/PaginationControl';
import { DEFAULT_PAGE_SIZE, DISPLAY_NAME_MAX_LENGTH, NAME_MAX_LENGTH } from '../constants';
import { createPagedResource } from '../createPagedResource';
import type { TableMetadataFilters, TableMetadataListRecord } from '../types/table';

interface Props { datasource: string | null; datasourceWrite: boolean; canGrant: boolean; navigate: (url: string) => void; }

export default function TableMetadataListPage(props: Props) {
  const [draft, setDraft] = createSignal({ name: '', display_name: '' });
  const [filters, setFilters] = createSignal({ page_no: 1, page_size: DEFAULT_PAGE_SIZE, name: undefined as string | undefined, display_name: undefined as string | undefined });
  const [deleting, setDeleting] = createSignal<TableMetadataListRecord | null>(null);
  const [deletingNow, setDeletingNow] = createSignal(false);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const records = createPagedResource(
    () => props.datasource ? { ...filters(), datasource: props.datasource } satisfies TableMetadataFilters : undefined,
    getTableMetadata,
    (page) => setFilters((current) => ({ ...current, page_no: page })),
  );

  function submitSearch(event: SubmitEvent) { event.preventDefault(); setFilters((value) => ({ ...value, page_no: 1, name: draft().name.trim() || undefined, display_name: draft().display_name.trim() || undefined })); }
  function resetSearch() { setDraft({ name: '', display_name: '' }); setFilters((value) => ({ page_no: 1, page_size: value.page_size, name: undefined, display_name: undefined })); }
  async function confirmDelete() {
    const table = deleting(); if (!table) return;
    setDeletingNow(true); setError('');
    try { await deleteTableMetadata(table.id); }
    catch (reason) { setError((reason as Error).message); setDeletingNow(false); return; }
    setDeleting(null); setMessage('数据表配置已删除');
    try { await records.refetch(); } catch { /* refresh errors are exposed by the resource. */ }
    setDeletingNow(false);
  }

  return <section class="table-metadata-list">
    <form class="filter-band table-metadata-filter" onSubmit={submitSearch}>
      <div class="table-metadata-filter-heading"><div class="filter-title"><Search size={16} />数据表筛选</div><div class="datasource-header-actions"><button type="button" class="button button-ghost" disabled={!props.datasource || records.loading()} onClick={() => void records.refetch()}><RefreshCw classList={{ spin: records.loading() }} size={16} />刷新</button><button type="button" class="button button-primary" disabled={!props.datasource || !props.datasourceWrite} onClick={() => props.datasource && props.navigate(`/meta/table/create?datasource=${encodeURIComponent(props.datasource)}`)}><Plus size={16} />新增数据表</button></div></div>
      <div class="datasource-filter-row"><label class="filter-field"><span>名称</span><input class="input" maxlength={NAME_MAX_LENGTH} disabled={!props.datasource} value={draft().name} onInput={(event) => setDraft({ ...draft(), name: event.currentTarget.value })} /></label><label class="filter-field"><span>展示名称</span><input class="input" maxlength={DISPLAY_NAME_MAX_LENGTH} disabled={!props.datasource} value={draft().display_name} onInput={(event) => setDraft({ ...draft(), display_name: event.currentTarget.value })} /></label><div class="datasource-filter-actions"><button type="button" class="icon-button" title="重置" onClick={resetSearch}><RotateCcw size={16} /></button><button type="submit" class="button button-dark" disabled={!props.datasource || records.loading()}><Search size={16} />查询</button></div></div>
    </form>
    <Show when={records.error()}><div class="notice notice-error">{records.error()?.message}</div></Show><Show when={message()}><div class="notice notice-success">{message()}</div></Show>
    <Switch><Match when={props.datasource}><section class="table-metadata-card-region"><header class="table-metadata-list-heading"><strong>列表</strong><span>{records.data()?.total ?? 0} 个数据表</span></header><div class="table-metadata-card-list" aria-busy={records.loading()}>
      <Show when={!records.loading() && !records.error()} fallback={<Show when={records.loading()}><div class="datasource-card-state"><LoaderCircle class="spin" size={18} />正在加载</div></Show>}><For each={records.data()?.items} fallback={<div class="datasource-card-state">暂无数据表</div>}>{(table) => <article class="table-metadata-card" classList={{ 'datasource-card-unavailable': table.effective_role === 'none' || table.disabled }}>
        <div class="datasource-card-identity"><span class="datasource-card-icon"><Table2 size={18} /></span><span><strong>{table.display_name}</strong><code>{table.name}</code></span></div>
        <div class="datasource-card-details"><div class="datasource-card-time"><span>创建时间</span><time>{table.created_at}</time></div><div class="datasource-card-time"><span>更新时间</span><time>{table.updated_at}</time></div></div>
        <div class="datasource-card-actions"><button class="icon-button" title="查看实体数据" disabled={table.disabled || table.effective_role === 'none'} onClick={() => props.datasource && props.navigate(`/entity?datasource=${encodeURIComponent(props.datasource)}&table=${table.id}`)}><ArrowRight size={15} /></button><button class="icon-button" title="编辑表配置" disabled={table.effective_role !== 'write'} onClick={() => props.datasource && props.navigate(`/meta/table/update?datasource=${encodeURIComponent(props.datasource)}&table=${table.id}`)}><Pencil size={15} /></button><Show when={props.canGrant}><button class="icon-button" title="按此数据表授权" onClick={() => props.navigate(`/grant/resource?resource_type=table&resource_id=${table.id}`)}><KeyRound size={15} /></button></Show><button class="icon-button danger" title={props.datasourceWrite ? '删除表配置' : '需要数据源写权限'} disabled={!props.datasourceWrite} onClick={() => { setError(''); setDeleting(table); }}><Trash2 size={15} /></button></div>
      </article>}</For></Show>
    </div><Show when={(records.data()?.total ?? 0) > 0}><footer class="grant-pagination"><PaginationControl count={records.data()?.total ?? 0} page={filters().page_no} pageSize={filters().page_size} loading={records.loading()} onPageChange={(page) => setFilters((value) => ({ ...value, page_no: page }))} /><PageSizeSelect class="page-size-inline" value={filters().page_size} disabled={records.loading()} onChange={(pageSize) => setFilters((value) => ({ ...value, page_no: 1, page_size: pageSize }))} /></footer></Show></section></Match><Match when><div class="table-workspace-empty"><Table2 size={19} />请选择数据源后管理数据表</div></Match></Switch>
    <Dialog.Root open={deleting() !== null} onOpenChange={(details) => !details.open && setDeleting(null)}><Portal><Dialog.Backdrop class="dialog-backdrop" /><Dialog.Positioner class="dialog-positioner"><Dialog.Content class="dialog-content datasource-delete-dialog"><div class="dialog-header"><div class="dialog-heading"><span class="dialog-icon danger"><Trash2 size={18} /></span><div><Dialog.Title class="dialog-title">删除数据表</Dialog.Title><div class="dialog-description">{deleting()?.display_name}</div></div></div><Dialog.CloseTrigger class="dialog-close" disabled={deletingNow()} title="关闭"><X size={18} /></Dialog.CloseTrigger></div><div class="datasource-delete-message">表配置和授权将被删除，业务数据库中的真实表和数据不会受到影响。</div><Show when={error()}><div class="notice notice-error">{error()}</div></Show><div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost" disabled={deletingNow()}>取消</Dialog.CloseTrigger><button class="button button-danger" disabled={deletingNow()} onClick={() => void confirmDelete()}><Show when={!deletingNow()} fallback={<><LoaderCircle class="spin" size={15} />删除中</>}><Trash2 size={15} />确认删除</Show></button></div></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </section>;
}
