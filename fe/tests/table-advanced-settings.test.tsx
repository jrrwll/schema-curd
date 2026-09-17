import { render, screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';
import TableAdvancedSettings from '../src/components/TableAdvancedSettings';
import type { TableAdvancedFormValue } from '../src/components/tableAdvancedConfig';

const value: TableAdvancedFormValue = {
  primary_keys: ['tenant_id'],
  readonly: false,
  sortable_columns: ['id'],
  search_default_value: [{ id: 1, column: 'id', value: '1' }],
  fixed_value: [{ id: 2, column: 'tenant_id', value: '7' }],
  fixed_where: [{ id: 3, column: 'tenant_id', operator: '=', values: ['7'] }],
  default_order_by: [{ id: 4, sort: 'tenant_id', order: 'asc' }],
};

function optionValues(select: HTMLSelectElement) {
  return Array.from(select.options, (option) => option.value);
}

describe('table advanced setting column sources', () => {
  test('uses physical columns for physical rules and columns_config for logical rules', () => {
    render(() => (
      <TableAdvancedSettings
        value={value}
        physicalColumns={[
          { name: 'id', data_type: 'int', optional: false },
          { name: 'tenant_id', data_type: 'int', optional: false },
        ]}
        logicalColumns={[{ name: 'id', data_type: 'int', optional: false }]}
        onChange={() => undefined}
      />
    ));

    expect(optionValues(screen.getByRole('combobox', { name: '主键数据列' }))).toContain('tenant_id');
    expect(optionValues(screen.getByRole('combobox', { name: '固定值数据列' }))).toContain('tenant_id');
    expect(optionValues(screen.getByRole('combobox', { name: '条件数据列' }))).toContain('tenant_id');
    expect(optionValues(screen.getByRole('combobox', { name: '排序数据列' }))).toContain('tenant_id');
    expect(optionValues(screen.getByRole('combobox', { name: '可排序数据列' }))).not.toContain('tenant_id');
    expect(optionValues(screen.getByRole('combobox', { name: '默认搜索数据列' }))).not.toContain('tenant_id');
  });
});
