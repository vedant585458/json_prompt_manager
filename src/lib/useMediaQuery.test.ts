/** Responsive breakpoint hook tests (TASK-027). */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COMPACT_QUERY,
  SINGLE_PANE_QUERY,
  useCompactLayout,
  useSinglePaneLayout,
} from '@/lib/useMediaQuery';

interface FakeList {
  readonly query: string;
  matches: boolean;
  listeners: Set<() => void>;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
}

function stubMatchMedia(matching: readonly string[], options: { legacy?: boolean } = {}) {
  const lists = new Map<string, FakeList>();

  const matchMedia = vi.fn((query: string) => {
    // One list per query, like the real API: re-creating it would drop the
    // listeners the hook registered.
    const cached = lists.get(query);
    if (cached) return cached;

    const list: FakeList = {
      query,
      matches: matching.includes(query),
      listeners: new Set(),
    };
    if (options.legacy) {
      list.addListener = (listener) => list.listeners.add(listener);
      list.removeListener = (listener) => list.listeners.delete(listener);
    } else {
      list.addEventListener = (_type, listener) => list.listeners.add(listener);
      list.removeEventListener = (_type, listener) => list.listeners.delete(listener);
    }
    lists.set(query, list);
    return list;
  });

  vi.stubGlobal('matchMedia', matchMedia);

  return {
    matchMedia,
    /** Flips one query and notifies its subscribers, like a real resize. */
    set(query: string, matches: boolean) {
      const list = lists.get(query);
      if (!list) throw new Error(`no media query list for ${query}`);
      list.matches = matches;
      for (const listener of [...list.listeners]) listener();
    },
    listeners(query: string): number {
      return lists.get(query)?.listeners.size ?? 0;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('reports the wide layout when the browser has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useCompactLayout());
    expect(result.current).toBe(false);
  });

  it('reads the current match and follows changes', () => {
    const media = stubMatchMedia([COMPACT_QUERY]);
    const { result } = renderHook(() => useCompactLayout());

    expect(result.current).toBe(true);

    act(() => media.set(COMPACT_QUERY, false));
    expect(result.current).toBe(false);

    act(() => media.set(COMPACT_QUERY, true));
    expect(result.current).toBe(true);
  });

  it('subscribes once per query and unsubscribes on unmount', () => {
    const media = stubMatchMedia([]);
    const { unmount } = renderHook(() => useSinglePaneLayout());

    expect(media.listeners(SINGLE_PANE_QUERY)).toBe(1);

    unmount();
    expect(media.listeners(SINGLE_PANE_QUERY)).toBe(0);
  });

  it('supports the deprecated addListener API', () => {
    const media = stubMatchMedia([], { legacy: true });
    const { result } = renderHook(() => useCompactLayout());

    expect(result.current).toBe(false);
    act(() => media.set(COMPACT_QUERY, true));
    expect(result.current).toBe(true);
  });

  it('uses the documented breakpoints', () => {
    expect(COMPACT_QUERY).toBe('(max-width: 639px)');
    expect(SINGLE_PANE_QUERY).toBe('(max-width: 1023px)');
  });
});
