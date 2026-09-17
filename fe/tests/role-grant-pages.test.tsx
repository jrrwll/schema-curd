import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { readRoute } from '../src/routing';
import type { GrantResourceRouteState, GrantUserRouteState, PositiveId } from '../src/types/route';
import RoleGrantByResourcePage from '../src/pages/role/RoleGrantByResourcePage';
import RoleGrantByUserPage from '../src/pages/role/RoleGrantByUserPage';
import RoleGrantTable from '../src/components/role/RoleGrantTable';
import SearchMultiSelect from '../src/components/SearchMultiSelect';
import DatasourceSelectionDialog from '../src/components/DatasourceSelectionDialog';
import GrantManagementPage from '../src/pages/GrantManagementPage';
import { SEARCH_DEBOUNCE_MS } from '../src/constants';

const user = { id: 2, name: 'tester', display_name: '测试用户', super_admin: false };
const datasource = {
  id: 4,
  created_at: '',
  updated_at: '',
  name: 'warehouse',
  display_name: '生产仓库',
  effective_role: 'write',
  url: '',
  username: '',
  password_configured: true,
  config: { bool_as_int: false },
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(status === 200 ? { code: '0', data } : { code: 'error', msg: String(data) }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function body(init?: RequestInit): Record<string, unknown> {
  return init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
}

function openDialog(): HTMLElement {
  const dialog = screen.getAllByRole('dialog', { hidden: true }).find((element) => element.getAttribute('data-state') === 'open');
  if (!dialog) throw new Error('Expected an open confirmation dialog');
  return dialog;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('authorization page URL hydration', () => {
  test('by-user route changes clear targets and restore the URL-selected tab', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/user/detail?id=2') return response(user);
      if (url === '/api/datasource/list') return response({ total: 1, items: [datasource] });
      if (url === '/api/datasource/detail?id=4') return response(datasource);
      if (url === '/api/role/user/datasource/list') return response([{ id: 4, name: 'warehouse', display_name: '生产仓库' }]);
      if (url === '/api/role/user/table/list') return response([{ id: 17, name: 'orders', display_name: '订单' }]);
      throw new Error(`Unexpected request: ${url} ${JSON.stringify(body(init))}`);
    }) as typeof fetch;

    const [selection, setSelection] = createSignal<GrantUserRouteState>({ userId: 2 as PositiveId, datasourceName: null });
    render(() => <RoleGrantByUserPage selection={selection()} navigate={() => undefined} />);

    fireEvent.click(await screen.findByText('生产仓库'));
    expect(screen.getByText('已选择 1 / 100')).toBeTruthy();

    setSelection({ userId: 2 as PositiveId, datasourceName: 'warehouse' });
    await screen.findByText('订单');
    expect(screen.getByText('已选择 0 / 100')).toBeTruthy();

    setSelection({ userId: 2 as PositiveId, datasourceName: null });
    await waitFor(() => expect(screen.getByRole('tab', { name: '数据源' }).getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByText('已选择 0 / 100')).toBeTruthy();
    expect(vi.mocked(globalThis.fetch).mock.calls.filter(([input]) => String(input) === '/api/user/detail?id=2')).toHaveLength(1);
  });

  test('changing the datasource of a hydrated table keeps the new datasource selected', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/table/detail?id=17') return response({
        id: 17,
        datasource_id: 4,
        datasource: 'warehouse',
        datasource_display_name: '生产仓库',
        name: 'orders',
        display_name: '订单',
      });
      if (url === '/api/role/table/user/list') return response([]);
      if (url === '/api/datasource/list') return response({
        total: 1,
        items: [{ ...datasource, id: 5, name: 'archive', display_name: '归档仓库' }],
      });
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    window.history.replaceState({}, '', '/grant/resource?resource_type=table&resource_id=17');
    const [selection, setSelection] = createSignal<GrantResourceRouteState>({ type: 'table', resourceId: 17 as PositiveId });
    const navigate = (url: string) => {
      window.history.pushState({}, '', url);
      setSelection(readRoute().grant_resource!);
    };
    render(() => <RoleGrantByResourcePage selection={selection()} navigate={navigate} />);

    fireEvent.click(await screen.findByText('生产仓库'));
    fireEvent.click(await screen.findByText('归档仓库'));
    await waitFor(() => expect(screen.getByText('归档仓库')).toBeTruthy());
    const tableTriggerLabel = screen.getAllByText('选择数据表').find((element) => element.tagName === 'SPAN');
    expect(tableTriggerLabel?.closest('button')?.disabled).toBe(false);
  });

  test('by-resource route changes clear users selected for the previous resource', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/datasource/list') return response({ total: 1, items: [datasource] });
      if (url.startsWith('/api/datasource/detail')) return response(datasource);
      if (url === '/api/role/datasource/user/list') return response([{ id: 2, name: 'tester', display_name: '测试用户' }]);
      if (url === '/api/table/detail?id=17') return response({
        id: 17,
        datasource_id: 4,
        datasource: 'warehouse',
        datasource_display_name: '生产仓库',
        name: 'orders',
        display_name: '订单',
      });
      if (url === '/api/role/table/user/list') return response([]);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const [selection, setSelection] = createSignal<GrantResourceRouteState>({ type: 'datasource', resourceName: 'warehouse' });
    render(() => <RoleGrantByResourcePage selection={selection()} navigate={() => undefined} />);
    fireEvent.click(await screen.findByText('测试用户'));
    expect(screen.getByText('已选择 1 / 100')).toBeTruthy();

    setSelection({ type: 'table', resourceId: 17 as PositiveId });
    await screen.findByText('订单');
    expect(screen.getByText('已选择 0 / 100')).toBeTruthy();
  });
});

