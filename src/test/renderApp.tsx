import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { routes } from '@/app/router';

/**
 * Renders the real application at a given path (TASK-008).
 *
 * Uses a memory router so tests never touch browser history, and returns the
 * router so a test can assert navigation. The data layer still boots for real —
 * in jsdom that means the labelled ephemeral adapter.
 */
export function renderAppAt(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<App router={router} />);
  return { ...utils, router };
}
