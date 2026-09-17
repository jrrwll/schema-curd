import { For } from 'solid-js';
import { PAGE_SIZE_OPTIONS } from '../constants';

interface Props {
  value: number;
  disabled?: boolean;
  class?: string;
  onChange: (value: number) => void;
}

export default function PageSizeSelect(props: Props) {
  return <label class={`page-size-control${props.class ? ` ${props.class}` : ''}`}>
    <span>每页</span>
    <select value={props.value} disabled={props.disabled} onChange={(event) => props.onChange(Number(event.currentTarget.value))}>
      <For each={PAGE_SIZE_OPTIONS}>{(size) => <option value={size}>{size}</option>}</For>
    </select>
    <span>条</span>
  </label>;
}
