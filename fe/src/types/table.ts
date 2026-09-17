import type { PageRequest, Value } from './common';
import type { EffectiveRole } from './role';

export type DataType = 'text' | 'int' | 'float' | 'bool' | 'json';

export interface ColumnConfig {
  name: string;
  display_name: string;
  data_type: DataType;
  optional: boolean;
  pattern?: string;
}

export interface OrderByConfig { sort: string; desc: boolean; }
export type FilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'not like' | 'in' | 'not in';

export interface FixedWhereConfig {
  column: string;
  operator: FilterOperator;
  value: Value | Value[];
}

export interface TableConfig {
  readonly: boolean;
  primary_keys: string[];
  sortable_columns: string[];
  search_default_value: Record<string, Value>;
  insert_fixed_values: Record<string, Value>;
  select_fixed_where: FixedWhereConfig[];
  default_order_by: OrderByConfig[];
}

export interface TableMetadataListRecord {
  id: number;
  created_at: string;
  updated_at: string;
  datasource: string;
  name: string;
  display_name: string;
  disabled: boolean;
  effective_role: EffectiveRole;
}

export interface TableMetadataDetailRecord extends TableMetadataListRecord {
  datasource_id: number;
  datasource_display_name: string;
  table_name: string;
  table_config: TableConfig;
  columns_config: ColumnConfig[];
}

export interface TableMetadataFilters extends PageRequest {
  datasource: string;
  name?: string;
  display_name?: string;
  disabled?: boolean;
}

export interface TableMetadataCreateInput {
  datasource: string;
  name: string;
  display_name: string;
  table_name: string;
  table_config: TableConfig;
  columns_config: ColumnConfig[];
}

export interface TableMetadataUpdateInput {
  id: number;
  display_name: string;
  table_config: TableConfig;
  columns_config: ColumnConfig[];
}
