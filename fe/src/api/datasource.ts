import type {
  DatasourceFilters,
  DatasourceDetail,
  DatasourceConnectionTestResult,
  DatasourceInput,
  DatasourceRecord,
  DatasourceSummary,
} from '../types';
import { request } from './client';

export function getDatasources(filters: DatasourceFilters = {}) {
  return request<DatasourceRecord[]>('/api/datasource/list', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

export function getDatasourceDetail(id: number) {
  return request<DatasourceDetail>('/api/datasource/detail', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function getDatasourceSummary(id: number) {
  return request<DatasourceSummary>('/api/datasource/summary', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function createDatasource(body: DatasourceInput) {
  return request<void>('/api/datasource/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function testDatasourceConnection(body: Pick<DatasourceInput, 'url' | 'username' | 'password'> & { id?: number }) {
  return request<DatasourceConnectionTestResult>('/api/datasource/test', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDatasource(body: Omit<DatasourceInput, 'name'> & { id: number }) {
  return request<void>('/api/datasource/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteDatasource(id: number) {
  return request<void>('/api/datasource/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}
