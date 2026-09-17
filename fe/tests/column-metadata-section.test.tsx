import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import ColumnMetadataSection, { validateColumnConfigs } from '../src/components/ColumnMetadataSection';
import type { ColumnConfig } from '../src/types/table';

const column: ColumnConfig = {
  name: 'secret',
  display_name: '敏感信息',
  data_type: 'text',
  optional: true,
};

function renderSection(initial: ColumnConfig[] = [column], referencedColumns?: ReadonlySet<string>) {
  const onChange = vi.fn();
  const [columns, setColumns] = createSignal(initial);
  const view = render(() => (
    <ColumnMetadataSection
      columns={columns()}
      referencedColumns={referencedColumns}
      canInspectPhysical={false}
      onChange={(next) => { onChange(next); setColumns(next); }}
    />
  ));
  return { ...view, columns, onChange };
}

describe('inline column metadata editing', () => {
  test('keeps the physical name disabled and edits the other fields inline', async () => {
    const { columns } = renderSection([{ ...column, optional: false }]);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByRole('textbox', { name: '数据列 1 名称' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('textbox', { name: '数据列 1 名称' }).getAttribute('title')).toBe('物理列名不可修改');
    fireEvent.input(screen.getByRole('textbox', { name: '数据列 1 展示名称' }), { target: { value: '编码' } });
    fireEvent.change(screen.getByRole('combobox', { name: '数据列 1 数据类型' }), { target: { value: 'int' } });
    fireEvent.click(screen.getByText('必填'));
    await screen.findByText('可选');
    fireEvent.input(screen.getByRole('textbox', { name: '数据列 1 正则校验' }), { target: { value: '\\d+' } });

    await waitFor(() => expect(columns()).toEqual([{
      name: 'secret', display_name: '编码', data_type: 'int', optional: true, pattern: '\\d+',
    }]));
  });

  test('shows invalid regex inline and rejects invalid or duplicate configurations', async () => {
    renderSection([column]);

    fireEvent.input(screen.getByRole('textbox', { name: '数据列 1 正则校验' }), { target: { value: '[' } });
    expect(await screen.findByText('正则表达式不合法')).toBeTruthy();

    expect(() => validateColumnConfigs([
      { ...column, name: 'other', pattern: '[' },
      { ...column, name: 'other' },
    ])).toThrow();
  });

  test('prevents deleting columns referenced by logical advanced settings', () => {
    const { columns, onChange } = renderSection([column], new Set(['secret']));

    const deleteButton = screen.getByTitle('该列已被高级设置引用') as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);
    expect(columns()).toEqual([column]);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('syncs physical columns using only the five column fields', async () => {
    const onChange = vi.fn();
    const [columns, setColumns] = createSignal<ColumnConfig[]>([]);
    const loadPhysicalColumns = vi.fn(async () => [{
      name: 'id', comment: '编号', data_type: 'int' as const, optional: false, primary_key: true,
    }]);
    render(() => (
      <ColumnMetadataSection
        columns={columns()}
        canInspectPhysical
        loadPhysicalColumns={loadPhysicalColumns}
        onChange={(next) => { onChange(next); setColumns(next); }}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: '同步物理列' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(columns()).toEqual([{ name: 'id', display_name: '编号', data_type: 'int', optional: false }]);
  });
});
