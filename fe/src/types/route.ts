import type { ResourceType } from './role';

export type PositiveId = number & { readonly __positiveId: unique symbol };

export interface GrantUserRouteState {
  userId: PositiveId | null;
  datasourceName: string | null;
}

export type GrantResourceRouteState =
  | { type: Extract<ResourceType, 'datasource'>; resourceName: string | null }
  | { type: Extract<ResourceType, 'table'>; resourceId: PositiveId | null };

export interface RouteState {
  pathname: string;
  redirect: string | null;
  datasource: string | null;
  table: PositiveId | null;
  user: PositiveId | null;
  grant_user: GrantUserRouteState | null;
  grant_resource: GrantResourceRouteState | null;
  error: string | null;
}
