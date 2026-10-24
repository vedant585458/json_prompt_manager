import { describe, expect, it } from 'vitest';

import {
  MAX_STORED_CHARS,
  MAX_STORED_ENTRIES,
  canUsePlaygroundStorage,
  clearPlaygroundValues,
  playgroundStorageKey,
  readPlaygroundValues,
  writePlaygroundValues,
} from '@/features/playground/valuesStorage';

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

function refusingStorage(): Storage {
  const storage = createMemoryStorage();
  return {
    ...storage,
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('SecurityError');
    },
  };
}

describe('playground input storage', () => {
  it('round-trips one prompt\u2019s inputs under its own key', () => {
    const storage = createMemoryStorage();
    const savedAt = '2026-10-24T09:00:00.000Z';

    expect(
      writePlaygroundValues('p1', { ticket: 'Billing', team: 'general' }, storage, savedAt),
    ).toBe(true);
    expect(storage.getItem(playgroundStorageKey('p1'))).not.toBeNull();

    expect(readPlaygroundValues('p1', storage)).toEqual({
      promptId: 'p1',
      values: { ticket: 'Billing', team: 'general' },
      savedAt,
    });
    // Another prompt never sees this prompt's inputs.
    expect(readPlaygroundValues('p2', storage)).toBeNull();
  });

  it('treats anything it did not write as absent', () => {
    const storage = createMemoryStorage();
    const key = playgroundStorageKey('p1');

    storage.setItem(key, 'not json');
    expect(readPlaygroundValues('p1', storage)).toBeNull();

    storage.setItem(key, JSON.stringify({ promptId: 'p2', values: { a: 'b' }, savedAt: 'x' }));
    expect(readPlaygroundValues('p1', storage)).toBeNull();

    storage.setItem(key, JSON.stringify({ promptId: 'p1', values: { a: 7 }, savedAt: 'x' }));
    expect(readPlaygroundValues('p1', storage)).toBeNull();

    storage.setItem(key, JSON.stringify({ promptId: 'p1', values: ['a'], savedAt: 'x' }));
    expect(readPlaygroundValues('p1', storage)).toBeNull();

    storage.setItem(key, JSON.stringify({ promptId: 'p1', values: {}, savedAt: 7 }));
    expect(readPlaygroundValues('p1', storage)).toBeNull();
  });

  it('refuses values over the caps instead of storing a truncation', () => {
    const storage = createMemoryStorage();

    const tooMany: Record<string, string> = {};
    for (let index = 0; index <= MAX_STORED_ENTRIES; index += 1) tooMany[`v${index}`] = 'x';
    expect(writePlaygroundValues('p1', tooMany, storage)).toBe(false);
    expect(storage.getItem(playgroundStorageKey('p1'))).toBeNull();

    expect(writePlaygroundValues('p1', { big: 'x'.repeat(MAX_STORED_CHARS + 1) }, storage)).toBe(
      false,
    );
    expect(storage.getItem(playgroundStorageKey('p1'))).toBeNull();
  });

  it('reads back nothing when a stored payload is over the read caps', () => {
    const storage = createMemoryStorage();
    const values: Record<string, string> = { big: 'x'.repeat(MAX_STORED_CHARS + 1) };
    storage.setItem(
      playgroundStorageKey('p1'),
      JSON.stringify({ promptId: 'p1', values, savedAt: '2026-10-24T09:00:00.000Z' }),
    );

    expect(readPlaygroundValues('p1', storage)).toBeNull();
  });

  it('fails softly when storage is disabled, throwing, or absent', () => {
    const storage = refusingStorage();

    expect(canUsePlaygroundStorage(storage)).toBe(false);
    expect(writePlaygroundValues('p1', { a: 'b' }, storage)).toBe(false);
    expect(readPlaygroundValues('p1', storage)).toBeNull();
    expect(() => clearPlaygroundValues('p1', storage)).not.toThrow();

    // `null` disables persistence explicitly; `undefined` would resolve to this
    // browser's session storage, which a unit test must not touch.
    expect(canUsePlaygroundStorage(null)).toBe(false);
    expect(writePlaygroundValues('p1', { a: 'b' }, null)).toBe(false);
    expect(readPlaygroundValues('p1', null)).toBeNull();
  });

  it('clears one prompt without touching another', () => {
    const storage = createMemoryStorage();
    writePlaygroundValues('p1', { a: 'b' }, storage);
    writePlaygroundValues('p2', { c: 'd' }, storage);

    clearPlaygroundValues('p1', storage);

    expect(readPlaygroundValues('p1', storage)).toBeNull();
    expect(readPlaygroundValues('p2', storage)).not.toBeNull();
  });
});
