import { describe, expect, it } from 'vitest';

import { createPrompt } from '@/domain/factories';
import { countPrompts, isEmptyTagEdit, rangeIds, tagCensus } from '@/features/bulk/bulkActions';
import type { Prompt } from '@/domain/types';

let sequence = 0;

function makePrompt(overrides: {
  title?: string;
  tags?: readonly string[];
  archived?: boolean;
}): Prompt {
  sequence += 1;
  return createPrompt(
    {
      title: overrides.title ?? `Prompt ${sequence}`,
      tags: overrides.tags ?? [],
      archived: overrides.archived ?? false,
    },
    { now: () => new Date('2026-10-24T09:00:00.000Z'), newId: () => `prompt-${sequence}` },
  );
}

describe('rangeIds', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('selects forwards and backwards inclusively', () => {
    expect(rangeIds(order, 'b', 'd')).toEqual(['b', 'c', 'd']);
    expect(rangeIds(order, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(rangeIds(order, 'c', 'c')).toEqual(['c']);
  });

  it('falls back to the target when the anchor is no longer visible', () => {
    expect(rangeIds(order, 'gone', 'c')).toEqual(['c']);
    expect(rangeIds(order, 'c', 'gone')).toEqual(['gone']);
  });
});

describe('tag edits', () => {
  it('knows when there is nothing to do', () => {
    expect(isEmptyTagEdit({ add: [], remove: [] })).toBe(true);
    expect(isEmptyTagEdit({ add: ['  '], remove: [] })).toBe(true);
    expect(isEmptyTagEdit({ add: ['finance'], remove: [] })).toBe(false);
    expect(isEmptyTagEdit({ add: [], remove: ['finance'] })).toBe(false);
  });
});

describe('tagCensus', () => {
  it('counts every tag, including archived prompts, most used first', () => {
    const prompts = [
      makePrompt({ tags: ['finance', 'support'] }),
      makePrompt({ tags: ['finance'] }),
      makePrompt({ tags: ['support'], archived: true }),
      makePrompt({ tags: [] }),
    ];

    expect(tagCensus(prompts)).toEqual([
      { tag: 'finance', count: 2 },
      { tag: 'support', count: 2 },
    ]);
  });

  it('returns an empty census for an empty selection', () => {
    expect(tagCensus([])).toEqual([]);
  });
});

describe('countPrompts', () => {
  it('agrees with the number', () => {
    expect(countPrompts(0)).toBe('0 prompts');
    expect(countPrompts(1)).toBe('1 prompt');
    expect(countPrompts(7)).toBe('7 prompts');
  });
});
