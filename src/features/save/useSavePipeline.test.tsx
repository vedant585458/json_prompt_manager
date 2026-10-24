import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  QuotaExceededError,
  createInMemoryRepositories,
  createWriteQueue,
  type Repositories,
  type WriteAnnouncement,
  type WriteBroadcaster,
} from '@/data';
import { createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { formatDocument } from '@/domain/serialization';
import type { Prompt } from '@/domain/types';
import { useSavePipeline } from '@/features/save/useSavePipeline';
import { draftStorageKey } from '@/features/editor/draftStorage';
import { createDataStore, type DataStore } from '@/store/dataStore';
import { createPreferencesStore, type PreferencesStore } from '@/store/preferences';

const BASE_TIME = '2026-10-24T09:00:00.000Z';

function makePrompt(id = 'alpha', title = 'Invoice parser'): Prompt {
  return createPrompt(
    { title, content: createBlankDocument({ name: title }) },
    { now: () => new Date(BASE_TIME), newId: () => id },
  );
}

/** A `localStorage` stand-in so a test never leaks drafts into another one. */
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

interface FakeBroadcaster extends WriteBroadcaster {
  readonly sent: WriteAnnouncement[];
  emit: (announcement: WriteAnnouncement) => void;
}

function createFakeBroadcaster(): FakeBroadcaster {
  const listeners = new Set<(announcement: WriteAnnouncement) => void>();
  const sent: WriteAnnouncement[] = [];

  return {
    supported: true,
    channelName: 'test',
    sent,
    announce: (announcement) => {
      sent.push(announcement);
    },
    announcePromptWrite: ({ id, version }) => {
      sent.push({
        type: 'prompt-written',
        promptId: id,
        version,
        at: new Date().toISOString(),
      });
    },
    announcePromptDelete: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => listeners.clear(),
    emit: (announcement) => {
      for (const listener of listeners) listener(announcement);
    },
  };
}

interface Harness {
  readonly repositories: Repositories;
  readonly store: DataStore;
  readonly preferences: PreferencesStore;
  readonly broadcaster: FakeBroadcaster;
  readonly storage: Storage;
  readonly queue: ReturnType<typeof createWriteQueue>;
  readonly result: { current: ReturnType<typeof useSavePipeline> };
  readonly rerender: () => void;
  readonly unmount: () => void;
  /** Mutable gate the test can flip before a rerender. */
  readonly control: { blockedReason: string | null };
}

interface HarnessOptions {
  readonly mode?: 'durable' | 'ephemeral';
  readonly autosaveEnabled?: boolean;
  readonly autosaveDelayMs?: number;
  readonly repositories?: Repositories;
  readonly storage?: Storage;
  readonly prompt?: Prompt;
  readonly blockedReason?: string | null;
}

const DRAFT_TEXT = (() => {
  const document = JSON.parse(
    formatDocument(createBlankDocument({ name: 'Invoice parser' }), 2),
  ) as Record<string, unknown>;
  document.objective = 'Extract the invoice total.';
  return JSON.stringify(document, null, 2);
})();

async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const repositories =
    options.repositories ??
    createInMemoryRepositories({ prompts: [options.prompt ?? makePrompt()] });

  const store = createDataStore();
  store.getState().attach(repositories, options.mode ?? 'durable');
  await store.getState().hydrate();

  const preferences = createPreferencesStore({
    themePreference: 'dark',
    resolvedTheme: 'dark',
    autosaveEnabled: options.autosaveEnabled ?? true,
    autosaveDelayMs: options.autosaveDelayMs ?? 20,
  });
  const broadcaster = createFakeBroadcaster();
  const storage = options.storage ?? createMemoryStorage();
  const queue = createWriteQueue();
  const control = { blockedReason: options.blockedReason ?? null };

  const view = renderHook(() =>
    useSavePipeline({
      prompt: store((state) => state.prompts.find((candidate) => candidate.id === 'alpha') ?? null),
      store,
      preferences,
      storage,
      queue,
      broadcaster,
      recoveryDelayMs: 10,
      parseDebounceMs: 5,
      blockedReason: control.blockedReason,
    }),
  );

  // The store hydrates asynchronously; the prompt must be present for the hook to
  // have a baseline at all.
  await waitFor(() => expect(view.result.current.text).toContain('schemaVersion'));

  return {
    repositories,
    store,
    preferences,
    broadcaster,
    storage,
    queue,
    result: view.result,
    rerender: view.rerender,
    unmount: view.unmount,
    control,
  };
}

async function edit(harness: Harness, text: string) {
  await act(async () => {
    harness.result.current.setText(text);
  });
}

