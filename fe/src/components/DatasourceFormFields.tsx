import { ChevronDown, Settings2 } from 'lucide-solid';
import {
  CONNECTION_FIELD_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../constants';
import BooleanSwitch from './BooleanSwitch';
import type { DatasourceInput } from '../types';

export interface DatasourceFormValue extends DatasourceInput {
  password: string;
}

interface DatasourceFormFieldsProps {
  value: DatasourceFormValue;
  editing?: boolean;
  onChange: (value: DatasourceFormValue) => void;
}

export const EMPTY_DATASOURCE_FORM: DatasourceFormValue = {
  name: '',
  display_name: '',
  url: '',
  username: '',
  password: '',
  bool_as_int: false,
};

export default function DatasourceFormFields(props: DatasourceFormFieldsProps) {
  const update = (value: Partial<DatasourceFormValue>) => props.onChange({ ...props.value, ...value });

  return (
    <>
      <div class="datasource-form-fields">
        <label class="form-field">
          <span class="form-label">名称<b>*</b></span>
          <input class="input form-input" required disabled={props.editing} maxlength={NAME_MAX_LENGTH} value={props.value.name} onInput={(event) => update({ name: event.currentTarget.value })} />
        </label>
        <label class="form-field">
          <span class="form-label">展示名称<b>*</b></span>
          <input class="input form-input" required maxlength={DISPLAY_NAME_MAX_LENGTH} value={props.value.display_name} onInput={(event) => update({ display_name: event.currentTarget.value })} />
        </label>
        <label class="form-field datasource-form-wide">
          <span class="form-label">连接 URL<b>*</b></span>
          <input class="input form-input" required maxlength={CONNECTION_FIELD_MAX_LENGTH} placeholder="mysql://host:3306/database 或 postgresql://host:5432/database" value={props.value.url} onInput={(event) => update({ url: event.currentTarget.value })} />
        </label>
        <label class="form-field">
          <span class="form-label">用户名</span>
          <input class="input form-input" maxlength={CONNECTION_FIELD_MAX_LENGTH} value={props.value.username} onInput={(event) => update({ username: event.currentTarget.value })} />
        </label>
        <label class="form-field">
          <span class="form-label">密码</span>
          <input class="input form-input" type="password" maxlength={CONNECTION_FIELD_MAX_LENGTH} placeholder={props.editing ? '留空保持当前密码' : undefined} value={props.value.password} onInput={(event) => update({ password: event.currentTarget.value })} />
        </label>
      </div>
      <details class="advanced-settings" open>
        <summary>
          <span class="advanced-settings-title"><Settings2 size={15} />高级设置</span>
          <span class="advanced-settings-state">
            <span class="advanced-settings-closed">展开</span>
            <span class="advanced-settings-open">收起</span>
            <ChevronDown size={16} />
          </span>
        </summary>
        <div class="advanced-setting-row">
          <code>bool_as_int</code>
          <BooleanSwitch
            checked={props.value.bool_as_int}
            label={props.value.bool_as_int ? 'true' : 'false'}
            onChange={(value) => update({ bool_as_int: value })}
          />
        </div>
      </details>
    </>
  );
}
