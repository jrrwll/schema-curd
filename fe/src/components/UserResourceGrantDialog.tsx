import { Dialog } from '@ark-ui/solid/dialog';
import { Check, KeyRound, LoaderCircle, Search, ShieldCheck, UserRound, X } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getDiscoveryResourceCandidates, getUsers, grantRole } from '../api';
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../constants';
import { roleLabel } from '../enumLabels';
import type { ResourceCandidate, ResourceType, UserRecord } from '../types';
import SearchMultiSelect, { type SearchMultiOption } from './SearchMultiSelect';

type ResourceRole = 'admin' | 'read' | 'write';
type DataRole = Exclude<ResourceRole, 'admin'>;

export interface ResourceGrantSelection {
  resourceType: Exclude<ResourceType, '*'>;
  resourceId: string;
  resourceName: string;
  role: ResourceRole;
}

interface UserResourceGrantDialogProps {
  open: boolean;
  user: UserRecord | null;
  allowMultipleUsers?: boolean;
  canGrantAllDatasources: boolean;
  onOpenChange: (open: boolean) => void;
  onGranted: (count: number) => void;
}

function selectionKey(selection: Pick<ResourceGrantSelection, 'resourceType' | 'resourceId' | 'role'>) {
  return `${selection.resourceType}:${selection.resourceId}:${selection.role}`;
}

function hasGrant(user: UserRecord | null, resourceType: Exclude<ResourceType, '*'>, resourceId: string, role: ResourceRole) {
  return user?.roles.some((item) =>
    item.resource_type === resourceType
    && item.resource_id === resourceId
    && item.role === role,
  ) ?? false;
}

function isSuperAdmin(user: UserRecord) {
  return user.roles.some((item) => item.role === 'super_admin');
}

