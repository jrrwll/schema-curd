import { Show, createEffect } from 'solid-js';
import {
  DISPLAY_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../constants';

export interface UserFormValue {
  name: string;
  display_name: string;
  password: string;
  password_confirm: string;
}

interface UserFormFieldsProps {
  value: UserFormValue;
  editing?: boolean;
  onChange: (value: UserFormValue) => void;
}

export const EMPTY_USER_FORM: UserFormValue = {
  name: '',
  display_name: '',
  password: '',
  password_confirm: '',
};

export default function UserFormFields(props: UserFormFieldsProps) {
  const update = (value: Partial<UserFormValue>) => props.onChange({ ...props.value, ...value });
  let passwordConfirmInput: HTMLInputElement | undefined;

  createEffect(() => {
    passwordConfirmInput?.setCustomValidity(
      props.value.password === props.value.password_confirm ? '' : '两次输入的密码不一致',
    );
  });

  return (
    <>
      <div class="datasource-form-fields user-form-fields">
        <label class="form-field">
          <span class="form-label">用户名<b>*</b></span>
          <input class="input form-input" required disabled={props.editing} maxlength={NAME_MAX_LENGTH} autocomplete="off" value={props.value.name} onInput={(event) => update({ name: event.currentTarget.value })} />
        </label>
        <label class="form-field">
          <span class="form-label">展示名称<b>*</b></span>
          <input class="input form-input" required maxlength={DISPLAY_NAME_MAX_LENGTH} value={props.value.display_name} onInput={(event) => update({ display_name: event.currentTarget.value })} />
        </label>
        <label class="form-field">
          <span class="form-label">密码<Show when={!props.editing}><b>*</b></Show></span>
          <input
            class="input form-input"
            type="password"
            required={!props.editing}
            minlength={PASSWORD_MIN_LENGTH}
            maxlength={PASSWORD_MAX_LENGTH}
            autocomplete="new-password"
            placeholder={props.editing ? '留空保持当前密码' : `${PASSWORD_MIN_LENGTH} - ${PASSWORD_MAX_LENGTH} 个字符`}
            value={props.value.password}
            onInput={(event) => update({ password: event.currentTarget.value })}
          />
        </label>
        <label class="form-field">
          <span class="form-label">确认密码<Show when={!props.editing || props.value.password}><b>*</b></Show></span>
          <input
            ref={passwordConfirmInput}
            class="input form-input"
            classList={{ invalid: Boolean(props.value.password_confirm && props.value.password !== props.value.password_confirm) }}
            type="password"
            required={!props.editing || Boolean(props.value.password)}
            minlength={PASSWORD_MIN_LENGTH}
            maxlength={PASSWORD_MAX_LENGTH}
            autocomplete="new-password"
            placeholder={props.editing ? '再次输入新密码' : '再次输入密码'}
            value={props.value.password_confirm}
            onInput={(event) => update({ password_confirm: event.currentTarget.value })}
          />
          <Show when={props.value.password_confirm && props.value.password !== props.value.password_confirm}>
            <span class="field-error">两次输入的密码不一致</span>
          </Show>
        </label>
      </div>

    </>
  );
}
