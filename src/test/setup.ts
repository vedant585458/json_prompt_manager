import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { mockMatchMedia, type MatchMediaController } from '@/test/matchMedia';

// React 19 requires this flag before `act()` can be used. Testing Library calls
// `act()` internally, and Radix primitives schedule focus/portal work in
// timers, so without the flag every interaction logs a "not configured to
// support act(...)" warning.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Testing Library only auto-registers cleanup when Vitest globals are enabled;
// this project keeps globals off, so cleanup is explicit.
afterEach(() => {
  cleanup();
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
