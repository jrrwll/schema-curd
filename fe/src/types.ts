export type Value = string | number | boolean | null;
export type Row = Record<string, Value>;
export type Role = 'super_admin' | 'user_admin' | 'admin' | 'read' | 'write';
export type ResourceType = '*' | 'datasource' | 'table';

export enum TableStatusEnum {
  Draft = 0,
  Enabled = 1,
  Disabled = 2,
}

export interface UserRole {
  role: Role;
  resource_type: ResourceType;
  resource_id: string;
  created_by?: number;
}

export interface CurrentUser {
  id: number;
  name: string;
  display_name: string;
  is_super_admin: boolean;
  is_user_admin: boolean;
  is_datasource_admin: boolean;
}

export interface UserRoleInput {
  role: Role;
  resource_type: ResourceType;
  resource_id: string;
}

export interface UserRecord {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  name: string;
  display_name: string;
  disable: boolean;
  roles: UserRole[];
}

export interface ListUserRequest {
  id?: number;
  page_no?: number;
  page_size?: number;
  name?: string;
  disable?: boolean;
}

export interface ListUserResult {
  total: number;
  items: UserRecord[];
}

export interface CreateUserInput {
  name: string;
  password: string;
  display_name: string;
}

export interface UpdateUserInput {
  id: number;
  password?: string;
  display_name?: string;
}

export interface RoleGrantRecord {
  id: number;
  created_at: string;
  user_id: number;
  user_name: string;
  user_display_name: string;
  user_disable: boolean;
  role: Role;
  resource_type: ResourceType;
  resource_id: string;
  created_by?: number;
  manageable: boolean;
}

export interface ListRoleRequest {
  page_no?: number;
  page_size?: number;
  user_ids?: number[];
  resource_type?: ResourceType;
  resource_ids?: string[];
  roles?: Role[];
}

export interface ListRoleResult {
  total: number;
  items: RoleGrantRecord[];
}

export interface ResourceCandidate {
  id: string;
  name: string;
  display_name: string;
}

export interface GrantRoleInput {
  user_id: number;
  role: Role;
  resource_type: ResourceType;
  resource_id: string;
}

export interface ColumnConfig {
  name: string;
  display_name: string;
  data_type: 'text' | 'int' | 'float' | 'bool';
  optional: boolean;
  primary_key: boolean;
  sortable: boolean;
  hidden_on_create: boolean;
  is_json: boolean;
  pattern?: string;
  search_default_value?: Value;
}

export interface OrderByConfig {
  sort: string;
  order: 'asc' | 'desc';
}

export interface TableConfig {
  id: number;
  name: string;
  display_name: string;
  readonly: boolean;
  columns: ColumnConfig[];
  default_order_by: OrderByConfig[];
}

export interface FixedWhereConfig {
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'not_like' | 'in' | 'not_in';
  value: Value | Value[];
}

export interface TableMetadataConfig {
  insert_readonly: boolean;
  insert_fixed_value: Record<string, Value>;
  list_fixed_where: FixedWhereConfig[];
  list_default_order_by: OrderByConfig[];
}

export interface TableMetadataListRecord {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  datasource: string;
  name: string;
  display_name: string;
  status: TableStatusEnum;
  column_count: number;
  has_primary_key: boolean;
  role_action: 'none' | 'read' | 'write';
}

export interface TableMetadataRecord extends TableMetadataListRecord {
  config: TableMetadataConfig;
}

export interface TableMetadataDetailRecord extends TableMetadataRecord {
  readonly: boolean;
  columns: ColumnConfig[];
  default_order_by: OrderByConfig[];
}

export interface ColumnMetadataConfig {
  data_type: ColumnConfig['data_type'];
  optional: boolean;
  sortable: boolean;
  hidden_on_create: boolean;
  is_json: boolean;
  pattern?: string;
  search_default_value?: Value;
}

export interface ColumnMetadataRecord {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  datasource: string;
  table: string;
  name: string;
  display_name: string;
  is_primary_key: boolean;
  config: ColumnMetadataConfig;
}

export interface PhysicalColumnItem {
  name: string;
  comment: string;
  data_type: ColumnConfig['data_type'];
  optional: boolean;
  primary_key: boolean;
}

export interface PhysicalColumnListResult {
  items: PhysicalColumnItem[];
}

export interface TableMetadataFilters {
  id?: number;
  datasource?: string;
  name?: string;
  display_name?: string;
}

export interface PhysicalTableListResult {
  items: PhysicalTableItem[];
  truncated: boolean;
}

export interface PhysicalTableItem {
  name: string;
  comment: string;
}

export interface TableMetadataInput {
  datasource: string;
  name: string;
  display_name: string;
  config: TableMetadataConfig;
}

export interface DatasourceConfig {
  name: string;
  display_name: string;
  tables: TableConfig[];
}

export interface DiscoveryDatasourceItem {
  id: number;
  name: string;
  display_name: string;
}

export interface DiscoveryDatasourceDetail extends DiscoveryDatasourceItem {
  table_count: number;
}

export interface DiscoveryTableItem {
  id: number;
  name: string;
  display_name: string;
}

export interface PageResult<T> {
  total: number;
  items: T[];
}

export interface DatasourceRecord {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  name: string;
  url: string;
  username: string;
  password_configured: boolean;
  display_name: string;
  table_count: number;
  role_action: 'none' | 'read' | 'write';
}

export interface DatasourceDetail extends DatasourceRecord {
  bool_as_int: boolean;
}

export interface DatasourceSummary {
  id: number;
  name: string;
  display_name: string;
  table_count: number;
  role_action: 'none' | 'read' | 'write';
}

export interface DatasourceInput {
  name: string;
  url: string;
  username: string;
  password?: string;
  display_name: string;
  bool_as_int: boolean;
}

export interface DatasourceConnectionTestResult {
  database_type: 'mysql' | 'postgresql';
  version: string;
}

export interface DatasourceFilters {
  name?: string;
  display_name?: string;
  url?: string;
}

export interface RouteState {
  pathname: string;
  redirect: string | null;
  datasource: string | null;
  table: string | null;
  resource_type: string | null;
  resource_id: string | null;
  user: string | null;
  role: string | null;
}
