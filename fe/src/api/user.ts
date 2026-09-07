import type {
  CreateUserInput,
  GrantRoleInput,
  ListRoleRequest,
  ListRoleResult,
  ListUserRequest,
  ListUserResult,
  Role,
  UpdateUserInput,
} from '../types';
import { request } from './client';

export function getUsers(body: ListUserRequest) {
  return request<ListUserResult>('/api/user/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function createUser(body: CreateUserInput) {
  return request<void>('/api/user/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateUser(body: UpdateUserInput) {
  return request<void>('/api/user/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function disableUser(id: number) {
  return request<void>('/api/user/disable', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function enableUser(id: number) {
  return request<void>('/api/user/enable', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function deleteUser(id: number) {
  return request<void>('/api/user/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function getRoleGrants(body: ListRoleRequest) {
  return request<ListRoleResult>('/api/role/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function grantRole(body: GrantRoleInput) {
  return request<void>('/api/role/grant', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateRoleGrant(body: { id: number; role: Role }) {
  return request<void>('/api/role/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function revokeRole(id: number) {
  return request<void>('/api/role/revoke', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}
