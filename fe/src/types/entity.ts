import type { Row, Value } from './common';
import type { ColumnConfig, OrderByConfig } from './table';

export interface EntityColumnConfig extends ColumnConfig { primary_key: boolean; is_json: boolean; sortable: boolean; }

export interface EntityTableView {
  id: number;
  name: string;
  display_name: string;
  search_default_value: Record<string, Value>;
  insert_fixed_values: Record<string, Value>;
  columns: EntityColumnConfig[];
}

export interface ListEntityRequest {
  table_id: number;
  page_no: number;
  page_size: number;
  condition: Record<string, Value>;
  order_by: OrderByConfig | null;
}

export interface WriteEntityRequest { table_id: number; columns: Row; }
