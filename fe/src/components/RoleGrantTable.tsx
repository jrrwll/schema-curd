import { Dialog } from '@ark-ui/solid/dialog';
import { Check, FileDiff, LoaderCircle, ShieldCheck, Trash2, X } from 'lucide-solid';
import { For, Show, createEffect, createResource, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getRoleGrants, revokeRole, updateRoleGrant } from '../api';
import { DEFAULT_PAGE_SIZE } from '../constants';
import { resourceTypeLabel, roleLabel } from '../enumLabels';
import type { ListRoleRequest, ResourceType, Role, RoleGrantRecord } from '../types';

interface RoleGrantTableProps {
  query: ListRoleRequest;
  refreshKey?: number;
}

interface DraftGrant {
  role: Role;
}

interface PendingAction {
  type: 'update' | 'revoke';
  grant?: RoleGrantRecord;
  role?: Role;
}

function roleOptions(resourceType: ResourceType, resourceId?: string): Role[] {
  if (resourceType === '*') return ['super_admin', 'user_admin'];
  if (resourceId === '*') return ['admin'];
  return ['read', 'write'];
}

function roleOptionsForGrant(item: RoleGrantRecord): Role[] {
  const options = roleOptions(item.resource_type, item.resource_id);
  return options.includes(item.role) ? options : [item.role, ...options];
}

