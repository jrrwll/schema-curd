import type { ResourceType, Role } from './types';

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  '*': '*',
  datasource: '数据源',
  table: '数据表',
};

const ROLE_LABELS: Record<Role, string> = {
  super_admin: '超级管理员',
  user_admin: '用户管理员',
  admin: '管理员',
  write: '写权限',
  read: '读权限',
};

export function resourceTypeLabel(value: ResourceType) {
  return RESOURCE_TYPE_LABELS[value];
}

export function roleLabel(value: Role) {
  return ROLE_LABELS[value];
}
