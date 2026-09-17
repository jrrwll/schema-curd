import type { PageResult, Row } from '../types/common';
import type { ListEntityRequest, WriteEntityRequest } from '../types/entity';
import { request } from './client';

export function getEntities(body: ListEntityRequest) {
  return request<PageResult<Row>>('/api/entity/list', {
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
