import { ArrowLeft, Check, ChevronRight, Database, KeyRound, LoaderCircle, Search, Table2, UserRound } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createResource, createSignal } from 'solid-js';
import { getDatasourceDetail, getDatasourceDetailByName, getDatasources } from '../../api/datasource';
import { batchGrantResources, getGrantableUserDatasources, getGrantableUserTables } from '../../api/role';
import { getUserDetail, getUsers } from '../../api/user';
import DatasourceSelectionDialog, { type DatasourcePageRequest } from '../../components/DatasourceSelectionDialog';
import type { SelectionPageRequest } from '../../components/PagedSelectionDialog';
import PageSizeSelect from '../../components/PageSizeSelect';
import PaginationControl from '../../components/PaginationControl';
import GrantConfirmationDialog, { type GrantConfirmationItem } from '../../components/role/RoleGrantConfirmationDialog';
import RoleGrantSubjectDialog from '../../components/role/RoleGrantSubjectDialog';
import type { SearchMultiOption } from '../../components/SearchMultiSelect';
import { DEFAULT_PAGE_SIZE } from '../../constants';
import { createDebouncedValue } from '../../debounce';
import type { Role, RoleResourceOption, ResourceType } from '../../types/role';
import type { GrantUserRouteState } from '../../types/route';
import { createPromiseCache, hydrateRoleGrantByUserSelection, roleGrantByUserUrl, switchRoleGrantByUserType, toSearchOption } from './roleGrantModel';

interface Props {
  selection: GrantUserRouteState;
  navigate: (url: string) => void;
}

const MAX_BATCH_SIZE = 100;

function getEnabledDatasourcePage(request: DatasourcePageRequest) {
  return getDatasources({ page_no: request.page_no, page_size: request.page_size, name: request.keyword, disabled: false });
}

async function getEnabledUserPage(request: SelectionPageRequest) {
  const result = await getUsers({
    page_no: request.page_no,
    page_size: request.page_size,
    name: request.keyword,
    disabled: false,
    super_admin: false,
  });
  return { total: result.total, items: result.items.map(toSearchOption) };
}

