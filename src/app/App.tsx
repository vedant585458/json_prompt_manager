import type { createBrowserRouter } from 'react-router-dom';
import { RouterProvider } from 'react-router-dom';

import { DataBootstrap } from '@/app/DataBootstrap';
import { AppProviders } from '@/app/providers/AppProviders';
import { appRouter } from '@/app/router';

export interface AppProps {
  /**
   * Injected by tests (`createMemoryRouter`). The application uses the browser
   * router exported from `src/app/router.tsx`.
   */
  readonly router?: ReturnType<typeof createBrowserRouter>;
}

/**
 * Application root (TASK-008).
 *
 * Providers first, then the data lifecycle, then the router: no route can
 * render before storage has been resolved, seeded, and hydrated, so a screen
 * never shows an empty library that looks like data loss.
 */
export function App({ router = appRouter }: AppProps) {
  return (
    <AppProviders>
      <DataBootstrap>
        <RouterProvider router={router} />
      </DataBootstrap>
    </AppProviders>
  );
}
