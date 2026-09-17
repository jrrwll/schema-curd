import { describe, expect, test } from 'vitest';
import { readRoute } from '../src/routing';

describe('authorization route parsing', () => {
  test('restores a user selection without a datasource', () => {
    const route = readRoute('/grant/user', '?user=2');
    expect(route.error).toBeNull();
    expect(route.grant_user).toEqual({ userId: 2, datasourceName: null });
  });

  test('restores a user and datasource selection', () => {
    const route = readRoute('/grant/user', '?user=2&datasource=warehouse');
    expect(route.error).toBeNull();
    expect(route.grant_user).toEqual({ userId: 2, datasourceName: 'warehouse' });
  });

  test('restores a datasource resource selection', () => {
    const route = readRoute('/grant/resource', '?resource_type=datasource&resource_name=warehouse');
    expect(route.error).toBeNull();
    expect(route.grant_resource).toEqual({ type: 'datasource', resourceName: 'warehouse' });
  });

  test('restores a table resource selection', () => {
    const route = readRoute('/grant/resource', '?resource_type=table&resource_id=17');
    expect(route.error).toBeNull();
    expect(route.grant_resource).toEqual({ type: 'table', resourceId: 17 });
  });

  test('defaults a normally opened resource page to datasource mode', () => {
    expect(readRoute('/grant/resource', '').grant_resource).toEqual({ type: 'datasource', resourceName: null });
  });

  test('rejects invalid or contradictory authorization parameters', () => {
    expect(readRoute('/grant/resource', '?resource_type=entity').error).toContain('无效的资源类型');
    expect(readRoute('/grant/resource', '?resource_type=table&resource_id=0').error).toContain('无效的数据表 ID');
    expect(readRoute('/grant/resource', '?resource_type=table&resource_name=x').error).toContain('不能使用 resource_name');
    expect(readRoute('/grant/resource', '?resource_type=datasource&resource_id=1').error).toContain('不能使用 resource_id');
    expect(readRoute('/grant/user', '?datasource=warehouse').error).toContain('必须先选择用户');
    expect(readRoute('/grant/user', '?user=abc').error).toContain('无效的用户 ID');
    expect(readRoute('/grant/user', '?user=1e2').error).toContain('无效的用户 ID');
    expect(readRoute('/grant/resource', '?resource_type=table&resource_id= 17').error).toContain('无效的数据表 ID');
    expect(readRoute('/grant/resource', '?resource_type=datasource&resource_name=%20warehouse').error).toContain('数据源名称不能为空');
    expect(readRoute('/meta/table', '?datasource=%20warehouse').error).toContain('数据源名称不能为空');
    expect(readRoute('/grant/user', '?user=2&table=3').error).toContain('无效的 URL 参数');
    expect(readRoute('/grant/resource', '?resource_type=table&resource_id=3&user=2').error).toContain('无效的 URL 参数');
    expect(readRoute('/grant/user', '?user=2&user=3').error).toContain('不能重复');
  });

  test('/grant ignores URL filter parameters', () => {
    const route = readRoute('/grant', '?user=2&datasource=warehouse&table=3&resource_type=table&resource_id=3');
    expect(route.user).toBeNull();
    expect(route.datasource).toBeNull();
    expect(route.table).toBeNull();
    expect(route.grant_user).toBeNull();
    expect(route.grant_resource).toBeNull();
    expect(route.error).toBeNull();
  });
});

describe('entity route parsing', () => {
  test('requires a datasource when a table is selected', () => {
    const route = readRoute('/entity', '?table=2');
    expect(route.error).toContain('必须先选择数据源');
  });

  test('accepts a table selected within a datasource', () => {
    const route = readRoute('/entity', '?datasource=warehouse&table=2');
    expect(route.error).toBeNull();
    expect(route.datasource).toBe('warehouse');
    expect(route.table).toBe(2);
  });
});
