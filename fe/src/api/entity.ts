import type {
  OrderByConfig,
  Row,
  Value,
} from '../types';
import { request } from './client';

interface EntityRequest {
  datasource: string;
  table: string;
}

interface ListEntityRequest extends EntityRequest {
  page_no: number;
  page_size: number;
  condition: Record<string, Value>;
  order_by: OrderByConfig | null;
}

interface WriteEntityRequest extends EntityRequest {
  columns: Row;
}

export function getEntities(body: ListEntityRequest) {
  return request<{ total: number; items: Row[] }>('/api/entity/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateEntity(body: WriteEntityRequest) {
  return request<{ affected: number }>('/api/entity/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function createEntity(body: WriteEntityRequest) {
  return request<void>('/api/entity/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
