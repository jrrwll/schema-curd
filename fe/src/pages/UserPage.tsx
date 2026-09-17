import { Dialog } from '@ark-ui/solid';
import { KeyRound, LoaderCircle, Pencil, Plus, Power, RotateCcw, Search, Trash2, UserRound, X } from 'lucide-solid';
import { For, Show, batch, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { deleteUser, disableUser, enableUser, getUsers } from '../api/user';
import PageSizeSelect from '../components/PageSizeSelect';
import PaginationControl from '../components/PaginationControl';
import { DEFAULT_PAGE_SIZE, NAME_MAX_LENGTH } from '../constants';
import { createPagedResource } from '../createPagedResource';
import type { UserRecord } from '../types/user';

interface Props { currentUserId: number; navigate: (url: string) => void; }

export default function UserPage(props: Props) {
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(DEFAULT_PAGE_SIZE);
  const [draft, setDraft] = createSignal({ name: '', disabled: '' });
  const [filters, setFilters] = createSignal<{ name?: string; disabled?: boolean }>({});
  const [deleting, setDeleting] = createSignal<UserRecord | null>(null);
  const [busy, setBusy] = createSignal<number | null>(null);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const result = createPagedResource(
    () => ({ ...filters(), page_no: page(), page_size: pageSize() }),
    getUsers,
    setPage,
  );

  function submitSearch(event: SubmitEvent) { event.preventDefault(); batch(() => { setPage(1); setFilters({ name: draft().name.trim() || undefined, disabled: draft().disabled === '' ? undefined : draft().disabled === 'true' }); }); }
  function resetSearch() { batch(() => { setDraft({ name: '', disabled: '' }); setPage(1); setFilters({}); }); }
  async function changeStatus(user: UserRecord) {
    setBusy(user.id); setError(''); setMessage('');
    try { if (user.disabled) await enableUser(user.id); else await disableUser(user.id); }
    catch (reason) { setError((reason as Error).message); setBusy(null); return; }
    setMessage(user.disabled ? '用户已启用' : '用户已禁用');
    try { await result.refetch(); } catch { /* refresh errors are exposed by the resource. */ }
    setBusy(null);
  }
  async function confirmDelete() {
    const user = deleting(); if (!user) return;
    setBusy(user.id); setError('');
    try { await deleteUser(user.id); }
    catch (reason) { setError((reason as Error).message); setBusy(null); return; }
    setDeleting(null); setMessage('用户已删除');
    try { await result.refetch(); } catch { /* refresh errors are exposed by the resource. */ }
    setBusy(null);
  }

  return <main class="page-shell user-shell">
    <header class="page-header"><div><h1>用户</h1><div class="datasource-summary">{result.data()?.total ?? 0} 个用户</div></div><button class="button button-primary" onClick={() => props.navigate('/user/create')}><Plus size={16} />新增用户</button></header>
    <Show when={message()}><div class="notice notice-success">{message()}</div></Show><Show when={error() || result.error()}><div class="notice notice-error">{error() || result.error()?.message}</div></Show>
    <form class="filter-band user-filter" onSubmit={submitSearch}><div class="filter-title"><Search size={16} />用户筛选</div><div class="user-filter-row"><label class="filter-field"><span>用户名</span><input class="input" maxlength={NAME_MAX_LENGTH} value={draft().name} onInput={(event) => setDraft({ ...draft(), name: event.currentTarget.value })} /></label><label class="filter-field"><span>状态</span><select class="input" value={draft().disabled} onChange={(event) => setDraft({ ...draft(), disabled: event.currentTarget.value })}><option value="">全部</option><option value="false">启用</option><option value="true">禁用</option></select></label><div class="datasource-filter-actions"><button type="button" class="icon-button" title="重置" onClick={resetSearch}><RotateCcw size={16} /></button><button type="submit" class="button button-dark"><Search size={16} />查询</button></div></div></form>
    <section class="user-card-list" aria-busy={result.loading()}><Show when={!result.loading() && !result.error()} fallback={<Show when={result.loading()}><div class="datasource-card-state"><LoaderCircle class="spin" size={18} />正在加载</div></Show>}><For each={result.data()?.items} fallback={<div class="datasource-card-state">暂无用户</div>}>{(user) => <article class="user-card">
      <div class="datasource-card-identity"><span class="user-card-icon"><UserRound size={18} /></span><span><strong>{user.display_name}</strong><code>{user.name}</code></span></div>
      <div class="user-card-status"><span class={`user-status user-status-${user.disabled ? 'disabled' : 'enabled'}`}>{user.disabled ? '已禁用' : '启用'}</span><Show when={user.super_admin}><span class="user-status user-status-admin">超级管理员</span></Show></div>
      <div class="datasource-card-details"><div class="datasource-card-time"><span>创建时间</span><time>{user.created_at.replace('T', ' ').slice(0, 19)}</time></div><div class="datasource-card-time"><span>更新时间</span><time>{user.updated_at.replace('T', ' ').slice(0, 19)}</time></div></div>
      <div class="datasource-card-actions"><button class="icon-button" title="编辑用户" disabled={user.disabled} onClick={() => props.navigate(`/user/update?user=${user.id}`)}><Pencil size={15} /></button><button class="button button-primary user-grant-action" title="管理授权" disabled={user.disabled || user.super_admin} onClick={() => props.navigate(`/grant/user?user=${user.id}`)}><KeyRound size={15} />授权</button><button class="icon-button" title={user.disabled ? '启用用户' : '禁用用户'} disabled={user.id === props.currentUserId || busy() !== null} onClick={() => void changeStatus(user)}><Power size={15} /></button><button class="icon-button danger" title="删除用户" disabled={user.id === props.currentUserId || busy() !== null} onClick={() => setDeleting(user)}><Trash2 size={15} /></button></div>
    </article>}</For></Show></section>
    <Show when={(result.data()?.total ?? 0) > 0}><div class="user-pagination-footer"><PaginationControl count={result.data()?.total ?? 0} page={page()} pageSize={pageSize()} loading={result.loading()} onPageChange={setPage} /><PageSizeSelect class="user-page-size" value={pageSize()} disabled={result.loading()} onChange={(value) => batch(() => { setPage(1); setPageSize(value); })} /></div></Show>
    <Dialog.Root open={deleting() !== null} onOpenChange={(details) => !details.open && setDeleting(null)}><Portal><Dialog.Backdrop class="dialog-backdrop" /><Dialog.Positioner class="dialog-positioner"><Dialog.Content class="dialog-content datasource-delete-dialog"><div class="dialog-header"><div class="dialog-heading"><span class="dialog-icon danger"><Trash2 size={18} /></span><div><Dialog.Title class="dialog-title">删除用户</Dialog.Title><div class="dialog-description">{deleting()?.display_name}</div></div></div><Dialog.CloseTrigger class="dialog-close"><X size={18} /></Dialog.CloseTrigger></div><div class="datasource-delete-message">该用户的全部角色授权也会被删除。</div><div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost">取消</Dialog.CloseTrigger><button class="button button-danger" disabled={busy() !== null} onClick={() => void confirmDelete()}><Trash2 size={16} />确认删除</button></div></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </main>;
}