export default function RoleGrantTable(props: RoleGrantTableProps) {
  const [page, setPage] = createSignal(1);
  const [version, setVersion] = createSignal(0);
  const [drafts, setDrafts] = createSignal<Record<number, DraftGrant>>({});
  const [pending, setPending] = createSignal<PendingAction | null>(null);
  const [selected, setSelected] = createSignal<Record<number, RoleGrantRecord>>({});
  const [batchConfirming, setBatchConfirming] = createSignal(false);
  const [batchSubmitting, setBatchSubmitting] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [result] = createResource(
    () => ({
      ...props.query,
      page_no: page(),
      page_size: DEFAULT_PAGE_SIZE,
      version: version(),
      refreshKey: props.refreshKey,
    }),
    ({ version: _version, refreshKey: _refreshKey, ...query }) => getRoleGrants(query),
  );

  createEffect(() => {
    props.query.user_ids;
    props.query.resource_type;
    props.query.resource_ids;
    props.query.roles;
    setPage(1);
  });

  createEffect(() => {
    const items = result()?.items;
    if (!items) return;
    setDrafts(Object.fromEntries(items.map((item) => [item.id, { role: item.role }])));
    setSelected({});
  });

  function changed(item: RoleGrantRecord) {
    const draft = drafts()[item.id];
    return Boolean(draft && draft.role !== item.role);
  }

  function canRevoke(item: RoleGrantRecord) {
    return !item.user_disable && item.manageable;
  }

  function toggleSelected(item: RoleGrantRecord) {
    if (!canRevoke(item)) return;
    const next = { ...selected() };
    if (next[item.id]) delete next[item.id];
    else next[item.id] = item;
    setSelected(next);
  }

  function toggleAllVisible() {
    const eligible = result()?.items.filter(canRevoke) ?? [];
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
    const results = await Promise.allSettled(grants.map((grant) => revokeRole(grant.id)));
    const succeeded = results.filter((item) => item.status === 'fulfilled').length;
    const failures = grants.filter((_, index) => results[index].status === 'rejected');
    setBatchConfirming(false);
    setSelected(Object.fromEntries(failures.map((grant) => [grant.id, grant])));
    if (succeeded > 0) {
      setMessage(`已撤销 ${succeeded} 项授权`);
      setVersion((value) => value + 1);
    }
    if (failures.length > 0) {
      const firstFailure = results.find((item): item is PromiseRejectedResult => item.status === 'rejected');
      const reason = firstFailure?.reason instanceof Error ? firstFailure.reason.message : String(firstFailure?.reason ?? 'Unknown error');
      setError(`成功 ${succeeded} 项，失败 ${failures.length} 项：${reason}`);
    }
    setBatchSubmitting(false);
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
      setVersion((value) => value + 1);
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
      <div class="table-region grant-table-region">
        <div class="table-meta grant-table-meta"><div><span>权限列表</span><strong>{result()?.total ?? 0}</strong></div><button class="button button-danger grant-batch-revoke" disabled={Object.keys(selected()).length === 0} onClick={() => setBatchConfirming(true)}><Trash2 size={15} />批量撤销<Show when={Object.keys(selected()).length > 0}><span>{Object.keys(selected()).length}</span></Show></button></div>
        <div class="table-scroll">
          <table class="grant-table">
            <thead><tr><th class="grant-select-column"><input type="checkbox" aria-label="全选当前页" checked={(result()?.items.filter(canRevoke).length ?? 0) > 0 && result()!.items.filter(canRevoke).every((item) => Boolean(selected()[item.id]))} onChange={toggleAllVisible} /></th><th>用户</th><th>资源</th><th>角色</th><th>授权时间</th><th class="action-column">操作</th></tr></thead>
            <tbody>
              <Show when={!result.loading} fallback={<tr><td colSpan={6}><div class="table-state"><LoaderCircle class="spin" size={18} />正在加载</div></td></tr>}>
                <For each={result()?.items} fallback={<tr><td colSpan={6}><div class="table-state">暂无授权</div></td></tr>}>
                  {(item) => <tr classList={{ 'dirty-row': changed(item), 'selected-row': Boolean(selected()[item.id]) }}><td class="grant-select-column"><input type="checkbox" aria-label={`选择 ${item.user_display_name} ${item.resource_type}:${item.resource_id}`} checked={Boolean(selected()[item.id])} disabled={!canRevoke(item)} onChange={() => toggleSelected(item)} /></td><td><strong>{item.user_display_name}</strong><code>{item.user_name}</code></td><td><strong>{resourceTypeLabel(item.resource_type)}</strong><code>{item.resource_id}</code></td><td><select class="input grant-inline-input" disabled={item.user_disable || item.role === 'super_admin' || !item.manageable} value={drafts()[item.id]?.role ?? item.role} onChange={(event) => setDrafts({ ...drafts(), [item.id]: { role: event.currentTarget.value as Role } })}><For each={roleOptionsForGrant(item)}>{(role) => <option value={role}>{roleLabel(role)}</option>}</For></select></td><td><time>{item.created_at.replace('T', ' ').slice(0, 19)}</time></td><td class="action-column"><button class="button button-update grant-update-button" disabled={!changed(item) || item.user_disable || item.role === 'super_admin' || !item.manageable} onClick={() => setPending({ type: 'update', grant: item, ...drafts()[item.id] })}>更新</button><button class="icon-button danger" title={item.manageable ? '撤销授权' : '没有该资源的写权限'} disabled={!canRevoke(item)} onClick={() => setPending({ type: 'revoke', grant: item })}><Trash2 size={15} /></button></td></tr>}
                </For>
              </Show>
            </tbody>
          </table>
        </div>
      </div>
      <div class="grant-pagination"><button class="button button-ghost" disabled={page() <= 1 || result.loading} onClick={() => setPage((value) => value - 1)}>上一页</button><span>第 {page()} 页</span><button class="button button-ghost" disabled={result.loading || (result()?.items.length ?? 0) < DEFAULT_PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>下一页</button></div>
      <Dialog.Root open={pending() !== null} onOpenChange={(details) => !details.open && setPending(null)}><Portal><Dialog.Backdrop class="dialog-backdrop" /><Dialog.Positioner class="dialog-positioner"><Dialog.Content class="dialog-content"><div class="dialog-header"><div class="dialog-heading"><span class="dialog-icon"><Show when={pending()?.type === 'update'} fallback={<ShieldCheck size={18} />}><FileDiff size={18} /></Show></span><div><Dialog.Title class="dialog-title">确认{pending()?.type === 'revoke' ? '撤销授权' : '更新授权'}</Dialog.Title><Dialog.Description class="dialog-description">{pending()?.grant ? `${pending()!.grant!.user_display_name} · ${resourceTypeLabel(pending()!.grant!.resource_type)}:${pending()!.grant!.resource_id}` : '操作确认后立即生效'}</Dialog.Description></div></div><Dialog.CloseTrigger class="dialog-close" disabled={submitting()}><X size={18} /></Dialog.CloseTrigger></div><Show when={pending()?.type === 'update' && pending()?.grant} fallback={<div class="datasource-delete-message">请确认用户、资源范围和角色均正确。</div>}>{(grant) => <><div class="diff-summary">以下字段将被更新</div><div class="diff-list"><Show when={pending()?.role !== grant().role}><div class="diff-row"><div class="diff-field"><strong>角色</strong><code>role</code></div><div class="diff-values"><div class="diff-before"><span>更新前</span><div>{roleLabel(grant().role)}</div></div><span class="diff-arrow">→</span><div class="diff-after"><span>更新后</span><div>{roleLabel(pending()!.role!)}</div></div></div></div></Show></div></>}</Show><div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost" disabled={submitting()}>取消</Dialog.CloseTrigger><button class="button button-confirm" disabled={submitting()} onClick={() => void confirm()}><Show when={submitting()} fallback={<><Check size={16} />确认</>}><LoaderCircle class="spin" size={16} />处理中</Show></button></div></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
      <Dialog.Root open={batchConfirming()} onOpenChange={(details) => !details.open && !batchSubmitting() && setBatchConfirming(false)}><Portal><Dialog.Backdrop class="dialog-backdrop" /><Dialog.Positioner class="dialog-positioner"><Dialog.Content class="dialog-content datasource-delete-dialog"><div class="dialog-header"><div class="dialog-heading"><span class="dialog-icon danger"><Trash2 size={18} /></span><div><Dialog.Title class="dialog-title">确认批量撤销</Dialog.Title><Dialog.Description class="dialog-description">已选择 {Object.keys(selected()).length} 项授权</Dialog.Description></div></div><Dialog.CloseTrigger class="dialog-close" disabled={batchSubmitting()}><X size={18} /></Dialog.CloseTrigger></div><div class="datasource-delete-message">撤销后，这些用户将立即失去对应资源的权限。</div><div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost" disabled={batchSubmitting()}>取消</Dialog.CloseTrigger><button class="button button-danger" disabled={batchSubmitting()} onClick={() => void confirmBatchRevoke()}><Show when={batchSubmitting()} fallback={<><Trash2 size={16} />确认撤销</>}><LoaderCircle class="spin" size={16} />撤销中</Show></button></div></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
    </section>
  );
}
