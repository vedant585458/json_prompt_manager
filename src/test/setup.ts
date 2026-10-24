import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when Vitest globals are enabled;
// this project keeps globals off, so cleanup is explicit.
afterEach(() => {
  cleanup();
});
