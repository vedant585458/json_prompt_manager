import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { DataBootstrap } from '@/app/DataBootstrap';
import { AppProviders } from '@/app/providers/AppProviders';
import { routes } from '@/app/router';
import { bootData } from '@/app/dataBoot';
import type { Repositories } from '@/data';
import { createDataStore, type DataStore } from '@/store/dataStore';

/**
 * Renders the real shell with a store attached to real (in-memory) repositories.
 *
 * The seed is skipped so each test owns its data; storage selection and seeding
 * are covered by the data-layer tests. Everything above storage — the router,
 * the shell, the screens, the store — is the production code.
 */
export const NO_SEED = {
  seeded: false,
  version: 0,
  previousVersion: 0,
  created: { folders: 0, collections: 0, prompts: 0, templates: 0 },
} as const;

export interface RenderAppWithDataOptions {
  readonly repositories: Repositories;
  readonly path?: string;
}

export function renderAppWithData({ repositories, path = '/' }: RenderAppWithDataOptions) {
  const store = createDataStore();

  const boot = (target: DataStore) =>
    bootData({
      store: target,
      openStorage: async () => ({ repositories, mode: 'ephemeral', notice: null }),
      seed: async () => NO_SEED,
    });

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <AppProviders>
      <DataBootstrap store={store} boot={boot}>
        <RouterProvider router={router} />
      </DataBootstrap>
    </AppProviders>,
  );

  return { ...view, router, store, repositories };
}
