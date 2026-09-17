import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { deleteDatasource, getDatasourceDetail, updateDatasource } from '../src/api/datasource';
import { getDiscoveryDatasources, getDiscoveryTables } from '../src/api/discovery';
import { getGrantableDatasourceUsers, getGrantableUserTables } from '../src/api/role';
import { getTableMetadata } from '../src/api/table';
import { getUserDetail } from '../src/api/user';
import { getUsers } from '../src/api/user';

const calls: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
  calls.length = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
      dispatchEvent: () => true,
    },
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ code: '0', data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('frontend API domain contracts', () => {
  test('role table selection uses /api/table/list rather than discovery', async () => {
    await getTableMetadata({ datasource: 'warehouse', page_no: 1, page_size: 20 });
    expect(calls.map((call) => call.url)).toEqual(['/api/table/list']);
    expect(calls[0].url).not.toContain('/api/discovery/');
  });

  test('entity datasource and table discovery use discovery endpoints and datasource IDs', async () => {
    await getDiscoveryDatasources({ keyword: 'ware' });
    await getDiscoveryTables({ datasource_id: 7, keyword: 'order' });
    expect(calls.map((call) => call.url)).toEqual([
      '/api/discovery/datasource/list',
      '/api/discovery/table/list',
    ]);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ datasource_id: 7, keyword: 'order' });
  });

  test('/meta/table datasource selection uses the discovery datasource contract', async () => {
    await getDiscoveryDatasources({ datasource: 'warehouse' });
    expect(calls[0].url).toBe('/api/discovery/datasource/list');
  });

  test('user hydration uses the super-admin detail endpoint', async () => {
    await getUserDetail(2);
    expect(calls[0].url).toBe('/api/user/detail?id=2');
  });

  test('datasource detail uses its ID while update and delete use technical names', async () => {
    await getDatasourceDetail(7);
    await updateDatasource({
      name: 'warehouse',
      display_name: '生产仓库',
      url: 'mysql://localhost/db',
      username: 'root',
      config: { bool_as_int: false },
    });
    await deleteDatasource('warehouse');
    expect(calls[0].url).toBe('/api/datasource/detail?id=7');
    expect(JSON.parse(String(calls[1].init?.body)).name).toBe('warehouse');
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ name: 'warehouse' });
  });

  test('role candidate contracts pass datasource_name rather than datasource id', async () => {
    await getGrantableUserTables({ user_id: 2, datasource_name: 'warehouse', keyword: 'order' });
    await getGrantableDatasourceUsers({ datasource_name: 'warehouse', keyword: 'test' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      user_id: 2,
      datasource_name: 'warehouse',
      keyword: 'order',
    });
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      datasource_name: 'warehouse',
      keyword: 'test',
    });
  });

  test('user list can request a paged non-super-admin result', async () => {
    await getUsers({ page_no: 1, page_size: 20, name: 'test', super_admin: false });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      page_no: 1,
      page_size: 20,
      name: 'test',
      super_admin: false,
    });
  });
});
