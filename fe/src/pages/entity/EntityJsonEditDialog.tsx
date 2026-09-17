import { Dialog } from '@ark-ui/solid';
import { Braces, Check, X } from 'lucide-solid';
import { Show, createEffect, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import JsonViewer from '../../components/JsonViewer';
import type { EntityColumnConfig } from '../../types/entity';

interface Props {
  open: boolean;
  column: EntityColumnConfig | null;
  value: string;
  original: string;
  valid: boolean;
  onChange: (source: string, valid: boolean) => void;
  onConfirm: () => void;
  onDiscard: () => void;
}

export default function EntityJsonEditDialog(props: Props) {
  const [discardOpen, setDiscardOpen] = createSignal(false);
  let dialog: HTMLDivElement | undefined;
  let focusEditor: (() => void) | undefined;

  createEffect(() => {
    if (!props.open) {
      setDiscardOpen(false);
      focusEditor = undefined;
    }
  });

  function requestClose() {
    if (props.value !== props.original) setDiscardOpen(true);
    else props.onDiscard();
  }

  function handleBlur() {
    queueMicrotask(() => {
      if (props.open && props.value !== props.original && !dialog?.contains(document.activeElement)) {
        setDiscardOpen(true);
      }
    });
  }

  return <>
    <Dialog.Root open={props.open} closeOnEscape={false} closeOnInteractOutside={false} onOpenChange={(details) => !details.open && requestClose()}>
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" onClick={requestClose} />
        <Dialog.Positioner class="dialog-positioner">
          <Dialog.Content
            ref={dialog}
            class="dialog-content json-edit-dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                requestClose();
              }
            }}
          >
            <div class="dialog-header">
              <div class="dialog-heading">
                <span class="dialog-icon"><Braces size={19} /></span>
                <div>
                  <Dialog.Title class="dialog-title">编辑 JSON</Dialog.Title>
                  <Dialog.Description class="dialog-description">{props.column?.display_name} · {props.column?.name}</Dialog.Description>
                </div>
              </div>
              <button type="button" class="dialog-close" title="关闭" onClick={requestClose}><X size={18} /></button>
            </div>
            <div class="json-edit-body">
              <Show when={props.open}>
                <JsonViewer value={props.value} readOnly={false} onChange={props.onChange} onBlur={handleBlur} onReady={(focus) => { focusEditor = focus; }} />
                <Show when={!props.valid}><div class="json-editor-validation-error">请输入合法 JSON</div></Show>
              </Show>
            </div>
            <div class="dialog-actions">
              <button type="button" class="button button-ghost" onClick={requestClose}>取消</button>
              <button type="button" class="button button-confirm" disabled={!props.valid} onClick={props.onConfirm}><Check size={16} />确认</button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>

    <Dialog.Root open={discardOpen()} closeOnEscape={false} closeOnInteractOutside={false}>
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" />
        <Dialog.Positioner class="dialog-positioner">
          <Dialog.Content class="dialog-content discard-json-dialog">
            <div class="dialog-header">
              <div class="dialog-heading">
                <span class="dialog-icon"><Braces size={19} /></span>
                <div><Dialog.Title class="dialog-title">丢弃 JSON 修改</Dialog.Title><Dialog.Description class="dialog-description">编辑器中有尚未确认的内容</Dialog.Description></div>
              </div>
            </div>
            <div class="discard-json-message">是否丢弃本次修改？</div>
            <div class="dialog-actions">
              <button type="button" class="button button-ghost" onClick={() => { setDiscardOpen(false); queueMicrotask(() => focusEditor?.()); }}>继续编辑</button>
              <button type="button" class="button button-danger" onClick={props.onDiscard}>丢弃修改</button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  </>;
}
