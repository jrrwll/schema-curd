import { createEffect, createSignal, type Accessor } from 'solid-js';
import type { PageResult } from './types/common';
import { clampPage } from './pagination';

export interface PagedRequest {
  page_no: number;
  page_size: number;
}

export interface PagedResource<T> {
  data: Accessor<PageResult<T> | undefined>;
  loading: Accessor<boolean>;
  error: Accessor<Error | undefined>;
  refetch: () => Promise<void>;
}

/**
 * Shared lifecycle for server-paged lists. The sequence guard prevents a
 * slower response from replacing a newer query, while the page correction
 * keeps deletions and filter changes from leaving the UI on an empty page.
 */
export function createPagedResource<T, Request extends PagedRequest>(
  getRequest: () => Request | undefined,
  load: (request: Request) => Promise<PageResult<T>>,
  setPage: (page: number) => void,
): PagedResource<T> {
  const [data, setData] = createSignal<PageResult<T>>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error>();
  const [version, setVersion] = createSignal(0);
  let sequence = 0;
  let pendingResolvers: Array<{ resolve: () => void; reject: (reason: Error) => void }> = [];

  async function execute(request: Request, currentSequence: number) {
    setLoading(true);
    setError(undefined);
    try {
      const result = await load(request);
      if (currentSequence !== sequence) return;
      setData(result);
      const nextPage = clampPage(request.page_no, result.total, request.page_size);
      if (nextPage !== request.page_no) setPage(nextPage);
    } catch (reason) {
      if (currentSequence !== sequence) return;
      setData(undefined);
      setError(reason instanceof Error ? reason : new Error(String(reason)));
    } finally {
      if (currentSequence === sequence) {
        setLoading(false);
        const resolvers = pendingResolvers;
        pendingResolvers = [];
        const currentError = error();
        resolvers.forEach(({ resolve, reject }) => currentError ? reject(currentError) : resolve());
      }
    }
  }

  createEffect(() => {
    const request = getRequest();
    version();
    const currentSequence = ++sequence;
    if (!request) {
      setData(undefined);
      setError(undefined);
      setLoading(false);
      pendingResolvers.splice(0).forEach(({ resolve }) => resolve());
      return;
    }
    void execute(request, currentSequence);
  });

  function refetch(): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => pendingResolvers.push({ resolve, reject }));
    setVersion((current) => current + 1);
    return promise;
  }

  return { data, loading, error, refetch };
}
