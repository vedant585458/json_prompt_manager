import { describe, expect, it, vi } from 'vitest';

import {
  MAX_DRAFT_CHARS,
  canUseDraftStorage,
  clearStoredDraft,
  draftStorageKey,
  readStoredDraft,
  writeStoredDraft,
  type StoredDraft,
} from '@/features/editor/draftStorage';

/** Minimal in-memory `Storage`, so these tests never touch the real browser. */
function createStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));

  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

const DRAFT: StoredDraft = {
  promptId: 'alpha',
  text: '{"a": 1}',
  savedAt: '2026-10-24T10:00:00.000Z',
  baseUpdatedAt: '2026-10-24T09:00:00.000Z',
};

describe('draft storage', () => {
  it('builds a namespaced key per prompt', () => {
    expect(draftStorageKey('alpha')).toBe('promptforge.editor.draft.alpha');
  });

  it('round-trips a draft', () => {
    const storage = createStorage();
    expect(writeStoredDraft(DRAFT, storage)).toBe(true);

    expect(readStoredDraft('alpha', storage)).toEqual(DRAFT);
    expect(readStoredDraft('beta', storage)).toBeNull();
  });

  it('clears a draft and tolerates clearing twice', () => {
    const storage = createStorage();
    writeStoredDraft(DRAFT, storage);

    clearStoredDraft('alpha', storage);
    clearStoredDraft('alpha', storage);

    expect(readStoredDraft('alpha', storage)).toBeNull();
  });

  it('refuses a draft over the size limit', () => {
    const storage = createStorage();
    const huge = { ...DRAFT, text: 'x'.repeat(MAX_DRAFT_CHARS + 1) };

    expect(writeStoredDraft(huge, storage)).toBe(false);
    expect(readStoredDraft('alpha', storage)).toBeNull();
  });

  it('treats corrupt, foreign, or incomplete records as absent', () => {
    const corrupt = createStorage({ [draftStorageKey('alpha')]: '{not json' });
    const foreign = createStorage({
      [draftStorageKey('alpha')]: JSON.stringify({ ...DRAFT, promptId: 'beta' }),
    });
    const incomplete = createStorage({
      [draftStorageKey('alpha')]: JSON.stringify({ promptId: 'alpha', text: 5 }),
    });

    expect(readStoredDraft('alpha', corrupt)).toBeNull();
    expect(readStoredDraft('alpha', foreign)).toBeNull();
    expect(readStoredDraft('alpha', incomplete)).toBeNull();
  });

  it('reports when storage is unavailable instead of throwing', () => {
    const failing = createStorage();
    vi.spyOn(failing, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    vi.spyOn(failing, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });

    expect(writeStoredDraft(DRAFT, failing)).toBe(false);
    expect(readStoredDraft('alpha', failing)).toBeNull();
    expect(() => clearStoredDraft('alpha', failing)).not.toThrow();
    expect(canUseDraftStorage(null)).toBe(false);
  });

  it('detects usable storage with a probe write', () => {
    const usable = createStorage();
    expect(canUseDraftStorage(usable)).toBe(true);
    // The probe does not leave anything behind.
    expect(usable.length).toBe(0);

    const blocked = createStorage();
    vi.spyOn(blocked, 'setItem').mockImplementation(() => {
      throw new Error('Private mode');
    });
    expect(canUseDraftStorage(blocked)).toBe(false);
  });
});
