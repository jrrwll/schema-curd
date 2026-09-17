import type {
  DatasourceConnectionTestInput,
  DatasourceConnectionTestResult,
  PhysicalColumnItem,
  PhysicalTableItem,
} from '../types/physical';
import { request } from './client';

export function testDatasourceConnection(body: DatasourceConnectionTestInput) {
  return request<DatasourceConnectionTestResult>('/api/physical/connection/test', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getPhysicalTables(datasource: string) {
  return request<PhysicalTableItem[]>('/api/physical/table/list', {
    method: 'POST',
    body: JSON.stringify({ datasource }),
  });
}

export function refreshPhysicalTables(datasource: string) {
  return request<PhysicalTableItem[]>('/api/physical/table/refresh', {
    method: 'POST',
    body: JSON.stringify({ datasource }),
  });
}

export function getPhysicalColumns(body: { table_id: number } | { datasource: string; table: string }) {
  return request<PhysicalColumnItem[]>('/api/physical/column/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function refreshPhysicalColumns(body: { table_id: number } | { datasource: string; table: string }) {
  return request<PhysicalColumnItem[]>('/api/physical/column/refresh', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
