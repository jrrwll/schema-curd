import { Dialog } from '@ark-ui/solid/dialog';
import { KeyRound, LoaderCircle, RotateCcw, Search, ShieldCheck, UserPlus, X } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getDiscoveryResourceCandidates, getUsers, grantRole } from '../api';
import RoleGrantTable from '../components/RoleGrantTable';
import RoleMultiSelect from '../components/RoleMultiSelect';
import SearchMultiSelect, { type SearchMultiOption } from '../components/SearchMultiSelect';
import UserMultiSelectionDialog from '../components/UserMultiSelectionDialog';
import UserResourceGrantDialog from '../components/UserResourceGrantDialog';
import { DEFAULT_PAGE_SIZE } from '../constants';
import { roleLabel } from '../enumLabels';
import type { ListRoleRequest, ResourceType, Role, UserRecord } from '../types';

interface GrantManagementPageProps {
  userIds: string | null;
  roles: string | null;
  resourceType: string | null;
  resourceIds: string | null;
  canManageAdministrativeRoles: boolean;
  canGrantAllDatasources: boolean;
  navigate: (url: string) => void;
}

interface GrantFilters {
  users: SearchMultiOption[];
  roles: Role[];
  resourceType: Exclude<ResourceType, '*'> | '';
  resources: SearchMultiOption[];
}

type AdministrativeRole = 'super_admin' | 'user_admin';

interface PendingAdministrativeGrant {
  users: UserRecord[];
  role: AdministrativeRole;
}

const EMPTY_FILTERS: GrantFilters = {
  users: [],
  roles: [],
  resourceType: '',
  resources: [],
};

const ROLE_VALUES: Role[] = ['super_admin', 'user_admin', 'admin', 'write', 'read'];

function split(value: string | null) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
}

function toQuery(filters: GrantFilters): ListRoleRequest {
  return {
    user_ids: filters.users.length > 0 ? filters.users.map((user) => Number(user.id)) : undefined,
    roles: filters.roles.length > 0 ? filters.roles : undefined,
    resource_type: filters.resourceType || undefined,
    resource_ids: filters.resources.length > 0 ? filters.resources.map((resource) => resource.id) : undefined,
  };
}

