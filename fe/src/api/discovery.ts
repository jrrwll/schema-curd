import type { PageRequest, PageResult } from '../types/common';
import type { DiscoveryDatasourceItem, DiscoveryTableItem } from '../types/discovery';
import { request } from './client';

export function getDiscoveryDatasources(body: {
  datasource?: string;
  keyword?: string;
}) {
  return request<DiscoveryDatasourceItem[]>('/api/discovery/datasource/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getDiscoveryDatasourcePage(body: PageRequest & { keyword?: string }): Promise<PageResult<DiscoveryDatasourceItem>> {
  const items = await getDiscoveryDatasources({ keyword: body.keyword });
  const start = (body.page_no - 1) * body.page_size;
  return { total: items.length, items: items.slice(start, start + body.page_size) };
}

export function getDiscoveryTables(body: {
  datasource_id?: number;
  table_id?: number;
  keyword?: string;
}) {
  return request<DiscoveryTableItem[]>('/api/discovery/table/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
