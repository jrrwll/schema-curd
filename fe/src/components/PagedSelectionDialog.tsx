import { Dialog } from '@ark-ui/solid';
import { ChevronRight, LoaderCircle, Search, X } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../constants';
import { createPagedResource } from '../createPagedResource';
import type { PageResult } from '../types/common';
import PageSizeSelect from './PageSizeSelect';
import PaginationControl from './PaginationControl';
import type { SearchMultiOption } from './SearchMultiSelect';

export interface SelectionPageRequest {
  keyword?: string;
  page_no: number;
  page_size: number;
}

interface Props {
  open: boolean;
  selectedId: string | null;
  title: string;
  description: string;
  searchPlaceholder: string;
  emptyText: string;
  loadingText: string;
  countLabel: string;
  icon: (size: number) => JSX.Element;
  loadPage: (request: SelectionPageRequest) => Promise<PageResult<SearchMultiOption>>;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: SearchMultiOption) => void;
}

export default function PagedSelectionDialog(props: Props) {
  const [keyword, setKeyword] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(DEFAULT_PAGE_SIZE);
  const [debouncedKeyword, setDebouncedKeyword] = createSignal('');
  const pageResource = createPagedResource(
    () => props.open ? {
      keyword: debouncedKeyword().trim() || undefined,
      page_no: page(),
      page_size: pageSize(),
    } : undefined,
    props.loadPage,
    setPage,
  );
  const items = () => pageResource.data()?.items ?? [];
  const total = () => pageResource.data()?.total ?? 0;
  const pageCount = createMemo(() => Math.max(1, Math.ceil(total() / pageSize())));

  createEffect(() => {
    if (!props.open) {
      setKeyword('');
      setDebouncedKeyword('');
      setPage(1);
      return;
    }
    const search = keyword();
    const timeout = window.setTimeout(() => setDebouncedKeyword(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  });

  function updateKeyword(value: string) {
    setKeyword(value);
    setPage(1);
  }

  function select(item: SearchMultiOption) {
    props.onSelect(item);
    props.onOpenChange(false);
  }

  return <Dialog.Root open={props.open} onOpenChange={(details) => props.onOpenChange(details.open)}>
    <Portal>
      <Dialog.Backdrop class="dialog-backdrop" />
      <Dialog.Positioner class="dialog-positioner datasource-picker-positioner">
        <Dialog.Content class="dialog-content datasource-picker-dialog">
          <header class="dialog-header">
            <div class="dialog-heading">
              <span class="dialog-icon">{props.icon(18)}</span>
              <div><Dialog.Title class="dialog-title">{props.title}</Dialog.Title><Dialog.Description class="dialog-description">{props.description}</Dialog.Description></div>
            </div>
            <Dialog.CloseTrigger class="dialog-close" title="关闭" aria-label="关闭"><X size={18} /></Dialog.CloseTrigger>
          </header>

          <div class="datasource-picker-search">
            <Search size={16} />
            <input type="search" autocomplete="off" autofocus placeholder={props.searchPlaceholder} value={keyword()} onInput={(event) => updateKeyword(event.currentTarget.value)} />
            <Show when={pageResource.loading()}><LoaderCircle class="spin" size={15} /></Show>
            <Show when={keyword() && !pageResource.loading()}><button type="button" title="清除搜索" aria-label="清除搜索" onClick={() => updateKeyword('')}><X size={14} /></button></Show>
          </div>

          <div class="datasource-picker-meta"><span>共 {total()} {props.countLabel}</span><span>第 {page()} / {pageCount()} 页</span></div>
          <div class="datasource-picker-list" aria-busy={pageResource.loading()}>
            <Show when={pageResource.error()}><div class="entity-picker-error">{pageResource.error()?.message}</div></Show>
            <Show when={!pageResource.loading()} fallback={<div class="entity-picker-loading"><LoaderCircle class="spin" size={17} />{props.loadingText}</div>}>
              <For each={items()} fallback={<Show when={!pageResource.error()}><div class="entity-picker-empty">{props.emptyText}</div></Show>}>
                {(item) => <button type="button" class="datasource-picker-card" classList={{ selected: props.selectedId === item.id }} onClick={() => select(item)}>
                  <span class="datasource-picker-card-icon">{props.icon(17)}</span>
                  <span class="datasource-picker-card-copy"><strong>{item.label}</strong><code>{item.detail}</code></span><ChevronRight size={16} />
                </button>}
              </For>
            </Show>
          </div>
          <footer class="datasource-picker-pagination">
            <PaginationControl count={total()} page={page()} pageSize={pageSize()} loading={pageResource.loading()} onPageChange={setPage} />
            <PageSizeSelect class="dialog-page-size" value={pageSize()} disabled={pageResource.loading()} onChange={(value) => { setPage(1); setPageSize(value); }} />
          </footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>;
}
