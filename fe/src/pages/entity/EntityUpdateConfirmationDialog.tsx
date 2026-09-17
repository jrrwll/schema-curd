import { Dialog } from '@ark-ui/solid';
import { Check, FileDiff, LoaderCircle, X } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { displayValue, type FieldDiff } from './entityValues';

interface Props {
  open: boolean;
  identity: string;
  diffs: FieldDiff[];
  updating: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function EntityUpdateConfirmationDialog(props: Props) {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      closeOnEscape={!props.updating}
      closeOnInteractOutside={!props.updating}
    >
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" />
        <Dialog.Positioner class="dialog-positioner">
          <Dialog.Content class="dialog-content">
            <div class="dialog-header">
              <div class="dialog-heading">
                <span class="dialog-icon"><FileDiff size={19} /></span>
                <div>
                  <Dialog.Title class="dialog-title">确认更新</Dialog.Title>
                  <Dialog.Description class="dialog-description">{props.identity}</Dialog.Description>
                </div>
              </div>
              <Dialog.CloseTrigger class="dialog-close" disabled={props.updating} title="关闭"><X size={18} /></Dialog.CloseTrigger>
            </div>
            <div class="diff-summary">以下 {props.diffs.length} 个字段将被更新</div>
            <div class="diff-list">
              <For each={props.diffs}>
                {(diff) => (
                  <div class="diff-row">
                    <div class="diff-field"><strong>{diff.column.display_name}</strong><code>{diff.column.name}</code></div>
                    <div class="diff-values">
                      <div class="diff-before"><span>更新前</span><div>{displayValue(diff.column, diff.before)}</div></div>
                      <span class="diff-arrow">→</span>
                      <div class="diff-after"><span>更新后</span><div>{displayValue(diff.column, diff.after)}</div></div>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <div class="dialog-actions">
              <Dialog.CloseTrigger class="button button-ghost" disabled={props.updating}>取消</Dialog.CloseTrigger>
              <button class="button button-confirm" disabled={props.updating || props.diffs.length === 0} onClick={props.onConfirm}>
                <Show when={props.updating} fallback={<><Check size={16} />确认更新</>}><LoaderCircle class="spin" size={16} />更新中</Show>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
