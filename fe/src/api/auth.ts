import { saveTokens, type AuthTokens } from '../session';
import type { CurrentUser } from '../types';
import { request } from './client';

export async function login(name: string, password: string) {
  const tokens = await request<AuthTokens>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  });
  saveTokens(tokens);
}

export function getCurrentUser() {
  return request<CurrentUser>('/api/user/profile');
}