describe('authorization subject selection APIs', () => {
  test('loads users through the user domain without super administrators', async () => {
    const requests: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== '/api/user/list') throw new Error(`Unexpected request: ${String(input)}`);
      requests.push(body(init));
      return response({ total: 1, items: [user] });
    }) as typeof fetch;

    render(() => <RoleGrantByUserPage selection={{ userId: null, datasourceName: null }} navigate={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /选择用户/ }));

    expect(await screen.findByText('测试用户')).toBeTruthy();
    expect(requests[0]).toEqual({ page_no: 1, page_size: 20, disabled: false, super_admin: false });
  });

  test('loads resource tables through the table domain API', async () => {
    const urls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url === '/api/datasource/list') return response({ total: 1, items: [datasource] });
      if (url === '/api/table/list') {
        expect(body(init)).toEqual({ datasource: 'warehouse', page_no: 1, page_size: 20, disabled: false });
        return response({ total: 1, items: [{ id: 17, name: 'orders', display_name: '订单' }] });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <RoleGrantByResourcePage selection={{ type: 'table', resourceId: null }} navigate={() => undefined} />);
    const datasourceTrigger = screen.getAllByRole('button', { name: /选择数据源/ }).find((button) => !(button as HTMLButtonElement).disabled);
    if (!datasourceTrigger) throw new Error('Expected datasource trigger');
    fireEvent.click(datasourceTrigger);
    const datasourceOption = (await screen.findByText('生产仓库')).closest('button');
    if (!datasourceOption) throw new Error('Expected datasource option');
    fireEvent.click(datasourceOption);
    await waitFor(() => expect(screen.getAllByRole('dialog', { hidden: true }).every((dialog) => dialog.getAttribute('data-state') !== 'open')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /选择数据表/ }));

    expect(await screen.findByText('订单')).toBeTruthy();
    expect(urls).not.toContain('/api/discovery/table/list');
  });
});

