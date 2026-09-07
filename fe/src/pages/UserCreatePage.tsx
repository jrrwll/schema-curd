import { ArrowLeft, LoaderCircle, Save, UserPlus } from 'lucide-solid';
import { Show, createSignal } from 'solid-js';
import { createUser } from '../api';
import UserFormFields, { EMPTY_USER_FORM, type UserFormValue } from '../components/UserFormFields';

interface UserCreatePageProps {
  navigate: (url: string) => void;
}

export default function UserCreatePage(props: UserCreatePageProps) {
  const [form, setForm] = createSignal<UserFormValue>({ ...EMPTY_USER_FORM });
  const [submitting, setSubmitting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setServerError('');
    try {
      const values = form();
      await createUser({
        name: values.name,
        display_name: values.display_name,
        password: values.password,
      });
      props.navigate('/user');
    } catch (error) {
      setServerError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main class="page-shell create-shell user-form-shell">
      <header class="page-header create-header">
        <div class="header-with-back">
          <button class="icon-button" title="返回用户列表" onClick={() => props.navigate('/user')}>
            <ArrowLeft size={19} />
          </button>
          <div><h1>新增用户</h1></div>
        </div>
      </header>
      <form class="create-form" onSubmit={submit}>
        <div class="form-heading">
          <h2><UserPlus size={16} />用户信息</h2>
          <span>sys_user</span>
        </div>
        <UserFormFields value={form()} onChange={setForm} />
        <Show when={serverError()}><div class="datasource-form-error notice notice-error">{serverError()}</div></Show>
        <div class="form-actions">
          <button type="button" class="button button-ghost" onClick={() => props.navigate('/user')}>取消</button>
          <button class="button button-confirm" type="submit" disabled={submitting()}>
            <Show when={submitting()} fallback={<><Save size={16} />创建</>}>
              <LoaderCircle class="spin" size={16} />创建中
            </Show>
          </button>
        </div>
      </form>
    </main>
  );
}
