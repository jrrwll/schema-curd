import type { PageRequest, PageResult } from './common';

export type Role = 'read' | 'write';
export type EffectiveRole = 'none' | 'read' | 'write';
export type ResourceType = 'datasource' | 'table';

export interface RoleGrantRecord {
  id: number;
  created_at: string;
  user_id: number;
  user_name: string;
  user_display_name: string;
  user_disabled: boolean;
  role: Role;
  resource_type: ResourceType;
  resource_id: number;
  resource_name: string;
}

export interface ListRoleRequest extends PageRequest {
  user_ids?: number[];
  resource_type?: ResourceType;
  resource_ids?: number[];
  roles?: Role[];
}

export type ListRoleResult = PageResult<RoleGrantRecord>;

export interface RoleResourceOption {
  id: number;
  name: string;
  display_name: string;
}

export interface BatchGrantUsersInput {
  resource_type: ResourceType;
  resource_id: number;
  items: Array<{ user_id: number; role: Role }>;
}

export interface BatchGrantResourcesInput {
  user_id: number;
  resource_type: ResourceType;
  items: Array<{ resource_id: number; role: Role }>;
}
