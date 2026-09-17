import { createEffect, createSignal } from 'solid-js';
import type { EntityTableView } from '../../types/entity';
import { createEntityDetailController } from './createEntityDetailController';
import { createEntityQueryController } from './createEntityQueryController';
import { createEntityRowDraftController } from './createEntityRowDraftController';
import { createEntityTableLayout } from './createEntityTableLayout';

interface ControllerProps {
  canWrite: boolean;
  table: EntityTableView;
}

export function createEntityListController(props: ControllerProps) {
  const [message, setMessage] = createSignal<{ kind: 'error' | 'success'; text: string } | null>(null);
  let rows!: ReturnType<typeof createEntityRowDraftController>;
  const busy = () => query.loading() || rows.updating() !== null;
  const query = createEntityQueryController(props, busy);
  rows = createEntityRowDraftController(props, query.data, busy, setMessage);
  const detail = createEntityDetailController(query.data);
  const tableLayout = createEntityTableLayout(props);

  createEffect(() => {
    const error = query.error();
    if (error) setMessage({ kind: 'error', text: error.message });
  });

  return {
    rows: rows.rows, total: query.total, page: query.page, pageSize: query.pageSize,
    draftConditions: query.draftConditions, setDraftConditions: query.setDraftConditions, orderBy: query.orderBy,
    dirtyRows: rows.dirtyRows, loading: query.loading, updating: rows.updating, confirmingRow: rows.confirmingRow,
    detailRow: detail.detailRow,
    jsonCellEdit: rows.jsonCellEdit, jsonDraft: rows.jsonDraft,
    jsonOriginal: rows.jsonOriginal, jsonValid: rows.jsonValid, message, busy, pageCount: query.pageCount,
    ...tableLayout, toggleSort: query.toggleSort, setCell: rows.setCell, rowDiff: rows.rowDiff,
    rowIdentity: rows.rowIdentity, submitSearch: query.submitSearch, resetSearch: query.resetSearch,
    openJsonCellEditor: rows.openJsonCellEditor, discardJsonCellEdit: rows.discardJsonCellEdit,
    setJsonDraft: rows.setJsonDraft, confirmJsonCellEdit: rows.confirmJsonCellEdit,
    openDetail: detail.openDetail, closeDetail: detail.closeDetail,
    changePage: query.changePage, changePageSize: query.changePageSize,
    openUpdateConfirmation: rows.openUpdateConfirmation, changeUpdateConfirmation: rows.changeUpdateConfirmation,
    confirmRowUpdate: rows.confirmRowUpdate,
  };
}

export type EntityListController = ReturnType<typeof createEntityListController>;
