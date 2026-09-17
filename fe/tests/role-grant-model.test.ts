import { describe, expect, test } from 'vitest';
import {
  createPromiseCache,
  hydrateRoleGrantByUserSelection,
  resetRoleGrantByResourceSelection,
  roleGrantByResourceUrl,
  roleGrantByUserUrl,
  switchRoleGrantByUserType,
  tableGrantSubjectFromDetail,
} from '../src/pages/role/roleGrantModel';
import type { TableMetadataDetailRecord } from '../src/types/table';

const user = { id: '2', label: '测试用户', detail: 'tester' };

describe('role grant page state', () => {
  test('builds canonical URLs as soon as a subject is selected', () => {
    expect(roleGrantByUserUrl(user)).toBe('/grant/user?user=2');
    expect(roleGrantByUserUrl(user, 'warehouse')).toBe('/grant/user?user=2&datasource=warehouse');
    expect(roleGrantByResourceUrl('datasource', { id: '4', label: '仓库', detail: 'warehouse' }))
      .toBe('/grant/resource?resource_type=datasource&resource_name=warehouse');
    expect(roleGrantByResourceUrl('table', { id: '17', label: '订单', detail: 'orders' }))
      .toBe('/grant/resource?resource_type=table&resource_id=17');
  });

  test('switching the by-user page to table mode clears dependent state', () => {
    expect(switchRoleGrantByUserType('table')).toEqual({
      resourceType: 'table',
      datasource: null,
      selected: {},
      roles: {},
      search: '',
      page: 1,
    });
  });

  test('URL hydration resets dependent selections for both authorization flows', () => {
    expect(hydrateRoleGrantByUserSelection('warehouse')).toEqual({
      resourceType: 'table',
      datasource: null,
      selected: {},
      roles: {},
      search: '',
      page: 1,
    });
    expect(hydrateRoleGrantByUserSelection(null).resourceType).toBe('datasource');
    expect(resetRoleGrantByResourceSelection()).toEqual({ selected: {}, roles: {}, search: '', page: 1 });
  });

  test('table detail restores both table and datasource display state', () => {
    const table = {
      id: 17,
      datasource_id: 4,
      datasource: 'warehouse',
      datasource_display_name: '生产仓库',
      name: 'orders',
      display_name: '订单',
    } as TableMetadataDetailRecord;
    expect(tableGrantSubjectFromDetail(table)).toEqual({
      resource: { id: '17', label: '订单', detail: 'orders' },
      datasource: { id: '4', label: '生产仓库', detail: 'warehouse' },
    });
  });
});

describe('authorization hydration request cache', () => {
  test('deduplicates concurrent and repeated detail requests', async () => {
    let calls = 0;
    let resolve!: (value: string) => void;
    const cache = createPromiseCache<number, string>(() => {
      calls += 1;
      return new Promise((done) => { resolve = done; });
    });
    const first = cache.get(2);
    const second = cache.get(2);
    expect(calls).toBe(1);
    expect(first).toBe(second);
    resolve('tester');
    expect(await first).toBe('tester');
    expect(await cache.get(2)).toBe('tester');
    expect(calls).toBe(1);
  });

  test('removes failed requests so hydration can retry', async () => {
    let calls = 0;
    const cache = createPromiseCache(async () => {
      calls += 1;
      if (calls === 1) throw new Error('temporary');
      return 'ok';
    });
    await expect(cache.get('warehouse')).rejects.toThrow('temporary');
    await expect(cache.get('warehouse')).resolves.toBe('ok');
    expect(calls).toBe(2);
  });
});
