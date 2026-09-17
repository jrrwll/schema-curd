import { LoaderCircle, Trash2 } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { batchRevokeRoles, getRoleGrants, revokeRole, updateRoleGrant } from '../../api/role';
import { DEFAULT_PAGE_SIZE } from '../../constants';
import { createPagedResource } from '../../createPagedResource';
import { resourceTypeLabel, roleLabel } from '../../enumLabels';
import type { ListRoleRequest, Role, RoleGrantRecord } from '../../types/role';
import PageSizeSelect from '../PageSizeSelect';
import PaginationControl from '../PaginationControl';
import GrantConfirmationDialog, { type GrantConfirmationItem } from './RoleGrantConfirmationDialog';

interface RoleGrantTableProps {
  query: ListRoleRequest;
}

interface DraftGrant {
  role: Role;
}

interface PendingAction {
  type: 'update' | 'revoke';
  grant?: RoleGrantRecord;
  role?: Role;
}

function roleOptions(): Role[] {
  return ['read', 'write'];
}

function roleOptionsForGrant(item: RoleGrantRecord): Role[] {
  const options = roleOptions();
  return options.includes(item.role) ? options : [item.role, ...options];
}

function resourceDisplayName(item: RoleGrantRecord): string {
  return item.resource_name || `${resourceTypeLabel(item.resource_type)} ${item.resource_id}`;
}

function toConfirmationItem(item: RoleGrantRecord, role = item.role, previousRole?: Role): GrantConfirmationItem {
  return {
    key: `grant-${item.id}`,
    grantId: item.id,
    userId: item.user_id,
    userName: item.user_display_name,
    userAccount: item.user_name,
    resourceType: item.resource_type,
    resourceId: item.resource_id,
    resourceName: resourceDisplayName(item),
    role,
    previousRole,
  };
}

