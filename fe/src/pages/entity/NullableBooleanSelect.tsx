import type { Value } from '../../types/common';
import { booleanValue } from './entityValues';

interface Props {
  value: Value | undefined;
  emptyLabel: string;
  disabled?: boolean;
  onChange: (value: boolean | null) => void;
}

export default function NullableBooleanSelect(props: Props) {
  return (
    <select
      class="input"
      disabled={props.disabled}
      value={booleanValue(props.value) === null ? '' : String(booleanValue(props.value))}
      onChange={(event) => props.onChange(event.currentTarget.value === '' ? null : event.currentTarget.value === 'true')}
    >
      <option value="">{props.emptyLabel}</option>
      <option value="true">是</option>
      <option value="false">否</option>
    </select>
  );
}
