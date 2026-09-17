import { Braces, FileDiff, Minimize2 } from 'lucide-solid';
import { Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { Content, JsonEditor } from 'vanilla-jsoneditor';
import type { Value } from '../types/common';
import JsonDiffDialog from './JsonDiffDialog';
import { buildJsonDiff } from './jsonDiff';

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

type JsonDiffMode = 'structured' | 'raw';

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
  const [diffMode, setDiffMode] = createSignal<JsonDiffMode>('structured');
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
  const diff = createMemo(() => buildJsonDiff(initialSource, currentSource(), diffMode()));

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
    setDiffMode('structured');
    setDiffOpen(true);
  }

  function keepEditorBlurLocal() {
    suppressNextBlur = true;
    window.setTimeout(() => {
      suppressNextBlur = false;
    });
  }

  createEffect(() => {
    if (!diffOpen()) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setDiffOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape, true);
    onCleanup(() => document.removeEventListener('keydown', closeOnEscape, true));
  });

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
      <JsonDiffDialog open={diffOpen()} mode={diffMode()} diff={diff()} onModeChange={setDiffMode} onClose={() => setDiffOpen(false)} />
    </Show>
  );
}