export default function RoleGrantTable(props: RoleGrantTableProps) {
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(DEFAULT_PAGE_SIZE);
  const [drafts, setDrafts] = createSignal<Record<number, DraftGrant>>({});
  const [pending, setPending] = createSignal<PendingAction | null>(null);
  const [selected, setSelected] = createSignal<Record<number, RoleGrantRecord>>({});
  const [batchConfirming, setBatchConfirming] = createSignal(false);
  const [batchSubmitting, setBatchSubmitting] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const result = createPagedResource(
    () => ({ ...props.query, page_no: page(), page_size: pageSize() }),
    getRoleGrants,
    setPage,
  );
  const pendingConfirmationItems = createMemo<GrantConfirmationItem[]>(() => {
    const action = pending();
    if (!action?.grant) return [];
    return [toConfirmationItem(action.grant, action.role ?? action.grant.role, action.type === 'update' ? action.grant.role : undefined)];
  });
  const batchConfirmationItems = createMemo<GrantConfirmationItem[]>(() => Object.values(selected()).map((grant) => toConfirmationItem(grant)));

  createEffect(() => {
    props.query.user_ids;
    props.query.resource_type;
    props.query.resource_ids;
    props.query.roles;
    setPage(1);
    setSelected({});
  });

  createEffect(() => {
    const items = result.data()?.items;
    if (!items) return;
    setDrafts(Object.fromEntries(items.map((item) => [item.id, { role: item.role }])));
    setSelected({});
  });

  function changed(item: RoleGrantRecord) {
    const draft = drafts()[item.id];
    return Boolean(draft && draft.role !== item.role);
  }

  function canRevoke(item: RoleGrantRecord) {
    return !item.user_disabled;
  }

  function toggleSelected(item: RoleGrantRecord) {
    if (!canRevoke(item)) return;
    const next = { ...selected() };
    if (next[item.id]) delete next[item.id];
    else next[item.id] = item;
    setSelected(next);
  }

  function toggleAllVisible() {
    const eligible = result.data()?.items.filter(canRevoke) ?? [];
    const allSelected = eligible.length > 0 && eligible.every((item) => Boolean(selected()[item.id]));
    const next = { ...selected() };
    if (allSelected) eligible.forEach((item) => delete next[item.id]);
    else eligible.forEach((item) => { next[item.id] = item; });
    setSelected(next);
  }

  async function confirmBatchRevoke() {
    const grants = Object.values(selected());
    if (grants.length === 0) return;
    setBatchSubmitting(true);
    setError('');
    setMessage('');
    try {
      await batchRevokeRoles(grants.map((grant) => grant.id));
      setBatchConfirming(false);
      setSelected({});
      setMessage(`已撤销 ${grants.length} 项授权`);
      await result.refetch();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBatchSubmitting(false);
    }
  }

  async function confirm() {
    const action = pending();
    if (!action) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (action.type === 'update' && action.grant) {
        await updateRoleGrant({ id: action.grant.id, role: action.role! });
        setMessage('授权已更新');
      } else if (action.type === 'revoke' && action.grant) {
        await revokeRole(action.grant.id);
        setMessage('授权已撤销');
      }
      setPending(null);
      await result.refetch();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section class="grant-list-section">
      <Show when={message()}><div class="notice notice-success">{message()}</div></Show>
      <Show when={error()}><div class="notice notice-error">{error()}</div></Show>
      <Show when={result.error()}><div class="notice notice-error">{result.error()?.message}</div></Show>
      <div class="table-region grant-table-region">
        <div class="table-meta grant-table-meta"><div><span>权限列表</span><strong>{result.data()?.total ?? 0}</strong></div><button class="button button-danger grant-batch-revoke" disabled={result.loading() || Object.keys(selected()).length === 0} onClick={() => { setError(''); setBatchConfirming(true); }}><Trash2 size={15} />批量撤销<Show when={Object.keys(selected()).length > 0}><span>{Object.keys(selected()).length}</span></Show></button></div>
        <div class="table-scroll grant-table-scroll">
          <table class="grant-table">
            <thead><tr><th class="grant-select-column"><input type="checkbox" aria-label="全选当前页" checked={(result.data()?.items.filter(canRevoke).length ?? 0) > 0 && result.data()!.items.filter(canRevoke).every((item) => Boolean(selected()[item.id]))} onChange={toggleAllVisible} /></th><th>用户</th><th>资源</th><th>角色</th><th>授权时间</th><th class="action-column">操作</th></tr></thead>
            <tbody>
              <Show when={!result.loading() && !result.error()} fallback={<Show when={result.loading()}><tr><td colSpan={6}><div class="table-state"><LoaderCircle class="spin" size={18} />正在加载</div></td></tr></Show>}>
                <For each={result.data()?.items} fallback={<tr><td colSpan={6}><div class="table-state">暂无授权</div></td></tr>}>
                  {(item) => <tr classList={{ 'dirty-row': changed(item), 'selected-row': Boolean(selected()[item.id]) }}><td class="grant-select-column"><input type="checkbox" aria-label={`选择 ${item.user_display_name} ${item.resource_type}:${item.resource_id}`} checked={Boolean(selected()[item.id])} disabled={!canRevoke(item)} onChange={() => toggleSelected(item)} /></td><td><strong>{item.user_display_name}</strong><code>{item.user_name}</code></td><td><strong>{resourceDisplayName(item)}</strong><small>{resourceTypeLabel(item.resource_type)} · {item.resource_id}</small></td><td><select class="input grant-inline-input" disabled={item.user_disabled} value={drafts()[item.id]?.role ?? item.role} onChange={(event) => setDrafts({ ...drafts(), [item.id]: { role: event.currentTarget.value as Role } })}><For each={roleOptionsForGrant(item)}>{(role) => <option value={role}>{roleLabel(role)}</option>}</For></select></td><td><time>{item.created_at.replace('T', ' ').slice(0, 19)}</time></td><td class="action-column"><button class="button button-update grant-update-button" disabled={!changed(item) || item.user_disabled} onClick={() => { setError(''); setPending({ type: 'update', grant: item, ...drafts()[item.id] }); }}>更新</button><button class="icon-button danger" title="撤销授权" disabled={!canRevoke(item)} onClick={() => { setError(''); setPending({ type: 'revoke', grant: item }); }}><Trash2 size={15} /></button></td></tr>}
                </For>
              </Show>
            </tbody>
          </table>
        </div>
      </div>
      <Show when={(result.data()?.total ?? 0) > 0}><div class="grant-pagination"><PaginationControl count={result.data()?.total ?? 0} page={page()} pageSize={pageSize()} loading={result.loading()} onPageChange={setPage} /><PageSizeSelect class="page-size-inline" value={pageSize()} disabled={result.loading()} onChange={(value) => { setPage(1); setPageSize(value); }} /></div></Show>
      <GrantConfirmationDialog open={pending() !== null} action={pending()?.type === 'update' ? 'update' : 'revoke'} items={pendingConfirmationItems()} submitting={submitting()} error={error()} onOpenChange={(open) => { if (!open && !submitting()) setPending(null); }} onConfirm={() => void confirm()} />
      <GrantConfirmationDialog open={batchConfirming()} action="revoke" items={batchConfirmationItems()} submitting={batchSubmitting()} error={error()} onOpenChange={(open) => { if (!open && !batchSubmitting()) setBatchConfirming(false); }} onConfirm={() => void confirmBatchRevoke()} />
    </section>
  );
}
