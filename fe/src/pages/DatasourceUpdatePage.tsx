import { ArrowLeft, Cable, Database, LoaderCircle, Save, ShieldX, TriangleAlert } from 'lucide-solid';
import { Match, Show, Switch, createEffect, createResource, createSignal } from 'solid-js';
import { getDatasourceDetail, testDatasourceConnection, updateDatasource } from '../api';
import DatasourceFormFields, { type DatasourceFormValue } from '../components/DatasourceFormFields';

interface DatasourceUpdatePageProps {
  id: string | null;
  navigate: (url: string) => void;
  onUpdated: () => unknown;
}

export default function DatasourceUpdatePage(props: DatasourceUpdatePageProps) {
  const id = () => Number(props.id);
  const [datasource] = createResource(
    () => Number.isInteger(id()) && id() > 0 ? id() : undefined,
    getDatasourceDetail,
  );
  const [form, setForm] = createSignal<DatasourceFormValue>();
  const [loadedId, setLoadedId] = createSignal<number | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');
  const [connectionResult, setConnectionResult] = createSignal<{ kind: 'success' | 'error'; text: string } | null>(null);

  function updateForm(value: DatasourceFormValue) {
    setForm(value);
    setConnectionResult(null);
  }

  async function testConnection() {
    const values = form();
    if (!values || !Number.isInteger(id()) || id() <= 0) return;
    setTesting(true);
    setConnectionResult(null);
    try {
      const result = await testDatasourceConnection({
        id: id(),
        url: values.url,
        username: values.username,
        password: values.password || undefined,
      });
      const databaseType = result.database_type === 'mysql' ? 'MySQL' : 'PostgreSQL';
      setConnectionResult({ kind: 'success', text: `连接测试成功：${databaseType} ${result.version}` });
    } catch (error) {
      setConnectionResult({ kind: 'error', text: (error as Error).message });
    } finally {
      setTesting(false);
    }
  }

  createEffect(() => {
    const current = datasource();
    if (!current || loadedId() === current.id) return;
    if (current.role_action !== 'write') return;
    setForm({
      name: current.name,
      display_name: current.display_name,
      url: current.url,
      username: current.username,
      password: '',
      bool_as_int: current.bool_as_int,
    });
    setLoadedId(current.id);
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const values = form();
    if (!values || !Number.isInteger(id()) || id() <= 0) return;
    setSubmitting(true);
    setServerError('');
    try {
      const password = values.password ? { password: values.password } : {};
      await updateDatasource({
        id: id(),
        display_name: values.display_name,
        url: values.url,
        username: values.username,
        bool_as_int: values.bool_as_int,
        ...password,
      });
      await props.onUpdated();
      props.navigate('/meta/datasource');
    } catch (error) {
      setServerError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main class="page-shell create-shell datasource-create-shell">
      <header class="page-header create-header">
        <div class="header-with-back">
          <button class="icon-button" title="返回数据源管理" onClick={() => props.navigate('/meta/datasource')}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <div class="eyebrow">数据源管理</div>
            <h1>编辑数据源</h1>
            <Show when={datasource()}>{(current) => <div class="table-code">{current().name}</div>}</Show>
          </div>
        </div>
      </header>

      <Switch>
        <Match when={datasource.loading}>
          <div class="app-state"><LoaderCircle class="spin" size={18} />正在加载</div>
        </Match>
        <Match when={datasource.error}>
          <div class="app-state app-error"><TriangleAlert size={20} />{datasource.error?.message}</div>
        </Match>
        <Match when={!datasource()}>
          <div class="app-state app-error"><TriangleAlert size={20} />Datasource not found</div>
        </Match>
        <Match when={datasource()?.role_action !== 'write'}>
          <div class="app-state app-error"><ShieldX size={20} />没有修改该数据源的权限</div>
        </Match>
        <Match when={form()}>
          {(value) => (
            <form class="create-form" onSubmit={submit}>
              <div class="form-heading">
                <h2><Database size={16} />连接信息</h2>
                <span>MySQL / PostgreSQL</span>
              </div>
              <DatasourceFormFields value={value()} editing onChange={updateForm} />
              <Show when={connectionResult()}>
                {(result) => <div class={`datasource-form-error notice notice-${result().kind}`}>{result().text}</div>}
              </Show>
              <Show when={serverError()}>
                <div class="datasource-form-error notice notice-error">{serverError()}</div>
              </Show>
              <div class="form-actions">
                <button type="button" class="button button-ghost datasource-test-button" disabled={testing() || submitting() || !value().url.trim()} onClick={() => void testConnection()}>
                  <Show when={testing()} fallback={<><Cable size={16} />测试连接</>}>
                    <LoaderCircle class="spin" size={16} />测试中
                  </Show>
                </button>
                <button type="button" class="button button-ghost" onClick={() => props.navigate('/meta/datasource')}>取消</button>
                <button class="button button-confirm" type="submit" disabled={submitting() || testing()}>
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
