import type {
  DiscoveryDatasourceDetail,
  DiscoveryDatasourceItem,
  DiscoveryTableItem,
  PageResult,
  ResourceCandidate,
  ResourceType,
} from '../types';
import { request } from './client';

export function getDiscoveryDatasources(body: {
  keyword?: string;
  page_no: number;
  page_size: number;
}) {
  return request<PageResult<DiscoveryDatasourceItem>>('/api/discovery/datasource/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getDiscoveryResourceCandidates(body: {
  resource_type: Exclude<ResourceType, '*'>;
  keyword?: string;
  page_no: number;
  page_size: number;
}) {
  return request<PageResult<ResourceCandidate>>('/api/discovery/resource/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getDiscoveryDatasourceDetail(datasource: number) {
  return request<DiscoveryDatasourceDetail>('/api/discovery/datasource/detail', {
    method: 'POST',
    body: JSON.stringify({ datasource }),
  });
}

export function getDiscoveryTables(body: {
  datasource: number;
  keyword?: string;
  page_no: number;
  page_size: number;
}) {
  return request<PageResult<DiscoveryTableItem>>('/api/discovery/table/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
