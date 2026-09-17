import { ArrowLeft, LoaderCircle, Save, TriangleAlert, UserRound } from 'lucide-solid';
import { Match, Show, Switch, createEffect, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import { getUserDetail, updateUser } from '../api/user';
import { DISPLAY_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants';

interface Props { id: number | null; navigate: (url: string, replace?: boolean) => void; }

export default function UserUpdatePage(props: Props) {
  const id = () => props.id ?? 0;
  const validId = () => Number.isInteger(id()) && id() > 0;
  const [user] = createResource(() => validId() ? id() : undefined, getUserDetail);
  const userValue = createMemo(() => user.error ? undefined : user());
  const [displayName, setDisplayName] = createSignal('');
  const [loadedId, setLoadedId] = createSignal<number | null>(null);
  const [password, setPassword] = createSignal('');
  const [passwordConfirm, setPasswordConfirm] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  let normalizedUrl = false;
  let active = true;
  onCleanup(() => { active = false; });

  createEffect(() => {
    if (!validId() || normalizedUrl || window.location.pathname !== '/user/update') return;
    const canonicalUrl = `/user/update?user=${id()}`;
    if (`${window.location.pathname}${window.location.search}` === canonicalUrl) return;
    normalizedUrl = true;
    props.navigate(canonicalUrl, true);
  });

  createEffect(() => {
    const current = userValue();
    if (!current || loadedId() === current.id) return;
    setDisplayName(current.display_name);
    setLoadedId(current.id);
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!validId()) return;
    if (!displayName().trim() && !password()) { setError('请至少填写展示名称或新密码'); return; }
    if (password() !== passwordConfirm()) { setError('两次输入的密码不一致'); return; }
    setSubmitting(true); setError('');
    try {
      await updateUser({ id: id(), ...(displayName().trim() ? { display_name: displayName().trim() } : {}), ...(password() ? { password: password() } : {}) });
      if (active) props.navigate('/user');
    } catch (reason) { setError((reason as Error).message); }
    finally { setSubmitting(false); }
  }

  return <main class="page-shell create-shell user-form-shell">
    <header class="page-header create-header"><div class="header-with-back"><button class="icon-button" title="返回用户列表" onClick={() => props.navigate('/user')}><ArrowLeft size={19} /></button><div><h1>编辑用户</h1><div class="table-code">ID: {props.id}</div></div></div></header>
    <Switch>
      <Match when={!validId()}><div class="app-state app-error"><TriangleAlert size={20} />无效的用户 ID</div></Match>
      <Match when={user.loading}><div class="app-state"><LoaderCircle class="spin" size={18} />正在加载</div></Match>
      <Match when={user.error || !userValue()}><div class="app-state app-error"><TriangleAlert size={20} />{user.error?.message || '未找到用户'}</div></Match>
      <Match when>
        <form class="create-form" onSubmit={submit}><fieldset class="form-disabled-scope" disabled={submitting()}><div class="form-heading"><h2><UserRound size={16} />用户信息</h2><span>只提交已填写项</span></div><div class="datasource-form-fields user-form-fields">
          <label class="form-field"><span class="form-label">新展示名称</span><input class="input form-input" maxlength={DISPLAY_NAME_MAX_LENGTH} value={displayName()} onInput={(event) => setDisplayName(event.currentTarget.value)} /></label>
          <label class="form-field"><span class="form-label">新密码</span><input class="input form-input" type="password" minlength={PASSWORD_MIN_LENGTH} maxlength={PASSWORD_MAX_LENGTH} value={password()} onInput={(event) => setPassword(event.currentTarget.value)} /></label>
          <label class="form-field"><span class="form-label">确认新密码</span><input class="input form-input" type="password" required={Boolean(password())} minlength={PASSWORD_MIN_LENGTH} maxlength={PASSWORD_MAX_LENGTH} value={passwordConfirm()} onInput={(event) => setPasswordConfirm(event.currentTarget.value)} /></label>
        </div><Show when={error()}><div class="notice notice-error">{error()}</div></Show><div class="form-actions"><button type="button" class="button button-ghost" onClick={() => props.navigate('/user')}>取消</button><button class="button button-confirm" type="submit" disabled={submitting()}><Show when={!submitting()} fallback={<><LoaderCircle class="spin" size={16} />保存中</>}><Save size={16} />保存</Show></button></div></fieldset></form>
      </Match>
    </Switch>
  </main>;
}
