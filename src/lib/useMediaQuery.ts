/**
 * Media-query subscriptions (TASK-027).
 *
 * CSS handles most responsiveness. A few behaviours cannot be expressed in
 * classes alone — moving a pane into a sheet, or switching a toolbar to an
 * overflow menu — so those read the same breakpoints here.
 *
 * The hook is deliberately conservative: without `window.matchMedia` (server
 * rendering, jsdom, an older browser) it reports `false`, which means "wide
 * layout", the layout every screen already renders. Nothing is hidden because a
 * capability is missing.
 */

import { useCallback, useSyncExternalStore } from 'react';

/** Below `sm`: phones in portrait. */
export const COMPACT_QUERY = '(max-width: 639px)';
/** Below `lg`: everything that cannot hold the editor's two panes side by side. */
export const SINGLE_PANE_QUERY = '(max-width: 1023px)';

type MediaQueryListLike = {
  readonly matches: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

function listFor(query: string): MediaQueryListLike | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query) as unknown as MediaQueryListLike;
}

/** True while `query` matches; re-renders the caller when it changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = listFor(query);
      if (!list) return () => {};

      // Safari before 14 only has the deprecated addListener pair.
      if (typeof list.addEventListener === 'function') {
        list.addEventListener('change', onChange);
        return () => list.removeEventListener?.('change', onChange);
      }
      list.addListener?.(onChange);
      return () => list.removeListener?.(onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => listFor(query)?.matches ?? false, [query]);

  // The server and the first client render must agree, or hydration would move
  // controls around; `false` is the wide layout both already render.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True on phone-width viewports (`< 640px`). */
export function useCompactLayout(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

/** True when the viewport cannot hold two panes (`< 1024px`). */
export function useSinglePaneLayout(): boolean {
  return useMediaQuery(SINGLE_PANE_QUERY);
}
