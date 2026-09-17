import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';
import DatasourcePage from '../src/pages/DatasourcePage';
import TableWorkspacePage from '../src/pages/TableWorkspacePage';
import UserPage from '../src/pages/UserPage';

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(status === 200 ? { code: '0', data } : { code: 'error', msg: data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => vi.restoreAllMocks());

describe('resource error rendering', () => {
  test('list pages render request errors without reading a failed resource', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/datasource/list') return response('数据源加载失败', 500);
      if (url === '/api/user/list') return response('用户加载失败', 500);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const datasourceView = render(() => <DatasourcePage canCreate canDelete navigate={() => undefined} />);
    expect(await screen.findByText('数据源加载失败')).toBeTruthy();
    expect(screen.queryByText('暂无数据源')).toBeNull();
    datasourceView.unmount();

    render(() => <UserPage currentUserId={1} navigate={() => undefined} />);
    expect(await screen.findByText('用户加载失败')).toBeTruthy();
    expect(screen.queryByText('暂无用户')).toBeNull();
  });

  test('table metadata clears the previous datasource while the next route is loading', async () => {
    const archive = deferred<Response>();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/discovery/datasource/list') {
        const body = JSON.parse(String(init?.body)) as { datasource: string };
        if (body.datasource === 'warehouse') return response([{ id: 1, name: 'warehouse', display_name: '生产仓库' }]);
        return archive.promise;
      }
      if (url === '/api/datasource/detail?id=1') return response({ id: 1, name: 'warehouse', display_name: '生产仓库', effective_role: 'write' });
      if (url === '/api/datasource/detail?id=3') return response({ id: 3, name: 'archive', display_name: '归档仓库', effective_role: 'write' });
      if (url === '/api/table/list') {
        const body = JSON.parse(String(init?.body)) as { datasource: string };
        return response(body.datasource === 'warehouse'
          ? { total: 1, items: [{ id: 2, name: 'orders', display_name: '订单', created_at: '', updated_at: '', datasource: 'warehouse', disabled: false, effective_role: 'write' }] }
          : { total: 0, items: [] });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const { createSignal } = await import('solid-js');
    const [datasource, setDatasource] = createSignal<string | null>('warehouse');
    render(() => <TableWorkspacePage datasource={datasource()} canGrant navigate={() => undefined} />);
    expect(await screen.findByText('订单')).toBeTruthy();

    setDatasource('archive');
    await waitFor(() => expect(screen.queryByText('订单')).toBeNull());
    expect(screen.getByText('请选择数据源后管理数据表')).toBeTruthy();
    archive.resolve(response([{ id: 3, name: 'archive', display_name: '归档仓库' }]));
    expect(await screen.findByText('归档仓库')).toBeTruthy();
  });

  test('keeps a successful delete distinct from a failed list refresh', async () => {
    let listCalls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/datasource/list') {
        listCalls += 1;
        return listCalls === 1
          ? response({ total: 1, items: [{ id: 1, name: 'warehouse', display_name: '生产仓库', created_at: '', updated_at: '', effective_role: 'write' }] })
          : response('列表刷新失败', 500);
      }
      if (url === '/api/datasource/delete') return response(null);
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <DatasourcePage canCreate canDelete navigate={() => undefined} />);
    const card = (await screen.findByText('生产仓库')).closest('article');
    if (!card) throw new Error('Expected datasource card');
    fireEvent.click(within(card).getByTitle('删除数据源'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }));

    expect(await screen.findByText('数据源已删除')).toBeTruthy();
    expect(await screen.findByText('列表刷新失败')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