describe('authorization request failures', () => {
  test('candidate and grant-list failures are rendered as errors', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/user/detail?id=2') return response(user);
      if (url === '/api/role/user/datasource/list') return response('候选资源加载失败', 500);
      if (url === '/api/role/list') return response('授权列表加载失败', 500);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const first = render(() => <RoleGrantByUserPage selection={{ userId: 2 as PositiveId, datasourceName: null }} navigate={() => undefined} />);
    expect(await screen.findByText('候选资源加载失败')).toBeTruthy();
    first.unmount();

    render(() => <RoleGrantTable query={{ page_no: 1, page_size: 20 }} />);
    expect(await screen.findByText('授权列表加载失败')).toBeTruthy();
    expect(screen.queryByText('暂无授权')).toBeNull();
  });

  test('by-resource candidate failures are not rendered as an empty match', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/datasource/list') return response({ total: 1, items: [datasource] });
      if (url.startsWith('/api/datasource/detail')) return response(datasource);
      if (url === '/api/role/datasource/user/list') return response('候选用户加载失败', 500);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <RoleGrantByResourcePage selection={{ type: 'datasource', resourceName: 'warehouse' }} navigate={() => undefined} />);
    expect(await screen.findByText('候选用户加载失败')).toBeTruthy();
    expect(screen.queryByText('没有匹配的用户')).toBeNull();
  });
});

describe('authorization stale request failures', () => {
  test('an old by-user candidate failure cannot replace newer successful candidates', async () => {
    const oldRequest = deferred<Response>();
    let oldStarted = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/user/detail?id=2') return response(user);
      if (url === '/api/user/detail?id=3') return response({ ...user, id: 3, name: 'new-user', display_name: '新用户' });
      if (url === '/api/role/user/datasource/list') {
        const requestBody = body(init);
        if (requestBody.user_id === 2) {
          oldStarted = true;
          return oldRequest.promise;
        }
        return response([{ id: 5, name: 'archive', display_name: '新候选资源' }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const [selection, setSelection] = createSignal<GrantUserRouteState>({ userId: 2 as PositiveId, datasourceName: null });
    render(() => <RoleGrantByUserPage selection={selection()} navigate={() => undefined} />);
    await waitFor(() => expect(oldStarted).toBe(true));
    setSelection({ userId: 3 as PositiveId, datasourceName: null });
    expect(await screen.findByText('新候选资源')).toBeTruthy();

    oldRequest.resolve(response('旧候选资源请求失败', 500));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('新候选资源')).toBeTruthy();
    expect(screen.queryByText('旧候选资源请求失败')).toBeNull();
  });

  test('an old by-resource candidate failure cannot replace newer successful candidates', async () => {
    const oldRequest = deferred<Response>();
    let oldStarted = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/datasource/list') {
        const name = body(init).name;
        return response({ total: 1, items: [name === 'archive' ? { ...datasource, id: 5, name: 'archive', display_name: '归档仓库' } : datasource] });
      }
      if (url === '/api/datasource/detail?id=4') return response(datasource);
      if (url === '/api/datasource/detail?id=5') return response({ ...datasource, id: 5, name: 'archive', display_name: '归档仓库' });
      if (url === '/api/role/datasource/user/list') {
        const requestBody = body(init);
        if (requestBody.datasource_name === 'warehouse') {
          oldStarted = true;
          return oldRequest.promise;
        }
        return response([{ id: 3, name: 'new-user', display_name: '新候选用户' }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const [selection, setSelection] = createSignal<GrantResourceRouteState>({ type: 'datasource', resourceName: 'warehouse' });
    render(() => <RoleGrantByResourcePage selection={selection()} navigate={() => undefined} />);
    await waitFor(() => expect(oldStarted).toBe(true));
    setSelection({ type: 'datasource', resourceName: 'archive' });
    expect(await screen.findByText('新候选用户')).toBeTruthy();

    oldRequest.resolve(response('旧候选用户请求失败', 500));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('新候选用户')).toBeTruthy();
    expect(screen.queryByText('旧候选用户请求失败')).toBeNull();
  });

  test('an old grant-list failure cannot replace a newer successful list', async () => {
    const oldRequest = deferred<Response>();
    let oldStarted = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url !== '/api/role/list') throw new Error(`Unexpected request: ${url}`);
      const requestBody = body(init);
      if ((requestBody.user_ids as number[] | undefined)?.includes(2)) {
        oldStarted = true;
        return oldRequest.promise;
      }
      return response({ total: 1, items: [{
        id: 11,
        created_at: '2026-09-11T10:00:00',
        user_id: 3,
        user_name: 'new-user',
        user_display_name: '新授权用户',
        user_disabled: false,
        role: 'read',
        resource_type: 'datasource',
        resource_id: 5,
        resource_name: '归档仓库',
      }] });
    }) as typeof fetch;

    const [query, setQuery] = createSignal({ page_no: 1, page_size: 20, user_ids: [2] });
    render(() => <RoleGrantTable query={query()} />);
    await waitFor(() => expect(oldStarted).toBe(true));
    setQuery({ page_no: 1, page_size: 20, user_ids: [3] });
    expect(await screen.findByText('新授权用户')).toBeTruthy();

    oldRequest.resolve(response('旧授权列表请求失败', 500));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('新授权用户')).toBeTruthy();
    expect(screen.queryByText('旧授权列表请求失败')).toBeNull();
  });
});

