import type { BatchGrantResourcesInput, BatchGrantUsersInput, ListRoleRequest, ListRoleResult, Role, RoleResourceOption } from '../types/role';
import { request } from './client';

export function getRoleGrants(body: ListRoleRequest) { return request<ListRoleResult>('/api/role/list', { method: 'POST', body: JSON.stringify(body) }); }
export function batchGrantUsers(body: BatchGrantUsersInput) { return request<void>('/api/role/batch/grant/user', { method: 'POST', body: JSON.stringify(body) }); }
export function batchGrantResources(body: BatchGrantResourcesInput) { return request<void>('/api/role/batch/grant/resource', { method: 'POST', body: JSON.stringify(body) }); }
export function getGrantableUserDatasources(body: { user_id: number; keyword?: string }) { return request<RoleResourceOption[]>('/api/role/user/datasource/list', { method: 'POST', body: JSON.stringify(body) }); }
export function getGrantableUserTables(body: { user_id: number; datasource_name: string; keyword?: string }) { return request<RoleResourceOption[]>('/api/role/user/table/list', { method: 'POST', body: JSON.stringify(body) }); }
export function getGrantableDatasourceUsers(body: { datasource_name: string; keyword?: string }) { return request<RoleResourceOption[]>('/api/role/datasource/user/list', { method: 'POST', body: JSON.stringify(body) }); }
export function getGrantableTableUsers(body: { table_id: number; keyword?: string }) { return request<RoleResourceOption[]>('/api/role/table/user/list', { method: 'POST', body: JSON.stringify(body) }); }
export function updateRoleGrant(body: { id: number; role: Role }) { return request<void>('/api/role/update', { method: 'POST', body: JSON.stringify(body) }); }
export function revokeRole(id: number) { return request<void>('/api/role/revoke', { method: 'POST', body: JSON.stringify({ id }) }); }
export function batchRevokeRoles(ids: number[]) { return request<void>('/api/role/batch/revoke', { method: 'POST', body: JSON.stringify({ ids }) }); }
