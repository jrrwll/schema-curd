import { ArrowDown, ArrowUp, ArrowUpDown, Braces, Eye, LoaderCircle } from 'lucide-solid';
import { For, Index, Match, Show, Switch } from 'solid-js';
import BooleanSwitch from '../../components/BooleanSwitch';
import PageSizeSelect from '../../components/PageSizeSelect';
import PaginationControl from '../../components/PaginationControl';
import type { EntityTableView } from '../../types/entity';
import { inputValue, inputValueForColumn } from './entityValues';
import type { EntityListController } from './createEntityListController';
import NullableBooleanSelect from './NullableBooleanSelect';

interface Props {
  canWrite: boolean;
  table: EntityTableView;
  controller: EntityListController;
}

export default function EntityDataTable(props: Props) {
  const state = props.controller;
  const editingDisabled = state.busy;

  return (
    <section class="table-region" aria-busy={state.loading()}>
      <div class="table-meta"><span>共 <strong>{state.total()}</strong> 条记录</span><span>第 {state.page()} / {state.pageCount()} 页</span></div>
      <div class="table-scroll">
        <table style={{ width: `${state.tableWidth()}px` }}>
          <colgroup>
            <For each={props.table.columns}>{(column) => <col style={{ width: `${state.columnWidths()[column.name] ?? 180}px` }} />}</For>
            <col style={{ width: `${state.actionColumnWidth()}px` }} />
          </colgroup>
          <thead><tr>
            <For each={props.table.columns}>{(column) => (
              <th style={{ width: `${state.columnWidths()[column.name] ?? 180}px` }}>
                <button type="button" class="sort-button" classList={{ sortable: column.sortable }} disabled={!column.sortable || editingDisabled()} title={column.sortable ? '切换排序' : undefined} onClick={() => state.toggleSort(column)}>
                  <span>{column.display_name}<small>{column.name}</small></span>
                  <Show when={column.sortable}><Show when={state.orderBy()?.sort === column.name} fallback={<ArrowUpDown size={14} />}><Show when={!state.orderBy()?.desc} fallback={<ArrowDown size={14} />}><ArrowUp size={14} /></Show></Show></Show>
                </button>
                <span class="column-resizer" title="拖动调整列宽" onPointerDown={(event) => state.startResize(event, column)} />
              </th>
            )}</For>
            <th class="action-column">操作</th>
          </tr></thead>
          <tbody>
            <Show when={!state.loading()} fallback={<tr><td colSpan={props.table.columns.length + 1}><div class="table-state"><LoaderCircle class="spin" size={20} />正在加载</div></td></tr>}>
              <Index each={state.rows()} fallback={<tr><td colSpan={props.table.columns.length + 1}><div class="table-state">暂无数据</div></td></tr>}>
                {(row, rowIndex) => <tr>
                  <For each={props.table.columns}>{(column) => <td>
                    <Switch>
                      <Match when={column.is_json}><button type="button" class="json-cell-trigger" disabled={column.primary_key || !props.canWrite || editingDisabled()} title={props.canWrite ? '编辑 JSON' : '只读'} onClick={() => state.openJsonCellEditor(rowIndex, column)}><Braces size={13} /><span>{inputValue(row()[column.name]) || '空值'}</span></button></Match>
                      <Match when={column.data_type === 'bool'}><Show when={column.optional} fallback={<BooleanSwitch checked={Boolean(row()[column.name])} disabled={column.primary_key || !props.canWrite || editingDisabled()} label={row()[column.name] ? '是' : '否'} onChange={(checked) => state.setCell(rowIndex, column, checked)} />}><NullableBooleanSelect value={row()[column.name]} emptyLabel="空值" disabled={column.primary_key || !props.canWrite || editingDisabled()} onChange={(value) => state.setCell(rowIndex, column, value)} /></Show></Match>
                      <Match when><input class="cell-input" classList={{ 'cell-primary': column.primary_key }} disabled={column.primary_key || !props.canWrite || editingDisabled()} type={column.data_type === 'int' || column.data_type === 'float' ? 'number' : 'text'} step={column.data_type === 'int' ? '1' : column.data_type === 'float' ? 'any' : undefined} value={inputValue(row()[column.name])} onInput={(event) => state.setCell(rowIndex, column, inputValueForColumn(column, event.currentTarget.value))} /></Match>
                    </Switch>
                  </td>}</For>
                  <td class="action-column"><div class="entity-row-actions">
                    <button type="button" class="button button-detail" disabled={editingDisabled()} onClick={() => state.openDetail(rowIndex)}><Eye size={14} />详情</button>
                    <Show when={props.canWrite}><button type="button" class="button button-update" disabled={!state.dirtyRows().has(rowIndex) || editingDisabled()} onClick={() => state.openUpdateConfirmation(rowIndex)}><Show when={state.updating() === rowIndex} fallback="更新"><LoaderCircle class="spin" size={15} />更新中</Show></button></Show>
                  </div></td>
                </tr>}
              </Index>
            </Show>
          </tbody>
        </table>
      </div>
      <div class="pagination-footer">
        <PaginationControl count={state.total()} page={state.page()} pageSize={state.pageSize()} loading={state.loading() || editingDisabled()} onPageChange={state.changePage} />
        <PageSizeSelect value={state.pageSize()} disabled={state.loading() || editingDisabled()} onChange={state.changePageSize} />
      </div>
    </section>
  );
}
