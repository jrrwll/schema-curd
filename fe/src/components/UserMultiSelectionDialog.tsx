import { Dialog } from '@ark-ui/solid/dialog';
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Search, UserPlus, UserRound, X } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getUsers } from '../api';
import { COMPACT_DIALOG_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../constants';
import type { UserRecord } from '../types';

interface UserMultiSelectionDialogProps {
  open: boolean;
  role: 'super_admin' | 'user_admin';
  onOpenChange: (open: boolean) => void;
  onConfirm: (users: UserRecord[]) => void;
}

function hasActiveRole(user: UserRecord, role: 'super_admin' | 'user_admin') {
  return user.roles.some((item) => item.role === role);
}

function roleLabel(role: 'super_admin' | 'user_admin') {
  return role === 'super_admin' ? '超级管理员' : '用户管理员';
}

function blockedReason(user: UserRecord, role: 'super_admin' | 'user_admin') {
  if (user.disable) return '用户已禁用';
  if (role === 'user_admin' && hasActiveRole(user, 'super_admin')) return '超级管理员不能追加授权';
  if (hasActiveRole(user, role)) return `已经是${roleLabel(role)}`;
  return null;
}

export default function UserMultiSelectionDialog(props: UserMultiSelectionDialogProps) {
  const [keyword, setKeyword] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [items, setItems] = createSignal<UserRecord[]>([]);
  const [selected, setSelected] = createSignal<Record<number, UserRecord>>({});
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  let requestId = 0;
  let wasOpen = false;
  const pageCount = createMemo(() => Math.max(1, Math.ceil(total() / COMPACT_DIALOG_PAGE_SIZE)));
  const selectedUsers = createMemo(() => Object.values(selected()));

  createEffect(() => {
    const open = props.open;
    if (open && !wasOpen) {
      setKeyword('');
      setPage(1);
      setSelected({});
      setError('');
    }
    if (!open && wasOpen) requestId += 1;
    wasOpen = open;
  });

  createEffect(() => {
    if (!props.open) return;
    const search = keyword();
    const pageNo = page();
    const timeout = window.setTimeout(async () => {
      const current = ++requestId;
      setLoading(true);
      setError('');
      try {
        const result = await getUsers({ name: search.trim() || undefined, page_no: pageNo, page_size: COMPACT_DIALOG_PAGE_SIZE });
        if (current !== requestId) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (reason) {
        if (current === requestId) setError((reason as Error).message);
      } finally {
        if (current === requestId) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    onCleanup(() => window.clearTimeout(timeout));
  });

  function search(value: string) {
    setKeyword(value);
    setPage(1);
  }

  function toggle(user: UserRecord) {
    if (blockedReason(user, props.role)) return;
    const next = { ...selected() };
    if (next[user.id]) delete next[user.id];
    else next[user.id] = user;
    setSelected(next);
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={(details) => props.onOpenChange(details.open)}>
      <Portal>
        <Dialog.Backdrop class="dialog-backdrop" />
        <Dialog.Positioner class="dialog-positioner datasource-picker-positioner">
          <Dialog.Content class="dialog-content datasource-picker-dialog user-multi-dialog">
            <header class="dialog-header">
              <div class="dialog-heading"><span class="dialog-icon"><UserPlus size={18} /></span><div><Dialog.Title class="dialog-title">新增{roleLabel(props.role)}</Dialog.Title><Dialog.Description class="dialog-description">搜索并选择一个或多个用户</Dialog.Description></div></div>
              <Dialog.CloseTrigger class="dialog-close" title="关闭"><X size={18} /></Dialog.CloseTrigger>
            </header>
            <div class="datasource-picker-search">
              <Search size={16} /><input type="search" autocomplete="off" autofocus placeholder="搜索用户名或展示名称" value={keyword()} onInput={(event) => search(event.currentTarget.value)} />
              <Show when={loading()}><LoaderCircle class="spin" size={15} /></Show>
              <Show when={keyword() && !loading()}><button type="button" title="清除搜索" onClick={() => search('')}><X size={14} /></button></Show>
            </div>
            <div class="datasource-picker-meta"><span>共 {total()} 个用户</span><span>已选择 {selectedUsers().length} 个</span></div>
            <div class="datasource-picker-list" aria-busy={loading()}>
              <Show when={error()}><div class="entity-picker-error">{error()}</div></Show>
              <Show when={!loading()} fallback={<div class="entity-picker-loading"><LoaderCircle class="spin" size={17} />正在加载用户</div>}>
                <For each={items()} fallback={<Show when={!error()}><div class="entity-picker-empty">没有匹配的用户</div></Show>}>
                  {(user) => {
                    const reason = () => blockedReason(user, props.role);
                    const checked = () => Boolean(selected()[user.id]);
                    return (
                      <button type="button" class="datasource-picker-card user-multi-card" classList={{ selected: checked() }} disabled={Boolean(reason())} title={reason() ?? undefined} onClick={() => toggle(user)}>
                        <span class="datasource-picker-card-icon"><UserRound size={17} /></span>
                        <span class="datasource-picker-card-copy"><strong>{user.display_name}</strong><code>{user.name}</code></span>
                        <Show when={reason()} fallback={<span class="user-multi-eligible">{checked() ? '已选择' : '可授权'}</span>}>{(message) => <span class="user-multi-blocked">{message()}</span>}</Show>
                        <span class="user-multi-check"><Show when={checked()}><Check size={14} /></Show></span>
                      </button>
                    );
                  }}
                </For>
              </Show>
            </div>
            <div class="user-multi-pagination">
              <button class="icon-button" type="button" title="上一页" disabled={loading() || page() <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button>
              <span>{page()} / {pageCount()}</span>
              <button class="icon-button" type="button" title="下一页" disabled={loading() || page() >= pageCount()} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button>
            </div>
            <footer class="user-multi-footer actions-only">
              <div class="dialog-actions"><Dialog.CloseTrigger class="button button-ghost">取消</Dialog.CloseTrigger><button type="button" class="button button-confirm" disabled={selectedUsers().length === 0} onClick={() => props.onConfirm(selectedUsers())}><UserPlus size={16} />下一步</button></div>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