test('a stale fuzzy-search request cannot overwrite a newer keyword', async () => {
  const requests: Array<{ keyword: string; resolve: (items: Array<{ id: string; label: string; detail: string }>) => void }> = [];
  render(() => <SearchMultiSelect value={[]} placeholder="全部用户" searchPlaceholder="搜索用户" loadOptions={(keyword) => new Promise((resolve) => requests.push({ keyword, resolve }))} onChange={() => undefined} />);

  fireEvent.click(screen.getByRole('button', { name: /全部用户/ }));
  const input = screen.getByPlaceholderText('搜索用户');
  fireEvent.input(input, { target: { value: 'old' } });
  await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 20));
  expect(requests[0].keyword).toBe('old');

  fireEvent.input(input, { target: { value: 'new' } });
  requests[0].resolve([{ id: '1', label: '旧结果', detail: 'old' }]);
  await Promise.resolve();
  expect(screen.queryByText('旧结果')).toBeNull();

  await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 20));
  requests[1].resolve([{ id: '2', label: '新结果', detail: 'new' }]);
  expect(await screen.findByText('新结果')).toBeTruthy();
});

test('a failed user search clears results from the previous request', async () => {
  let calls = 0;
  render(() => <SearchMultiSelect
    value={[]}
    placeholder="全部用户"
    searchPlaceholder="搜索用户"
    loadOptions={async () => {
      calls += 1;
      if (calls === 1) return [{ id: '1', label: '旧用户', detail: 'old-user' }];
      throw new Error('用户搜索失败');
    }}
    onChange={() => undefined}
  />);

  fireEvent.click(screen.getByRole('button', { name: /全部用户/ }));
  expect(await screen.findByText('旧用户')).toBeTruthy();
  fireEvent.input(screen.getByPlaceholderText('搜索用户'), { target: { value: 'new' } });

  expect(await screen.findByText('用户搜索失败')).toBeTruthy();
  expect(screen.queryByText('旧用户')).toBeNull();
});

test('a stale datasource search cannot overwrite a newer keyword', async () => {
  const requests: Array<{ keyword?: string; resolve: (result: { total: number; items: Array<{ id: number; name: string; display_name: string }> }) => void }> = [];
  render(() => <DatasourceSelectionDialog
    open
    selectedId={null}
    loadPage={(request) => new Promise((resolve) => requests.push({ keyword: request.keyword, resolve }))}
    onOpenChange={() => undefined}
    onSelect={() => undefined}
  />);

  await waitFor(() => expect(requests).toHaveLength(1));
  requests[0].resolve({ total: 0, items: [] });
  const input = screen.getByPlaceholderText('搜索数据源');
  fireEvent.input(input, { target: { value: 'old' } });
  await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 20));
  expect(requests[1].keyword).toBe('old');

  fireEvent.input(input, { target: { value: 'new' } });
  requests[1].resolve({ total: 1, items: [{ id: 1, name: 'old', display_name: '旧数据源' }] });
  await Promise.resolve();
  expect(screen.queryByText('旧数据源')).toBeNull();

  await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 20));
  requests[2].resolve({ total: 1, items: [{ id: 2, name: 'new', display_name: '新数据源' }] });
  expect(await screen.findByText('新数据源')).toBeTruthy();
});

