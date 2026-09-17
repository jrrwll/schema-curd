import { KeyRound, RotateCcw, Search } from 'lucide-solid';
import { Show, createSignal } from 'solid-js';
import { getUsers } from '../api/user';
import SearchMultiSelect, { type SearchMultiOption } from '../components/SearchMultiSelect';
import RoleGrantTable from '../components/role/RoleGrantTable';
import RoleMultiSelect from '../components/role/RoleMultiSelect';
import { DEFAULT_PAGE_SIZE } from '../constants';
import type { ListRoleRequest, ResourceType, Role } from '../types/role';

interface Props {
  navigate: (url: string) => void;
}

function numericList(value: string): number[] | null {
  if (!value.trim()) return [];
  const items = value.split(',').map((item) => item.trim());
  if (items.some((item) => !/^[1-9]\d*$/.test(item))) return null;
  const ids = items.map(Number);
  return ids.every(Number.isSafeInteger) ? ids : null;
}

export default function GrantManagementPage(props: Props) {
  const [users, setUsers] = createSignal<SearchMultiOption[]>([]);
  const [roles, setRoles] = createSignal<Role[]>([]);
  const [resourceType, setResourceType] = createSignal<ResourceType | ''>('');
  const [resourceIds, setResourceIds] = createSignal('');
  const [resourceIdsError, setResourceIdsError] = createSignal('');
  const [query, setQuery] = createSignal<ListRoleRequest>({ page_no: 1, page_size: DEFAULT_PAGE_SIZE });

  function submitFilter(event: SubmitEvent) {
    event.preventDefault();
    const ids = numericList(resourceIds());
    if (ids === null) {
      setResourceIdsError('资源 ID 必须是用逗号分隔的正整数');
      return;
    }
    setResourceIdsError('');
    setQuery({
      page_no: 1,
      page_size: DEFAULT_PAGE_SIZE,
      user_ids: users().length ? users().map((user) => Number(user.id)) : undefined,
      roles: roles().length ? roles() : undefined,
      resource_type: resourceType() || undefined,
      resource_ids: ids.length ? ids : undefined,
    });
  }

  function reset() {
    setUsers([]);
    setRoles([]);
    setResourceType('');
    setResourceIds('');
    setResourceIdsError('');
    setQuery({ page_no: 1, page_size: DEFAULT_PAGE_SIZE });
  }

  async function loadUserOptions(keyword: string): Promise<SearchMultiOption[]> {
    const result = await getUsers({
      page_no: 1,
      page_size: 100,
      name: keyword || undefined,
      super_admin: false,
    });
    const options = result.items.map((user) => ({
      id: String(user.id),
      label: user.display_name,
      detail: `${user.name} · ID:${user.id}${user.disabled ? ' · 已禁用' : ''}`,
    }));
    const optionById = new Map(options.map((option) => [option.id, option]));
    setUsers((current) => current.map((user) => optionById.get(user.id) ?? user));
    return options;
  }

  return <main class="page-shell grant-shell">
    <header class="page-header"><div><h1>授权管理</h1><div class="datasource-summary">维护数据源和数据表的读写权限</div></div><div class="datasource-header-actions"><button class="button button-primary" onClick={() => props.navigate('/grant/user')}><KeyRound size={16} />按用户授权</button><button class="button button-primary" onClick={() => props.navigate('/grant/resource')}><KeyRound size={16} />按资源授权</button></div></header>

    <form class="filter-band grant-management-filter" onSubmit={submitFilter}>
      <div class="filter-title"><Search size={16} />授权筛选</div>
      <div class="grant-management-filter-grid">
        <div class="filter-field"><span>用户 ID</span><SearchMultiSelect value={users()} placeholder="全部用户" searchPlaceholder="搜索用户名或展示名称" loadOptions={loadUserOptions} onChange={setUsers} /></div>
        <div class="filter-field"><span>角色</span><RoleMultiSelect value={roles()} onChange={setRoles} /></div>
        <label class="filter-field"><span>资源类型</span><select class="input" value={resourceType()} onChange={(event) => setResourceType(event.currentTarget.value as ResourceType | '')}><option value="">全部</option><option value="datasource">数据源</option><option value="table">数据表</option></select></label>
        <label class="filter-field"><span>资源 ID</span><input class="input" classList={{ invalid: Boolean(resourceIdsError()) }} placeholder="多个 ID 用逗号分隔" value={resourceIds()} onInput={(event) => { setResourceIds(event.currentTarget.value); setResourceIdsError(''); }} /><Show when={resourceIdsError()}><small class="field-error">{resourceIdsError()}</small></Show></label>
        <div class="datasource-filter-actions"><button type="button" class="icon-button" title="重置" onClick={reset}><RotateCcw size={16} /></button><button type="submit" class="button button-dark"><Search size={16} />查询</button></div>
      </div>
    </form>

    <RoleGrantTable query={query()} />
  </main>;
}
