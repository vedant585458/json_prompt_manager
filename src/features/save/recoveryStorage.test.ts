import { describe, expect, it } from 'vitest';

import {
  canRecover,
  clearRecovery,
  readRecovery,
  writeRecovery,
} from '@/features/save/recoveryStorage';
import { draftStorageKey } from '@/features/editor/draftStorage';

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

const NOW = new Date('2026-10-24T10:00:00.000Z');
const STORED = '{\n  "a": 1\n}';

describe('recoveryStorage', () => {
  it('round-trips a draft with the version it was typed over', () => {
    const storage = createMemoryStorage();

    expect(
      writeRecovery({
        promptId: 'alpha',
        text: '{\n  "a": 2\n}',
        baseVersion: 3,
        baseUpdatedAt: '2026-10-24T09:00:00.000Z',
        storage,
        now: () => NOW,
      }),
    ).toBe(true);

    expect(JSON.parse(storage.getItem(draftStorageKey('alpha')) ?? '{}')).toMatchObject({
      promptId: 'alpha',
      baseVersion: 3,
      baseUpdatedAt: '2026-10-24T09:00:00.000Z',
      savedAt: NOW.toISOString(),
    });
  });

  it('offers a draft that differs from the stored text, with a line hint', () => {
    const storage = createMemoryStorage();
    writeRecovery({
      promptId: 'alpha',
      text: '{\n  "a": 2\n}',
      baseVersion: 1,
      baseUpdatedAt: NOW.toISOString(),
      storage,
    });

    const candidate = readRecovery({
      promptId: 'alpha',
      storedText: STORED,
      storedVersion: 1,
      storage,
    });

    expect(candidate?.draft.text).toBe('{\n  "a": 2\n}');
    expect(candidate?.hint).toBe('Differs from the stored document at line 2 (+1 line, −1 line).');
    expect(candidate?.basedOnOlderVersion).toBe(false);
  });

  it('does not offer a draft that matches the stored text', () => {
    const storage = createMemoryStorage();
    writeRecovery({
      promptId: 'alpha',
      text: STORED,
      baseVersion: 1,
      baseUpdatedAt: NOW.toISOString(),
      storage,
    });

    expect(
      readRecovery({ promptId: 'alpha', storedText: STORED, storedVersion: 1, storage }),
    ).toBeNull();
  });

  it('flags a draft typed over a different stored version', () => {
    const storage = createMemoryStorage();
    writeRecovery({
      promptId: 'alpha',
      text: '{\n  "a": 2\n}',
      baseVersion: 1,
      baseUpdatedAt: NOW.toISOString(),
      storage,
    });

    expect(
      readRecovery({ promptId: 'alpha', storedText: STORED, storedVersion: 4, storage })
        ?.basedOnOlderVersion,
    ).toBe(true);
  });

  it('flags a draft from before versions were recorded', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      draftStorageKey('alpha'),
      JSON.stringify({
        promptId: 'alpha',
        text: '{\n  "a": 2\n}',
        savedAt: NOW.toISOString(),
        baseUpdatedAt: NOW.toISOString(),
      }),
    );

    expect(
      readRecovery({ promptId: 'alpha', storedText: STORED, storedVersion: 1, storage })
        ?.basedOnOlderVersion,
    ).toBe(true);
  });

  it('ignores another prompt’s draft and unparsable storage', () => {
    const storage = createMemoryStorage();
    storage.setItem(draftStorageKey('alpha'), '{"promptId":"other","text":"{}"}');

    expect(
      readRecovery({ promptId: 'alpha', storedText: STORED, storedVersion: 1, storage }),
    ).toBeNull();
  });

  it('clears a draft and tolerates a missing one', () => {
    const storage = createMemoryStorage();
    writeRecovery({
      promptId: 'alpha',
      text: 'x',
      baseVersion: 1,
      baseUpdatedAt: '',
      storage,
    });

    clearRecovery('alpha', storage);
    expect(storage.getItem(draftStorageKey('alpha'))).toBeNull();
    expect(() => clearRecovery('alpha', storage)).not.toThrow();
  });

  it('fails softly when storage refuses writes', () => {
    const blocked: Storage = {
      get length() {
        return 0;
      },
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    };

    expect(canRecover(blocked)).toBe(false);
    expect(
      writeRecovery({
        promptId: 'alpha',
        text: 'x',
        baseVersion: 1,
        baseUpdatedAt: '',
        storage: blocked,
      }),
    ).toBe(false);
  });

  it('reports whether recovery is possible at all', () => {
    expect(canRecover(createMemoryStorage())).toBe(true);
    expect(canRecover(null)).toBe(false);
  });
});
