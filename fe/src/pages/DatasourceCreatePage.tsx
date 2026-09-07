import { ArrowLeft, Cable, Database, LoaderCircle, Save } from 'lucide-solid';
import { Show, createSignal } from 'solid-js';
import { createDatasource, testDatasourceConnection } from '../api';
import DatasourceFormFields, {
  EMPTY_DATASOURCE_FORM,
  type DatasourceFormValue,
} from '../components/DatasourceFormFields';

interface DatasourceCreatePageProps {
  navigate: (url: string) => void;
  onCreated: () => unknown;
}

export default function DatasourceCreatePage(props: DatasourceCreatePageProps) {
  const [form, setForm] = createSignal<DatasourceFormValue>({ ...EMPTY_DATASOURCE_FORM });
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
    setTesting(true);
    setConnectionResult(null);
    try {
      const result = await testDatasourceConnection({
        url: values.url,
        username: values.username,
        password: values.password,
      });
      const databaseType = result.database_type === 'mysql' ? 'MySQL' : 'PostgreSQL';
      setConnectionResult({ kind: 'success', text: `连接测试成功：${databaseType} ${result.version}` });
    } catch (error) {
      setConnectionResult({ kind: 'error', text: (error as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setServerError('');
    try {
      await createDatasource(form());
      await props.onCreated();
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
            <h1>新增数据源</h1>
          </div>
        </div>
      </header>

      <form class="create-form" onSubmit={submit}>
        <div class="form-heading">
          <h2><Database size={16} />连接信息</h2>
          <span>MySQL / PostgreSQL</span>
        </div>
        <DatasourceFormFields value={form()} onChange={updateForm} />
        <Show when={connectionResult()}>
          {(result) => <div class={`datasource-form-error notice notice-${result().kind}`}>{result().text}</div>}
        </Show>
        <Show when={serverError()}>
          <div class="datasource-form-error notice notice-error">{serverError()}</div>
        </Show>
        <div class="form-actions">
          <button type="button" class="button button-ghost datasource-test-button" disabled={testing() || submitting() || !form().url.trim()} onClick={() => void testConnection()}>
            <Show when={testing()} fallback={<><Cable size={16} />测试连接</>}>
              <LoaderCircle class="spin" size={16} />测试中
            </Show>
          </button>
          <button type="button" class="button button-ghost" onClick={() => props.navigate('/meta/datasource')}>取消</button>
          <button class="button button-confirm" type="submit" disabled={submitting() || testing()}>
            <Show when={submitting()} fallback={<><Save size={16} />创建</>}>
              <LoaderCircle class="spin" size={16} />创建中
            </Show>
          </button>
        </div>
      </form>
    </main>
  );
}
