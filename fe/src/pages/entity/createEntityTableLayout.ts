import { createEffect, createSignal, onCleanup } from 'solid-js';
import type { EntityTableView } from '../../types/entity';
import type { ColumnConfig } from '../../types/table';

interface LayoutProps {
  canWrite: boolean;
  table: EntityTableView;
}

export function createEntityTableLayout(props: LayoutProps) {
  const [columnWidths, setColumnWidths] = createSignal<Record<string, number>>({});
  let stopResizing: (() => void) | undefined;

  const actionColumnWidth = () => props.canWrite ? 154 : 84;
  const tableWidth = () => props.table.columns.reduce(
    (sum, column) => sum + (columnWidths()[column.name] ?? 180),
    actionColumnWidth(),
  );

  createEffect(() => {
    props.table.id;
    setColumnWidths(Object.fromEntries(
      props.table.columns.map((column) => [column.name, column.primary_key ? 120 : 180]),
    ));
  });

  function startResize(event: PointerEvent, column: ColumnConfig) {
    event.preventDefault();
    event.stopPropagation();
    stopResizing?.();
    const startX = event.clientX;
    const startWidth = columnWidths()[column.name] ?? 180;
    document.body.classList.add('is-resizing-column');
    const move = (moveEvent: PointerEvent) => {
      const width = Math.min(480, Math.max(100, startWidth + moveEvent.clientX - startX));
      setColumnWidths((current) => ({ ...current, [column.name]: width }));
    };
    const stop = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.body.classList.remove('is-resizing-column');
      stopResizing = undefined;
    };
    stopResizing = stop;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
  }

  onCleanup(() => stopResizing?.());

  return { columnWidths, actionColumnWidth, tableWidth, startResize };
}
