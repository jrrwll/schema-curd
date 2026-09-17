import type { Row, Value } from '../../types/common';
import type { EntityColumnConfig } from '../../types/entity';
import type { ColumnConfig } from '../../types/table';

export interface FieldDiff {
  column: ColumnConfig;
  before: Value | undefined;
  after: Value | undefined;
}

export function inputValue(value: Value | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export function inputValueForColumn(column: ColumnConfig, value: string): Value {
  return (column.data_type === 'int' || column.data_type === 'float') && value !== ''
    ? Number(value)
    : value;
}

export function booleanValue(value: Value | undefined): boolean | null {
  return value === null || value === undefined ? null : Boolean(value);
}

export function valuesEqual(
  column: ColumnConfig,
  before: Value | undefined,
  after: Value | undefined,
): boolean {
  if (column.data_type === 'bool') return booleanValue(before) === booleanValue(after);
  return inputValue(before) === inputValue(after);
}

export function displayValue(column: ColumnConfig, value: Value | undefined): string {
  if (value === null || value === undefined || value === '') return '空值';
  if (column.data_type === 'bool') return Boolean(value) ? '是' : '否';
  return String(value);
}

export function entityRowDiff(columns: EntityColumnConfig[], before?: Row, after?: Row): FieldDiff[] {
  if (!before || !after) return [];
  return columns
    .filter((column) => !column.primary_key && !valuesEqual(column, before[column.name], after[column.name]))
    .map((column) => ({ column, before: before[column.name], after: after[column.name] }));
}

export function entityRowIdentity(columns: EntityColumnConfig[], row?: Row): string {
  if (!row) return '';
  return columns
    .filter((column) => column.primary_key)
    .map((column) => `${column.display_name}: ${displayValue(column, row[column.name])}`)
    .join(' / ');
}

export function validJson(value: Value | undefined): boolean {
  try {
    JSON.parse(String(value ?? ''));
    return true;
  } catch {
    return false;
  }
}
