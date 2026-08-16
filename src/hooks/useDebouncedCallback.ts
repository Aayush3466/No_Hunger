'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Trailing-edge debounce that cancels itself on unmount. */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);

  useEffect(() => {
    latest.current = fn;
  }, [fn]);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
