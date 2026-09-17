import type { PageResult } from '../types/common';
import type {
  DatasourceCreateInput,
  DatasourceDetail,
  DatasourceFilters,
  DatasourceRecord,
  DatasourceUpdateInput,
} from '../types/datasource';
import { request } from './client';

export function getDatasources(body: DatasourceFilters) {
  return request<PageResult<DatasourceRecord>>('/api/datasource/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getDatasourceDetail(id: number) {
  return request<DatasourceDetail>(`/api/datasource/detail?id=${id}`);
}

/** Resolves legacy name-based routes before using the ID-only detail endpoint. */
export async function getDatasourceDetailByName(name: string) {
  const page = await getDatasources({ name, page_no: 1, page_size: 20 });
  const datasource = page.items.find((item) => item.name === name);
  if (!datasource) throw new Error(`未找到数据源：${name}`);
  return getDatasourceDetail(datasource.id);
}

export function createDatasource(body: DatasourceCreateInput) {
  return request<void>('/api/datasource/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDatasource(body: DatasourceUpdateInput) {
  return request<void>('/api/datasource/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteDatasource(name: string) {
  return request<void>('/api/datasource/delete', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
