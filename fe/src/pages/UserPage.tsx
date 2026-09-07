import { Dialog, Pagination } from '@ark-ui/solid';
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  LoaderCircle,
  Pencil,
  Plus,
  KeyRound,
  Power,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-solid';
import { For, Show, batch, createResource, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { deleteUser, disableUser, enableUser, getUsers } from '../api';
import UserResourceGrantDialog from '../components/UserResourceGrantDialog';
import { NAME_MAX_LENGTH, USER_PAGE_SIZE_OPTIONS } from '../constants';
import { resourceTypeLabel, roleLabel as roleName } from '../enumLabels';
import type { UserRecord, UserRole } from '../types';

interface UserFilters {
  name: string;
  disable: string;
}

interface UserPageProps {
  currentUserId: number;
  canGrantAllDatasources: boolean;
  navigate: (url: string) => void;
}

function formatDateTime(value: string) {
  return value.replace('T', ' ').slice(0, 19);
}

function roleLabel(role: UserRole) {
  return `${roleName(role.role)} · ${resourceTypeLabel(role.resource_type)}:${role.resource_id}`;
}

function isSuperAdmin(user: UserRecord) {
  return user.roles.some((role) => role.role === 'super_admin');
}

export default function UserPage(props: UserPageProps) {
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal<number>(USER_PAGE_SIZE_OPTIONS[0]);
  const [draftFilters, setDraftFilters] = createSignal<UserFilters>({ name: '', disable: '' });
  const [filters, setFilters] = createSignal<{ name?: string; disable?: boolean }>({});
  const [deleting, setDeleting] = createSignal<UserRecord | null>(null);
  const [submittingDelete, setSubmittingDelete] = createSignal(false);
  const [changingStatus, setChangingStatus] = createSignal<number | null>(null);
  const [actionMenuUserId, setActionMenuUserId] = createSignal<number | null>(null);
  const [operationError, setOperationError] = createSignal('');
  const [deleteError, setDeleteError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [resourceGrantUser, setResourceGrantUser] = createSignal<UserRecord | null>(null);
  const [result, { refetch }] = createResource(
    () => ({
      ...filters(),
      page_no: page(),
      page_size: pageSize(),
    }),
    getUsers,
  );

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const draft = draftFilters();
    batch(() => {
      setPage(1);
      setFilters({
        name: draft.name.trim() || undefined,
        disable: draft.disable === '' ? undefined : draft.disable === 'true',
      });
    });
  }

  function resetSearch() {
    batch(() => {
      setDraftFilters({ name: '', disable: '' });
      setPage(1);
      setFilters({});
    });
  }

  async function changeStatus(user: UserRecord) {
    setActionMenuUserId(null);
    setChangingStatus(user.id);
    setOperationError('');
    setMessage('');
    try {
      if (user.disable) await enableUser(user.id);
      else await disableUser(user.id);
      setMessage(user.disable ? '用户已启用' : '用户已禁用');
      await refetch();
    } catch (error) {
      setOperationError((error as Error).message);
    } finally {
      setChangingStatus(null);
    }
  }

  async function confirmDelete() {
    const user = deleting();
    if (!user) return;
    setSubmittingDelete(true);
    setDeleteError('');
    try {
      await deleteUser(user.id);
      setDeleting(null);
      setMessage('用户已删除');
      await refetch();
    } catch (error) {
      setDeleteError((error as Error).message);
    } finally {
      setSubmittingDelete(false);
    }
  }

  return (
    <main class="page-shell user-shell">
      <header class="page-header">
        <div>
          <h1>用户</h1>
          <div class="datasource-summary">{result()?.total ?? 0} 个用户</div>
        </div>
        <div class="datasource-header-actions">
          <button class="button button-primary" onClick={() => props.navigate('/user/create')}><Plus size={16} />新增用户</button>
        </div>
      </header>

      <Show when={message()}><div class="notice notice-success">{message()}</div></Show>
      <Show when={operationError()}><div class="notice notice-error">{operationError()}</div></Show>
      <Show when={result.error}><div class="notice notice-error">{result.error?.message}</div></Show>

      <form class="filter-band user-filter" onSubmit={submitSearch}>
        <div class="filter-title"><Search size={16} />用户筛选</div>
        <div class="user-filter-row">
          <label class="filter-field">
            <span>用户名</span>
            <input class="input" maxlength={NAME_MAX_LENGTH} value={draftFilters().name} onInput={(event) => setDraftFilters({ ...draftFilters(), name: event.currentTarget.value })} />
          </label>
          <label class="filter-field">
            <span>状态</span>
            <select
              class="input"
              value={draftFilters().disable}
              onChange={(event) => setDraftFilters({ ...draftFilters(), disable: event.currentTarget.value })}
            >
              <option value="">全部</option>
              <option value="false">启用</option>
              <option value="true">禁用</option>
            </select>
          </label>
          <div class="datasource-filter-actions">
            <button type="button" class="icon-button" title="重置" aria-label="重置" onClick={resetSearch} disabled={result.loading}><RotateCcw size={16} /></button>
            <button type="submit" class="button button-dark" disabled={result.loading}><Search size={16} />查询</button>
          </div>
        </div>
      </form>

      <section class="user-card-list" aria-busy={result.loading}>
        <Show when={!result.loading} fallback={<div class="datasource-card-state"><LoaderCircle class="spin" size={18} />正在加载</div>}>
          <For each={result()?.items} fallback={<div class="datasource-card-state">暂无用户</div>}>
            {(user) => (
              <article class="user-card">
                <div class="datasource-card-identity">
                  <span class="user-card-icon"><UserRound size={18} /></span>
                  <span><strong>{user.display_name}</strong><code>{user.name}</code></span>
                </div>
                <div class="user-card-status">
                  <span class={`user-status user-status-${user.disable ? 'disabled' : 'enabled'}`}>{user.disable ? '已禁用' : '启用'}</span>
                </div>
                <div class="user-card-roles">
                  <For each={user.roles.slice(0, 3)} fallback={<span class="user-role-none">无角色</span>}>
                    {(role) => <code title={roleLabel(role)}>{roleLabel(role)}</code>}
                  </For>
                  <Show when={user.roles.length > 3}><span>+{user.roles.length - 3}</span></Show>
                </div>
                <div class="datasource-card-details">
                  <div class="datasource-card-time"><span>创建时间</span><time>{formatDateTime(user.created_at)}</time></div>
                  <div class="datasource-card-time"><span>更新时间</span><time>{formatDateTime(user.updated_at)}</time></div>
                </div>
                <div class="datasource-card-actions">
                  <button
                    class="icon-button"
                    title={user.disable ? '禁用用户不能编辑' : '编辑用户'}
                    disabled={user.disable}
                    onClick={() => props.navigate(`/user/update?user=${user.id}`)}
                  ><Pencil size={15} /></button>
                  <button
                    class="button button-primary user-grant-action"
                    title={user.disable ? '禁用用户不能授权' : isSuperAdmin(user) ? '超级管理员不能追加授权' : '授权'}
                    disabled={user.disable || isSuperAdmin(user)}
                    onClick={() => setResourceGrantUser(user)}
                  ><KeyRound size={15} />授权</button>
                  <button
                    class="icon-button danger"
                    title={user.id === props.currentUserId ? '不能删除当前用户' : '删除用户'}
                    disabled={user.id === props.currentUserId}
                    onClick={() => {
                      setDeleteError('');
                      setDeleting(user);
                    }}
                  ><Trash2 size={15} /></button>
                  <div
                    class="user-action-menu"
                    onFocusOut={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActionMenuUserId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setActionMenuUserId(null);
                    }}
                  >
                    <button
                      type="button"
                      class="icon-button"
                      title="更多操作"
                      aria-label="更多操作"
                      aria-haspopup="menu"
                      aria-expanded={actionMenuUserId() === user.id}
                      onClick={() => setActionMenuUserId((current) => current === user.id ? null : user.id)}
                    ><EllipsisVertical size={16} /></button>
                    <Show when={actionMenuUserId() === user.id}>
                      <div class="user-action-menu-popup" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          classList={{ success: user.disable, danger: !user.disable }}
                          title={user.id === props.currentUserId ? '不能修改当前用户状态' : user.disable ? '启用用户' : '禁用用户'}
                          disabled={user.id === props.currentUserId || changingStatus() === user.id}
                          onClick={() => void changeStatus(user)}
                        >
                          <Show when={changingStatus() !== user.id} fallback={<LoaderCircle class="spin" size={15} />}><Power size={15} /></Show>
                          <span>{user.disable ? '启用用户' : '禁用用户'}</span>
                        </button>
                      </div>
                    </Show>
                  </div>
                </div>
              </article>
            )}
          </For>
        </Show>
      </section>

      <Show when={(result()?.total ?? 0) > 0}>
        <div class="user-pagination-footer">
          <Pagination.Root
            class="pagination"
            count={result()?.total ?? 0}
            page={page()}
            pageSize={pageSize()}
            siblingCount={2}
            boundaryCount={1}
            onPageChange={(details) => setPage(details.page)}
          >
            <Pagination.PrevTrigger class="page-button page-arrow" disabled={result.loading} title="上一页"><ChevronLeft size={17} /></Pagination.PrevTrigger>
            <Pagination.Context>
              {(context) => (
                <For each={context().pages}>
                  {(item, index) => (
                    <Show when={item.type === 'page'} fallback={<Pagination.Ellipsis class="page-ellipsis" index={index()}>...</Pagination.Ellipsis>}>
                      <Pagination.Item class="page-button" type="page" value={item.type === 'page' ? item.value : 1}>{item.type === 'page' ? item.value : ''}</Pagination.Item>
                    </Show>
                  )}
                </For>
              )}
            </Pagination.Context>
            <Pagination.NextTrigger class="page-button page-arrow" disabled={result.loading} title="下一页"><ChevronRight size={17} /></Pagination.NextTrigger>
          </Pagination.Root>
          <label class="page-size-control user-page-size">
            <span>每页</span>
            <select value={pageSize()} disabled={result.loading} onChange={(event) => batch(() => {
              setPage(1);
              setPageSize(Number(event.currentTarget.value));
            })}>
              <For each={USER_PAGE_SIZE_OPTIONS}>{(size) => <option value={size}>{size}</option>}</For>
            </select>
          </label>
        </div>
      </Show>

      <UserResourceGrantDialog
        open={resourceGrantUser() !== null}
        user={resourceGrantUser()}
        canGrantAllDatasources={props.canGrantAllDatasources}
        onOpenChange={(open) => !open && setResourceGrantUser(null)}
        onGranted={(count) => {
          setMessage(`已新增 ${count} 项资源授权`);
          void refetch();
        }}
      />

      <Dialog.Root open={deleting() !== null} onOpenChange={(details) => !details.open && setDeleting(null)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content datasource-delete-dialog">
              <div class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon danger"><Trash2 size={18} /></span>
                  <div><Dialog.Title class="dialog-title">删除用户</Dialog.Title><div class="dialog-description">{deleting()?.display_name}</div></div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" disabled={submittingDelete()} title="关闭"><X size={18} /></Dialog.CloseTrigger>
              </div>
              <div class="datasource-delete-message">该用户的全部角色授权也会被删除。</div>
              <Show when={deleteError()}><div class="datasource-form-error notice notice-error">{deleteError()}</div></Show>
              <div class="dialog-actions">
                <Dialog.CloseTrigger class="button button-ghost" disabled={submittingDelete()}>取消</Dialog.CloseTrigger>
                <button class="button button-danger" disabled={submittingDelete()} onClick={() => void confirmDelete()}>
                  <Show when={submittingDelete()} fallback={<><Trash2 size={16} />确认删除</>}><LoaderCircle class="spin" size={16} />删除中</Show>
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </main>
  );
}
