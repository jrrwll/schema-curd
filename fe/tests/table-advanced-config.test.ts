import { describe, expect, test } from 'vitest';
import {
  buildTableAdvancedConfig,
  clearColumnDependentAdvanced,
  tableAdvancedFormValue,
  tableAdvancedReferencedColumns,
} from '../src/components/tableAdvancedConfig';

const physicalColumns = [
  { name: 'id', data_type: 'int' as const, optional: false },
  { name: 'tenant_id', data_type: 'int' as const, optional: false },
  { name: 'nullable_text', data_type: 'text' as const, optional: true },
  { name: 'empty_text', data_type: 'text' as const, optional: false },
  { name: 'enabled', data_type: 'bool' as const, optional: false },
  { name: 'created_at', data_type: 'text' as const, optional: false },
];

const logicalColumns = physicalColumns.filter((column) => column.name !== 'tenant_id');

describe('table advanced configuration', () => {
  test('round-trips table-level primary keys, sortable columns and search defaults', () => {
    const source = {
      readonly: false,
      primary_keys: ['id'],
      sortable_columns: ['id', 'created_at'],
      search_default_value: { nullable_text: null, enabled: true },
      insert_fixed_values: { tenant_id: 7 },
      select_fixed_where: [{ column: 'enabled', operator: '=' as const, value: true }],
      default_order_by: [{ sort: 'created_at', desc: true }],
    };

    expect(buildTableAdvancedConfig(tableAdvancedFormValue(source), physicalColumns, logicalColumns)).toEqual(source);
  });

  test('allows null only for optional columns in typed table values', () => {
    const form = tableAdvancedFormValue({
      readonly: false,
      primary_keys: ['id'],
      sortable_columns: [],
      search_default_value: { nullable_text: null },
      insert_fixed_values: { nullable_text: null, empty_text: '' },
      select_fixed_where: [
        { column: 'nullable_text', operator: '=' as const, value: null },
        { column: 'empty_text', operator: '=' as const, value: '' },
      ],
      default_order_by: [],
    });

    expect(() => buildTableAdvancedConfig({
      ...form,
      search_default_value: [{ id: 1, column: 'empty_text', value: null }],
    }, physicalColumns, logicalColumns)).toThrow('Field search_default_value.empty_text cannot be NULL');
    expect(() => buildTableAdvancedConfig({
      ...form,
      fixed_value: [{ id: 2, column: 'empty_text', value: null }],
    }, physicalColumns, logicalColumns)).toThrow('Field insert_fixed_values.empty_text cannot be NULL');
    expect(() => buildTableAdvancedConfig({
      ...form,
      fixed_value: [],
      fixed_where: [{ id: 3, column: 'empty_text', operator: '=', values: [null] }],
    }, physicalColumns, logicalColumns)).toThrow('Field select_fixed_where.empty_text cannot be NULL');
  });

  test('rejects missing and duplicate selected columns', () => {
    const form = tableAdvancedFormValue({
      readonly: false,
      primary_keys: ['id'],
      sortable_columns: ['created_at'],
      search_default_value: { enabled: true },
      insert_fixed_values: {},
      select_fixed_where: [],
      default_order_by: [],
    });

    expect(() => buildTableAdvancedConfig({ ...form, primary_keys: ['id', 'id'] }, physicalColumns, logicalColumns)).toThrow('duplicated in primary_keys');
    expect(() => buildTableAdvancedConfig({ ...form, sortable_columns: ['tenant_id'] }, physicalColumns, logicalColumns)).toThrow('sortable_columns must select an existing column');
    expect(() => buildTableAdvancedConfig({
      ...form,
      search_default_value: [
        { id: 1, column: 'enabled', value: 'true' },
        { id: 2, column: 'enabled', value: 'false' },
      ],
    }, physicalColumns, logicalColumns)).toThrow('duplicated in search_default_value');
    expect(() => buildTableAdvancedConfig({
      ...form,
      fixed_value: [
        { id: 3, column: 'tenant_id', value: '1' },
        { id: 4, column: 'tenant_id', value: '2' },
      ],
    }, physicalColumns, logicalColumns)).toThrow('duplicated in insert_fixed_values');
    expect(() => buildTableAdvancedConfig({
      ...form,
      default_order_by: [
        { id: 5, sort: 'created_at', order: 'asc' },
        { id: 6, sort: 'created_at', order: 'desc' },
      ],
    }, physicalColumns, logicalColumns)).toThrow('duplicated in default_order_by');
    expect(() => buildTableAdvancedConfig({
      ...form,
      fixed_where: [
        { id: 7, column: 'enabled', operator: '=', values: ['true'] },
        { id: 8, column: 'enabled', operator: '!=', values: ['false'] },
      ],
    }, physicalColumns, logicalColumns)).not.toThrow();
  });

  test('finds all references and clears only column-dependent settings', () => {
    const form = tableAdvancedFormValue({
      readonly: true,
      primary_keys: ['id'],
      sortable_columns: ['nullable_text'],
      search_default_value: { empty_text: '' },
      insert_fixed_values: { nullable_text: 'fixed' },
      select_fixed_where: [{ column: 'enabled', operator: '=' as const, value: true }],
      default_order_by: [{ sort: 'created_at', desc: true }],
    });

    expect([...tableAdvancedReferencedColumns(form)]).toEqual(['nullable_text', 'empty_text']);
    expect(clearColumnDependentAdvanced(form)).toEqual({
      readonly: true,
      primary_keys: [],
      sortable_columns: [],
      search_default_value: [],
      fixed_value: [],
      fixed_where: [],
      default_order_by: [],
    });
  });
});
