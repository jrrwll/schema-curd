import type {
  ColumnMetadataConfig,
  ColumnMetadataRecord,
  PhysicalColumnListResult,
} from '../types';
import { request } from './client';

interface ColumnOwner {
  datasource: string;
  table: string;
}

export function getColumnMetadata(owner: ColumnOwner) {
  return request<ColumnMetadataRecord[]>('/api/column/list', {
    method: 'POST',
    body: JSON.stringify(owner),
  });
}

export function getPhysicalColumns(owner: ColumnOwner) {
  return request<PhysicalColumnListResult>('/api/column/physical/list', {
    method: 'POST',
    body: JSON.stringify(owner),
  });
}

export function refreshPhysicalColumns(owner: ColumnOwner) {
  return request<PhysicalColumnListResult>('/api/column/physical/refresh', {
    method: 'POST',
    body: JSON.stringify(owner),
  });
}

export function createColumnMetadata(
  body: ColumnOwner & {
    name: string;
    display_name: string;
    is_primary_key: boolean;
    config: ColumnMetadataConfig;
  },
) {
  return request<{ id: number }>('/api/column/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function batchCreateColumnMetadata(
  body: ColumnOwner & {
    columns: Array<{
      name: string;
      display_name: string;
      data_type: ColumnMetadataConfig['data_type'];
      optional: boolean;
      is_primary_key: boolean;
    }>;
  },
) {
  return request<void>('/api/column/batch/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateColumnMetadata(
  body: ColumnOwner & {
    id: number;
    display_name: string;
    is_primary_key: boolean;
    config: ColumnMetadataConfig;
  },
) {
  return request<void>('/api/column/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteColumnMetadata(body: ColumnOwner & { id: number }) {
  return request<void>('/api/column/delete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
