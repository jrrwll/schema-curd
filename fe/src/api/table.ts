import type {
  TableMetadataDetailRecord,
  TableMetadataFilters,
  TableMetadataInput,
  TableMetadataListRecord,
  PhysicalTableListResult,
} from '../types';
import { request } from './client';

export function getTableMetadata(filters: TableMetadataFilters) {
  return request<TableMetadataListRecord[]>('/api/table/list', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

export function getTableMetadataDetail(body: { id: number; datasource: string }) {
  return request<TableMetadataDetailRecord>('/api/table/detail', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getPhysicalTables(datasource: string) {
  return request<PhysicalTableListResult>('/api/table/physical/list', {
    method: 'POST',
    body: JSON.stringify({ datasource }),
  });
}

export function refreshPhysicalTables(datasource: string) {
  return request<PhysicalTableListResult>('/api/table/physical/refresh', {
    method: 'POST',
    body: JSON.stringify({ datasource }),
  });
}

export function createTableMetadata(body: TableMetadataInput) {
  return request<{ id: number }>('/api/table/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTableMetadata(body: Omit<TableMetadataInput, 'name'> & { id: number }) {
  return request<void>('/api/table/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function publishTableMetadata(body: { id: number; datasource: string }) {
  return request<void>('/api/table/publish', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteTableMetadata(body: { id: number; datasource: string }) {
  return request<void>('/api/table/delete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
