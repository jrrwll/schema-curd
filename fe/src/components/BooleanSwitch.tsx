import { Switch } from '@ark-ui/solid';

interface BooleanSwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export default function BooleanSwitch(props: BooleanSwitchProps) {
  return (
    <Switch.Root
      checked={props.checked}
      disabled={props.disabled}
      onCheckedChange={(details) => props.onChange(details.checked)}
      class="switch-root"
    >
      <Switch.HiddenInput />
      <Switch.Control class="switch-control">
        <Switch.Thumb class="switch-thumb" />
      </Switch.Control>
      <Switch.Label class="switch-label">{props.label}</Switch.Label>
    </Switch.Root>
  );
}
