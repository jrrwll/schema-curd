import { ArrowLeft, Check, ChevronRight, Database, KeyRound, LoaderCircle, Search, Table2 } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createResource, createSignal } from 'solid-js';
import { getDatasourceDetail, getDatasourceDetailByName, getDatasources } from '../../api/datasource';
import { batchGrantUsers, getGrantableDatasourceUsers, getGrantableTableUsers } from '../../api/role';
import { getTableMetadata, getTableMetadataDetail } from '../../api/table';
import DatasourceSelectionDialog, { type DatasourcePageRequest } from '../../components/DatasourceSelectionDialog';
import type { SelectionPageRequest } from '../../components/PagedSelectionDialog';
import PageSizeSelect from '../../components/PageSizeSelect';
import PaginationControl from '../../components/PaginationControl';
import type { SearchMultiOption } from '../../components/SearchMultiSelect';
import GrantConfirmationDialog, { type GrantConfirmationItem } from '../../components/role/RoleGrantConfirmationDialog';
import RoleGrantSubjectDialog from '../../components/role/RoleGrantSubjectDialog';
import { DEFAULT_PAGE_SIZE } from '../../constants';
import { createDebouncedValue } from '../../debounce';
import { resourceTypeLabel } from '../../enumLabels';
import type { ResourceType, Role, RoleResourceOption } from '../../types/role';
import type { GrantResourceRouteState } from '../../types/route';
import { createPromiseCache, resetRoleGrantByResourceSelection, roleGrantByResourceUrl, tableGrantSubjectFromDetail, toSearchOption } from './roleGrantModel';

interface Props {
  selection: GrantResourceRouteState;
  navigate: (url: string) => void;
}

const MAX_BATCH_SIZE = 100;

function getEnabledDatasourcePage(request: DatasourcePageRequest) {
  return getDatasources({ page_no: request.page_no, page_size: request.page_size, name: request.keyword, disabled: false });
}

