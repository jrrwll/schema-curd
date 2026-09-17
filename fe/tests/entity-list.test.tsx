import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ListPage from '../src/pages/ListPage';
import type { EntityTableView } from '../src/types/entity';

const table: EntityTableView = {
  id: 2,
  name: 'users',
  display_name: '用户数据',
  search_default_value: {},
  insert_fixed_values: {},
  columns: [
    { name: 'id', display_name: '编号', data_type: 'int', optional: false, sortable: true, primary_key: true, is_json: false },
    { name: 'name', display_name: '姓名', data_type: 'text', optional: false, sortable: true, primary_key: false, is_json: false },
    { name: 'enabled', display_name: '启用', data_type: 'bool', optional: false, sortable: false, primary_key: false, is_json: false },
  ],
};

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'confirm');
});

describe('entity list edit protection', () => {
  test('clears stale rows when a new list request fails', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== '/api/entity/list') throw new Error(`Unexpected request: ${String(input)}`);
      const request = JSON.parse(String(init?.body)) as { condition?: Record<string, unknown> };
      if (request.condition?.name === 'Bob') throw new Error('列表加载失败');
      return response({ total: 1, items: [{ id: 1, name: 'Alice', enabled: true }] });
    }) as typeof fetch;

    render(() => <ListPage canWrite datasource="warehouse" table={table} navigate={() => undefined} />);
    expect(await screen.findByDisplayValue('Alice')).toBeTruthy();

    fireEvent.input(screen.getByPlaceholderText('模糊搜索'), { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));

    expect(await screen.findByText('列表加载失败')).toBeTruthy();
    expect(screen.queryByDisplayValue('Alice')).toBeNull();
    expect(screen.getByText('暂无数据')).toBeTruthy();
  });

  test('discards inline edits without confirmation when pagination changes', async () => {
    const listRequests: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      listRequests.push(request);
      return response({ total: 21, items: [{ id: 1, name: 'Alice', enabled: true }] });
    }) as typeof fetch;
    const confirm = vi.fn(() => false);
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirm });

    render(() => <ListPage canWrite datasource="warehouse" table={table} navigate={() => undefined} />);
    const input = await screen.findByDisplayValue('Alice');
    fireEvent.input(input, { target: { value: 'Edited' } });
    await waitFor(() => expect((screen.getByRole('button', { name: '更新' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole('combobox', { name: /每页/ }), { target: { value: '10' } });

    await waitFor(() => expect(listRequests.some((request) => request.page_size === 10)).toBe(true));
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByDisplayValue('Alice')).toBeTruthy();
  });

  test('freezes inline controls and submits an immutable row snapshot', async () => {
    const update = deferred<Response>();
    const updateBodies: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/entity/list') return response({ total: 1, items: [{ id: 1, name: 'Alice', enabled: true }] });
      if (String(input) === '/api/entity/update') {
        updateBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return update.promise;
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    const view = render(() => <ListPage canWrite datasource="warehouse" table={table} navigate={() => undefined} />);
    const input = await screen.findByDisplayValue('Alice') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    const dialog = (await screen.findAllByRole('dialog', { hidden: true })).find((item) => item.getAttribute('data-state') === 'open');
    if (!dialog) throw new Error('Expected update confirmation dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认更新', hidden: true }));

    await waitFor(() => expect(input.disabled).toBe(true));
    expect(view.container.querySelector<HTMLFieldSetElement>('.filter-band fieldset')?.disabled).toBe(true);
    expect(updateBodies).toEqual([{ table_id: 2, columns: { id: 1, name: 'Bob', enabled: true } }]);

    update.resolve(response({ affected: 1 }));
    await waitFor(() => expect(input.disabled).toBe(false));
    expect((screen.getByRole('button', { name: '更新' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByDisplayValue('Bob')).toBeTruthy();
  });

  test('shows entity details as copyable read-only values', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/entity/list') return response({ total: 1, items: [{ id: 1, name: 'Alice', enabled: true }] });
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    render(() => <ListPage canWrite datasource="warehouse" table={table} navigate={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: '详情' }));
    const detail = (await screen.findAllByRole('dialog', { hidden: true })).find((item) => item.textContent?.includes('数据详情'));
    if (!detail) throw new Error('Expected detail dialog');

    expect(within(detail).getByText('Alice')).toBeTruthy();
    expect(within(detail).getAllByTitle('复制值')).toHaveLength(table.columns.length);
    expect(detail.querySelector('input, select, textarea')).toBeNull();
    expect(within(detail).queryByRole('button', { name: '保存', hidden: true })).toBeNull();
  });

  test('reports an entity update with zero affected rows as failed', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/entity/list') return response({ total: 1, items: [{ id: 1, name: 'Alice', enabled: true }] });
      if (String(input) === '/api/entity/update') return response({ affected: 0 });
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    render(() => <ListPage canWrite datasource="warehouse" table={table} navigate={() => undefined} />);
    const input = await screen.findByDisplayValue('Alice') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    const dialog = (await screen.findAllByRole('dialog', { hidden: true })).find((item) => item.getAttribute('data-state') === 'open');
    if (!dialog) throw new Error('Expected update confirmation dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认更新', hidden: true }));

    expect(await screen.findByText('更新失败：记录不存在或已被其他操作移除')).toBeTruthy();
    expect((screen.getByRole('button', { name: '更新' }) as HTMLButtonElement).disabled).toBe(false);
  });

  test('uses table-level search defaults in list requests', async () => {
    const searchTable: EntityTableView = {
      ...table,
      search_default_value: { enabled: true },
    };
    let request: { condition?: Record<string, unknown> } | undefined;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      request = JSON.parse(String(init?.body)) as { condition?: Record<string, unknown> };
      return response({ total: 0, items: [] });
    }) as typeof fetch;

    render(() => <ListPage canWrite datasource="warehouse" table={searchTable} navigate={() => undefined} />);

    await screen.findByText('暂无数据');
    expect(request?.condition).toEqual({ enabled: true });
  });
});
