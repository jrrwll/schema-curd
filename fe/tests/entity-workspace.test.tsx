import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import EntityWorkspacePage from '../src/pages/EntityWorkspacePage';
import type { RouteState } from '../src/types/route';

function response(data: unknown) {
  return new Response(JSON.stringify({ code: '0', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function tableDetail(id: number, name: string, displayName: string) {
  return {
    id,
    created_at: '',
    updated_at: '',
    datasource: 'warehouse',
    datasource_id: 1,
    datasource_display_name: '生产仓库',
    name,
    display_name: displayName,
    disabled: false,
    effective_role: 'write',
    table_name: name,
    table_config: { readonly: false, primary_keys: ['id'], sortable_columns: ['id', 'name'], search_default_value: {}, insert_fixed_values: {}, select_fixed_where: [], default_order_by: [] },
    columns_config: [
      { name: 'id', display_name: '编号', data_type: 'int', optional: false },
      { name: 'name', display_name: '姓名', data_type: 'text', optional: false },
    ],
  };
}

const route: RouteState = {
  pathname: '/entity',
  redirect: null,
  datasource: 'warehouse',
  table: 2 as RouteState['table'],
  user: null,
  grant_user: null,
  grant_resource: null,
  error: null,
};

afterEach(() => vi.restoreAllMocks());

describe('entity workspace table hydration', () => {
  test('hydrates the selected table through the metadata detail endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/discovery/datasource/list') return response([{ id: 1, name: 'warehouse', display_name: '生产仓库' }]);
      if (url === '/api/discovery/table/list') {
        return response([{ id: 2, name: 'orders', display_name: '订单' }]);
      }
      if (url === '/api/table/detail?id=2') return response({
        id: 2,
        created_at: '',
        updated_at: '',
        datasource: 'warehouse',
        datasource_id: 1,
        datasource_display_name: '生产仓库',
        name: 'orders',
        display_name: '订单',
        disabled: false,
        effective_role: 'read',
        table_name: 'orders',
        table_config: { readonly: true, primary_keys: ['id'], sortable_columns: ['id'], search_default_value: {}, insert_fixed_values: {}, select_fixed_where: [], default_order_by: [] },
        columns_config: [{ name: 'id', display_name: '编号', data_type: 'int', optional: false }],
      });
      if (url === '/api/entity/list') return response({ total: 0, items: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(() => <EntityWorkspacePage route={route} navigate={() => undefined} />);

    expect(await screen.findByRole('heading', { level: 1, name: '订单' })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/table/detail?id=2')).toBe(true);
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/discovery/table/list')).toHaveLength(1);
    expect(JSON.parse(String(fetchMock.mock.calls.find(([input]) => String(input) === '/api/discovery/table/list')?.[1]?.body))).toEqual({ datasource_id: 1 });
  });

  test('rejects a table that belongs to another datasource', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/discovery/datasource/list') return response([{ id: 1, name: 'warehouse', display_name: '生产仓库' }]);
      if (url === '/api/discovery/table/list') return response([]);
      if (url === '/api/table/detail?id=2') return response({
        id: 2,
        created_at: '',
        updated_at: '',
        datasource: 'archive',
        datasource_id: 3,
        datasource_display_name: '归档仓库',
        name: 'orders',
        display_name: '订单',
        disabled: false,
        effective_role: 'read',
        table_name: 'orders',
        table_config: { readonly: true, primary_keys: ['id'], sortable_columns: ['id'], search_default_value: {}, insert_fixed_values: {}, select_fixed_where: [], default_order_by: [] },
        columns_config: [{ name: 'id', display_name: '编号', data_type: 'int', optional: false }],
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(() => <EntityWorkspacePage route={route} navigate={() => undefined} />);

    expect(await screen.findByText('数据表 订单 不属于数据源 warehouse')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/entity/list')).toBe(false);
  });

});
