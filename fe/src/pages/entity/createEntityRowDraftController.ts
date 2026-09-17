import { batch, createEffect, createSignal } from 'solid-js';
import { updateEntity } from '../../api/entity';
import type { PageResult, Row, Value } from '../../types/common';
import type { EntityColumnConfig, EntityTableView } from '../../types/entity';
import { entityRowDiff, entityRowIdentity, inputValue, validJson, valuesEqual } from './entityValues';

interface Props {
  table: EntityTableView;
}

interface JsonCellEdit {
  rowIndex: number;
  column: EntityColumnConfig;
}

type Message = { kind: 'error' | 'success'; text: string } | null;

export function createEntityRowDraftController(
  props: Props,
  data: () => PageResult<Row> | undefined,
  busy: () => boolean,
  setMessage: (message: Message) => void,
) {
  const [rows, setRows] = createSignal<Row[]>([]);
  const [originalRows, setOriginalRows] = createSignal<Row[]>([]);
  const [dirtyRows, setDirtyRows] = createSignal(new Set<number>());
  const [updating, setUpdating] = createSignal<number | null>(null);
  const [confirmingRow, setConfirmingRow] = createSignal<number | null>(null);
  const [jsonCellEdit, setJsonCellEdit] = createSignal<JsonCellEdit | null>(null);
  const [jsonDraft, setJsonDraftValue] = createSignal('');
  const [jsonOriginal, setJsonOriginal] = createSignal('');
  const [jsonValid, setJsonValid] = createSignal(false);

  createEffect(() => {
    props.table.id;
    const result = data();
    const items = result?.items ?? [];
    batch(() => {
      setRows(items.map((row) => ({ ...row })));
      setOriginalRows(items.map((row) => ({ ...row })));
      setDirtyRows(new Set<number>());
      setConfirmingRow(null);
      setJsonCellEdit(null);
    });
  });

  function setCell(rowIndex: number, column: EntityColumnConfig, value: Value) {
    if (column.primary_key || busy()) return;
    setRows((current) => {
      const next = current.map((row, index) => index === rowIndex ? { ...row, [column.name]: value } : row);
      const changed = props.table.columns.some((item) => (
        !item.primary_key
        && !valuesEqual(item, originalRows()[rowIndex]?.[item.name], next[rowIndex]?.[item.name])
      ));
      setDirtyRows((dirty) => {
        const result = new Set(dirty);
        if (changed) result.add(rowIndex);
        else result.delete(rowIndex);
        return result;
      });
      return next;
    });
  }

  const rowDiff = (rowIndex: number | null) => rowIndex === null
    ? []
    : entityRowDiff(props.table.columns, originalRows()[rowIndex], rows()[rowIndex]);
  const rowIdentity = (rowIndex: number | null) => rowIndex === null
    ? ''
    : entityRowIdentity(props.table.columns, rows()[rowIndex]);

  async function updateRow(rowIndex: number) {
    const currentRow = rows()[rowIndex];
    if (!currentRow || busy()) return;
    const submittedRow = { ...currentRow };
    setUpdating(rowIndex);
    setMessage(null);
    try {
      const result = await updateEntity({ table_id: props.table.id, columns: submittedRow });
      if (result.affected === 0) {
        setMessage({ kind: 'error', text: '更新失败：记录不存在或已被其他操作移除' });
        return;
      }
      setOriginalRows((current) => current.map((row, index) => index === rowIndex ? submittedRow : row));
      setDirtyRows((current) => {
        const next = new Set(current);
        next.delete(rowIndex);
        return next;
      });
      setConfirmingRow(null);
      setMessage({ kind: 'success', text: '更新成功' });
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    } finally {
      setUpdating(null);
    }
  }

  function openJsonCellEditor(rowIndex: number, column: EntityColumnConfig) {
    if (busy()) return;
    const source = inputValue(rows()[rowIndex]?.[column.name]);
    setJsonOriginal(source);
    setJsonDraftValue(source);
    setJsonValid(validJson(source));
    setJsonCellEdit({ rowIndex, column });
  }

  function discardJsonCellEdit() {
    setJsonCellEdit(null);
  }

  function setJsonDraft(source: string, valid: boolean) {
    setJsonDraftValue(source);
    setJsonValid(valid);
  }

  function confirmJsonCellEdit() {
    const editing = jsonCellEdit();
    if (!editing || !jsonValid()) return;
    setCell(editing.rowIndex, editing.column, jsonDraft());
    discardJsonCellEdit();
  }

  function openUpdateConfirmation(rowIndex: number) {
    if (!busy()) setConfirmingRow(rowIndex);
  }

  function changeUpdateConfirmation(open: boolean) {
    if (!open && updating() === null) setConfirmingRow(null);
  }

  function confirmRowUpdate() {
    const rowIndex = confirmingRow();
    if (rowIndex !== null) void updateRow(rowIndex);
  }

  function applySavedRow(rowIndex: number, row: Row) {
    setRows((current) => current.map((item, index) => index === rowIndex ? row : item));
    setOriginalRows((current) => current.map((item, index) => index === rowIndex ? row : item));
    setDirtyRows((current) => {
      const next = new Set(current);
      next.delete(rowIndex);
      return next;
    });
  }

  return {
    rows,
    originalRows,
    dirtyRows,
    updating,
    confirmingRow,
    jsonCellEdit,
    jsonDraft,
    jsonOriginal,
    jsonValid,
    setCell,
    rowDiff,
    rowIdentity,
    openJsonCellEditor,
    discardJsonCellEdit,
    setJsonDraft,
    confirmJsonCellEdit,
    openUpdateConfirmation,
    changeUpdateConfirmation,
    confirmRowUpdate,
    applySavedRow,
  };
}

export type EntityRowDraftController = ReturnType<typeof createEntityRowDraftController>;
