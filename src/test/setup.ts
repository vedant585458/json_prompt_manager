import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { mockMatchMedia, type MatchMediaController } from '@/test/matchMedia';

// Testing Library only auto-registers cleanup when Vitest globals are enabled;
// this project keeps globals off, so cleanup is explicit.
afterEach(() => {
  cleanup();
});

let media: MatchMediaController | undefined;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  media = mockMatchMedia(true);
});

afterEach(() => {
  media?.restore();
  media = undefined;
});
