import { beforeEach, describe, expect, it } from 'vitest';

import type { QualityDismissal } from '@/domain/quality';
import {
  QUALITY_DISMISSAL_PREFIX,
  canUseDismissalStorage,
  clearDismissals,
  dismissalStorageKey,
  loadDismissals,
  saveDismissals,
} from '@/features/quality/dismissalStorage';

const DISMISSED_AT = '2026-10-25T09:00:00.000Z';

const DISMISSAL: QualityDismissal = {
  ruleId: 'role-missing',
  fingerprint: 'a1b2c3d4',
  reason: 'Deliberately voice-neutral.',
  dismissedAt: DISMISSED_AT,
};

/** A storage double that writes nothing, like a browser in private mode. */
function refusingStorage(): Storage {
  return {
    length: 0,
    clear: () => undefined,
    key: () => null,
    getItem: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('dismissal storage', () => {
  it('stores dismissals per prompt, not globally', () => {
    expect(saveDismissals('p-1', [DISMISSAL])).toBe(true);
    expect(saveDismissals('p-2', [])).toBe(true);

    expect(loadDismissals('p-1')).toEqual([DISMISSAL]);
    expect(loadDismissals('p-2')).toEqual([]);
    expect(dismissalStorageKey('p-1')).toBe(`${QUALITY_DISMISSAL_PREFIX}p-1`);
  });

  it('returns nothing when the prompt has no stored dismissal', () => {
    expect(loadDismissals('never-seen')).toEqual([]);
  });

  it('removes the key instead of storing an empty list', () => {
    saveDismissals('p-1', [DISMISSAL]);
    expect(window.localStorage.getItem(dismissalStorageKey('p-1'))).not.toBeNull();

    expect(clearDismissals('p-1')).toBe(true);
    expect(window.localStorage.getItem(dismissalStorageKey('p-1'))).toBeNull();
    expect(loadDismissals('p-1')).toEqual([]);
  });

  it('drops entries that do not validate instead of crashing', () => {
    window.localStorage.setItem(
      dismissalStorageKey('p-1'),
      JSON.stringify([DISMISSAL, { ruleId: 'role-missing' }, 'nope', null]),
    );

    expect(loadDismissals('p-1')).toEqual([DISMISSAL]);
  });

  it('treats corrupt JSON as no dismissals', () => {
    window.localStorage.setItem(dismissalStorageKey('p-1'), '{not json');
    expect(loadDismissals('p-1')).toEqual([]);
  });

  it('reports a refused write instead of pretending it worked', () => {
    const storage = refusingStorage();

    expect(saveDismissals('p-1', [DISMISSAL], storage)).toBe(false);
    expect(canUseDismissalStorage(storage)).toBe(false);
    expect(canUseDismissalStorage(window.localStorage)).toBe(true);
  });

  it('reads and writes nothing when no storage exists at all', () => {
    expect(loadDismissals('p-1', null)).toEqual([]);
    expect(saveDismissals('p-1', [DISMISSAL], null)).toBe(false);
    expect(canUseDismissalStorage(null)).toBe(false);
  });

  it('leaves no probe key behind', () => {
    canUseDismissalStorage();
    const keys = Object.keys(window.localStorage).filter((key) => key.includes('__probe__'));

    expect(keys).toEqual([]);
  });
});
