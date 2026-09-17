import { createEffect, createSignal } from 'solid-js';
import type { PageResult, Row } from '../../types/common';

export function createEntityDetailController(data: () => PageResult<Row> | undefined) {
  const [detailRow, setDetailRow] = createSignal<number | null>(null);

  createEffect(() => {
    data();
    setDetailRow(null);
  });

  function openDetail(rowIndex: number) {
    if (data()?.items[rowIndex]) setDetailRow(rowIndex);
  }

  function closeDetail() {
    setDetailRow(null);
  }

  return { detailRow, openDetail, closeDetail };
}

export type EntityDetailController = ReturnType<typeof createEntityDetailController>;
