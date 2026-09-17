import { batch, createEffect, createSignal } from 'solid-js';
import { getEntities } from '../../api/entity';
import { DEFAULT_PAGE_SIZE } from '../../constants';
import { createPagedResource } from '../../createPagedResource';
import type { Value } from '../../types/common';
import type { EntityColumnConfig, EntityTableView } from '../../types/entity';
import type { OrderByConfig } from '../../types/table';

interface Props {
  table: EntityTableView;
}

export function createEntityQueryController(props: Props, busy: () => boolean) {
  const searchDefaults = () => Object.fromEntries(
    Object.entries(props.table.search_default_value),
  ) as Record<string, Value>;
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(DEFAULT_PAGE_SIZE);
  const [draftConditions, setDraftConditions] = createSignal<Record<string, Value>>(searchDefaults());
  const [conditions, setConditions] = createSignal<Record<string, Value>>(searchDefaults());
  const [orderBy, setOrderBy] = createSignal<OrderByConfig | null>(null);
  const resource = createPagedResource(
    () => ({
      table_id: props.table.id,
      page_no: page(),
      page_size: pageSize(),
      condition: conditions(),
      order_by: orderBy(),
    }),
    getEntities,
    setPage,
  );

  createEffect(() => {
    props.table.id;
    batch(() => {
      setOrderBy(null);
      setPage(1);
      const defaults = searchDefaults();
      setDraftConditions(defaults);
      setConditions(defaults);
    });
  });

  function toggleSort(column: EntityColumnConfig) {
    if (!column.sortable || busy()) return;
    setPage(1);
    setOrderBy((current) => {
      if (!current || current.sort !== column.name) return { sort: column.name, desc: false };
      if (!current.desc) return { ...current, desc: true };
      return null;
    });
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    if (busy()) return;
    setPage(1);
    setConditions({ ...draftConditions() });
  }

  function resetSearch() {
    if (busy()) return;
    const defaults = searchDefaults();
    batch(() => {
      setDraftConditions(defaults);
      setPage(1);
      setConditions(defaults);
    });
  }

  function changePage(nextPage: number) {
    if (!busy() && nextPage !== page()) setPage(nextPage);
  }

  function changePageSize(value: number) {
    if (busy() || value === pageSize()) return;
    batch(() => {
      setPage(1);
      setPageSize(value);
    });
  }

  const total = () => resource.data()?.total ?? 0;
  const pageCount = () => Math.max(1, Math.ceil(total() / pageSize()));

  return {
    data: resource.data,
    loading: resource.loading,
    error: resource.error,
    refetch: resource.refetch,
    total,
    page,
    pageSize,
    pageCount,
    draftConditions,
    setDraftConditions,
    orderBy,
    toggleSort,
    submitSearch,
    resetSearch,
    changePage,
    changePageSize,
  };
}

export type EntityQueryController = ReturnType<typeof createEntityQueryController>;
