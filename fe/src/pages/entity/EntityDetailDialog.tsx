import { Dialog } from '@ark-ui/solid';
import { Copy, Eye, X } from 'lucide-solid';
import { For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Row, Value } from '../../types/common';
import type { EntityTableView } from '../../types/entity';
import { displayValue } from './entityValues';

interface Props {
  open: boolean;
  table: EntityTableView;
  row: Row | null;
  identity: string;
  onRequestClose: () => void;
}

function copyValue(value: Value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text !== undefined) void navigator.clipboard?.writeText(text);
}

export default function EntityDetailDialog(props: Props) {
  return <Dialog.Root open={props.open} onOpenChange={(details) => !details.open && props.onRequestClose()}>
    <Portal>
      <Dialog.Backdrop class="dialog-backdrop" />
      <Dialog.Positioner class="dialog-positioner">
        <Dialog.Content class="dialog-content entity-detail-dialog">
          <div class="dialog-header">
            <div class="dialog-heading">
              <span class="dialog-icon"><Eye size={19} /></span>
              <div><Dialog.Title class="dialog-title">数据详情</Dialog.Title><Dialog.Description class="dialog-description">{props.identity || props.table.display_name}</Dialog.Description></div>
            </div>
            <Dialog.CloseTrigger class="dialog-close" title="关闭"><X size={18} /></Dialog.CloseTrigger>
          </div>
          <div class="entity-detail-list">
            <Show when={props.row}>
              <For each={props.table.columns}>{(column) => <div class="entity-detail-row">
                <div class="entity-detail-key"><strong>{column.display_name}</strong><code>{column.name}</code></div>
                <div class="entity-detail-value entity-detail-readonly"><code>{displayValue(column, props.row?.[column.name])}</code><button type="button" class="icon-button" title="复制值" onClick={() => copyValue(props.row?.[column.name] ?? null)}><Copy size={15} /></button></div>
              </div>}</For>
            </Show>
          </div>
          <div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost">关闭</Dialog.CloseTrigger></div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>;
}