async function save(harness: Harness) {
  let saved = false;
  await act(async () => {
    saved = await harness.result.current.saveNow('manual');
  });
  return saved;
}

describe('useSavePipeline — durability', () => {
  it('autosaves after the configured delay and bumps the version and updatedAt', async () => {
    const harness = await createHarness({ autosaveDelayMs: 20 });

    await edit(harness, DRAFT_TEXT);
    expect(harness.result.current.dirty).toBe(true);
    expect(harness.result.current.state).toBe('dirty');

    await waitFor(() => expect(harness.store.getState().prompts[0]?.version).toBe(2));
    await waitFor(() => expect(harness.result.current.state).toBe('saved'));

    const stored = await harness.repositories.prompts.get('alpha');
    expect(stored?.content.objective).toBe('Extract the invoice total.');
    expect(stored?.version).toBe(2);
    expect(stored?.updatedAt).not.toBe(BASE_TIME);
    expect(harness.result.current.lastSavedAt).toBe(stored?.updatedAt);
    expect(harness.result.current.dirty).toBe(false);
  });

  it('does not autosave when the preference is off, and saves on demand', async () => {
    const harness = await createHarness({ autosaveEnabled: false });

    await edit(harness, DRAFT_TEXT);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(harness.store.getState().prompts[0]?.version).toBe(1);
    expect(harness.result.current.state).toBe('dirty');

    expect(await save(harness)).toBe(true);
    expect(harness.store.getState().prompts[0]?.version).toBe(2);
  });

  it('writes immediately on Mod+S', async () => {
    const harness = await createHarness({ autosaveEnabled: false });

    await edit(harness, DRAFT_TEXT);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    });

    await waitFor(() => expect(harness.store.getState().prompts[0]?.version).toBe(2));
  });

  it('enables snapshot creation only once the draft is saved', async () => {
    const harness = await createHarness({ autosaveEnabled: false });

    expect(harness.result.current.canSnapshot).toBe(true);
    await edit(harness, DRAFT_TEXT);
    expect(harness.result.current.canSnapshot).toBe(false);

    await save(harness);
    expect(harness.result.current.canSnapshot).toBe(true);

    let snapshotResult: Awaited<ReturnType<Harness['result']['current']['snapshot']>> | null = null;
    await act(async () => {
      snapshotResult = await harness.result.current.snapshot('Before refactor');
    });

    expect(snapshotResult).toMatchObject({ ok: true });
    const revisions = await harness.repositories.revisions.listByPrompt('alpha');
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.label).toBe('Before refactor');
  });

  it('queues rapid edits into one ordered write with the latest text', async () => {
    const harness = await createHarness({ autosaveDelayMs: 30 });
    const update = vi.spyOn(harness.repositories.prompts, 'update');

    const first = DRAFT_TEXT.replace('Extract the invoice total.', 'First edit.');
    const second = first.replace('First edit.', 'Second edit.');
    const third = second.replace('Second edit.', 'Third edit.');

    await edit(harness, first);
    await edit(harness, second);
    await edit(harness, third);

    await waitFor(() => expect(harness.store.getState().prompts[0]?.version).toBe(2));
    await waitFor(() => expect(harness.result.current.state).toBe('saved'));

    expect(update).toHaveBeenCalledTimes(1);
    const stored = await harness.repositories.prompts.get('alpha');
    expect(stored?.content.objective).toBe('Third edit.');
    expect(stored?.version).toBe(2);
  });

  it('keeps sequential saves in order without losing the later content', async () => {
    const harness = await createHarness({ autosaveEnabled: false });
    const versions: number[] = [];

    harness.store.subscribe((state) => {
      const version = state.prompts[0]?.version;
      if (version !== undefined && versions.at(-1) !== version) versions.push(version);
    });

    await edit(harness, DRAFT_TEXT);
    await save(harness);
    await edit(harness, DRAFT_TEXT.replace('Extract the invoice total.', 'Then this.'));
    await save(harness);

    expect(versions).toEqual([1, 2, 3]);
    const stored = await harness.repositories.prompts.get('alpha');
    expect(stored?.content.objective).toBe('Then this.');
    expect(stored?.version).toBe(3);
  });

  it('refuses invalid JSON without touching storage and keeps the draft', async () => {
    const harness = await createHarness({ autosaveEnabled: false });
    const broken = '{ "name": ';

    await edit(harness, broken);
    expect(await save(harness)).toBe(false);

    expect(harness.result.current.state).toBe('error');
    expect(harness.result.current.error?.message).toMatch(/not valid JSON/);
    expect(harness.result.current.text).toBe(broken);
    expect(harness.store.getState().prompts[0]?.version).toBe(1);
  });

  it('refuses a JSON document that is not a valid prompt and names the field', async () => {
    const harness = await createHarness({ autosaveEnabled: false });

    await edit(harness, '{"name":"Only a name"}');
    expect(await save(harness)).toBe(false);

    expect(harness.result.current.state).toBe('error');
    expect(harness.result.current.error?.message).toMatch(/not a valid prompt/);
    expect(harness.result.current.error?.detail).toContain('schemaVersion');
    expect(harness.store.getState().prompts[0]?.version).toBe(1);
  });

  it('reports a failed write, keeps the draft, and succeeds on retry', async () => {
    const harness = await createHarness({ autosaveEnabled: false });
    const original = harness.repositories.prompts.update.bind(harness.repositories.prompts);
    let failures = 1;

    harness.repositories.prompts.update = async (prompt, options) => {
      if (failures > 0) {
        failures -= 1;
        throw new QuotaExceededError('This browser refused the write.');
      }
      return original(prompt, options);
    };

    await edit(harness, DRAFT_TEXT);
    expect(await save(harness)).toBe(false);

    expect(harness.result.current.state).toBe('error');
    expect(harness.result.current.error?.message).toBe('The prompt was not saved.');
    expect(harness.result.current.text).toBe(DRAFT_TEXT);
    expect(harness.store.getState().prompts[0]?.version).toBe(1);
    // The recovery copy is the safety net while nothing is persisted.
    await waitFor(() =>
      expect(harness.storage.getItem(draftStorageKey('alpha'))).toContain(
        'Extract the invoice total.',
      ),
    );

    let retried = false;
    await act(async () => {
      retried = await harness.result.current.retry();
    });

    expect(retried).toBe(true);
    expect(harness.store.getState().prompts[0]?.version).toBe(2);
    expect(harness.result.current.state).toBe('saved');
  });
});

