import { Dialog } from '@ark-ui/solid/dialog';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Portal } from 'solid-js/web';
import JsonViewer from '../src/components/JsonViewer';

const editor = {
  source: '{\n  "status": "draft"\n}',
  props: undefined as { onChange: (content: { text: string }) => void } | undefined,
  destroy: vi.fn(),
  focus: vi.fn(),
  get() { return { text: this.source }; },
  set(content: { text: string }) { this.source = content.text; },
  updateProps: vi.fn((props: { onChange: (content: { text: string }) => void }) => { editor.props = props; }),
};

vi.mock('vanilla-jsoneditor', () => ({
  Mode: { text: 'text' },
  createJSONEditor: ({ props }: { props: { onChange: (content: { text: string }) => void } }) => {
    editor.props = props;
    return editor;
  },
}));

afterEach(() => {
  editor.source = '{\n  "status": "draft"\n}';
  editor.props = undefined;
  vi.clearAllMocks();
});

describe('JSON diff dialog', () => {
  function renderEditor(initial = '{\n  "status": "draft"\n}') {
    render(() => (
      <Dialog.Root open>
        <Portal>
          <Dialog.Positioner class="dialog-positioner">
            <Dialog.Content class="dialog-content">
              <Dialog.Title>编辑 JSON</Dialog.Title>
              <JsonViewer value={initial} readOnly={false} />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    ));
  }

  async function openDiff(source: string) {
    const diffButton = screen.getByRole('button', { name: 'Diff', hidden: true });
    await waitFor(() => expect(editor.props).toBeTruthy());
    editor.source = source;
    editor.props?.onChange({ text: editor.source });
    fireEvent.click(diffButton);
    return screen.findByRole('dialog', { name: 'JSON Diff' });
  }

  test('shows formatted line and inline changes above an enclosing dialog', async () => {
    renderEditor('{"status":"draft","count":1}');

    const dialog = await openDiff('{"status":"drift","count":1}');
    expect(dialog.hidden).toBe(false);
    expect(dialog.closest('.json-diff-overlay')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: '编辑 JSON', hidden: true }).getAttribute('data-state')).toBe('open');
    const diffText = document.querySelector('.json-diff-view')?.textContent ?? '';
    expect(diffText).toContain('"status": "draft"');
    expect(diffText).toContain('"status": "drift"');
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('-1')).toBeTruthy();
    const removedChange = dialog.querySelector('.json-diff-line.removed .json-diff-inline-change');
    const addedChange = dialog.querySelector('.json-diff-line.added .json-diff-inline-change');
    expect(removedChange?.textContent).toBe('a');
    expect(addedChange?.textContent).toBe('i');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'JSON Diff' })).toBeNull();
  });

  test('ignores formatting-only changes in structured mode and exposes them in raw mode', async () => {
    renderEditor('{"status":"draft","count":1}');
    const dialog = await openDiff('{\n  "status": "draft",\n  "count": 1\n}');

    expect(screen.getByText('结构化内容没有变化，仅格式不同')).toBeTruthy();
    expect(screen.getByText('+0')).toBeTruthy();
    expect(screen.getByText('-0')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '原文' }));
    expect(screen.queryByText('结构化内容没有变化，仅格式不同')).toBeNull();
    expect(dialog.querySelectorAll('.json-diff-line.added').length).toBeGreaterThan(0);
    expect(dialog.querySelectorAll('.json-diff-line.removed').length).toBeGreaterThan(0);
  });

  test('falls back to source comparison when the current content is invalid JSON', async () => {
    renderEditor();
    await openDiff('{"status":"draft"');

    expect(screen.getByText('内容不是合法 JSON，当前按原文比较')).toBeTruthy();
    expect(document.querySelectorAll('.json-diff-line.added').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.json-diff-line.removed').length).toBeGreaterThan(0);
  });
});
