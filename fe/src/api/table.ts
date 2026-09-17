import type {
  TableMetadataCreateInput,
  TableMetadataDetailRecord,
  TableMetadataFilters,
  TableMetadataListRecord,
  TableMetadataUpdateInput,
} from '../types/table';
import type { PageResult } from '../types/common';
import { request } from './client';

export function getTableMetadata(body: TableMetadataFilters) {
  return request<PageResult<TableMetadataListRecord>>('/api/table/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getTableMetadataDetail(id: number) {
  return request<TableMetadataDetailRecord>(`/api/table/detail?id=${encodeURIComponent(id)}`);
}

export function createTableMetadata(body: TableMetadataCreateInput) {
  return request<void>('/api/table/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTableMetadata(body: TableMetadataUpdateInput) {
  return request<void>('/api/table/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteTableMetadata(id: number) {
  return request<void>('/api/table/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}
