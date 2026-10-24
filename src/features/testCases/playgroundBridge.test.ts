import { describe, expect, it } from 'vitest';

import type { VariableDefinition } from '@/domain/types';
import {
  caseValuesFromPlaygroundText,
  loadCaseIntoPlayground,
  readPlaygroundCarryOver,
} from '@/features/testCases/playgroundBridge';
import {
  playgroundStorageKey,
  readPlaygroundValues,
  writePlaygroundValues,
} from '@/features/playground/valuesStorage';

function memoryStorage(): Storage {
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

const VARIABLES: readonly VariableDefinition[] = [
  { name: 'ticket', type: 'string', required: true },
  { name: 'priority', type: 'number', required: false },
  { name: 'urgent', type: 'boolean', required: false },
  { name: 'payload', type: 'json', required: false },
];

describe('playground carry-over', () => {
  it('turns remembered text into typed values', () => {
    const carry = caseValuesFromPlaygroundText(VARIABLES, {
      ticket: 'Billing',
      priority: '2',
      urgent: 'false',
      payload: '{"a":1}',
    });

    expect(carry.empty).toBe(false);
    expect(carry.problems).toEqual([]);
    expect(carry.values).toEqual({
      ticket: 'Billing',
      priority: 2,
      urgent: false,
      payload: { a: 1 },
    });
  });

  it('leaves blank fields out instead of storing an empty answer', () => {
    const carry = caseValuesFromPlaygroundText(VARIABLES, { ticket: '', priority: '  ' });

    expect(carry.values).toEqual({});
    expect(carry.problems).toEqual([]);
    expect(carry.empty).toBe(false);
  });

  it('reports values that cannot be carried over instead of guessing', () => {
    const carry = caseValuesFromPlaygroundText(VARIABLES, {
      ticket: 'Billing',
      priority: 'high',
      payload: '{not json',
      legacy: 'x',
    });

    expect(carry.values).toEqual({ ticket: 'Billing' });
    expect(carry.problems.map((problem) => problem.name)).toEqual([
      'priority',
      'payload',
      'legacy',
    ]);
    expect(carry.problems.every((problem) => problem.severity === 'warning')).toBe(true);
    expect(carry.problems[0]?.message).toContain('not a valid number value');
  });

  it('reads nothing when the tab has never written inputs', () => {
    const storage = memoryStorage();
    expect(readPlaygroundCarryOver('p1', VARIABLES, storage)).toEqual({
      values: {},
      problems: [],
      empty: true,
    });

    // Another prompt's inputs are not this prompt's inputs.
    writePlaygroundValues('p2', { ticket: 'Other' }, storage);
    expect(readPlaygroundCarryOver('p1', VARIABLES, storage).empty).toBe(true);
    expect(readPlaygroundCarryOver('p2', VARIABLES, storage).values).toEqual({ ticket: 'Other' });
  });

  it('survives storage being unavailable', () => {
    expect(readPlaygroundCarryOver('p1', VARIABLES, null).empty).toBe(true);
    expect(loadCaseIntoPlayground('p1', VARIABLES, { ticket: 'x' }, null)).toEqual({
      written: false,
      values: { ticket: 'x' },
    });
  });

  it('writes a case into the place the playground reads, and says when it could not', () => {
    const storage = memoryStorage();
    const result = loadCaseIntoPlayground(
      'p1',
      VARIABLES,
      { ticket: 'Billing', priority: 2, payload: { a: 1 } },
      storage,
    );

    expect(result.written).toBe(true);
    expect(readPlaygroundValues('p1', storage)?.values).toEqual({
      ticket: 'Billing',
      priority: '2',
      payload: '{\n  "a": 1\n}',
    });

    const refused: Storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('quota');
      },
      getItem: () => null,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    expect(loadCaseIntoPlayground('p1', VARIABLES, { ticket: 'Billing' }, refused).written).toBe(
      false,
    );
    expect(playgroundStorageKey('p1')).toBe('promptforge.playground.p1');
  });
});
