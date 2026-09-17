import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';
import CreatePage from '../src/pages/CreatePage';
import UserCreatePage from '../src/pages/UserCreatePage';
import TableMetadataUpdatePage from '../src/pages/TableMetadataUpdatePage';
import UserUpdatePage from '../src/pages/UserUpdatePage';
import { valuesEqual } from '../src/pages/entity/entityValues';
import type { EntityTableView } from '../src/types/entity';

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

const entityTable: EntityTableView = {
  id: 2,
  name: 'users',
  display_name: '用户数据',
  search_default_value: {},
  insert_fixed_values: {},
  columns: [
    { name: 'id', display_name: '编号', data_type: 'int', optional: false, sortable: true, primary_key: true, is_json: false },
    { name: 'name', display_name: '姓名', data_type: 'text', optional: false, sortable: true, primary_key: false, is_json: false },
  ],
};

const tableDetail = {
  id: 2,
  created_at: '',
  updated_at: '',
  datasource: 'warehouse',
  datasource_id: 1,
  datasource_display_name: '生产仓库',
  name: 'users',
  display_name: '用户数据',
  disabled: false,
  effective_role: 'write' as const,
  table_name: 'users',
  table_config: { readonly: false, primary_keys: ['id'], sortable_columns: ['id', 'name'], search_default_value: {}, insert_fixed_values: {}, select_fixed_where: [], default_order_by: [] },
  columns_config: [
    { name: 'id', display_name: '编号', data_type: 'int' as const, optional: false },
    { name: 'name', display_name: '姓名', data_type: 'text' as const, optional: false },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('form submission state', () => {
  test('keeps null distinct from false for optional booleans', async () => {
    expect(valuesEqual({
      name: 'archived', display_name: '归档', data_type: 'bool', optional: true,
    }, null, false)).toBe(false);

    let submitted: { columns: Record<string, unknown> } | undefined;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== '/api/entity/create') throw new Error(`Unexpected request: ${String(input)}`);
      submitted = JSON.parse(String(init?.body)) as { columns: Record<string, unknown> };
      return response(null);
    }) as typeof fetch;
    const table: EntityTableView = {
      ...entityTable,
      columns: [...entityTable.columns, {
        name: 'archived', display_name: '归档', data_type: 'bool', optional: true, sortable: false,
        primary_key: false, is_json: false,
      }],
    };
    render(() => <CreatePage datasource="warehouse" table={table} navigate={() => undefined} />);
    const archived = screen.getByRole('combobox', { name: /归档/ }) as HTMLSelectElement;
    expect(archived.value).toBe('');
    fireEvent.input(screen.getByRole('textbox', { name: /姓名/ }), { target: { value: 'Alice' } });
    fireEvent.change(archived, { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => expect(submitted?.columns.archived).toBe(false));
  });

  test('does not render or submit columns configured in insert_fixed_values', async () => {
    let submitted: { columns: Record<string, unknown> } | undefined;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== '/api/entity/create') throw new Error(`Unexpected request: ${String(input)}`);
      submitted = JSON.parse(String(init?.body)) as { columns: Record<string, unknown> };
      return response(null);
    }) as typeof fetch;
    const table: EntityTableView = {
      ...entityTable,
      insert_fixed_values: { tenant_id: 7 },
      columns: [...entityTable.columns, {
        name: 'tenant_id', display_name: '租户', data_type: 'int', optional: false, sortable: false,
        primary_key: false, is_json: false,
      }],
    };

    render(() => <CreatePage datasource="warehouse" table={table} navigate={() => undefined} />);
    expect(screen.queryByRole('spinbutton', { name: /租户/ })).toBeNull();
    fireEvent.input(screen.getByRole('textbox', { name: /姓名/ }), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => expect(submitted?.columns).toEqual({ name: 'Alice' }));
  });

  test('rejects invalid JSON in a new entity before submitting', async () => {
    const create = vi.fn();
    globalThis.fetch = create as typeof fetch;
    const table: EntityTableView = {
      ...entityTable,
      columns: [...entityTable.columns, {
        name: 'profile', display_name: '配置', data_type: 'json', optional: false, sortable: false,
        primary_key: false, is_json: true,
      }],
    };
    const view = render(() => <CreatePage datasource="warehouse" table={table} navigate={() => undefined} />);
    fireEvent.input(screen.getByRole('textbox', { name: /配置/ }), { target: { value: '{invalid' } });
    fireEvent.submit(view.container.querySelector('form')!);

    expect(await screen.findByText('Field 配置 must be valid JSON')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  test('does not navigate after a submitted page has been unmounted', async () => {
    const create = deferred<Response>();
    const navigate = vi.fn();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/user/create') return create.promise;
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    const view = render(() => <UserCreatePage navigate={navigate} />);
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Expected user form');
    fireEvent.submit(form);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    view.unmount();

    create.resolve(response(null));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(navigate).not.toHaveBeenCalled();
  });

  test('freezes entity create inputs while the request is pending', async () => {
    const create = deferred<Response>();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/entity/create') return create.promise;
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    const view = render(() => <CreatePage datasource="warehouse" table={entityTable} navigate={() => undefined} />);
    const input = screen.getByRole('textbox', { name: /姓名/ }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));

    const fieldset = view.container.querySelector<HTMLFieldSetElement>('.form-disabled-scope');
    await waitFor(() => expect(fieldset?.disabled).toBe(true));

    create.resolve(response(null));
    await waitFor(() => expect(fieldset?.disabled).toBe(false));
  });

  test('normalizes table edit datasource and freezes the whole form while saving', async () => {
    const update = deferred<Response>();
    const navigate = vi.fn();
    let detailCalls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/table/detail?id=2') { detailCalls += 1; return response(tableDetail); }
      if (url === '/api/table/update') return update.promise;
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const view = render(() => <TableMetadataUpdatePage tableId={2} datasource="archive" navigate={navigate} />);
    await screen.findByDisplayValue('用户数据');
    expect(navigate).toHaveBeenCalledWith('/meta/table/update?datasource=warehouse&table=2', true);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    const fieldset = view.container.querySelector<HTMLFieldSetElement>('.form-disabled-scope');
    await waitFor(() => expect(fieldset?.disabled).toBe(true));

    update.resolve(response(null));
    await screen.findByText('表配置已保存');
    await waitFor(() => expect(view.container.querySelector<HTMLFieldSetElement>('.form-disabled-scope')?.disabled).toBe(false));
    expect(detailCalls).toBe(1);
  });

  test('drops legacy column-level settings at table save boundary', async () => {
    let submitted: { columns_config: Array<Record<string, unknown>> } | undefined;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/table/detail?id=2') {
        return response({
          ...tableDetail,
          columns_config: [
            tableDetail.columns_config[0],
            { ...tableDetail.columns_config[1], hidden_on_list: true, search_default_value: 'legacy' },
          ],
        });
      }
      if (url === '/api/table/update') {
        submitted = JSON.parse(String(init?.body)) as { columns_config: Array<Record<string, unknown>> };
        return response(null);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    render(() => <TableMetadataUpdatePage tableId={2} datasource="warehouse" navigate={() => undefined} />);
    await screen.findByDisplayValue('用户数据');
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(submitted).toBeTruthy());
    expect(submitted?.columns_config[1]).not.toHaveProperty('search_default_value');
    expect(submitted?.columns_config[1]).not.toHaveProperty('hidden_on_list');
  });
});

