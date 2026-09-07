import { Dialog } from '@ark-ui/solid/dialog';
import { diffLines } from 'diff';
import { Braces, FileDiff, Minimize2, X } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Content, JsonEditor } from 'vanilla-jsoneditor';
import type { Value } from '../types';

let jsonEditorModule: Promise<typeof import('vanilla-jsoneditor')> | undefined;

function loadJsonEditor() {
  jsonEditorModule ??= import('vanilla-jsoneditor');
  return jsonEditorModule;
}

interface JsonViewerProps {
  value: Value | undefined;
  readOnly?: boolean;
  onChange?: (source: string, valid: boolean) => void;
  onBlur?: () => void;
  onReady?: (focus: () => void) => void;
}

type ParsedJson =
  | { valid: true; value: unknown }
  | { valid: false; error: string; source: string };

interface JsonDiffLine {
  kind: 'context' | 'added' | 'removed';
  oldLine?: number;
  newLine?: number;
  text: string;
}

function linesOf(value: string) {
  const lines = value.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

export default function JsonViewer(props: JsonViewerProps) {
  let container: HTMLDivElement | undefined;
  let editor: JsonEditor | undefined;
  let editorSource: string | undefined;
  let suppressNextBlur = false;
  let syncId = 0;
  let disposed = false;
  const initialSource = String(props.value ?? '');
  const [editorReady, setEditorReady] = createSignal(false);
  const [currentSource, setCurrentSource] = createSignal(initialSource);
  const [diffOpen, setDiffOpen] = createSignal(false);
  const parsed = createMemo<ParsedJson>(() => {
    const source = String(props.value ?? '');
    try {
      return { valid: true, value: JSON.parse(source) as unknown };
    } catch (error) {
      return { valid: false, error: (error as Error).message, source };
    }
  });
  const invalid = createMemo(() => {
    const current = parsed();
    return current.valid ? undefined : current;
  });
  const diff = createMemo(() => {
    let oldLine = 1;
    let newLine = 1;
    const rows: JsonDiffLine[] = [];
    let additions = 0;
    let deletions = 0;

    for (const part of diffLines(initialSource, currentSource())) {
      const kind = part.added ? 'added' : part.removed ? 'removed' : 'context';
      for (const text of linesOf(part.value)) {
        if (kind === 'added') {
          rows.push({ kind, newLine: newLine++, text });
          additions += 1;
        } else if (kind === 'removed') {
          rows.push({ kind, oldLine: oldLine++, text });
          deletions += 1;
        } else {
          rows.push({ kind, oldLine: oldLine++, newLine: newLine++, text });
        }
      }
    }

    return { rows, additions, deletions };
  });

  createEffect(() => {
    const current = parsed();
    const readOnly = props.readOnly ?? true;
    const currentSyncId = ++syncId;
    if (readOnly && !current.valid) {
      if (editor) void editor.destroy();
      editor = undefined;
      editorSource = undefined;
      setEditorReady(false);
      return;
    }
    if (!container) return;
    const source = String(props.value ?? '');
    const content: Content = { text: source };
    void loadJsonEditor().then(({ Mode, createJSONEditor }) => {
      if (disposed || currentSyncId !== syncId || !container) return;
      const editorProps = {
        content,
        mode: Mode.text,
        readOnly,
        mainMenuBar: false,
        navigationBar: false,
        statusBar: false,
        askToFormat: false,
        onChange: (updatedContent: Content) => {
          const updatedSource = 'text' in updatedContent
            ? updatedContent.text
            : JSON.stringify(updatedContent.json, null, 2);
          editorSource = updatedSource;
          setCurrentSource(updatedSource);
          let valid = true;
          try {
            JSON.parse(updatedSource);
          } catch {
            valid = false;
          }
          props.onChange?.(updatedSource, valid);
        },
        onBlur: () => {
          if (suppressNextBlur) {
            suppressNextBlur = false;
            return;
          }
          props.onBlur?.();
        },
      };
      if (editor) {
        if (editorSource !== source) {
          editorSource = source;
          editor.updateProps(editorProps);
        }
      } else {
        editorSource = source;
        editor = createJSONEditor({ target: container, props: editorProps });
        setEditorReady(true);
        props.onReady?.(() => editor?.focus());
      }
    });
  });

  function transform(indentation?: number) {
    if (!editor) return;
    const content = editor.get();
    const source = 'text' in content ? content.text : JSON.stringify(content.json);
    let transformed: string;
    try {
      transformed = JSON.stringify(JSON.parse(source), null, indentation);
    } catch {
      return;
    }
    editorSource = transformed;
    setCurrentSource(transformed);
    editor.set({ text: transformed });
    if (!(props.readOnly ?? true)) props.onChange?.(transformed, true);
  }

  function openDiff() {
    if (!editor) return;
    const content = editor.get();
    setCurrentSource('text' in content ? content.text : JSON.stringify(content.json));
    setDiffOpen(true);
  }

  function keepEditorBlurLocal() {
    suppressNextBlur = true;
    window.setTimeout(() => {
      suppressNextBlur = false;
    });
  }

  onCleanup(() => {
    disposed = true;
    syncId += 1;
    if (editor) void editor.destroy();
    setEditorReady(false);
  });

  return (
    <Show
      when={!(props.readOnly ?? true) || parsed().valid}
      fallback={(
        <Show when={invalid()}>
          {(error) => (
            <div class="json-viewer-error">
              <pre>{error().source}</pre>
              <span>非法 JSON：{error().error}</span>
            </div>
          )}
        </Show>
      )}
    >
      <div class="json-viewer-shell">
        <div class="json-viewer-toolbar">
          <button type="button" disabled={!editorReady() || !parsed().valid} onClick={() => transform(2)}>
            <Braces size={13} />格式化
          </button>
          <button type="button" disabled={!editorReady() || !parsed().valid} onClick={() => transform()}>
            <Minimize2 size={13} />压缩
          </button>
          <button
            type="button"
            disabled={!editorReady() || currentSource() === initialSource}
            onPointerDown={keepEditorBlurLocal}
            onClick={openDiff}
          >
            <FileDiff size={13} />Diff
          </button>
        </div>
        <div class="json-viewer" classList={{ invalid: !parsed().valid }} ref={container} />
      </div>
      <Dialog.Root open={diffOpen()} onOpenChange={(details) => setDiffOpen(details.open)}>
        <Portal>
          <Dialog.Backdrop class="dialog-backdrop" />
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content json-diff-dialog">
              <header class="dialog-header">
                <div class="dialog-heading">
                  <span class="dialog-icon"><FileDiff size={18} /></span>
                  <div>
                    <Dialog.Title class="dialog-title">JSON Diff</Dialog.Title>
                    <Dialog.Description class="dialog-description">
                      对比打开编辑器时的原始内容与当前内容
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.CloseTrigger class="dialog-close" title="关闭" aria-label="关闭">
                  <X size={18} />
                </Dialog.CloseTrigger>
              </header>
              <div class="json-diff-summary">
                <span>{diff().rows.length} 行</span>
                <strong class="added">+{diff().additions}</strong>
                <strong class="removed">-{diff().deletions}</strong>
              </div>
              <div class="json-diff-view">
                <div class="json-diff-file removed">--- 原始内容</div>
                <div class="json-diff-file added">+++ 当前内容</div>
                <div class="json-diff-hunk">
                  @@ -1,{linesOf(initialSource).length} +1,{linesOf(currentSource()).length} @@
                </div>
                <For each={diff().rows}>
                  {(line) => (
                    <div class={`json-diff-line ${line.kind}`}>
                      <span class="json-diff-line-number">{line.oldLine ?? ''}</span>
                      <span class="json-diff-line-number">{line.newLine ?? ''}</span>
                      <span class="json-diff-marker">
                        {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
                      </span>
                      <code>{line.text || ' '}</code>
                    </div>
                  )}
                </For>
              </div>
              <footer class="dialog-actions">
                <Dialog.CloseTrigger class="button button-confirm">关闭</Dialog.CloseTrigger>
              </footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Show>
  );
}
