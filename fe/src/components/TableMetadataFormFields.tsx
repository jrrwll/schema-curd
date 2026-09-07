import { ChevronDown, Settings2, Table2 } from 'lucide-solid';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { DISPLAY_NAME_MAX_LENGTH, NAME_MAX_LENGTH } from '../constants';
import { physicalMetadataDisplayName } from '../physicalMetadata';
import type { PhysicalTableItem, TableMetadataConfig } from '../types';
import TableAdvancedSettings, {
  EMPTY_TABLE_ADVANCED_FORM,
  buildTableAdvancedConfig,
  tableAdvancedFormValue,
  type TableAdvancedColumn,
  type TableAdvancedFormValue,
} from './TableAdvancedSettings';

export interface TableMetadataFormValue {
  name: string;
  display_name: string;
  advanced: TableAdvancedFormValue;
}

interface TableMetadataFormFieldsProps {
  value: TableMetadataFormValue;
  editing?: boolean;
  physicalTables?: PhysicalTableItem[];
  columns?: TableAdvancedColumn[];
  onChange: (value: TableMetadataFormValue) => void;
}

export const EMPTY_TABLE_METADATA_FORM: TableMetadataFormValue = {
  name: '',
  display_name: '',
  advanced: EMPTY_TABLE_ADVANCED_FORM,
};

export function tableMetadataFormValue(
  name: string,
  displayName: string,
  config: TableMetadataConfig,
): TableMetadataFormValue {
  return {
    name,
    display_name: displayName,
    advanced: tableAdvancedFormValue(config),
  };
}

export function buildTableMetadataConfig(
  value: TableMetadataFormValue,
  columns: TableAdvancedColumn[],
): TableMetadataConfig {
  return buildTableAdvancedConfig(value.advanced, columns);
}

export default function TableMetadataFormFields(props: TableMetadataFormFieldsProps) {
  const [tableNamesOpen, setTableNamesOpen] = createSignal(false);
  const update = (value: Partial<TableMetadataFormValue>) =>
    props.onChange({ ...props.value, ...value });
  const filteredTableNames = createMemo(() => {
    const keyword = props.value.name.trim().toLocaleLowerCase();
    return (props.physicalTables ?? [])
      .filter((table) => !keyword || table.name.toLocaleLowerCase().includes(keyword));
  });

  function selectTable(table: PhysicalTableItem) {
    update({
      name: table.name,
      display_name: physicalMetadataDisplayName(table.comment, table.name),
    });
    setTableNamesOpen(false);
  }

  return (
    <>
      <div class="datasource-form-fields metadata-basic-fields">
        <div
          class="form-field physical-table-field"
          onFocusOut={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setTableNamesOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setTableNamesOpen(false);
          }}
        >
          <label class="form-label" for="table-metadata-name">名称<b>*</b></label>
          <input
            id="table-metadata-name"
            class="input form-input"
            required
            disabled={props.editing}
            maxlength={NAME_MAX_LENGTH}
            autocomplete="off"
            aria-haspopup={!props.editing && Boolean(props.physicalTables) ? 'listbox' : undefined}
            aria-expanded={!props.editing && Boolean(props.physicalTables) ? tableNamesOpen() : undefined}
            value={props.value.name}
            onFocus={() => setTableNamesOpen(true)}
            onInput={(event) => {
              update({ name: event.currentTarget.value });
              setTableNamesOpen(true);
            }}
          />
          <Show when={!props.editing && tableNamesOpen() && filteredTableNames().length > 0}>
            <div class="physical-table-options" role="listbox">
              <For each={filteredTableNames()}>
                {(table) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={props.value.name === table.name}
                    classList={{ selected: props.value.name === table.name }}
                    title={table.comment || table.name}
                    onClick={() => selectTable(table)}
                  >
                    <Table2 size={14} />
                    <span>
                      <code>{table.name}</code>
                      <Show when={table.comment}><small>{table.comment}</small></Show>
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
        <label class="form-field">
          <span class="form-label">展示名称<b>*</b></span>
          <input class="input form-input" required maxlength={DISPLAY_NAME_MAX_LENGTH} value={props.value.display_name} onInput={(event) => update({ display_name: event.currentTarget.value })} />
        </label>
      </div>

      <details class="advanced-settings table-advanced-settings" open>
        <summary>
          <span class="advanced-settings-title"><Settings2 size={15} />高级设置</span>
          <span class="advanced-settings-state">
            <span class="advanced-settings-closed">展开</span>
            <span class="advanced-settings-open">收起</span>
            <ChevronDown size={16} />
          </span>
        </summary>
        <TableAdvancedSettings
          value={props.value.advanced}
          columns={props.columns ?? []}
          onChange={(advanced) => update({ advanced })}
        />
      </details>
    </>
  );
}
