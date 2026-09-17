import type { PageRequest, PageResult } from './common';

export interface CurrentUser {
  id: number;
  name: string;
  display_name: string;
  super_admin: boolean;
}

export interface UserRecord {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  display_name: string;
  disabled: boolean;
  super_admin: boolean;
}

export interface ListUserRequest extends PageRequest {
  name?: string;
  disabled?: boolean;
  super_admin?: boolean;
}

export type ListUserResult = PageResult<UserRecord>;

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
