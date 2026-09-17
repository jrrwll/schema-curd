import type { ResourceType, Role } from './types/role';

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  datasource: '数据源',
  table: '数据表',
};

const ROLE_LABELS: Record<Role, string> = {
  write: '写权限',
  read: '读权限',
};

export function resourceTypeLabel(value: ResourceType) {
  return RESOURCE_TYPE_LABELS[value];
}

export function roleLabel(value: Role) {
  return ROLE_LABELS[value];
}
