import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { mockMatchMedia, type MatchMediaController } from '@/test/matchMedia';
import {
  expectNoNetworkAttempts,
  installNetworkGuard,
  resetNetworkAttempts,
} from '@/test/networkGuard';

// React 19 requires this flag before `act()` can be used. Testing Library calls
// `act()` internally, and Radix primitives schedule focus/portal work in
// timers, so without the flag every interaction logs a "not configured to
// support act(...)" warning.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no `ResizeObserver`, and Radix's checkbox bubble input measures
// itself with one. A no-op observer is enough: the tests assert on checked
// state and focus behavior, never on the measured size.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof globalThis.ResizeObserver;
}

// jsdom implements no layout, so a `Range` has no rects. CodeMirror measures a
// range to decide how tall the caret is on the current line, and throws without
// them. Empty rects are enough: no test asserts on measured geometry.
if (typeof Range !== 'undefined') {
  const emptyRect = (): DOMRect =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  if (typeof Range.prototype.getClientRects !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [] as unknown as DOMRectList,
    });
  }

  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: emptyRect,
    });
  }
}

// Nothing may leave the browser (ADR-01), so the suite enforces it: every
// outbound primitive throws and records, and each test fails if it tried to use
// one (TASK-029).
installNetworkGuard();

// Testing Library only auto-registers cleanup when Vitest globals are enabled;
// this project keeps globals off, so cleanup is explicit.
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  resetNetworkAttempts();
});

afterEach(() => {
  expectNoNetworkAttempts();
});

let media: MatchMediaController | undefined;

beforeEach(() => {
  window.localStorage.clear();
  // jsdom implements `scrollTo` as a "not implemented" stub that reports to
  // console.error; the shell calls it on navigation, so replace it.
  Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  media = mockMatchMedia(true);
});

afterEach(() => {
  media?.restore();
  media = undefined;
});
