import { Check, ChevronDown, X } from 'lucide-solid';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { roleLabel } from '../enumLabels';
import type { Role } from '../types';

const ROLES: Role[] = ['super_admin', 'user_admin', 'admin', 'write', 'read'];

interface RoleMultiSelectProps {
  value: Role[];
  onChange: (value: Role[]) => void;
}

export default function RoleMultiSelect(props: RoleMultiSelectProps) {
  const [open, setOpen] = createSignal(false);
  const summary = createMemo(() => props.value.length === 0 ? '全部' : props.value.map(roleLabel).join('、'));

  function toggle(role: Role) {
    props.onChange(props.value.includes(role)
      ? props.value.filter((item) => item !== role)
      : [...props.value, role]);
  }

  return (
    <div class="permission-multi-select" onFocusOut={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <div class="input permission-multi-control" classList={{ open: open() }}><button type="button" class="permission-multi-trigger" aria-haspopup="listbox" aria-expanded={open()} onClick={() => setOpen((value) => !value)}><span classList={{ placeholder: props.value.length === 0 }}>{summary()}</span><ChevronDown size={14} /></button><Show when={props.value.length > 0}><button type="button" class="permission-multi-clear" title="清除角色" onClick={() => props.onChange([])}><X size={13} /></button></Show></div>
      <Show when={open()}><div class="permission-multi-options role-multi-options" role="listbox" aria-multiselectable="true"><For each={ROLES}>{(role) => { const selected = () => props.value.includes(role); return <button type="button" role="option" aria-selected={selected()} classList={{ selected: selected() }} onClick={() => toggle(role)}><span class="permission-option-check"><Show when={selected()}><Check size={13} /></Show></span><span>{roleLabel(role)}</span></button>; }}</For></div></Show>
    </div>
  );
}