describe('useSavePipeline — conflicts', () => {
  async function createConflict(harness: Harness) {
    const stored = await harness.repositories.prompts.get('alpha');
    if (!stored) throw new Error('seed prompt missing');

    const theirs = JSON.parse(formatDocument(stored.content, 2)) as Record<string, unknown>;
    theirs.objective = 'Written in another tab.';
    await harness.repositories.prompts.update(
      {
        ...stored,
        content: theirs as unknown as Prompt['content'],
        updatedAt: '2026-10-24T11:00:00.000Z',
        version: stored.version + 1,
      },
      { expectedVersion: stored.version },
    );

    await edit(harness, DRAFT_TEXT);
    const saved = await save(harness);

    expect(saved).toBe(false);
    await waitFor(() => expect(harness.result.current.conflict).not.toBeNull());
    return harness.result.current.conflict;
  }

  it('detects a stale write, shows the stored version, and reloads it on request', async () => {
    const harness = await createHarness({ autosaveEnabled: false });
    const conflict = await createConflict(harness);

    expect(harness.result.current.state).toBe('conflict');
    expect(conflict).toMatchObject({ baseVersion: 1, storedVersion: 2 });
    expect(conflict?.storedText).toContain('Written in another tab.');
    // Nothing was overwritten while the dialog was up.
    expect((await harness.repositories.prompts.get('alpha'))?.content.objective).toBe(
      'Written in another tab.',
    );
    expect(harness.result.current.dirty).toBe(true);

    let reloaded = false;
    await act(async () => {
      reloaded = await harness.result.current.reloadStoredVersion();
    });

    expect(reloaded).toBe(true);
    expect(harness.result.current.conflict).toBeNull();
    expect(harness.result.current.text).toContain('Written in another tab.');
    expect(harness.result.current.dirty).toBe(false);
    expect(harness.storage.getItem(draftStorageKey('alpha'))).toBeNull();
  });

  it('keeps the draft as new content only when the user says so', async () => {
    const harness = await createHarness({ autosaveEnabled: false });
    await createConflict(harness);

    let kept = false;
    await act(async () => {
      kept = await harness.result.current.keepDraftAsNew();
    });

    expect(kept).toBe(true);
    const stored = await harness.repositories.prompts.get('alpha');
    expect(stored?.content.objective).toBe('Extract the invoice total.');
    expect(stored?.version).toBe(3);
    expect(harness.result.current.state).toBe('saved');
    expect(harness.result.current.conflict).toBeNull();
  });
});

