import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import {
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { Prompt } from '@/domain/types';
import { renderAppWithData } from '@/test/renderAppWithData';
import { useUiStore } from '@/store/uiStore';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const BASE_TIME = '2026-10-24T09:00:00.000Z';

interface Seed {
  readonly prompts?: readonly Prompt[];
  readonly path?: string;
}

function makePrompt(overrides: Partial<Prompt> & { id: string; title: string }): Prompt {
  const base = createPrompt(
    {
      title: overrides.title,
      description: overrides.description ?? 'Summarises a support thread.',
      tags: overrides.tags ?? ['support'],
      folderId: overrides.folderId ?? null,
      collectionIds: overrides.collectionIds ?? [],
      favorite: overrides.favorite ?? false,
      pinned: overrides.pinned ?? false,
      archived: overrides.archived ?? false,
      content: createBlankDocument({ name: overrides.title }),
    },
    { now: () => new Date(BASE_TIME), newId: () => overrides.id },
  );

  return { ...base, ...overrides };
}

function renderEditor(seed: Seed = {}) {
  const repositories = createInMemoryRepositories({
    prompts: seed.prompts ?? [],
    folders: [
      createFolder(
        { name: 'Client work', parentId: null },
        {
          now: () => new Date(BASE_TIME),
          newId: () => 'work',
        },
      ),
    ],
    collections: [
      createCollection(
        { name: 'Starter kit', description: '' },
        {
          now: () => new Date(BASE_TIME),
          newId: () => 'kit',
        },
      ),
    ],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  return {
    ...renderAppWithData({ repositories, path: seed.path ?? '/prompts/alpha' }),
    repositories,
  };
}

async function openEditor(seed: Seed = {}) {
  const harness = renderEditor(seed);
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  return harness;
}

beforeEach(() => {
  useUiStore.setState({
    sidebarOpen: true,
    paletteOpen: false,
    helpOpen: false,
    selectedPromptIds: [],
    selectedPromptId: null,
  });
});

describe('prompt workspace header (TASK-013)', () => {
  const prompt = makePrompt({
    id: 'alpha',
    title: 'Invoice parser',
    tags: ['finance', 'extraction'],
    folderId: 'work',
    collectionIds: ['kit'],
  });

  it('names the prompt, its filing, and what the screen does not do yet', async () => {
    await openEditor({ prompts: [prompt] });

    expect(await screen.findByRole('heading', { level: 1, name: 'Invoice parser' })).toBeVisible();
    const section = screen.getByRole('region', { name: 'Invoice parser' });
    expect(within(section).getByText('#finance')).toBeVisible();
    expect(within(section).getByText('Client work')).toBeVisible();
    expect(within(section).getByText('Starter kit')).toBeVisible();
    expect(
      within(section).getByText(/The JSON editor, validation, and version history/),
    ).toBeVisible();
    expect(within(section).getByRole('button', { name: 'Favorite' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('favorites and pins from the header with write-through state', async () => {
    const user = userEvent.setup();
    const { store } = await openEditor({ prompts: [prompt] });

    await user.click(await screen.findByRole('button', { name: 'Favorite' }));

    expect(await screen.findByText('Added to favorites')).toBeVisible();
    const favoriteButton = screen.getByRole('button', { name: 'Favorited' });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Pin' }));

    await waitFor(() => expect(store.getState().prompts[0]?.pinned).toBe(true));
    expect(screen.getByRole('button', { name: 'Pinned' })).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().prompts[0]).toMatchObject({ favorite: true, pinned: true });
  });

  it('archives and restores with an undo action', async () => {
    const user = userEvent.setup();
    const { store } = await openEditor({ prompts: [prompt] });

    await user.click(await screen.findByRole('button', { name: 'Archive' }));

    expect(await screen.findByText('Prompt archived')).toBeVisible();
    expect(store.getState().prompts[0]?.archived).toBe(true);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(store.getState().prompts[0]?.archived).toBe(false));
    expect(screen.getByRole('button', { name: 'Archive' })).toBeVisible();
  });

  it('explains when the id is not in the library', async () => {
    await openEditor({ prompts: [], path: '/prompts/missing' });

    expect(await screen.findByText('This prompt is not in your library')).toBeVisible();
    expect(screen.getByText(/missing/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to the library' })).toHaveAttribute(
      'href',
      '/library',
    );
  });
});
