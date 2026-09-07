import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  type AuthTokens,
} from '../session';

interface ApiResult<T> {
  code: string;
  msg?: string;
  data: T;
}

let refreshPromise: Promise<void> | null = null;

async function rotateRefreshToken(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('登录状态已过期');
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.msg || '登录状态已过期');
  }
  saveTokens((payload as ApiResult<AuthTokens>).data);
}

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = rotateRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function expireSession(): void {
  clearSession();
  window.dispatchEvent(new Event('auth-expired'));
}

export async function request<T>(url: string, init?: RequestInit, retry = true): Promise<T> {
  const accessToken = getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 401 && retry && url !== '/api/auth/login' && url !== '/api/auth/refresh') {
    try {
      await refreshSession();
      return request<T>(url, init, false);
    } catch {
      expireSession();
      throw new Error('登录状态已过期');
    }
  }
  if (!response.ok) {
    throw new Error(payload?.msg || `Request failed (${response.status})`);
  }
  return (payload as ApiResult<T>).data;
}
