import 'fake-indexeddb/auto';

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openStorage } from '@/data';
import { createPrompt } from '@/domain/factories';
import { draftStorageKey } from '@/features/editor/draftStorage';
import { createBlankDocument } from '@/domain/promptDocument';
import { formatDocument } from '@/domain/serialization';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';
import { renderAppWithData } from '@/test/renderAppWithData';

/**
 * §10.2.8 — a storage failure must surface as an error state, keep the draft,
 * and never let the screen claim the text was saved.
 *
 * The repositories here are the real IndexedDB adapter (fake-indexeddb), so the
 * write path under test is the one that ships; only the browser is simulated.
 * The dirty draft is delivered through the recovery-draft mechanism, which is
 * how a user gets a *valid* changed document into the editor without typing it
 * character by character.
 */

const DB_NAME = 'promptforge-workflow-failure';
const BASE_TIME = '2026-10-25T09:00:00.000Z';
const REFUSED = 'The browser refused the write.';

const DRAFT_TEXT = (() => {
  const document = JSON.parse(
    formatDocument(createBlankDocument({ name: 'Refused write' }), 2),
  ) as Record<string, unknown>;
  document.objective = 'Survive a refused write.';
  return JSON.stringify(document, null, 2);
})();

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  useUiStore.setState({ paletteOpen: false, helpOpen: false, sidebarOpen: false });
  usePreferencesStore.setState({ autosaveEnabled: false });
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function openDurableEditor() {
  const opened = await openStorage({ name: DB_NAME });
  if (opened.mode !== 'durable') throw new Error('expected durable storage');

  const prompt = createPrompt(
    { title: 'Refused write', content: createBlankDocument({ name: 'Refused write' }) },
    { now: () => new Date(BASE_TIME), newId: () => 'alpha' },
  );
  await opened.repositories.prompts.create(prompt);

  // A valid draft typed over this exact version, offered for recovery on open.
  window.localStorage.setItem(
    draftStorageKey('alpha'),
    JSON.stringify({
      promptId: 'alpha',
      text: DRAFT_TEXT,
      savedAt: BASE_TIME,
      baseUpdatedAt: prompt.updatedAt,
      baseVersion: prompt.version,
    }),
  );

  const harness = renderAppWithData({
    repositories: opened.repositories,
    path: '/prompts/alpha',
    mode: 'durable',
  });

  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  await screen.findByRole('textbox', { name: 'JSON document for Refused write' });

  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Restore the draft' }));

  // Restoring the draft is a change against the stored row, so it must be dirty.
  await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeVisible());

  return { ...harness, opened, user };
}

function statusRegion(): HTMLElement {
  const label = screen.getByText('Not saved');
  const region = label.closest('[role="status"]');
  if (!region) throw new Error('expected the save status region');
  return region as HTMLElement;
}

describe('§10.2.8 a refused write is reported, not papered over', () => {
  it('shows an error, keeps the draft, and never says the text was saved', async () => {
    const { store, opened, user } = await openDurableEditor();

    opened.repositories.prompts.update = async () => {
      throw new Error(REFUSED);
    };

    await user.click(screen.getByRole('button', { name: /Save now/ }));

    expect(await screen.findByText('Not saved')).toBeVisible();
    expect(statusRegion()).toHaveTextContent(REFUSED);

    // No false confirmation anywhere on the screen.
    expect(screen.queryByText(/^Saved\b/)).toBeNull();

    // The draft survived the failure: the editor still holds it, and it is still
    // reported as unsaved so the user knows there is work left to land.
    expect(
      screen.getByRole('textbox', { name: 'JSON document for Refused write' }).textContent,
    ).toContain('Survive a refused write.');
    await waitFor(() =>
      expect(window.localStorage.getItem(draftStorageKey('alpha'))).toContain(
        'Survive a refused write.',
      ),
    );

    // Nothing was persisted: the stored row is still at version 1, and so is the
    // in-memory copy the screen is reading.
    const reopened = await openStorage({ name: DB_NAME });
    const stored = await reopened.repositories.prompts.get('alpha');
    expect(stored?.version).toBe(1);
    expect(stored?.content.objective).not.toBe('Survive a refused write.');
    expect(store.getState().prompts[0]?.version).toBe(1);

    await reopened.repositories.close();
    await opened.repositories.close();
  });

  it('saves the same draft once the write succeeds again', async () => {
    const { opened, user } = await openDurableEditor();

    const update = opened.repositories.prompts.update.bind(opened.repositories.prompts);
    opened.repositories.prompts.update = async () => {
      throw new Error(REFUSED);
    };

    await user.click(screen.getByRole('button', { name: /Save now/ }));
    await screen.findByText('Not saved');

    opened.repositories.prompts.update = update;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByText('Not saved')).toBeNull());
    expect(await screen.findByText(/^Saved\b/)).toBeVisible();

    const reopened = await openStorage({ name: DB_NAME });
    const stored = await reopened.repositories.prompts.get('alpha');
    expect(stored?.version).toBe(2);
    expect(stored?.content.objective).toBe('Survive a refused write.');

    await reopened.repositories.close();
    await opened.repositories.close();
  });
});
