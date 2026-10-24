import 'fake-indexeddb/auto';

import { act, renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openStorage } from '@/data';
import { createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { formatDocument } from '@/domain/serialization';
import { useSavePipeline } from '@/features/save/useSavePipeline';
import { createDataStore } from '@/store/dataStore';
import { createPreferencesStore } from '@/store/preferences';

const DB_NAME = 'promptforge-save-pipeline';

const NEXT_TEXT = (() => {
  const document = JSON.parse(
    formatDocument(createBlankDocument({ name: 'Indexed prompt' }), 2),
  ) as Record<string, unknown>;
  document.objective = 'Persist through IndexedDB.';
  return JSON.stringify(document, null, 2);
})();

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('save pipeline over real IndexedDB', () => {
  it('persists a confirmed write and reopens it from a second connection', async () => {
    const opened = await openStorage({ name: DB_NAME });
    expect(opened.mode).toBe('durable');

    const prompt = createPrompt(
      { title: 'Indexed prompt', content: createBlankDocument({ name: 'Indexed prompt' }) },
      { newId: () => 'alpha', now: () => new Date('2026-10-24T09:00:00.000Z') },
    );
    await opened.repositories.prompts.create(prompt);

    const store = createDataStore();
    store.getState().attach(opened.repositories, 'durable');
    await store.getState().hydrate();

    const preferences = createPreferencesStore({
      themePreference: 'dark',
      resolvedTheme: 'dark',
      autosaveEnabled: false,
    });

    const { result } = renderHook(() =>
      useSavePipeline({
        prompt: store((state) => state.prompts[0] ?? null),
        store,
        preferences,
        recoveryDelayMs: 5,
      }),
    );

    await waitFor(() => expect(result.current.text).toContain('schemaVersion'));

    await act(async () => {
      result.current.setText(NEXT_TEXT);
    });
    await act(async () => {
      expect(await result.current.saveNow('manual')).toBe(true);
    });

    expect(result.current.state).toBe('saved');
    expect(result.current.lastSavedAt).not.toBeNull();

    // A second connection sees what the first one confirmed.
    const reopened = await openStorage({ name: DB_NAME });
    const stored = await reopened.repositories.prompts.get('alpha');

    expect(stored?.content.objective).toBe('Persist through IndexedDB.');
    expect(stored?.version).toBe(2);
    expect(stored?.updatedAt).toBe(result.current.lastSavedAt);

    await reopened.repositories.close();
    await opened.repositories.close();
  });

  it('does not leave a version bump behind when the write is refused', async () => {
    const opened = await openStorage({ name: `${DB_NAME}-failure` });

    const prompt = createPrompt(
      { title: 'Indexed prompt', content: createBlankDocument({ name: 'Indexed prompt' }) },
      { newId: () => 'alpha', now: () => new Date('2026-10-24T09:00:00.000Z') },
    );
    await opened.repositories.prompts.create(prompt);

    const store = createDataStore();
    store.getState().attach(opened.repositories, 'durable');
    await store.getState().hydrate();

    const original = opened.repositories.prompts.update.bind(opened.repositories.prompts);
    opened.repositories.prompts.update = async () => {
      throw new Error('The write was refused.');
    };

    const preferences = createPreferencesStore({
      themePreference: 'dark',
      resolvedTheme: 'dark',
      autosaveEnabled: false,
    });

    const { result } = renderHook(() =>
      useSavePipeline({
        prompt: store((state) => state.prompts[0] ?? null),
        store,
        preferences,
        recoveryDelayMs: 5,
      }),
    );

    await waitFor(() => expect(result.current.text).toContain('schemaVersion'));

    await act(async () => {
      result.current.setText(NEXT_TEXT);
    });
    await act(async () => {
      expect(await result.current.saveNow('manual')).toBe(false);
    });

    expect(result.current.state).toBe('error');
    expect(result.current.text).toBe(NEXT_TEXT);

    // Nothing changed on disk: the failure was reported instead of papered over.
    const reopened = await openStorage({ name: `${DB_NAME}-failure` });
    const stored = await reopened.repositories.prompts.get('alpha');
    expect(stored?.version).toBe(1);
    expect(stored?.content.objective).not.toBe('Persist through IndexedDB.');

    await reopened.repositories.close();
    opened.repositories.prompts.update = original;
    await opened.repositories.close();
  });
});