describe('useSavePipeline — recovery', () => {
  it('mirrors a dirty draft and offers it after a reload', async () => {
    const storage = createMemoryStorage();
    const harness = await createHarness({ autosaveEnabled: false, storage });

    await edit(harness, DRAFT_TEXT);
    await waitFor(() =>
      expect(storage.getItem(draftStorageKey('alpha'))).toContain('Extract the invoice total.'),
    );

    const stored = JSON.parse(storage.getItem(draftStorageKey('alpha')) ?? '{}') as {
      baseVersion?: number;
    };
    expect(stored.baseVersion).toBe(1);

    harness.unmount();

    const reloaded = await createHarness({
      autosaveEnabled: false,
      storage,
      repositories: harness.repositories,
    });

    expect(reloaded.result.current.recovery?.draft.text).toBe(DRAFT_TEXT);
    expect(reloaded.result.current.recovery?.hint).toMatch(/Differs from the stored document/);
    expect(reloaded.result.current.recovery?.basedOnOlderVersion).toBe(false);

    await act(async () => {
      reloaded.result.current.restoreRecovery();
    });

    expect(reloaded.result.current.text).toBe(DRAFT_TEXT);
    expect(reloaded.result.current.recovery).toBeNull();
    expect(reloaded.result.current.dirty).toBe(true);
  });

  it('discards a recovery draft on request', async () => {
    const storage = createMemoryStorage();
    const harness = await createHarness({ autosaveEnabled: false, storage });

    await edit(harness, DRAFT_TEXT);
    await waitFor(() => expect(storage.getItem(draftStorageKey('alpha'))).not.toBeNull());
    harness.unmount();

    const reloaded = await createHarness({
      autosaveEnabled: false,
      storage,
      repositories: harness.repositories,
    });

    await act(async () => {
      reloaded.result.current.discardRecovery();
    });

    expect(reloaded.result.current.recovery).toBeNull();
    expect(storage.getItem(draftStorageKey('alpha'))).toBeNull();
  });

  it('clears the recovery draft only after the write lands', async () => {
    const storage = createMemoryStorage();
    const harness = await createHarness({ autosaveEnabled: false, storage });

    await edit(harness, DRAFT_TEXT);
    await waitFor(() => expect(storage.getItem(draftStorageKey('alpha'))).not.toBeNull());

    await save(harness);
    expect(storage.getItem(draftStorageKey('alpha'))).toBeNull();
  });
});

describe('useSavePipeline — ephemeral mode and other tabs', () => {
  it('disables saving in ephemeral mode while still keeping a recovery draft', async () => {
    const storage = createMemoryStorage();
    const harness = await createHarness({ mode: 'ephemeral', storage });

    expect(harness.result.current.state).toBe('disabled');
    expect(harness.result.current.durable).toBe(false);

    await edit(harness, DRAFT_TEXT);
    expect(await save(harness)).toBe(false);
    expect(harness.result.current.error?.message).toMatch(/ephemeral/);
    expect(harness.store.getState().prompts[0]?.version).toBe(1);

    await waitFor(() => expect(storage.getItem(draftStorageKey('alpha'))).not.toBeNull());
  });

  it('announces its own writes and surfaces a write from another tab without touching the draft', async () => {
    const harness = await createHarness({ autosaveEnabled: false });

    await edit(harness, DRAFT_TEXT);
    await save(harness);
    expect(harness.broadcaster.sent).toEqual([
      expect.objectContaining({ type: 'prompt-written', promptId: 'alpha', version: 2 }),
    ]);

    await edit(harness, DRAFT_TEXT.replace('Extract the invoice total.', 'Still mine.'));
    const textBefore = harness.result.current.text;

    await act(async () => {
      harness.broadcaster.emit({
        type: 'prompt-written',
        promptId: 'alpha',
        version: 5,
        at: '2026-10-24T12:00:00.000Z',
      });
    });

    expect(harness.result.current.remote).toEqual({
      version: 5,
      at: '2026-10-24T12:00:00.000Z',
    });
    expect(harness.result.current.text).toBe(textBefore);

    await act(async () => {
      harness.result.current.dismissRemote();
    });
    expect(harness.result.current.remote).toBeNull();
  });
});

describe('a caller-held write gate (TASK-017)', () => {
  it('holds autosave and manual saves back, then writes once the reason clears', async () => {
    const harness = await createHarness({
      autosaveDelayMs: 20,
      blockedReason: 'Fix the duplicate variable first.',
    });

    await edit(harness, DRAFT_TEXT);
    expect(harness.result.current.state).toBe('dirty');

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(harness.store.getState().prompts[0]?.version).toBe(1);
    expect(await save(harness)).toBe(false);
    expect(harness.store.getState().prompts[0]?.version).toBe(1);
    expect(harness.result.current.state).toBe('dirty');

    harness.control.blockedReason = null;
    harness.rerender();

    await waitFor(() => expect(harness.store.getState().prompts[0]?.version).toBe(2));
    expect((await harness.repositories.prompts.get('alpha'))?.content.objective).toBe(
      'Extract the invoice total.',
    );
  });
});
