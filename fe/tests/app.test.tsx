import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';
import App from '../src/App';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  Reflect.deleteProperty(window, 'confirm');
});

describe('application bootstrap', () => {
  test('clears the session when a retried request is still unauthorized', async () => {
    window.localStorage.setItem('schema-curd-access-token', 'access');
    window.localStorage.setItem('schema-curd-refresh-token', 'refresh');
    window.history.replaceState({}, '', '/meta/datasource');
    let profileCalls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/user/profile') {
        profileCalls += 1;
        return new Response(JSON.stringify({ code: 'unauthorized', msg: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      if (url === '/api/auth/refresh') {
        return new Response(JSON.stringify({ code: '0', data: { access_token: 'new-access', refresh_token: 'new-refresh' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(profileCalls).toBe(2);
    expect(window.localStorage.getItem('schema-curd-access-token')).toBeNull();
    expect(window.localStorage.getItem('schema-curd-refresh-token')).toBeNull();
  });

  test('keeps the session and offers retry when loading the current user fails', async () => {
    window.localStorage.setItem('schema-curd-access-token', 'access');
    window.localStorage.setItem('schema-curd-refresh-token', 'refresh');
    window.history.replaceState({}, '', '/meta/datasource');
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ code: 'error', msg: '用户服务暂不可用' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    render(() => <App />);

    expect(await screen.findByText('加载用户信息失败：用户服务暂不可用')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    expect(window.localStorage.getItem('schema-curd-access-token')).toBe('access');
    expect(window.localStorage.getItem('schema-curd-refresh-token')).toBe('refresh');
    expect(window.location.pathname).toBe('/meta/datasource');
  });

  test('accepts browser history navigation and discards inline edits without confirmation', async () => {
    window.localStorage.setItem('schema-curd-access-token', 'access');
    window.localStorage.setItem('schema-curd-refresh-token', 'refresh');
    window.history.replaceState({}, '', '/entity?datasource=warehouse&table=2');
    const confirm = vi.fn(() => false);
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirm });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/user/profile') return new Response(JSON.stringify({ code: '0', data: { id: 1, name: 'admin', display_name: '管理员', super_admin: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/discovery/datasource/list') return new Response(JSON.stringify({ code: '0', data: [{ id: 1, name: 'warehouse', display_name: '生产仓库' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/discovery/table/list') return new Response(JSON.stringify({ code: '0', data: [{ id: 2, name: 'users', display_name: '用户数据' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/table/detail?id=2') return new Response(JSON.stringify({ code: '0', data: {
        id: 2, created_at: '', updated_at: '', datasource: 'warehouse', datasource_id: 1,
        datasource_display_name: '生产仓库', name: 'users', display_name: '用户数据', disabled: false,
        effective_role: 'write', table_name: 'users',
        table_config: { readonly: false, primary_keys: ['id'], sortable_columns: ['id', 'name'], search_default_value: {}, insert_fixed_values: {}, select_fixed_where: [], default_order_by: [] },
        columns_config: [
          { name: 'id', display_name: '编号', data_type: 'int', optional: false },
          { name: 'name', display_name: '姓名', data_type: 'text', optional: false },
        ],
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/entity/list') return new Response(JSON.stringify({ code: '0', data: { total: 1, items: [{ id: 1, name: 'Alice' }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/datasource/list') return new Response(JSON.stringify({ code: '0', data: { total: 0, items: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <App />);
    const input = await screen.findByDisplayValue('Alice');
    fireEvent.input(input, { target: { value: 'Edited' } });
    window.history.pushState({}, '', '/meta/datasource');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('heading', { level: 1, name: '数据源' })).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  test('ignores an old user detail response after the route user changes', async () => {
    window.localStorage.setItem('schema-curd-access-token', 'access');
    window.localStorage.setItem('schema-curd-refresh-token', 'refresh');
    window.history.replaceState({}, '', '/user/update?user=2');
    const oldDetail = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/user/profile') return new Response(JSON.stringify({ code: '0', data: { id: 1, name: 'admin', display_name: '管理员', super_admin: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/user/detail?id=2') return oldDetail.promise;
      if (url === '/api/user/detail?id=3') return new Response(JSON.stringify({ code: '0', data: { id: 3, name: 'current', display_name: '当前用户', super_admin: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      throw new Error(`Unexpected request: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(() => <App />);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/user/detail?id=2')).toBe(true));
    window.history.pushState({}, '', '/user/update?user=3');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByDisplayValue('当前用户')).toBeTruthy();
    oldDetail.resolve(new Response(JSON.stringify({ code: '0', data: { id: 2, name: 'old', display_name: '旧用户', super_admin: false } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(screen.queryByDisplayValue('旧用户')).toBeNull();
  });
});
