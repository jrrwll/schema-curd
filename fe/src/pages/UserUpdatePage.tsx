import { ArrowLeft, LoaderCircle, Save, TriangleAlert, UserRound } from 'lucide-solid';
import { Match, Show, Switch, createEffect, createResource, createSignal } from 'solid-js';
import { getUsers, updateUser } from '../api';
import UserFormFields, { type UserFormValue } from '../components/UserFormFields';

interface UserUpdatePageProps {
  id: string | null;
  navigate: (url: string) => void;
}

export default function UserUpdatePage(props: UserUpdatePageProps) {
  const id = () => Number(props.id);
  const [result] = createResource(
    () => Number.isInteger(id()) && id() > 0 ? id() : null,
    (userId) => getUsers({ id: userId, page_no: 1, page_size: 1 }),
  );
  const [form, setForm] = createSignal<UserFormValue>();
  const [loadedId, setLoadedId] = createSignal<number | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');
  const user = () => result()?.items[0];

  createEffect(() => {
    const current = user();
    if (!current || loadedId() === current.id) return;
    setForm({
      name: current.name,
      display_name: current.display_name,
      password: '',
      password_confirm: '',
    });
    setLoadedId(current.id);
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const values = form();
    if (!values || !user()) return;
    setSubmitting(true);
    setServerError('');
    try {
      await updateUser({
        id: user()!.id,
        display_name: values.display_name,
        ...(values.password ? { password: values.password } : {}),
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
          <div>
            <h1>编辑用户</h1>
            <Show when={user()}>{(current) => <div class="table-code">{current().name}</div>}</Show>
          </div>
        </div>
      </header>
      <Switch>
        <Match when={result.loading}><div class="app-state"><LoaderCircle class="spin" size={18} />正在加载</div></Match>
        <Match when={result.error}><div class="app-state app-error"><TriangleAlert size={20} />{result.error?.message}</div></Match>
        <Match when={!user()}><div class="app-state app-error"><TriangleAlert size={20} />User not found</div></Match>
        <Match when={user()?.disable}><div class="app-state app-error"><TriangleAlert size={20} />禁用用户不能编辑</div></Match>
        <Match when={form()}>
          {(value) => (
            <form class="create-form" onSubmit={submit}>
              <div class="form-heading">
                <h2><UserRound size={16} />用户信息</h2>
                <span>sys_user</span>
              </div>
              <UserFormFields value={value()} editing onChange={setForm} />
              <Show when={serverError()}><div class="datasource-form-error notice notice-error">{serverError()}</div></Show>
              <div class="form-actions">
                <button type="button" class="button button-ghost" onClick={() => props.navigate('/user')}>取消</button>
                <button class="button button-confirm" type="submit" disabled={submitting()}>
                  <Show when={submitting()} fallback={<><Save size={16} />保存</>}>
                    <LoaderCircle class="spin" size={16} />保存中
                  </Show>
                </button>
              </div>
            </form>
          )}
        </Match>
      </Switch>
    </main>
  );
}
