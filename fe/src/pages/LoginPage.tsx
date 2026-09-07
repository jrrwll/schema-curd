import { Database, LoaderCircle, LogIn } from 'lucide-solid';
import { Show, createSignal } from 'solid-js';
import { login } from '../api';
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '../constants';

interface LoginPageProps {
  onAuthenticated: () => Promise<void>;
}

export default function LoginPage(props: LoginPageProps) {
  const [name, setName] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name().trim() || !password()) {
      setError('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(name().trim(), password());
      await props.onAuthenticated();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main class="login-page">
      <section class="login-panel">
        <header class="login-header">
          <span class="login-mark"><Database size={21} /></span>
          <div>
            <h1>Schema CURD</h1>
            <p>登录数据维护平台</p>
          </div>
        </header>
        <form class="login-form" onSubmit={submit}>
          <label class="form-field">
            <span class="login-label">用户名</span>
            <input
              class="input form-input"
              autocomplete="username"
              autofocus
              maxlength={NAME_MAX_LENGTH}
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label class="form-field">
            <span class="login-label">密码</span>
            <input
              class="input form-input"
              type="password"
              autocomplete="current-password"
              maxlength={PASSWORD_MAX_LENGTH}
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
          <Show when={error()}>
            <div class="notice notice-error login-error">{error()}</div>
          </Show>
          <button class="button button-primary login-submit" type="submit" disabled={submitting()}>
            <Show when={submitting()} fallback={<><LogIn size={17} />登录</>}>
              <LoaderCircle class="spin" size={17} />登录中
            </Show>
          </button>
        </form>
      </section>
    </main>
  );
}
