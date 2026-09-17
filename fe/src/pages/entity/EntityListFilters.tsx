import { Filter, RotateCcw, Search } from 'lucide-solid';
import { For, Show } from 'solid-js';
import type { EntityTableView } from '../../types/entity';
import { inputValue, inputValueForColumn } from './entityValues';
import type { EntityListController } from './createEntityListController';
import NullableBooleanSelect from './NullableBooleanSelect';

interface Props {
  table: EntityTableView;
  controller: EntityListController;
}

export default function EntityListFilters(props: Props) {
  const state = props.controller;

  return (
    <form class="filter-band" onSubmit={state.submitSearch}>
      <fieldset class="form-disabled-scope" disabled={state.busy()}>
      <div class="filter-title"><Filter size={16} />字段筛选</div>
      <div class="entity-filter-row">
        <div class="filter-grid">
          <For each={props.table.columns}>
            {(column) => (
              <label class="filter-field">
                <span>{column.display_name}</span>
                <Show when={column.data_type !== 'bool'} fallback={
                  <NullableBooleanSelect
                    value={state.draftConditions()[column.name]}
                    emptyLabel="不限"
                    onChange={(value) => state.setDraftConditions((current) => {
                      const next = { ...current };
                      if (value === null) delete next[column.name];
                      else next[column.name] = value;
                      return next;
                    })}
                  />
                }>
                  <input
                    class="input"
                    type={column.data_type === 'int' || column.data_type === 'float' ? 'number' : 'search'}
                    step={column.data_type === 'int' ? '1' : column.data_type === 'float' ? 'any' : undefined}
                    placeholder={column.data_type === 'int' || column.data_type === 'float' ? '精确匹配' : '模糊搜索'}
                    value={inputValue(state.draftConditions()[column.name])}
                    onInput={(event) => state.setDraftConditions((current) => ({
                      ...current,
                      [column.name]: inputValueForColumn(column, event.currentTarget.value),
                    }))}
                  />
                </Show>
              </label>
            )}
          </For>
        </div>
        <div class="entity-filter-actions">
          <button type="button" class="icon-button" title="重置" aria-label="重置" onClick={state.resetSearch} disabled={state.loading()}><RotateCcw size={16} /></button>
          <button type="submit" class="button button-dark" disabled={state.loading()}><Search size={16} />查询</button>
        </div>
      </div>
      </fieldset>
    </form>
  );
}
