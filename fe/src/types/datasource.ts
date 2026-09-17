import type { PageRequest } from './common';
import type { EffectiveRole } from './role';

export interface DatasourceConfig { bool_as_int: boolean; }

export interface DatasourceOption {
  id: number;
  name: string;
  display_name: string;
}

export interface DatasourceRecord {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  display_name: string;
  effective_role: Exclude<EffectiveRole, 'none'>;
}

export interface DatasourceDetail extends DatasourceRecord {
  url: string;
  username: string;
  password_configured: boolean;
  config: DatasourceConfig;
}

export interface DatasourceCreateInput {
  name: string;
  url: string;
  username: string;
  password: string;
  display_name: string;
  config: DatasourceConfig;
}

export interface DatasourceUpdateInput {
  name: string;
  url: string;
  username: string;
  password?: string;
  display_name: string;
  config: DatasourceConfig;
}

export interface DatasourceFilters extends PageRequest {
  name?: string;
  display_name?: string;
  url?: string;
  disabled?: boolean;
}
