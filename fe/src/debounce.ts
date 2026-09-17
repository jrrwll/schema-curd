import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { SEARCH_DEBOUNCE_MS } from './constants';

export function createDebouncedValue<T>(source: Accessor<T>, delay = SEARCH_DEBOUNCE_MS): Accessor<T> {
  const [value, setValue] = createSignal(source());

  createEffect(() => {
    const next = source();
    const timeout = window.setTimeout(() => setValue(() => next), delay);
    onCleanup(() => window.clearTimeout(timeout));
  });

  return value;
}