describe('authorization confirmation workflows', () => {
  test('by-user batch grant confirms every item, submits once, stays on the route and refreshes candidates', async () => {
    window.history.replaceState({}, '', '/grant/user?user=2');
    const candidateCalls: Record<string, unknown>[] = [];
    const grantCalls: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/user/detail?id=2') return response(user);
      if (url === '/api/role/user/datasource/list') {
        candidateCalls.push(body(init));
        return response(candidateCalls.length === 1 ? [
          { id: 4, name: 'warehouse', display_name: '生产仓库' },
          { id: 5, name: 'archive', display_name: '归档仓库' },
        ] : []);
      }
      if (url === '/api/role/batch/grant/resource') {
        grantCalls.push(body(init));
        return response(null);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <RoleGrantByUserPage selection={{ userId: 2 as PositiveId, datasourceName: null }} navigate={() => undefined} />);
    fireEvent.click(await screen.findByText('生产仓库'));
    fireEvent.click(screen.getByText('归档仓库'));
    const archiveRow = screen.getAllByText('归档仓库').map((element) => element.closest('.batch-grant-list-row')).find(Boolean)!;
    fireEvent.change(archiveRow.querySelector('select')!, { target: { value: 'write' } });
    fireEvent.click(screen.getByRole('button', { name: /确认授权/ }));

    expect(grantCalls).toHaveLength(0);
    await screen.findByRole('dialog');
    const dialog = openDialog();
    expect(within(dialog).getByText('请核对以下 2 项授权内容，确认后立即生效')).toBeTruthy();
    expect(within(dialog).getByText('生产仓库')).toBeTruthy();
    expect(within(dialog).getByText('归档仓库')).toBeTruthy();
    expect(within(dialog).getByText('写权限')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认授权' }));

    await waitFor(() => expect(grantCalls).toHaveLength(1));
    expect(grantCalls[0]).toEqual({
      user_id: 2,
      resource_type: 'datasource',
      items: [
        { resource_id: 4, role: 'read' },
        { resource_id: 5, role: 'write' },
      ],
    });
    await waitFor(() => expect(candidateCalls).toHaveLength(2));
    expect(window.location.pathname + window.location.search).toBe('/grant/user?user=2');
    expect(screen.getByText('已选择 0 / 100')).toBeTruthy();
  });

  test('by-resource batch grant confirms every item, submits once, stays on the route and refreshes candidates', async () => {
    window.history.replaceState({}, '', '/grant/resource?resource_type=datasource&resource_name=warehouse');
    let candidateCalls = 0;
    const grantCalls: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/datasource/list') return response({ total: 1, items: [datasource] });
      if (url === '/api/datasource/detail?id=4') return response(datasource);
      if (url === '/api/role/datasource/user/list') {
        candidateCalls += 1;
        return response(candidateCalls === 1 ? [
          { id: 2, name: 'tester', display_name: '测试用户' },
          { id: 3, name: 'writer', display_name: '写入用户' },
        ] : []);
      }
      if (url === '/api/role/batch/grant/user') {
        grantCalls.push(body(init));
        return response(null);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <RoleGrantByResourcePage selection={{ type: 'datasource', resourceName: 'warehouse' }} navigate={() => undefined} />);
    fireEvent.click(await screen.findByText('测试用户'));
    fireEvent.click(screen.getByText('写入用户'));
    const writerRow = screen.getAllByText('写入用户').map((element) => element.closest('.batch-grant-list-row')).find(Boolean)!;
    fireEvent.change(writerRow.querySelector('select')!, { target: { value: 'write' } });
    fireEvent.click(screen.getByRole('button', { name: /确认授权/ }));

    expect(grantCalls).toHaveLength(0);
    await screen.findByRole('dialog');
    const dialog = openDialog();
    expect(within(dialog).getByText('请核对以下 2 项授权内容，确认后立即生效')).toBeTruthy();
    expect(within(dialog).getByText('测试用户')).toBeTruthy();
    expect(within(dialog).getByText('写入用户')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认授权' }));

    await waitFor(() => expect(grantCalls).toHaveLength(1));
    expect(grantCalls[0]).toEqual({
      resource_type: 'datasource',
      resource_id: 4,
      items: [
        { user_id: 2, role: 'read' },
        { user_id: 3, role: 'write' },
      ],
    });
    await waitFor(() => expect(candidateCalls).toBe(2));
    expect(window.location.pathname + window.location.search).toBe('/grant/resource?resource_type=datasource&resource_name=warehouse');
    expect(screen.getByText('已选择 0 / 100')).toBeTruthy();
  });

  test('grant updates, single revokes and batch revokes all require confirmation and refresh the list', async () => {
    const grant = {
      id: 10,
      created_at: '2026-09-11T10:00:00',
      user_id: 2,
      user_name: 'tester',
      user_display_name: '测试用户',
      user_disabled: false,
      role: 'read',
      resource_type: 'datasource',
      resource_id: 4,
      resource_name: '生产仓库',
    };
    let listCalls = 0;
    const mutationCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/role/list') {
        listCalls += 1;
        return response({ total: 1, items: [grant] });
      }
      if (url === '/api/role/update' || url === '/api/role/revoke' || url === '/api/role/batch/revoke') {
        mutationCalls.push({ url, body: body(init) });
        return response(null);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <RoleGrantTable query={{ page_no: 1, page_size: 20 }} />);
    const row = (await screen.findByText('测试用户')).closest('tr')!;
    fireEvent.change(row.querySelector('select')!, { target: { value: 'write' } });
    fireEvent.click(within(row).getByRole('button', { name: '更新' }));
    expect(mutationCalls).toHaveLength(0);
    await screen.findByRole('dialog');
    let dialog = openDialog();
    expect(within(dialog).getByRole('heading', { name: '确认更新授权' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认更新授权' }));
    await waitFor(() => expect(mutationCalls).toContainEqual({ url: '/api/role/update', body: { id: 10, role: 'write' } }));
    await waitFor(() => expect(listCalls).toBe(2));

    const refreshedRow = (await screen.findByText('测试用户')).closest('tr')!;
    fireEvent.click(within(refreshedRow).getByTitle('撤销授权'));
    expect(mutationCalls.filter((call) => call.url === '/api/role/revoke')).toHaveLength(0);
    await waitFor(() => expect(openDialog()).toBeTruthy());
    dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销', hidden: true }));
    await waitFor(() => expect(mutationCalls).toContainEqual({ url: '/api/role/revoke', body: { id: 10 } }));
    await waitFor(() => expect(listCalls).toBe(3));

    const batchRow = (await screen.findByText('测试用户')).closest('tr')!;
    fireEvent.click(within(batchRow).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /批量撤销/ }));
    expect(mutationCalls.filter((call) => call.url === '/api/role/batch/revoke')).toHaveLength(0);
    await waitFor(() => expect(openDialog()).toBeTruthy());
    dialog = openDialog();
    expect(within(dialog).getByText('请核对以下 1 项授权内容，确认后立即生效')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销', hidden: true }));
    await waitFor(() => expect(mutationCalls).toContainEqual({ url: '/api/role/batch/revoke', body: { ids: [10] } }));
    await waitFor(() => expect(listCalls).toBe(4));
  });
});

test('grant-management user search requests the first 100 non-super-admin users', async () => {
  const userListBodies: Record<string, unknown>[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/role/list') return response({ total: 0, items: [] });
    if (url === '/api/user/list') {
      userListBodies.push(body(init));
      return response({ total: 0, items: [] });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  render(() => <GrantManagementPage navigate={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /全部用户/ }));
  await waitFor(() => expect(userListBodies).toHaveLength(1));
  expect(userListBodies[0]).toEqual({ page_no: 1, page_size: 100, super_admin: false });
});

test('grant-management rejects malformed resource IDs instead of silently dropping them', async () => {
  let listCalls = 0;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/role/list') {
      listCalls += 1;
      return response({ total: 0, items: [] });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  render(() => <GrantManagementPage navigate={() => undefined} />);
  await waitFor(() => expect(listCalls).toBe(1));
  fireEvent.input(screen.getByRole('textbox', { name: '资源 ID' }), { target: { value: '1,abc,2' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));

  expect(await screen.findByText('资源 ID 必须是用逗号分隔的正整数')).toBeTruthy();
  expect(listCalls).toBe(1);
});
