import { Check, ChevronDown, LoaderCircle, Search, X } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { SEARCH_DEBOUNCE_MS } from '../constants';

export interface SearchMultiOption {
  id: string;
  label: string;
  detail: string;
}

interface SearchMultiSelectProps {
  value: SearchMultiOption[];
  placeholder: string;
  searchPlaceholder: string;
  reloadKey?: string;
  disabled?: boolean;
  loadOptions: (keyword: string) => Promise<SearchMultiOption[]>;
  onChange: (value: SearchMultiOption[]) => void;
}

export default function SearchMultiSelect(props: SearchMultiSelectProps) {
  const [open, setOpen] = createSignal(false);
  const [keyword, setKeyword] = createSignal('');
  const [items, setItems] = createSignal<SearchMultiOption[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  let requestId = 0;
  const summary = createMemo(() => props.value.length === 0
    ? props.placeholder
    : props.value.map((item) => item.label).join('、'));

  createEffect(() => {
    if (props.disabled) setOpen(false);
  });

  createEffect(() => {
    if (!open() || props.disabled) return;
    props.reloadKey;
    const search = keyword();
    const timeout = window.setTimeout(async () => {
      const current = ++requestId;
      setLoading(true);
      setError('');
      try {
        const result = await props.loadOptions(search.trim());
        if (current === requestId) setItems(result);
      } catch (reason) {
        if (current === requestId) setError((reason as Error).message);
      } finally {
        if (current === requestId) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    onCleanup(() => window.clearTimeout(timeout));
  });

  function toggle(option: SearchMultiOption) {
    props.onChange(props.value.some((item) => item.id === option.id)
      ? props.value.filter((item) => item.id !== option.id)
      : [...props.value, option]);
  }

  return (
    <div class="search-multi-select" onFocusOut={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <div class="input permission-multi-control" classList={{ open: open(), disabled: props.disabled }}>
        <button type="button" class="permission-multi-trigger" disabled={props.disabled} aria-haspopup="listbox" aria-expanded={open()} onClick={() => setOpen((value) => !value)}><span classList={{ placeholder: props.value.length === 0 }}>{summary()}</span><ChevronDown size={14} /></button>
        <Show when={props.value.length > 0 && !props.disabled}><button type="button" class="permission-multi-clear" title="清除选择" onClick={() => props.onChange([])}><X size={13} /></button></Show>
      </div>
      <Show when={open() && !props.disabled}>
        <div class="search-multi-options">
          <div class="search-multi-input"><Search size={14} /><input type="search" autocomplete="off" autofocus placeholder={props.searchPlaceholder} value={keyword()} onInput={(event) => setKeyword(event.currentTarget.value)} /><Show when={loading()}><LoaderCircle class="spin" size={14} /></Show></div>
          <div class="search-multi-list" role="listbox" aria-multiselectable="true">
            <Show when={error()}><div class="user-search-state app-error">{error()}</div></Show>
            <Show when={!loading()} fallback={<div class="user-search-state"><LoaderCircle class="spin" size={14} />正在搜索</div>}>
              <For each={items()} fallback={<Show when={!error()}><div class="user-search-state">没有匹配项</div></Show>}>
                {(item) => {
                  const selected = () => props.value.some((value) => value.id === item.id);
                  return <button type="button" role="option" aria-selected={selected()} classList={{ selected: selected() }} onClick={() => toggle(item)}><span class="permission-option-check"><Show when={selected()}><Check size={13} /></Show></span><span><strong>{item.label}</strong><code>{item.detail}</code></span></button>;
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
