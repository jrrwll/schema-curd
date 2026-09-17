import type { CreateUserInput, CurrentUser, ListUserRequest, ListUserResult, UpdateUserInput } from '../types/user';
import { request } from './client';

export function getUsers(body: ListUserRequest) {
  return request<ListUserResult>('/api/user/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getUserDetail(id: number) {
  return request<CurrentUser>(`/api/user/detail?id=${encodeURIComponent(id)}`);
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