export default function RoleGrantByUserPage(props: Props) {
  const [submitting, setSubmitting] = createSignal(false);
  const [confirming, setConfirming] = createSignal(false);
  const [pageSize, setPageSize] = createSignal(DEFAULT_PAGE_SIZE);
  const [error, setError] = createSignal('');
  const [subjectDialogOpen, setSubjectDialogOpen] = createSignal(false);
  const [datasourceDialogOpen, setDatasourceDialogOpen] = createSignal(false);
  const [subjectUser, setSubjectUser] = createSignal<SearchMultiOption | null>(null);
  const [resourceType, setResourceType] = createSignal<ResourceType>(props.selection.datasourceName ? 'table' : 'datasource');
  const [resourceDatasource, setResourceDatasource] = createSignal<SearchMultiOption | null>(null);
  const [selectedResources, setSelectedResources] = createSignal<Record<string, SearchMultiOption>>({});
  const [resourceRoles, setResourceRoles] = createSignal<Record<string, Role>>({});
  const [resourceSearch, setResourceSearch] = createSignal('');
  const debouncedResourceSearch = createDebouncedValue(resourceSearch);
  const [resourcePage, setResourcePage] = createSignal(1);
  const userCache = createPromiseCache((id: number) => getUserDetail(id).then(toSearchOption));
  const datasourceCache = createPromiseCache((id: number) => getDatasourceDetail(id).then(toSearchOption));
  let hydrationRequest = 0;

  createEffect(() => {
    const request = ++hydrationRequest;
    const userId = props.selection.userId;
    const datasourceName = props.selection.datasourceName;
    const initial = hydrateRoleGrantByUserSelection(datasourceName);
    setResourceType(initial.resourceType);
    setResourceDatasource(initial.datasource);
    setSelectedResources(initial.selected);
    setResourceRoles(initial.roles);
    setResourceSearch(initial.search);
    setResourcePage(initial.page);
    setSubjectUser(null);
    if (!userId) {
      return;
    }
    setError('');
    void Promise.all([
      userCache.get(userId),
      datasourceName ? getDatasourceDetailByName(datasourceName).then(toSearchOption) : Promise.resolve(null),
    ]).then(([user, datasource]) => {
      if (request !== hydrationRequest) return;
      setSubjectUser(user);
      if (datasource) setResourceType('table');
      setResourceDatasource(datasource);
    }).catch((reason) => {
      if (request !== hydrationRequest) return;
      setSubjectUser(null);
      setResourceDatasource(null);
      setError((reason as Error).message);
    });
  });

  const [resources, { refetch: refetchResources }] = createResource(
    () => {
      const userId = Number(subjectUser()?.id);
      if (!Number.isInteger(userId) || userId <= 0) return undefined;
      const type = resourceType();
      const datasourceName = type === 'table' ? resourceDatasource()?.detail : undefined;
      if (type === 'table' && !datasourceName) return undefined;
      return { type, userId, datasourceName, keyword: debouncedResourceSearch().trim() || undefined };
    },
    async ({ type, userId, datasourceName, keyword }) => {
      try {
        const items: RoleResourceOption[] = type === 'datasource'
          ? await getGrantableUserDatasources({ user_id: userId, keyword })
          : await getGrantableUserTables({ user_id: userId, datasource_name: datasourceName!, keyword });
        return { items: items.map(toSearchOption), error: '' };
      } catch (reason) {
        return { items: [], error: (reason as Error).message };
      }
    },
  );

  const resourceStateReady = createMemo(() => Boolean(subjectUser()) && (resourceType() !== 'table' || Boolean(resourceDatasource())));
  const resourcesError = createMemo(() => resourceStateReady() && !resources.loading ? resources()?.error ?? '' : '');
  const resourceItems = createMemo(() => resourceStateReady() ? resources()?.items ?? [] : []);
  const visibleResources = createMemo(() => resourceItems().slice((resourcePage() - 1) * pageSize(), resourcePage() * pageSize()));
  const selectedIds = createMemo(() => Object.keys(selectedResources()));
  const uniformRole = createMemo<Role | ''>(() => {
    const ids = selectedIds();
    if (ids.length === 0) return '';
    const first = resourceRoles()[ids[0]] ?? 'read';
    return ids.every((id) => (resourceRoles()[id] ?? 'read') === first) ? first : '';
  });
  const currentPageAllSelected = createMemo(() => visibleResources().length > 0 && visibleResources().every((resource) => Boolean(selectedResources()[resource.id])));
  const confirmationItems = createMemo<GrantConfirmationItem[]>(() => {
    const user = subjectUser();
    if (!user) return [];
    return Object.values(selectedResources()).map((resource) => ({
      key: `resource-${resource.id}`,
      userId: Number(user.id),
      userName: user.label,
      userAccount: user.detail,
      resourceType: resourceType(),
      resourceId: Number(resource.id),
      resourceName: resource.label,
      resourceCode: resource.detail,
      role: resourceRoles()[resource.id] ?? 'read',
    }));
  });

  function navigateGrantUrl(url: string) {
    if (`${window.location.pathname}${window.location.search}` !== url) props.navigate(url);
  }

  function selectResourceType(type: ResourceType) {
    const next = switchRoleGrantByUserType(type);
    setError('');
    setResourceType(next.resourceType);
    setResourceDatasource(next.datasource);
    setSelectedResources(next.selected);
    setResourceRoles(next.roles);
    setResourceSearch(next.search);
    setResourcePage(next.page);
    navigateGrantUrl(roleGrantByUserUrl(subjectUser()));
  }

  function selectSubjectUser(user: SearchMultiOption) {
    userCache.prime(Number(user.id), user);
    setError('');
    setSubjectUser(user);
    setSelectedResources({});
    setResourceRoles({});
    setResourceDatasource(null);
    setResourceSearch('');
    setResourcePage(1);
    navigateGrantUrl(roleGrantByUserUrl(user));
  }

  function selectDatasource(datasource: RoleResourceOption) {
    const option = toSearchOption(datasource);
    datasourceCache.prime(datasource.id, option);
    setError('');
    setResourceDatasource(option);
    setDatasourceDialogOpen(false);
    setSelectedResources({});
    setResourceRoles({});
    setResourceSearch('');
    setResourcePage(1);
    navigateGrantUrl(roleGrantByUserUrl(subjectUser(), datasource.name));
  }

  function toggleResource(resource: SearchMultiOption) {
    const next = { ...selectedResources() };
    if (next[resource.id]) delete next[resource.id];
    else if (Object.keys(next).length < MAX_BATCH_SIZE) next[resource.id] = resource;
    setSelectedResources(next);
    setResourceRoles((current) => ({ ...current, [resource.id]: current[resource.id] ?? 'read' }));
  }

  function toggleCurrentPage() {
    const next = { ...selectedResources() };
    if (currentPageAllSelected()) for (const resource of visibleResources()) delete next[resource.id];
    else for (const resource of visibleResources()) {
      if (Object.keys(next).length >= MAX_BATCH_SIZE) break;
      next[resource.id] = resource;
    }
    setSelectedResources(next);
    setResourceRoles((current) => {
      const roles = { ...current };
      for (const resource of visibleResources()) if (next[resource.id]) roles[resource.id] ??= 'read';
      return roles;
    });
  }

  function setUniformRole(role: Role) {
    const next = { ...resourceRoles() };
    for (const id of selectedIds()) next[id] = role;
    setResourceRoles(next);
  }

  async function confirmGrant() {
    const userId = Number(subjectUser()?.id);
    const items = Object.values(selectedResources());
    if (!Number.isInteger(userId) || userId <= 0 || items.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      await batchGrantResources({ user_id: userId, resource_type: resourceType(), items: items.map((resource) => ({ resource_id: Number(resource.id), role: resourceRoles()[resource.id] ?? 'read' })) });
      setConfirming(false);
      setSelectedResources({});
      setResourceRoles({});
      setResourcePage(1);
      await refetchResources();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main class="page-shell create-shell batch-grant-page">
    <header class="page-header create-header batch-grant-page-header">
      <div class="header-with-back"><button class="icon-button" title="返回授权列表" onClick={() => props.navigate('/grant')}><ArrowLeft size={19} /></button><div><h1>按用户授权</h1></div></div>
      <div class="table-page-datasource batch-grant-header-subject"><span class="entity-picker-label">操作主体</span><button type="button" class="entity-selected-datasource batch-grant-subject-trigger" classList={{ 'entity-selected-datasource-empty': !subjectUser() }} onClick={() => setSubjectDialogOpen(true)}><Show when={subjectUser()} fallback={<><UserRound size={17} /><span>选择用户</span><ChevronRight size={16} /></>}>{(user) => <><span class="entity-selected-datasource-icon batch-grant-user-icon"><UserRound size={17} /></span><span class="entity-selected-datasource-copy"><strong>{user().label}</strong><code>{user().detail}</code></span><ChevronRight size={16} /></>}</Show></button></div>
    </header>
    <form class="create-form batch-grant-form" onSubmit={(event) => { event.preventDefault(); if (confirmationItems().length) { setError(''); setConfirming(true); } }}>
      <div class="form-heading"><div class="batch-grant-type-tabs batch-grant-form-tabs" role="tablist" aria-label="资源类型"><button type="button" role="tab" aria-selected={resourceType() === 'datasource'} classList={{ active: resourceType() === 'datasource' }} onClick={() => selectResourceType('datasource')}><Database size={15} />数据源</button><button type="button" role="tab" aria-selected={resourceType() === 'table'} classList={{ active: resourceType() === 'table' }} onClick={() => selectResourceType('table')}><Table2 size={15} />数据表</button></div></div>
      <section class="batch-grant-target-section">
        <div class="batch-grant-target-heading"><div><h3>选择资源</h3><span>已选择 {selectedIds().length} / {MAX_BATCH_SIZE}</span></div><div class="batch-grant-target-actions"><button type="button" class="batch-grant-select-page" classList={{ selected: currentPageAllSelected() }} disabled={resources.loading || visibleResources().length === 0} onClick={toggleCurrentPage}><span><Show when={currentPageAllSelected()}><Check size={13} /></Show></span>{currentPageAllSelected() ? '取消当前页' : '全选当前页'}</button><label class="batch-grant-uniform-role"><select class="input" aria-label="统一设置权限" disabled={selectedIds().length === 0} value={uniformRole()} onChange={(event) => setUniformRole(event.currentTarget.value as Role)}><option value="" disabled>请选择</option><option value="read">读权限</option><option value="write">写权限</option></select></label></div></div>
        <Show when={resourceType() === 'table'}><div class="batch-grant-table-datasource"><span class="entity-picker-label">所属数据源</span><button type="button" class="entity-selected-datasource batch-grant-subject-trigger" classList={{ 'entity-selected-datasource-empty': !resourceDatasource() }} disabled={!subjectUser()} onClick={() => setDatasourceDialogOpen(true)}><Show when={resourceDatasource()} fallback={<><Database size={17} /><span>{subjectUser() ? '选择数据源' : '请先选择用户'}</span><ChevronRight size={16} /></>}>{(datasource) => <><span class="entity-selected-datasource-icon"><Database size={17} /></span><span class="entity-selected-datasource-copy"><strong>{datasource().label}</strong><code>{datasource().detail}</code></span><ChevronRight size={16} /></>}</Show></button></div></Show>
        <div class="batch-grant-target-toolbar"><label class="batch-grant-search"><Search size={14} /><input type="search" placeholder="搜索资源" value={resourceSearch()} disabled={!subjectUser() || (resourceType() === 'table' && !resourceDatasource())} onInput={(event) => { setResourceSearch(event.currentTarget.value); setResourcePage(1); }} /></label></div>
        <div class="batch-grant-paged-list">
          <Show when={!resources.loading && !resourcesError()} fallback={<Show when={resourcesError()} fallback={<div class="batch-grant-list-state"><LoaderCircle class="spin" size={16} />正在加载资源</div>}>{(message) => <div class="batch-grant-list-state app-error">{message()}</div>}</Show>}>
            <For each={visibleResources()} fallback={<div class="batch-grant-list-state">没有匹配的资源</div>}>{(resource) => <div class="batch-grant-list-row" classList={{ selected: Boolean(selectedResources()[resource.id]) }}><button type="button" class="batch-grant-list-select" onClick={() => toggleResource(resource)}><span class="batch-grant-list-check">{selectedResources()[resource.id] ? '✓' : ''}</span><span class="batch-grant-list-copy"><strong>{resource.label}</strong><code>{resource.detail}</code></span></button><Show when={selectedResources()[resource.id]}><select class="input batch-grant-role-select" value={resourceRoles()[resource.id] ?? 'read'} onChange={(event) => setResourceRoles({ ...resourceRoles(), [resource.id]: event.currentTarget.value as Role })}><option value="read">读权限</option><option value="write">写权限</option></select></Show></div>}</For>
          </Show>
        </div>
        <div class="batch-grant-pagination"><PaginationControl count={resourceItems().length} page={resourcePage()} pageSize={pageSize()} loading={resources.loading} onPageChange={setResourcePage} /><PageSizeSelect class="batch-page-size" value={pageSize()} disabled={resources.loading} onChange={(value) => { setResourcePage(1); setPageSize(value); }} /></div>
      </section>
      <Show when={error()}><div class="datasource-form-error notice notice-error">{error()}</div></Show>
      <div class="form-actions"><button type="button" class="button button-ghost" onClick={() => props.navigate('/grant')}>取消</button><button class="button button-confirm" type="submit" disabled={submitting() || !subjectUser() || selectedIds().length === 0}><Show when={!submitting()} fallback={<><LoaderCircle class="spin" size={16} />授权中</>}><KeyRound size={16} />确认授权</Show></button></div>
    </form>
    <RoleGrantSubjectDialog open={subjectDialogOpen()} type="user" selectedId={Number(subjectUser()?.id) || null} loadPage={getEnabledUserPage} onOpenChange={setSubjectDialogOpen} onSelect={selectSubjectUser} />
    <DatasourceSelectionDialog open={datasourceDialogOpen()} selectedId={Number(resourceDatasource()?.id) || null} description="按名称搜索并选择一个可用数据源" loadPage={getEnabledDatasourcePage} onOpenChange={setDatasourceDialogOpen} onSelect={selectDatasource} />
    <GrantConfirmationDialog open={confirming()} action="grant" items={confirmationItems()} submitting={submitting()} error={error()} onOpenChange={(open) => { if (!submitting()) setConfirming(open); }} onConfirm={() => void confirmGrant()} />
  </main>;
}
