import type { DataType } from './table';

export interface PhysicalColumnItem {
  name: string;
  comment: string;
  data_type: DataType;
  optional: boolean;
  primary_key: boolean;
}

export interface PhysicalTableItem { name: string; comment: string; }

export interface DatasourceConnectionTestInput {
  id?: number;
  url: string;
  username: string;
  password?: string;
}

export interface DatasourceConnectionTestResult {
  database_type: 'mysql' | 'postgresql';
  version: string;
  database: string;
  cost_ms: number;
}
