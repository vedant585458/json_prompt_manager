import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { Shell } from '@/components/layout/Shell';
import { ComposerEditRoute } from '@/routes/composer/ComposerEditRoute';
import { ComposerRoute } from '@/routes/composer/ComposerRoute';
import { DashboardRoute } from '@/routes/dashboard/DashboardRoute';
import { DesignGallery } from '@/routes/design/DesignGallery';
import { EditorRoute } from '@/routes/editor/EditorRoute';
import { HealthRoute } from '@/routes/health/HealthRoute';
import { DiffRoute } from '@/routes/diff/DiffRoute';
import { HistoryRoute } from '@/routes/history/HistoryRoute';
import { LabRoute } from '@/routes/lab/LabRoute';
import { LibraryRoute } from '@/routes/library/LibraryRoute';
import { NotFoundRoute } from '@/routes/not-found/NotFoundRoute';
import { PlaygroundRoute } from '@/routes/playground/PlaygroundRoute';
import { RouteErrorScreen } from '@/routes/route-error/RouteErrorScreen';
import { SettingsRoute } from '@/routes/settings/SettingsRoute';
import { TemplatesRoute } from '@/routes/templates/TemplatesRoute';
import { ValidationRoute } from '@/routes/validation/ValidationRoute';

/**
 * Route table (TASK-008).
 *
 * One layout route owns the shell, so every screen shares the same landmarks,
 * skip link, navigation, and route chrome. `*` is a child of the shell — a
 * mistyped URL should still show navigation rather than a bare page — while the
 * error screen sits outside it so it can render when the shell itself fails.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: <DashboardRoute /> },
      { path: 'library', element: <LibraryRoute /> },
      { path: 'prompts/:promptId', element: <EditorRoute /> },
      { path: 'prompts/:promptId/compose', element: <ComposerEditRoute /> },
      { path: 'prompts/:promptId/history', element: <HistoryRoute /> },
      { path: 'prompts/:promptId/playground', element: <PlaygroundRoute /> },
      { path: 'prompts/:promptId/lab', element: <LabRoute /> },
      { path: 'diff', element: <DiffRoute /> },
      { path: 'composer', element: <ComposerRoute /> },
      { path: 'templates', element: <TemplatesRoute /> },
      { path: 'validation', element: <ValidationRoute /> },
      { path: 'health', element: <HealthRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: 'design', element: <DesignGallery /> },
      { path: '*', element: <NotFoundRoute /> },
    ],
  },
];

/** Creates a router for the current environment (browser history). */
export function createAppRouter() {
  return createBrowserRouter(routes);
}

/**
 * The application router.
 *
 * Tests build their own `createMemoryRouter(routes, …)` and pass it to `<App />`
 * so each test starts at a known path without touching browser history.
 */
export const appRouter = createAppRouter();