export default function RoleGrantByResourcePage(props: Props) {
  const initialType = props.selection.type;
  const [resourceType, setResourceType] = createSignal<ResourceType>(initialType);
  const [datasourceDialogOpen, setDatasourceDialogOpen] = createSignal(false);
  const [tableDialogOpen, setTableDialogOpen] = createSignal(false);
  const [subjectDatasource, setSubjectDatasource] = createSignal<SearchMultiOption | null>(null);
  const [subjectResource, setSubjectResource] = createSignal<SearchMultiOption | null>(null);
  const [selectedUsers, setSelectedUsers] = createSignal<Record<string, SearchMultiOption>>({});
  const [userRoles, setUserRoles] = createSignal<Record<string, Role>>({});
  const [userSearch, setUserSearch] = createSignal('');
  const debouncedUserSearch = createDebouncedValue(userSearch);
  const [userPage, setUserPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(DEFAULT_PAGE_SIZE);
  const [confirming, setConfirming] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const datasourceCache = createPromiseCache((id: number) => getDatasourceDetail(id).then(toSearchOption));
  const tableCache = createPromiseCache((id: number) => getTableMetadataDetail(id).then(tableGrantSubjectFromDetail));
  let hydrationRequest = 0;
  let preserveDatasourceOnNextRoute = false;

  createEffect(() => {
    const request = ++hydrationRequest;
    const selection = props.selection;
    const type = selection.type;
    const resourceId = selection.type === 'table' ? selection.resourceId : null;
    const resourceName = selection.type === 'datasource' ? selection.resourceName : null;
    const preserveDatasource = preserveDatasourceOnNextRoute;
    preserveDatasourceOnNextRoute = false;
    setResourceType(type);
    setSubjectResource(null);
    if (!preserveDatasource) setSubjectDatasource(null);
    const reset = resetRoleGrantByResourceSelection();
    setSelectedUsers(reset.selected);
    setUserRoles(reset.roles);
    setUserSearch(reset.search);
    setUserPage(reset.page);
    setError('');

    if (type === 'datasource') {
      setSubjectDatasource(null);
      if (!resourceName) {
        setSubjectResource(null);
        return;
      }
      void getDatasourceDetailByName(resourceName).then(toSearchOption).then((resource) => {
        if (request !== hydrationRequest) return;
        setSubjectResource(resource);
      }).catch((reason) => {
        if (request !== hydrationRequest) return;
        setSubjectResource(null);
        setError((reason as Error).message);
      });
      return;
    }

    if (!resourceId) {
      setSubjectResource(null);
      return;
    }
    void tableCache.get(resourceId).then((subject) => {
      if (request !== hydrationRequest) return;
      setSubjectResource(subject.resource);
      setSubjectDatasource(subject.datasource);
    }).catch((reason) => {
      if (request !== hydrationRequest) return;
      setSubjectResource(null);
      setSubjectDatasource(null);
      setError((reason as Error).message);
    });
  });

  const [users, { refetch: refetchUsers }] = createResource(
    () => {
      const type = resourceType();
      const resourceId = Number(subjectResource()?.id);
      if (!Number.isInteger(resourceId) || resourceId <= 0) return undefined;
      const resourceName = subjectResource()?.detail;
      if (type === 'datasource' && !resourceName) return undefined;
      return { type, resourceId, resourceName, keyword: debouncedUserSearch().trim() || undefined };
    },
    async ({ type, resourceId, resourceName, keyword }) => {
      try {
        const items: RoleResourceOption[] = type === 'datasource'
          ? await getGrantableDatasourceUsers({ datasource_name: resourceName!, keyword })
          : await getGrantableTableUsers({ table_id: resourceId, keyword });
        return { items: items.map(toSearchOption), error: '' };
      } catch (reason) {
        return { items: [], error: (reason as Error).message };
      }
    },
  );

  const usersError = createMemo(() => subjectResource() && !users.loading ? users()?.error ?? '' : '');
  const allUsers = createMemo(() => subjectResource() ? users()?.items ?? [] : []);
  const visibleUsers = createMemo(() => allUsers().slice((userPage() - 1) * pageSize(), userPage() * pageSize()));
  const selectedIds = createMemo(() => Object.keys(selectedUsers()));
  const currentPageAllSelected = createMemo(() => visibleUsers().length > 0 && visibleUsers().every((user) => Boolean(selectedUsers()[user.id])));
  const uniformRole = createMemo<Role | ''>(() => {
    const ids = selectedIds();
    if (ids.length === 0) return '';
    const first = userRoles()[ids[0]] ?? 'read';
    return ids.every((id) => (userRoles()[id] ?? 'read') === first) ? first : '';
  });
  const confirmationItems = createMemo<GrantConfirmationItem[]>(() => {
    const resource = subjectResource();
    if (!resource) return [];
    return Object.values(selectedUsers()).map((user) => ({
      key: `user-${user.id}`,
      userId: Number(user.id),
      userName: user.label,
      userAccount: user.detail,
      resourceType: resourceType(),
      resourceId: Number(resource.id),
      resourceName: resource.label,
      resourceCode: resource.detail || `${resourceTypeLabel(resourceType())}:${resource.id}`,
      role: userRoles()[user.id] ?? 'read',
    }));
  });

  function navigateGrantUrl(url: string, preserveDatasource = false) {
    if (`${window.location.pathname}${window.location.search}` !== url) {
      preserveDatasourceOnNextRoute = preserveDatasource;
      props.navigate(url);
    } else {
      preserveDatasourceOnNextRoute = false;
    }
  }

  function resetTargets() {
    setSelectedUsers({});
    setUserRoles({});
    setUserSearch('');
    setUserPage(1);
  }

  function selectResourceType(type: ResourceType) {
    setError('');
    setResourceType(type);
    setSubjectResource(null);
    setSubjectDatasource(null);
    resetTargets();
    navigateGrantUrl(roleGrantByResourceUrl(type));
  }

  function selectDatasource(datasource: { id: number; name: string; display_name: string }) {
    const option = toSearchOption(datasource);
    setDatasourceDialogOpen(false);
    setSubjectDatasource(option);
    if (resourceType() === 'datasource') {
      datasourceCache.prime(datasource.id, option);
      selectResource(option);
      return;
    }
    setSubjectResource(null);
    resetTargets();
    navigateGrantUrl(roleGrantByResourceUrl('table'), true);
  }

  function selectResource(resource: SearchMultiOption) {
    if (resourceType() === 'datasource') datasourceCache.prime(Number(resource.id), resource);
    if (resourceType() === 'table' && subjectDatasource()) {
      tableCache.prime(Number(resource.id), { resource, datasource: subjectDatasource()! });
    }
    setError('');
    setSubjectResource(resource);
    resetTargets();
    navigateGrantUrl(roleGrantByResourceUrl(resourceType(), resource));
  }

  async function getEnabledTablePage(request: SelectionPageRequest) {
    const datasource = subjectDatasource()?.detail;
    if (!datasource) return { total: 0, items: [] };
    const result = await getTableMetadata({
      datasource,
      page_no: request.page_no,
      page_size: request.page_size,
      name: request.keyword,
      disabled: false,
    });
    return { total: result.total, items: result.items.map(toSearchOption) };
  }

  function toggleUser(user: SearchMultiOption) {
    const next = { ...selectedUsers() };
    if (next[user.id]) delete next[user.id];
    else if (Object.keys(next).length < MAX_BATCH_SIZE) next[user.id] = user;
    setSelectedUsers(next);
    setUserRoles((current) => ({ ...current, [user.id]: current[user.id] ?? 'read' }));
  }

  function toggleCurrentPage() {
    const next = { ...selectedUsers() };
    if (currentPageAllSelected()) for (const user of visibleUsers()) delete next[user.id];
    else for (const user of visibleUsers()) {
      if (Object.keys(next).length >= MAX_BATCH_SIZE) break;
      next[user.id] = user;
    }
    setSelectedUsers(next);
    setUserRoles((current) => {
      const roles = { ...current };
      for (const user of visibleUsers()) if (next[user.id]) roles[user.id] ??= 'read';
      return roles;
    });
  }

  function setUniformRole(role: Role) {
    const next = { ...userRoles() };
    for (const id of selectedIds()) next[id] = role;
    setUserRoles(next);
  }

  async function confirmGrant() {
    const resourceId = Number(subjectResource()?.id);
    const items = Object.values(selectedUsers());
    if (!Number.isInteger(resourceId) || resourceId <= 0 || items.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      await batchGrantUsers({
        resource_type: resourceType(),
        resource_id: resourceId,
        items: items.map((user) => ({ user_id: Number(user.id), role: userRoles()[user.id] ?? 'read' })),
      });
      setConfirming(false);
      setSelectedUsers({});
      setUserRoles({});
      setUserPage(1);
      await refetchUsers();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main class="page-shell create-shell batch-grant-page">
    <header class="page-header create-header batch-grant-page-header"><div class="header-with-back"><button class="icon-button" title="返回授权列表" onClick={() => props.navigate('/grant')}><ArrowLeft size={19} /></button><div><h1>按资源授权</h1></div></div></header>
    <form class="create-form batch-grant-form" onSubmit={(event) => { event.preventDefault(); if (confirmationItems().length) { setError(''); setConfirming(true); } }}>
      <div class="form-heading"><h2><KeyRound size={16} />批量授权</h2></div>
      <section class="batch-grant-subject-section">
        <div class="batch-grant-section-title">操作主体</div>
        <div class="batch-grant-type-tabs" role="tablist" aria-label="资源类型"><button type="button" role="tab" aria-selected={resourceType() === 'datasource'} classList={{ active: resourceType() === 'datasource' }} onClick={() => selectResourceType('datasource')}><Database size={15} />数据源</button><button type="button" role="tab" aria-selected={resourceType() === 'table'} classList={{ active: resourceType() === 'table' }} onClick={() => selectResourceType('table')}><Table2 size={15} />数据表</button></div>
        <Show when={resourceType() === 'datasource'} fallback={<div class="batch-grant-resource-stack">
          <div class="filter-field"><span>数据源</span><button type="button" class="entity-selected-datasource batch-grant-subject-trigger" classList={{ 'entity-selected-datasource-empty': !subjectDatasource() }} onClick={() => setDatasourceDialogOpen(true)}><Show when={subjectDatasource()} fallback={<><Database size={17} /><span>选择数据源</span><ChevronRight size={16} /></>}>{(datasource) => <><span class="entity-selected-datasource-icon"><Database size={17} /></span><span class="entity-selected-datasource-copy"><strong>{datasource().label}</strong><code>{datasource().detail}</code></span><ChevronRight size={16} /></>}</Show></button></div>
          <div class="filter-field"><span>数据表</span><button type="button" class="entity-selected-datasource batch-grant-subject-trigger" classList={{ 'entity-selected-datasource-empty': !subjectResource() }} disabled={!subjectDatasource()} onClick={() => setTableDialogOpen(true)}><Show when={subjectResource()} fallback={<><Table2 size={17} /><span>{subjectDatasource() ? '选择数据表' : '请先选择数据源'}</span><ChevronRight size={16} /></>}>{(resource) => <><span class="entity-selected-datasource-icon"><Table2 size={17} /></span><span class="entity-selected-datasource-copy"><strong>{resource().label}</strong><code>{resource().detail}</code></span><ChevronRight size={16} /></>}</Show></button></div>
        </div>}>
          <div class="filter-field"><span>数据源</span><button type="button" class="entity-selected-datasource batch-grant-subject-trigger" classList={{ 'entity-selected-datasource-empty': !subjectResource() }} onClick={() => setDatasourceDialogOpen(true)}><Show when={subjectResource()} fallback={<><Database size={17} /><span>选择数据源</span><ChevronRight size={16} /></>}>{(resource) => <><span class="entity-selected-datasource-icon"><Database size={17} /></span><span class="entity-selected-datasource-copy"><strong>{resource().label}</strong><code>{resource().detail}</code></span><ChevronRight size={16} /></>}</Show></button></div>
        </Show>
      </section>
      <section class="batch-grant-target-section">
        <div class="batch-grant-target-heading"><div><h3>选择用户</h3><span>已选择 {selectedIds().length} / {MAX_BATCH_SIZE}</span></div><div class="batch-grant-target-actions"><button type="button" class="batch-grant-select-page" classList={{ selected: currentPageAllSelected() }} disabled={users.loading || visibleUsers().length === 0} onClick={toggleCurrentPage}><span><Show when={currentPageAllSelected()}><Check size={13} /></Show></span>{currentPageAllSelected() ? '取消当前页' : '全选当前页'}</button><label class="batch-grant-uniform-role"><select class="input" aria-label="统一设置权限" disabled={selectedIds().length === 0} value={uniformRole()} onChange={(event) => setUniformRole(event.currentTarget.value as Role)}><option value="" disabled>请选择</option><option value="read">读权限</option><option value="write">写权限</option></select></label></div></div>
        <div class="batch-grant-target-toolbar"><label class="batch-grant-search"><Search size={14} /><input type="search" placeholder="搜索用户名或展示名称" value={userSearch()} disabled={!subjectResource()} onInput={(event) => { setUserSearch(event.currentTarget.value); setUserPage(1); }} /></label></div>
        <div class="batch-grant-paged-list">
          <Show when={!users.loading && !usersError()} fallback={<Show when={usersError()} fallback={<div class="batch-grant-list-state"><LoaderCircle class="spin" size={16} />正在加载用户</div>}>{(message) => <div class="batch-grant-list-state app-error">{message()}</div>}</Show>}>
            <For each={visibleUsers()} fallback={<div class="batch-grant-list-state">没有匹配的用户</div>}>{(user) => <div class="batch-grant-list-row" classList={{ selected: Boolean(selectedUsers()[user.id]) }}><button type="button" class="batch-grant-list-select" onClick={() => toggleUser(user)}><span class="batch-grant-list-check">{selectedUsers()[user.id] ? '✓' : ''}</span><span class="batch-grant-list-copy"><strong>{user.label}</strong><code>{user.detail} · ID:{user.id}</code></span></button><Show when={selectedUsers()[user.id]}><select class="input batch-grant-role-select" value={userRoles()[user.id] ?? 'read'} onChange={(event) => setUserRoles({ ...userRoles(), [user.id]: event.currentTarget.value as Role })}><option value="read">读权限</option><option value="write">写权限</option></select></Show></div>}</For>
          </Show>
        </div>
        <div class="batch-grant-pagination"><PaginationControl count={allUsers().length} page={userPage()} pageSize={pageSize()} loading={users.loading} onPageChange={setUserPage} /><PageSizeSelect class="batch-page-size" value={pageSize()} disabled={users.loading} onChange={(value) => { setUserPage(1); setPageSize(value); }} /></div>
      </section>
      <Show when={error()}><div class="datasource-form-error notice notice-error">{error()}</div></Show>
      <div class="form-actions"><button type="button" class="button button-ghost" onClick={() => props.navigate('/grant')}>取消</button><button class="button button-confirm" type="submit" disabled={submitting() || !subjectResource() || selectedIds().length === 0}><Show when={!submitting()} fallback={<><LoaderCircle class="spin" size={16} />授权中</>}><KeyRound size={16} />确认授权</Show></button></div>
    </form>
    <DatasourceSelectionDialog open={datasourceDialogOpen()} selectedId={Number(resourceType() === 'datasource' ? subjectResource()?.id : subjectDatasource()?.id) || null} description="按名称搜索并选择一个可用数据源" loadPage={getEnabledDatasourcePage} onOpenChange={setDatasourceDialogOpen} onSelect={selectDatasource} />
    <RoleGrantSubjectDialog open={tableDialogOpen()} type="table" selectedId={Number(subjectResource()?.id) || null} loadPage={getEnabledTablePage} onOpenChange={setTableDialogOpen} onSelect={selectResource} />
    <GrantConfirmationDialog open={confirming()} action="grant" items={confirmationItems()} submitting={submitting()} error={error()} onOpenChange={(open) => { if (!submitting()) setConfirming(open); }} onConfirm={() => void confirmGrant()} />
  </main>;
}
