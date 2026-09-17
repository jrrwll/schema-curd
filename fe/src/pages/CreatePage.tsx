import { ArrowLeft, Check, LoaderCircle, Save } from 'lucide-solid';
import { For, Show, createSignal } from 'solid-js';
import { createEntity } from '../api/entity';
import BooleanSwitch from '../components/BooleanSwitch';
import type { Row, Value } from '../types/common';
import type { EntityTableView } from '../types/entity';
import type { ColumnConfig } from '../types/table';
import NullableBooleanSelect from './entity/NullableBooleanSelect';

interface CreatePageProps {
  datasource: string;
  table: EntityTableView;
  navigate: (url: string) => void;
}

export default function CreatePage(props: CreatePageProps) {
  const editableColumns = () =>
    props.table.columns.filter(
      (column) => !column.primary_key
        && !Object.hasOwn(props.table.insert_fixed_values, column.name),
    );
  const initialValues = () =>
    Object.fromEntries(editableColumns().map((column) => [
      column.name,
      column.data_type === 'bool' ? (column.optional ? null : false) : '',
    ]));
  const [values, setValues] = createSignal<Row>(initialValues());
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [submitting, setSubmitting] = createSignal(false);
  const [serverError, setServerError] = createSignal('');
  const [created, setCreated] = createSignal(false);

  const listUrl = () =>
    `/entity?datasource=${encodeURIComponent(props.datasource)}&table=${props.table.id}`;

  function validate(column: ColumnConfig, value: Value): string {
    if ((value === '' || value === null || value === undefined) && !column.optional) return `Field ${column.display_name} is required`;
    if (column.data_type === 'json' && value !== '' && value !== null && value !== undefined) {
      try {
        JSON.parse(String(value));
      } catch {
        return `Field ${column.display_name} must be valid JSON`;
      }
    }
    if (value !== '' && value !== null && column.pattern) {
      try {
        if (!new RegExp(`^(?:${column.pattern})$`).test(String(value))) return `Field ${column.display_name} has an invalid format`;
      } catch {
        return `Field ${column.display_name} has an invalid validation rule`;
      }
    }
    return '';
  }

  function updateValue(column: ColumnConfig, value: Value) {
    setValues((current) => ({ ...current, [column.name]: value }));
    setErrors((current) => ({ ...current, [column.name]: validate(column, value) }));
  }

  function inputValue(column: ColumnConfig, value: string): Value {
    return (column.data_type === 'int' || column.data_type === 'float') && value !== '' ? Number(value) : value;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const nextErrors = Object.fromEntries(
      editableColumns().map((column) => [column.name, validate(column, values()[column.name])]),
    );
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const columns = Object.fromEntries(
      Object.entries(values()).filter(([, value]) => value !== ''),
    );
    setSubmitting(true);
    setServerError('');
    try {
      await createEntity({ table_id: props.table.id, columns });
      setCreated(true);
      setValues(initialValues());
    } catch (error) {
      setServerError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main class="page-shell create-shell">
      <header class="page-header create-header">
        <div class="header-with-back">
          <button class="icon-button" title="返回列表" onClick={() => props.navigate(listUrl())}><ArrowLeft size={19} /></button>
          <div>
            <div class="eyebrow">新增记录</div>
            <h1>{props.table.display_name}</h1>
            <div class="table-code">{props.table.name}</div>
          </div>
        </div>
      </header>

      <Show when={created()}>
        <div class="notice notice-success"><Check size={15} />新增成功</div>
      </Show>
      <Show when={serverError()}><div class="notice notice-error">{serverError()}</div></Show>

      <form class="create-form" onSubmit={submit}>
        <fieldset class="form-disabled-scope" disabled={submitting()}>
        <div class="form-heading">
          <h2>记录信息</h2>
          <span>{editableColumns().length} 个字段</span>
        </div>
        <div class="form-fields">
          <For each={editableColumns()}>
            {(column) => (
              <label class="form-field">
                <div class="form-label">
                  <span>{column.display_name}{!column.optional && <b>*</b>}</span>
                  <code>{column.name}</code>
                </div>
                <Show when={column.data_type !== 'bool'} fallback={
                  <Show when={column.optional} fallback={
                    <BooleanSwitch
                      checked={Boolean(values()[column.name])}
                      label={values()[column.name] ? '是' : '否'}
                      onChange={(checked) => updateValue(column, checked)}
                    />
                  }>
                    <NullableBooleanSelect
                      value={values()[column.name]}
                      emptyLabel="空值"
                      onChange={(value) => updateValue(column, value)}
                    />
                  </Show>
                }>
                  <input
                    class="input form-input"
                    classList={{ invalid: Boolean(errors()[column.name]) }}
                    type={column.data_type === 'int' || column.data_type === 'float' ? 'number' : 'text'}
                    step={column.data_type === 'int' ? '1' : column.data_type === 'float' ? 'any' : undefined}
                    value={String(values()[column.name] ?? '')}
                    onInput={(event) => updateValue(column, inputValue(column, event.currentTarget.value))}
                    onBlur={() => setErrors((current) => ({ ...current, [column.name]: validate(column, values()[column.name]) }))}
                  />
                </Show>
                <Show when={errors()[column.name]}>
                  <span class="field-error">{errors()[column.name]}</span>
                </Show>
              </label>
            )}
          </For>
        </div>
        <div class="form-actions">
          <button type="button" class="button button-ghost" onClick={() => props.navigate(listUrl())}>取消</button>
          <button type="submit" class="button button-primary" disabled={submitting()}>
            <Show when={submitting()} fallback={<><Save size={16} />提交</>}><LoaderCircle class="spin" size={16} />提交中</Show>
          </button>
        </div>
        </fieldset>
      </form>
    </main>
  );
}