function filtersFromProps(props: GrantManagementPageProps, current: GrantFilters = EMPTY_FILTERS): GrantFilters {
  const userIds = split(props.userIds).filter((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  const roles = split(props.roles).filter((role): role is Role => ROLE_VALUES.includes(role as Role));
  const resourceType = props.resourceType === 'datasource' || props.resourceType === 'table' ? props.resourceType : '';
  const resources = resourceType
    ? split(props.resourceIds).map((id) => current.resources.find((item) => item.id === id) ?? { id, label: id, detail: id })
    : [];
  return {
    users: userIds.map((id) => current.users.find((item) => item.id === id) ?? { id, label: id, detail: `用户 ID: ${id}` }),
    roles,
    resourceType,
    resources,
  };
}

export default function GrantManagementPage(props: GrantManagementPageProps) {
  const [draft, setDraft] = createSignal<GrantFilters>(filtersFromProps(props));
  const query = createMemo(() => toQuery(filtersFromProps(props)));
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [resourceGrantDialog, setResourceGrantDialog] = createSignal(false);
  const [administrativeRoleDialog, setAdministrativeRoleDialog] = createSignal<AdministrativeRole | null>(null);
  const [pendingAdministrativeGrant, setPendingAdministrativeGrant] = createSignal<PendingAdministrativeGrant | null>(null);
  const [submittingAdministrativeGrant, setSubmittingAdministrativeGrant] = createSignal(false);
  const [message, setMessage] = createSignal('');
  const [operationError, setOperationError] = createSignal('');

  createEffect(() => {
    setDraft(filtersFromProps(props, untrack(draft)));
  });

  async function loadUsers(keyword: string): Promise<SearchMultiOption[]> {
    const result = await getUsers({
      name: keyword || undefined,
      page_no: 1,
      page_size: DEFAULT_PAGE_SIZE,
    });
    return result.items.map((user) => ({ id: String(user.id), label: user.display_name, detail: user.name }));
  }

  async function loadResources(keyword: string): Promise<SearchMultiOption[]> {
    const resourceType = draft().resourceType;
    if (!resourceType) return [];
    const result = await getDiscoveryResourceCandidates({
      resource_type: resourceType,
      keyword: keyword || undefined,
      page_no: 1,
      page_size: DEFAULT_PAGE_SIZE,
    });
    return result.items.map((resource) => ({ id: resource.id, label: resource.display_name, detail: resource.name }));
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const filters = draft();
    const params: string[] = [];
    if (filters.users.length > 0) params.push(`user=${filters.users.map((user) => encodeURIComponent(user.id)).join(',')}`);
    if (filters.roles.length > 0) params.push(`role=${filters.roles.join(',')}`);
    if (filters.resourceType) params.push(`resource_type=${filters.resourceType}`);
    if (filters.resourceType && filters.resources.length > 0) params.push(`resource_id=${filters.resources.map((resource) => encodeURIComponent(resource.id)).join(',')}`);
    props.navigate(`/grant${params.length > 0 ? `?${params.join('&')}` : ''}`);
  }

  function reset() {
    setDraft({ ...EMPTY_FILTERS });
    props.navigate('/grant');
  }

  async function confirmAdministrativeGrant() {
    const pending = pendingAdministrativeGrant();
    if (!pending) return;
    setSubmittingAdministrativeGrant(true);
    setOperationError('');
    setMessage('');
    const results = await Promise.allSettled(pending.users.map((user) => grantRole({
      user_id: user.id,
      role: pending.role,
      resource_type: '*',
      resource_id: '*',
    })));
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    setPendingAdministrativeGrant(null);
    setSubmittingAdministrativeGrant(false);
    if (succeeded > 0) setRefreshKey((value) => value + 1);
    const label = roleLabel(pending.role);
    if (failures.length === 0) {
      setMessage(`已新增 ${succeeded} 个${label}`);
    } else {
      const reason = failures[0].reason instanceof Error ? failures[0].reason.message : String(failures[0].reason);
      setOperationError(`成功 ${succeeded} 个，失败 ${failures.length} 个：${reason}`);
    }
  }

  return (
    <main class="page-shell grant-shell">
      <header class="page-header"><div><h1>授权管理</h1><div class="datasource-summary">查看和维护全部用户授权</div></div><div class="datasource-header-actions"><button class="button button-primary" onClick={() => setResourceGrantDialog(true)}><KeyRound size={16} />新增授权</button><Show when={props.canManageAdministrativeRoles}><button class="button button-dark" onClick={() => setAdministrativeRoleDialog('user_admin')}><UserPlus size={16} />新增用户管理员</button><button class="button button-ghost" onClick={() => setAdministrativeRoleDialog('super_admin')}><ShieldCheck size={16} />新增超级管理员</button></Show></div></header>
      <Show when={message()}><div class="notice notice-success">{message()}</div></Show>
      <Show when={operationError()}><div class="notice notice-error">{operationError()}</div></Show>
      <form class="filter-band grant-management-filter" onSubmit={submit}>
        <div class="filter-title"><Search size={16} />授权筛选</div>
        <div class="grant-management-filter-grid">
          <div class="filter-field"><span>用户</span><SearchMultiSelect value={draft().users} placeholder="全部用户" searchPlaceholder="搜索用户名或展示名称" loadOptions={loadUsers} onChange={(users) => setDraft({ ...draft(), users })} /></div>
          <div class="filter-field"><span>角色</span><RoleMultiSelect value={draft().roles} onChange={(roles) => setDraft({ ...draft(), roles })} /></div>
          <label class="filter-field"><span>资源类型</span><select class="input" value={draft().resourceType} onChange={(event) => setDraft({ ...draft(), resourceType: event.currentTarget.value as Exclude<ResourceType, '*'> | '', resources: [] })}><option value="">全部</option><option value="datasource">数据源</option><option value="table">数据表</option></select></label>
          <div class="filter-field"><span>资源 ID</span><SearchMultiSelect value={draft().resources} placeholder={draft().resourceType ? '全部资源' : '请先选择资源类型'} searchPlaceholder="搜索资源 ID 或名称" reloadKey={draft().resourceType} disabled={!draft().resourceType} loadOptions={loadResources} onChange={(resources) => setDraft({ ...draft(), resources })} /></div>
          <div class="datasource-filter-actions"><button type="button" class="icon-button" title="重置" aria-label="重置" onClick={reset}><RotateCcw size={16} /></button><button type="submit" class="button button-dark"><Search size={16} />查询</button></div>
        </div>
      </form>
      <RoleGrantTable query={query()} refreshKey={refreshKey()} />

      <UserResourceGrantDialog
        open={resourceGrantDialog()}
        user={null}
        allowMultipleUsers
        canGrantAllDatasources={props.canGrantAllDatasources}
        onOpenChange={setResourceGrantDialog}
        onGranted={(count) => {
          setMessage(`已新增 ${count} 项资源授权`);
          setRefreshKey((value) => value + 1);
        }}
      />

      <UserMultiSelectionDialog
        open={administrativeRoleDialog() !== null}
        role={administrativeRoleDialog() ?? 'user_admin'}
        onOpenChange={(open) => !open && setAdministrativeRoleDialog(null)}
        onConfirm={(users) => {
          const role = administrativeRoleDialog();
          if (!role) return;
          setAdministrativeRoleDialog(null);
          setPendingAdministrativeGrant({ users, role });
        }}
      />

      <Dialog.Root open={pendingAdministrativeGrant() !== null} onOpenChange={(details) => !details.open && !submittingAdministrativeGrant() && setPendingAdministrativeGrant(null)}>
        <Portal><Dialog.Backdrop class="dialog-backdrop" /><Dialog.Positioner class="dialog-positioner"><Dialog.Content class="dialog-content datasource-delete-dialog">
          <div class="dialog-header"><div class="dialog-heading"><span class="dialog-icon"><UserPlus size={18} /></span><div><Dialog.Title class="dialog-title">确认新增{pendingAdministrativeGrant() ? roleLabel(pendingAdministrativeGrant()!.role) : ''}</Dialog.Title><div class="dialog-description">共 {pendingAdministrativeGrant()?.users.length ?? 0} 个用户</div></div></div><Dialog.CloseTrigger class="dialog-close" disabled={submittingAdministrativeGrant()} title="关闭"><X size={18} /></Dialog.CloseTrigger></div>
          <div class="user-admin-confirmation"><div class="user-admin-confirm-users"><For each={pendingAdministrativeGrant()?.users.slice(0, 5)}>{(user) => <span><strong>{user.display_name}</strong><code>{user.name}</code></span>}</For><Show when={(pendingAdministrativeGrant()?.users.length ?? 0) > 5}><small>另有 {(pendingAdministrativeGrant()?.users.length ?? 0) - 5} 个用户</small></Show></div><div class="user-admin-confirm-scope"><span>角色</span><strong>{pendingAdministrativeGrant() ? roleLabel(pendingAdministrativeGrant()!.role) : ''}</strong><code>*:*</code></div></div>
          <div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost" disabled={submittingAdministrativeGrant()}>取消</Dialog.CloseTrigger><button class="button button-confirm" disabled={submittingAdministrativeGrant()} onClick={() => void confirmAdministrativeGrant()}><Show when={submittingAdministrativeGrant()} fallback={<><UserPlus size={16} />确认授权</>}><LoaderCircle class="spin" size={16} />授权中</Show></button></div>
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </main>
  );
}
