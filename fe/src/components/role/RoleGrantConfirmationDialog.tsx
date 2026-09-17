import { Dialog } from '@ark-ui/solid';
import { Check, FileDiff, KeyRound, LoaderCircle, ShieldCheck, Trash2, X } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { resourceTypeLabel, roleLabel } from '../../enumLabels';
import type { ResourceType, Role } from '../../types/role';

export type GrantConfirmationAction = 'grant' | 'update' | 'revoke';

export interface GrantConfirmationItem {
  key: string;
  grantId?: number;
  userId: number;
  userName: string;
  userAccount: string;
  resourceType: ResourceType;
  resourceId: number;
  resourceName: string;
  resourceCode?: string;
  role: Role;
  previousRole?: Role;
}

interface Props {
  open: boolean;
  action: GrantConfirmationAction;
  items: GrantConfirmationItem[];
  submitting: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const ACTION_LABELS: Record<GrantConfirmationAction, string> = {
  grant: '授权',
  update: '更新授权',
  revoke: '撤销授权',
};

export default function GrantConfirmationDialog(props: Props) {
  const actionLabel = () => ACTION_LABELS[props.action];

  return <Dialog.Root open={props.open} onOpenChange={(details) => props.onOpenChange(details.open)}>
    <Portal>
      <Dialog.Backdrop class="dialog-backdrop" />
      <Dialog.Positioner class="dialog-positioner">
        <Dialog.Content class="dialog-content grant-confirm-dialog">
          <header class="dialog-header">
            <div class="dialog-heading">
              <span class="dialog-icon" classList={{ danger: props.action === 'revoke' }}>
                <Show when={props.action === 'grant'} fallback={<Show when={props.action === 'update'} fallback={<ShieldCheck size={18} />}><FileDiff size={18} /></Show>}><KeyRound size={18} /></Show>
              </span>
              <div>
                <Dialog.Title class="dialog-title">确认{actionLabel()}</Dialog.Title>
                <Dialog.Description class="dialog-description">请核对以下 {props.items.length} 项授权内容，确认后立即生效</Dialog.Description>
              </div>
            </div>
            <Dialog.CloseTrigger class="dialog-close" disabled={props.submitting} title="关闭" aria-label="关闭"><X size={18} /></Dialog.CloseTrigger>
          </header>

          <div class="grant-confirm-table-wrap">
            <table class="grant-confirm-table">
              <thead><tr><th>用户</th><th>资源</th><th>资源范围</th><th>权限</th></tr></thead>
              <tbody>
                <For each={props.items}>{(item) => <tr>
                  <td><strong>{item.userName}</strong><code>{item.userAccount} · ID:{item.userId}</code></td>
                  <td><strong>{item.resourceName}</strong><Show when={item.resourceCode}><code>{item.resourceCode}</code></Show></td>
                  <td><strong>{resourceTypeLabel(item.resourceType)} · ID:{item.resourceId}</strong><Show when={item.grantId}><code>授权 ID:{item.grantId}</code></Show></td>
                  <td><Show when={props.action === 'update' && item.previousRole} fallback={<b>{roleLabel(item.role)}</b>}>{(previousRole) => <span class="grant-confirm-role-change"><b>{roleLabel(previousRole())}</b><span>→</span><b>{roleLabel(item.role)}</b></span>}</Show></td>
                </tr>}</For>
              </tbody>
            </table>
          </div>

          <Show when={props.error}><div class="notice notice-error grant-confirm-error">{props.error}</div></Show>
          <div class="dialog-actions">
            <Dialog.CloseTrigger class="button button-ghost" disabled={props.submitting}>取消</Dialog.CloseTrigger>
            <button type="button" class={props.action === 'revoke' ? 'button button-danger' : 'button button-confirm'} disabled={props.submitting || props.items.length === 0} onClick={props.onConfirm}>
              <Show when={!props.submitting} fallback={<><LoaderCircle class="spin" size={16} />处理中</>}>
                <Show when={props.action === 'revoke'} fallback={<><Check size={16} />确认{actionLabel()}</>}><Trash2 size={16} />确认撤销</Show>
              </Show>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>;
}
