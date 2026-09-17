import type { SearchMultiOption } from '../../components/SearchMultiSelect';
import type { ResourceType, RoleResourceOption } from '../../types/role';
import type { TableMetadataDetailRecord } from '../../types/table';

export interface RoleGrantByUserSelectionState {
  resourceType: ResourceType;
  datasource: SearchMultiOption | null;
  selected: Record<string, SearchMultiOption>;
  roles: Record<string, 'read' | 'write'>;
  search: string;
  page: number;
}

export interface RoleGrantTableSubject {
  resource: SearchMultiOption;
  datasource: SearchMultiOption;
}

export function toSearchOption(item: RoleResourceOption): SearchMultiOption {
  return { id: String(item.id), label: item.display_name, detail: item.name };
}

export function roleGrantByUserUrl(user: SearchMultiOption | null, datasourceName?: string): string {
  if (!user) return '/grant/user';
  const params = new URLSearchParams({ user: user.id });
  if (datasourceName) params.set('datasource', datasourceName);
  return `/grant/user?${params}`;
}

export function roleGrantByResourceUrl(type: ResourceType, resource?: SearchMultiOption | null): string {
  const params = new URLSearchParams({ resource_type: type });
  if (resource) {
    if (type === 'datasource') params.set('resource_name', resource.detail);
    else params.set('resource_id', resource.id);
  }
  return `/grant/resource?${params}`;
}

export function switchRoleGrantByUserType(type: ResourceType): RoleGrantByUserSelectionState {
  return { resourceType: type, datasource: null, selected: {}, roles: {}, search: '', page: 1 };
}

export function hydrateRoleGrantByUserSelection(datasourceName: string | null): RoleGrantByUserSelectionState {
  return switchRoleGrantByUserType(datasourceName ? 'table' : 'datasource');
}

export interface RoleGrantByResourceSelectionState {
  selected: Record<string, SearchMultiOption>;
  roles: Record<string, 'read' | 'write'>;
  search: string;
  page: number;
}

export function resetRoleGrantByResourceSelection(): RoleGrantByResourceSelectionState {
  return { selected: {}, roles: {}, search: '', page: 1 };
}

export function tableGrantSubjectFromDetail(table: TableMetadataDetailRecord): RoleGrantTableSubject {
  return {
    resource: { id: String(table.id), label: table.display_name, detail: table.name },
    datasource: {
      id: String(table.datasource_id),
      label: table.datasource_display_name,
      detail: table.datasource,
    },
  };
}

export interface PromiseCache<K, V> {
  get: (key: K) => Promise<V>;
  prime: (key: K, value: V) => void;
}

export function createPromiseCache<K, V>(loader: (key: K) => Promise<V>): PromiseCache<K, V> {
  const entries = new Map<K, Promise<V>>();
  return {
    get(key) {
      const existing = entries.get(key);
      if (existing) return existing;
      const request = loader(key).catch((reason) => {
        entries.delete(key);
        throw reason;
      });
      entries.set(key, request);
      return request;
    },
    prime(key, value) {
      entries.set(key, Promise.resolve(value));
    },
  };
}
