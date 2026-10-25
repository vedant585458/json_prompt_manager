import { vi } from 'vitest';

export interface MatchMediaController {
  /** Flip the simulated OS preference and notify listeners. */
  setMatches: (matches: boolean) => void;
  listenerCount: () => number;
  restore: () => void;
}

/**
 * jsdom has no matchMedia. This controller simulates the OS color-scheme
 * preference and tracks listeners so tests can assert subscription behavior.
 *
 * Only `prefers-color-scheme` queries are driven by the simulated preference;
 * every other query (width breakpoints, reduced motion, pointer type) reports
 * `false`, which is the wide, motion-allowed, fine-pointer default. A test that
 * wants a narrow viewport stubs `matchMedia` itself (TASK-027).
 */
export function mockMatchMedia(initialMatches: boolean): MatchMediaController {
  const original = window.matchMedia;
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const makeList = (media: string) => ({
    get matches() {
      return media.includes('prefers-color-scheme') ? matches : false;
    },
    media,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  });

  window.matchMedia = vi.fn((media: string) =>
    makeList(media),
  ) as unknown as typeof window.matchMedia;

  return {
    setMatches(next) {
      matches = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
    listenerCount: () => listeners.size,
    restore() {
      window.matchMedia = original;
    },
  };
}
