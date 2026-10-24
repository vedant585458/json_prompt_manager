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
 */
export function mockMatchMedia(initialMatches: boolean): MatchMediaController {
  const original = window.matchMedia;
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const query = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
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
  };

  window.matchMedia = vi.fn(() => query) as unknown as typeof window.matchMedia;

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