describe('user update hydration', () => {
  test('loads the display name from user detail instead of the URL', async () => {
    window.history.replaceState({}, '', '/user/update?user=2&display_name=%E4%BC%AA%E9%80%A0%E5%90%8D%E7%A7%B0');
    const navigate = vi.fn();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/user/detail?id=2') {
        return response({ id: 2, name: 'tester', display_name: '真实名称', super_admin: false });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    render(() => <UserUpdatePage id={2} navigate={navigate} />);

    expect(await screen.findByDisplayValue('真实名称')).toBeTruthy();
    expect(screen.queryByDisplayValue('伪造名称')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/user/update?user=2', true);
  });

  test('freezes the complete user form while saving', async () => {
    const update = deferred<Response>();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/user/detail?id=2') return response({ id: 2, name: 'tester', display_name: '测试用户', super_admin: false });
      if (String(input) === '/api/user/update') return update.promise;
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    const view = render(() => <UserUpdatePage id={2} navigate={() => undefined} />);
    await screen.findByDisplayValue('测试用户');
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    const fieldset = view.container.querySelector<HTMLFieldSetElement>('.form-disabled-scope');
    await waitFor(() => expect(fieldset?.disabled).toBe(true));
    update.resolve(response(null));
    await waitFor(() => expect(fieldset?.disabled).toBe(false));
  });
});