export default function UserResourceGrantDialog(props: UserResourceGrantDialogProps) {
  const [keyword, setKeyword] = createSignal('');
  const [items, setItems] = createSignal<ResourceCandidate[]>([]);
  const [selectedUsers, setSelectedUsers] = createSignal<UserRecord[]>([]);
  const [selectedResources, setSelectedResources] = createSignal<Record<string, ResourceCandidate>>({});
  const [resourceType, setResourceType] = createSignal<Exclude<ResourceType, '*'>>('datasource');
  const [allResources, setAllResources] = createSignal(false);
  const [resourceRole, setResourceRole] = createSignal<DataRole>('read');
  const [granted, setGranted] = createSignal<Record<string, boolean>>({});
  const [reviewing, setReviewing] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [searchError, setSearchError] = createSignal('');
  const [submitError, setSubmitError] = createSignal('');
  let requestId = 0;
  let wasOpen = false;
  const userCache = new Map<number, UserRecord>();

  const selections = createMemo<ResourceGrantSelection[]>(() => {
    if (resourceType() === 'datasource' && allResources()) {
      return [{ resourceType: 'datasource', resourceId: '*', resourceName: '全部数据源', role: 'admin' }];
    }
    const role = resourceRole();
    return Object.values(selectedResources()).map((resource) => ({
      resourceType: resourceType(),
      resourceId: resource.id,
      resourceName: resource.display_name,
      role,
    }));
  });

  const eligibleItems = createMemo(() => items().filter((item) => !alreadyGranted(item.id, resourceRole())));
  const allVisibleSelected = createMemo(() => {
    const eligible = eligibleItems();
    return eligible.length > 0 && eligible.every((item) => Boolean(selectedResources()[item.id]));
  });
  const selectedUserOptions = createMemo<SearchMultiOption[]>(() => selectedUsers().map((user) => ({
    id: String(user.id),
    label: user.display_name,
    detail: user.name,
  })));
  const plannedCount = createMemo(() => selections().reduce((count, selection) => count + selectedUsers()
    .filter((user) => !userHasGrant(user, selection)).length, 0));

  createEffect(() => {
    const open = props.open;
    if (open && !wasOpen) {
      setKeyword('');
      setSelectedUsers(props.user ? [props.user] : []);
      setSelectedResources({});
      setResourceType('datasource');
      setAllResources(false);
      setResourceRole('read');
      setGranted({});
      setReviewing(false);
      setSearchError('');
      setSubmitError('');
    }
    if (!open && wasOpen) requestId += 1;
    wasOpen = open;
  });

  createEffect(() => {
    if (!props.open || reviewing()) return;
    const search = keyword();
    const type = resourceType();
    const timeout = window.setTimeout(async () => {
      const current = ++requestId;
      setLoading(true);
      setSearchError('');
      try {
        const result = await getDiscoveryResourceCandidates({
          resource_type: type,
          keyword: search.trim() || undefined,
          page_no: 1,
          page_size: DEFAULT_PAGE_SIZE,
        });
        if (current === requestId) {
          setItems(result.items);
        }
      } catch (reason) {
        if (current === requestId) setSearchError((reason as Error).message);
      } finally {
        if (current === requestId) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    onCleanup(() => window.clearTimeout(timeout));
  });

  function alreadyGranted(resourceId: string, role: ResourceRole) {
    const users = selectedUsers();
    if (users.length === 0) return false;
    const selection = { resourceType: resourceType(), resourceId, role };
    return users.every((user) => userHasGrant(user, selection));
  }

  function userHasGrant(user: UserRecord, selection: Pick<ResourceGrantSelection, 'resourceType' | 'resourceId' | 'role'>) {
    return hasGrant(user, selection.resourceType, selection.resourceId, selection.role)
      || Boolean(granted()[`${user.id}:${selectionKey(selection)}`]);
  }

  async function loadUsers(keyword: string): Promise<SearchMultiOption[]> {
    const result = await getUsers({
      name: keyword || undefined,
      page_no: 1,
      page_size: DEFAULT_PAGE_SIZE,
    });
    return result.items
      .filter((user) => !user.disable && !isSuperAdmin(user))
      .map((user) => {
        userCache.set(user.id, user);
        return { id: String(user.id), label: user.display_name, detail: user.name };
      });
  }

  function changeUsers(options: SearchMultiOption[]) {
    setSelectedUsers(options
      .map((option) => userCache.get(Number(option.id)))
      .filter((user): user is UserRecord => Boolean(user)));
  }

  function toggleAllResources() {
    if (resourceType() !== 'datasource' || alreadyGranted('*', 'admin')) return;
    setAllResources((current) => {
      if (!current) setSelectedResources({});
      return !current;
    });
  }

  function changeResourceType(value: Exclude<ResourceType, '*'>) {
    setResourceType(value);
    setAllResources(false);
    setSelectedResources({});
    setKeyword('');
    setSubmitError('');
  }

  function changeResourceRole(role: DataRole) {
    setResourceRole(role);
    setSelectedResources(Object.fromEntries(
      Object.values(selectedResources())
        .filter((resource) => !alreadyGranted(resource.id, role))
        .map((resource) => [resource.id, resource]),
    ));
  }

  function toggleResource(resource: ResourceCandidate) {
    if ((resourceType() === 'datasource' && allResources()) || alreadyGranted(resource.id, resourceRole())) return;
    const next = { ...selectedResources() };
    if (next[resource.id]) delete next[resource.id];
    else next[resource.id] = resource;
    setSelectedResources(next);
  }

  function toggleVisibleResources() {
    if ((resourceType() === 'datasource' && allResources()) || eligibleItems().length === 0) return;
    const next = { ...selectedResources() };
    if (allVisibleSelected()) eligibleItems().forEach((item) => delete next[item.id]);
    else eligibleItems().forEach((item) => { next[item.id] = item; });
    setSelectedResources(next);
  }

  async function submit() {
    const user = props.user;
    const grants = selections();
    const users = selectedUsers();
    if ((!user && !props.allowMultipleUsers) || users.length === 0 || grants.length === 0) return;
    const targets = users.flatMap((targetUser) => grants
      .filter((grant) => !userHasGrant(targetUser, grant))
      .map((grant) => ({ user: targetUser, grant })));
    if (targets.length === 0) return;
    setSubmitting(true);
    setSubmitError('');
    const results = await Promise.allSettled(targets.map((target) => grantRole({
      user_id: target.user.id,
      resource_type: target.grant.resourceType,
      resource_id: target.grant.resourceId,
      role: target.grant.role,
    })));
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const failed = targets.filter((_, index) => results[index].status === 'rejected');
    if (succeeded > 0) {
      setGranted({
        ...granted(),
        ...Object.fromEntries(targets
          .filter((_, index) => results[index].status === 'fulfilled')
          .map((target) => [`${target.user.id}:${selectionKey(target.grant)}`, true])),
      });
      props.onGranted(succeeded);
    }
    if (failed.length === 0) {
      props.onOpenChange(false);
    } else {
      const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      const reason = firstFailure?.reason instanceof Error ? firstFailure.reason.message : String(firstFailure?.reason ?? 'Unknown error');
      const failedGrants = [...new Map(failed.map((target) => [selectionKey(target.grant), target.grant])).values()];
      setResourceType(failedGrants[0].resourceType);
      const adminFailed = failedGrants[0].role === 'admin';
      setAllResources(adminFailed);
      setSelectedResources(adminFailed ? {} : Object.fromEntries(failedGrants.map((grant) => [grant.resourceId, {
        id: grant.resourceId,
        name: grant.resourceId,
        display_name: grant.resourceName,
      }])));
      if (!adminFailed) setResourceRole(failedGrants[0].role as DataRole);
      setReviewing(false);
      setSubmitError(`成功 ${succeeded} 项，失败 ${failed.length} 项：${reason}`);
    }
    setSubmitting(false);
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={(details) => !submitting() && props.onOpenChange(details.open)}>
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" />
        <Dialog.Positioner class="dialog-positioner datasource-picker-positioner">
          <Dialog.Content class="dialog-content datasource-picker-dialog resource-grant-dialog">
            <header class="dialog-header">
              <div class="dialog-heading"><span class="dialog-icon"><KeyRound size={18} /></span><div><Dialog.Title class="dialog-title">新增资源授权</Dialog.Title><Dialog.Description class="dialog-description">{reviewing() ? '确认授权范围' : '选择资源范围和权限'}</Dialog.Description></div></div>
              <Dialog.CloseTrigger class="dialog-close" disabled={submitting()} title="关闭"><X size={18} /></Dialog.CloseTrigger>
            </header>

            <Show when={!reviewing()} fallback={
              <>
                <div class="resource-grant-review">
                  <div class="resource-grant-review-users"><For each={selectedUsers()}>{(user) => <span><UserRound size={15} /><span><strong>{user.display_name}</strong><code>{user.name}</code></span></span>}</For></div>
                  <div class="resource-grant-review-meta"><span>用户</span><strong>{selectedUsers().length}</strong><span>待授权</span><strong>{plannedCount()} 项</strong></div>
                  <div class="resource-grant-review-list"><For each={selections()}>{(selection) => <div><span><strong>{selection.resourceName}</strong><code>{selection.resourceType}:{selection.resourceId}</code></span><b>{roleLabel(selection.role)}</b></div>}</For></div>
                </div>
                <Show when={submitError()}><div class="notice notice-error resource-grant-error">{submitError()}</div></Show>
                <div class="dialog-actions"><button type="button" class="button button-ghost" disabled={submitting()} onClick={() => setReviewing(false)}>返回修改</button><button type="button" class="button button-confirm" disabled={submitting()} onClick={() => void submit()}><Show when={submitting()} fallback={<><Check size={16} />确认授权</>}><LoaderCircle class="spin" size={16} />授权中</Show></button></div>
              </>
            }>
              <div class="resource-grant-body">
                <div class="resource-grant-user-field"><span>用户</span><Show when={props.allowMultipleUsers} fallback={<div class="input resource-grant-user-input" aria-readonly="true"><UserRound size={16} /><span><strong>{props.user?.display_name}</strong><code>{props.user?.name}</code></span></div>}><SearchMultiSelect value={selectedUserOptions()} placeholder="选择用户" searchPlaceholder="搜索用户名或展示名称" loadOptions={loadUsers} onChange={changeUsers} /></Show></div>
                <Show when={resourceType() === 'datasource' && props.canGrantAllDatasources}><label class="resource-grant-admin-scope" classList={{ selected: allResources(), disabled: alreadyGranted('*', 'admin') }}><input type="checkbox" checked={allResources()} disabled={alreadyGranted('*', 'admin')} onChange={toggleAllResources} /><span class="datasource-picker-card-icon"><ShieldCheck size={17} /></span><span><strong>全部数据源</strong><code>datasource:*</code></span><b>{alreadyGranted('*', 'admin') ? '已授权管理员' : '资源管理员'}</b></label></Show>
                <div class="resource-grant-divider"><span>具体资源授权</span></div>
                <div class="resource-grant-search-row" classList={{ disabled: allResources() }}>
                  <label><span>资源类型</span><select class="input" value={resourceType()} disabled={allResources()} onChange={(event) => changeResourceType(event.currentTarget.value as Exclude<ResourceType, '*'>)}><option value="datasource">数据源</option><option value="table">数据表</option></select></label>
                  <label><span>资源名称</span><div class="resource-grant-search input"><Search size={16} /><input type="search" autocomplete="off" disabled={allResources()} placeholder="模糊搜索资源 ID 或名称" value={keyword()} onInput={(event) => setKeyword(event.currentTarget.value)} /><Show when={loading()}><LoaderCircle class="spin" size={15} /></Show><Show when={keyword() && !loading()}><button type="button" disabled={allResources()} title="清除搜索" onClick={() => setKeyword('')}><X size={14} /></button></Show></div></label>
                </div>
              </div>
              <div class="resource-grant-list-toolbar" classList={{ disabled: allResources() }}>
                <div class="resource-grant-role-radio"><span>权限</span><label><input type="radio" name="resource-grant-role" value="read" checked={resourceRole() === 'read'} disabled={allResources()} onChange={() => changeResourceRole('read')} />读权限</label><label><input type="radio" name="resource-grant-role" value="write" checked={resourceRole() === 'write'} disabled={allResources()} onChange={() => changeResourceRole('write')} />写权限</label></div>
                <label class="resource-grant-select-all"><input type="checkbox" checked={allVisibleSelected()} disabled={allResources() || eligibleItems().length === 0} onChange={toggleVisibleResources} />全选当前结果</label>
                <span>已选择 {selections().length} 项</span>
              </div>
              <div class="datasource-picker-list resource-grant-list" classList={{ disabled: allResources() }} aria-busy={loading()}>
                <Show when={searchError()}><div class="entity-picker-error">{searchError()}</div></Show>
                <Show when={!loading()} fallback={<div class="entity-picker-loading"><LoaderCircle class="spin" size={17} />正在加载资源</div>}>
                  <For each={items()} fallback={<Show when={!searchError()}><div class="entity-picker-empty">没有匹配的资源</div></Show>}>
                    {(resource) => {
                      const existing = () => alreadyGranted(resource.id, resourceRole());
                      const checked = () => Boolean(selectedResources()[resource.id]);
                      return <label class="resource-grant-card" classList={{ selected: checked(), disabled: allResources() || existing() }}><input type="checkbox" checked={checked()} disabled={allResources() || existing()} onChange={() => toggleResource(resource)} /><span class="datasource-picker-card-icon"><ShieldCheck size={17} /></span><span class="datasource-picker-card-copy"><strong>{resource.display_name}</strong><code>{resource.name}</code></span><b>{existing() ? `已授权${roleLabel(resourceRole())}` : roleLabel(resourceRole())}</b></label>;
                    }}
                  </For>
                </Show>
              </div>
              <Show when={submitError()}><div class="notice notice-error resource-grant-error">{submitError()}</div></Show>
              <footer class="user-multi-footer resource-grant-footer actions-only"><div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost">取消</Dialog.CloseTrigger><button type="button" class="button button-confirm" disabled={selections().length === 0 || selectedUsers().length === 0 || plannedCount() === 0} onClick={() => setReviewing(true)}><KeyRound size={16} />下一步</button></div></footer>
            </Show>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
