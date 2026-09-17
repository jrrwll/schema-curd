import type { ResourceType } from './types/role';
import type { GrantResourceRouteState, GrantUserRouteState, PositiveId, RouteState } from './types/route';

function positiveId(value: string | null): PositiveId | null {
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id as PositiveId : null;
}

function validName(value: string | null): string | null {
  return value !== null && value.length > 0 && value.trim() === value ? value : null;
}

function resourceType(value: string | null): ResourceType | null {
  return value === 'datasource' || value === 'table' ? value : null;
}

function invalidParams(params: URLSearchParams, allowed: ReadonlySet<string>): string | null {
  for (const key of params.keys()) {
    if (!allowed.has(key)) return `无效的 URL 参数：${key}`;
    if (params.getAll(key).length > 1) return `URL 参数不能重复：${key}`;
  }
  return null;
}

export function readRoute(pathname = window.location.pathname, search = window.location.search): RouteState {
  const params = new URLSearchParams(search);
  const rawResourceType = params.get('resource_type');
  const parsedResourceType = resourceType(rawResourceType);
  const rawUser = params.get('user');
  const rawTable = params.get('table');
  const rawResourceId = params.get('resource_id');
  const rawResourceName = params.get('resource_name');
  const rawDatasource = params.get('datasource');
  const resourceName = validName(rawResourceName);
  const datasource = validName(rawDatasource);
  const user = positiveId(rawUser);
  const table = positiveId(rawTable);
  const resourceId = positiveId(rawResourceId);
  let grantUser: GrantUserRouteState | null = null;
  let grantResource: GrantResourceRouteState | null = null;
  let error: string | null = null;

  if (pathname === '/grant/user') {
    error = invalidParams(params, new Set(['user', 'datasource']));
  } else if (pathname === '/grant/resource') {
    error = invalidParams(params, new Set(['resource_type', 'resource_id', 'resource_name']));
  }

  if (error) {
    // The route-specific state remains null so invalid parameters cannot reach a page.
  } else if (pathname !== '/grant' && rawDatasource !== null && !datasource) {
    error = '数据源名称不能为空且不能包含首尾空格';
  } else if ((pathname === '/user/update' || pathname === '/grant/user') && rawUser !== null && !user) {
    error = `无效的用户 ID：${rawUser}`;
  } else if ((pathname.startsWith('/entity') || pathname.startsWith('/meta/table')) && rawTable !== null && !table) {
    error = `无效的数据表 ID：${rawTable}`;
  } else if (pathname.startsWith('/entity') && table && !datasource) {
    error = '选择数据表前必须先选择数据源';
  } else if (pathname === '/grant/user') {
    if (rawDatasource !== null && !datasource) error = '数据源名称不能为空且不能包含首尾空格';
    else if (datasource && !user) error = '选择数据源前必须先选择用户';
    else if (rawResourceType !== null || rawResourceId !== null || rawResourceName !== null) error = '按用户授权 URL 包含无效的资源参数';
    else grantUser = { userId: user, datasourceName: datasource };
  } else if (pathname === '/grant/resource') {
    if (rawResourceType !== null && !parsedResourceType) error = `无效的资源类型：${rawResourceType}`;
    else {
      const type = parsedResourceType ?? 'datasource';
      if (type === 'datasource') {
        if (rawResourceId !== null) error = '数据源授权不能使用 resource_id';
        else if (rawResourceName !== null && !resourceName) error = '数据源名称不能为空且不能包含首尾空格';
        else grantResource = { type, resourceName };
      } else if (rawResourceName !== null) error = '数据表授权不能使用 resource_name';
      else if (rawResourceId !== null && !resourceId) error = `无效的数据表 ID：${rawResourceId}`;
      else grantResource = { type, resourceId };
    }
  }

  return {
    pathname,
    redirect: params.get('redirect'),
    datasource: pathname === '/grant' ? null : datasource,
    table: pathname === '/grant' ? null : table,
    user: pathname === '/grant' ? null : user,
    grant_user: grantUser,
    grant_resource: grantResource,
    error,
  };
}
