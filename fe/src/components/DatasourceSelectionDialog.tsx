import { Dialog } from '@ark-ui/solid/dialog';
import { ChevronLeft, ChevronRight, Database, LoaderCircle, Search, X } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  COMPACT_DIALOG_PAGE_SIZE,
  DATASOURCE_SEARCH_DEBOUNCE_MS,
} from '../constants';
import type { DiscoveryDatasourceItem, PageResult } from '../types';

interface DatasourceSelectionDialogProps {
  open: boolean;
  selectedId: number | null;
  loadPage: (request: DatasourcePageRequest) => Promise<PageResult<DiscoveryDatasourceItem>>;
  onOpenChange: (open: boolean) => void;
  onSelect: (datasource: DiscoveryDatasourceItem) => void;
}

export interface DatasourcePageRequest {
  keyword?: string;
  page_no: number;
  page_size: number;
}

export default function DatasourceSelectionDialog(props: DatasourceSelectionDialogProps) {
  const [keyword, setKeyword] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [items, setItems] = createSignal<DiscoveryDatasourceItem[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  let requestId = 0;

  const pageCount = createMemo(() => Math.max(1, Math.ceil(total() / COMPACT_DIALOG_PAGE_SIZE)));

  async function loadPage(search: string, pageNo: number) {
    const currentRequest = ++requestId;
    setLoading(true);
    setError('');
    try {
      const result = await props.loadPage({
        keyword: search.trim() || undefined,
        page_no: pageNo,
        page_size: COMPACT_DIALOG_PAGE_SIZE,
      });
      if (currentRequest !== requestId) return;
      setItems(result.items);
      setTotal(result.total);
      if (pageNo > 1 && result.items.length === 0) setPage(Math.max(1, pageNo - 1));
    } catch (reason) {
      if (currentRequest !== requestId) return;
      setError((reason as Error).message);
    } finally {
      if (currentRequest === requestId) setLoading(false);
    }
  }

  function updateKeyword(value: string) {
    setKeyword(value);
    setPage(1);
  }

  createEffect(() => {
    if (!props.open) return;
    const search = keyword();
    const pageNo = page();
    const timeout = window.setTimeout(
      () => void loadPage(search, pageNo),
      DATASOURCE_SEARCH_DEBOUNCE_MS,
    );
    onCleanup(() => window.clearTimeout(timeout));
  });

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
    >
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" />
        <Dialog.Positioner class="dialog-positioner datasource-picker-positioner">
          <Dialog.Content class="dialog-content datasource-picker-dialog">
            <header class="dialog-header">
              <div class="dialog-heading">
                <span class="dialog-icon"><Database size={18} /></span>
                <div>
                  <Dialog.Title class="dialog-title">选择数据源</Dialog.Title>
                  <Dialog.Description class="dialog-description">
                    搜索名称或展示名称，然后选择一个数据源
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.CloseTrigger class="dialog-close" title="关闭" aria-label="关闭">
                <X size={18} />
              </Dialog.CloseTrigger>
            </header>

            <div class="datasource-picker-search">
              <Search size={16} />
              <input
                type="search"
                autocomplete="off"
                autofocus
                placeholder="搜索数据源"
                value={keyword()}
                onInput={(event) => updateKeyword(event.currentTarget.value)}
              />
              <Show when={loading()}><LoaderCircle class="spin" size={15} /></Show>
              <Show when={keyword() && !loading()}>
                <button title="清除搜索" aria-label="清除搜索" onClick={() => updateKeyword('')}>
                  <X size={14} />
                </button>
              </Show>
            </div>

            <div class="datasource-picker-meta">
              <span>共 {total()} 个数据源</span>
              <span>第 {page()} / {pageCount()} 页</span>
            </div>

            <div class="datasource-picker-list" aria-busy={loading()}>
              <Show when={error()}>
                <div class="entity-picker-error">{error()}</div>
              </Show>
              <Show when={!loading()} fallback={
                <div class="entity-picker-loading"><LoaderCircle class="spin" size={17} />正在加载数据源</div>
              }>
                <For each={items()} fallback={
                  <Show when={!error()}><div class="entity-picker-empty">没有匹配的数据源</div></Show>
                }>
                  {(datasource) => (
                    <button
                      class="datasource-picker-card"
                      classList={{ selected: props.selectedId === datasource.id }}
                      onClick={() => props.onSelect(datasource)}
                    >
                      <span class="datasource-picker-card-icon"><Database size={17} /></span>
                      <span class="datasource-picker-card-copy">
                        <strong>{datasource.display_name}</strong>
                        <code>{datasource.name}</code>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  )}
                </For>
              </Show>
            </div>

            <footer class="datasource-picker-pagination">
              <button
                class="icon-button"
                title="上一页"
                aria-label="上一页"
                disabled={loading() || page() <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={17} />
              </button>
              <span>{page()} / {pageCount()}</span>
              <button
                class="icon-button"
                title="下一页"
                aria-label="下一页"
                disabled={loading() || page() >= pageCount()}
                onClick={() => setPage((current) => Math.min(pageCount(), current + 1))}
              >
                <ChevronRight size={17} />
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
