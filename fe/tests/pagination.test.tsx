import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import { afterEach, describe, expect, test, vi } from 'vitest';
import RoleGrantTable from '../src/components/role/RoleGrantTable';
import { clampPage, lastPage } from '../src/pagination';

function response(data: unknown) {
  return new Response(JSON.stringify({ code: '0', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function body(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

afterEach(() => vi.restoreAllMocks());

describe('pagination bounds', () => {
  test('calculates and clamps the last available page', () => {
    expect(lastPage(0, 20)).toBe(1);
    expect(lastPage(21, 20)).toBe(2);
    expect(clampPage(3, 20, 20)).toBe(1);
  });

  test('returns to the previous page after revoking the last grant on the last page', async () => {
    const requestedPages: number[] = [];
    let revoked = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/role/revoke') {
        revoked = true;
        return response(null);
      }
      if (url !== '/api/role/list') throw new Error(`Unexpected request: ${url}`);
      const page = Number(body(init).page_no);
      requestedPages.push(page);
      if (!revoked && page === 1) return response({ total: 21, items: [] });
      if (page === 2 && !revoked) return response({
        total: 21,
        items: [{
          id: 21,
          created_at: '2026-09-14T10:00:00',
          user_id: 2,
          user_name: 'tester',
          user_display_name: '测试用户',
          user_disabled: false,
          role: 'read',
          resource_type: 'datasource',
          resource_id: 4,
          resource_name: '生产仓库',
        }],
      });
      return response({ total: 20, items: [] });
    }) as typeof fetch;

    render(() => <RoleGrantTable query={{ page_no: 1, page_size: 20 }} />);
    const secondPage = await screen.findByRole('button', { name: /第 2 页/ });
    fireEvent.click(secondPage);
    await screen.findByText('测试用户');
    fireEvent.click(screen.getByTitle('撤销授权'));
    const dialog = (await screen.findAllByRole('dialog', { hidden: true })).find((item) => item.getAttribute('data-state') === 'open');
    if (!dialog) throw new Error('Expected revoke confirmation dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销', hidden: true }));

    await waitFor(() => expect(requestedPages.slice(-2)).toEqual([2, 1]));
  });
});
