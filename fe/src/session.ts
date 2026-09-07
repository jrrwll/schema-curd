import type { CurrentUser } from './types';

const ACCESS_TOKEN_KEY = 'schema-curd-access-token';
const REFRESH_TOKEN_KEY = 'schema-curd-refresh-token';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasSession(): boolean {
  return getAccessToken() !== null || getRefreshToken() !== null;
}

export function saveTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearSession(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isSuperAdmin(user: CurrentUser): boolean {
  return user.is_super_admin;
}

export function canCreateDatasource(user: CurrentUser): boolean {
  return user.is_datasource_admin;
}

export function canAdminUsers(user: CurrentUser): boolean {
  return user.is_super_admin || user.is_user_admin;
}
