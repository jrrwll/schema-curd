import { FileDiff, X } from 'lucide-solid';
import { For, Show } from 'solid-js';
import type { JsonDiffResult } from './jsonDiff';
import { linesOf } from './jsonDiff';

interface Props {
  open: boolean;
  mode: 'structured' | 'raw';
  diff: JsonDiffResult;
  onModeChange: (mode: 'structured' | 'raw') => void;
  onClose: () => void;
}

export default function JsonDiffDialog(props: Props) {
  return <Show when={props.open}>
    <div class="json-diff-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
      <section class="dialog-content json-diff-dialog" role="dialog" aria-modal="true" aria-label="JSON Diff">
        <header class="dialog-header">
          <div class="dialog-heading">
            <span class="dialog-icon"><FileDiff size={18} /></span>
            <div><h2 class="dialog-title">JSON Diff</h2><div class="dialog-description">对比打开编辑器时的原始内容与当前内容</div></div>
          </div>
          <button type="button" class="dialog-close" title="关闭" aria-label="关闭" onClick={props.onClose}><X size={18} /></button>
        </header>
        <div class="json-diff-summary">
          <div class="json-diff-mode" role="tablist" aria-label="Diff 模式">
            <button type="button" role="tab" aria-selected={props.mode === 'structured'} classList={{ active: props.mode === 'structured' }} onClick={() => props.onModeChange('structured')}>结构化</button>
            <button type="button" role="tab" aria-selected={props.mode === 'raw'} classList={{ active: props.mode === 'raw' }} onClick={() => props.onModeChange('raw')}>原文</button>
          </div>
          <div class="json-diff-counts"><span>{props.diff.rows.length} 行</span><strong class="added">+{props.diff.additions}</strong><strong class="removed">-{props.diff.deletions}</strong></div>
        </div>
        <Show when={props.mode === 'structured' && !props.diff.structured}><div class="json-diff-notice invalid">内容不是合法 JSON，当前按原文比较</div></Show>
        <Show when={props.diff.formattingOnly}><div class="json-diff-notice">结构化内容没有变化，仅格式不同</div></Show>
        <div class="json-diff-view">
          <div class="json-diff-file removed">--- 原始内容</div>
          <div class="json-diff-file added">+++ 当前内容</div>
          <div class="json-diff-hunk">@@ -1,{linesOf(props.diff.before).length} +1,{linesOf(props.diff.after).length} @@</div>
          <For each={props.diff.rows}>{(line) => <div class={`json-diff-line ${line.kind}`}>
            <span class="json-diff-line-number">{line.oldLine ?? ''}</span><span class="json-diff-line-number">{line.newLine ?? ''}</span>
            <span class="json-diff-marker">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</span>
            <code><Show when={line.segments} fallback={line.text || ' '}><For each={line.segments}>{(segment) => <span classList={{ 'json-diff-inline-change': segment.changed }}>{segment.text}</span>}</For></Show></code>
          </div>}</For>
        </div>
        <footer class="dialog-actions"><button type="button" class="button button-confirm" onClick={props.onClose}>关闭</button></footer>
      </section>
    </div>
  </Show>;
}
