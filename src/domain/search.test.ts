import { describe, expect, it } from 'vitest';

import {
  SEARCH_EXCERPT_LIMIT,
  highlightSegments,
  matchPrompt,
  parseSearchQuery,
  searchPrompts,
} from '@/domain/search';
import { createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { Prompt } from '@/domain/types';

let sequence = 0;

function makePrompt(overrides: {
  title?: string;
  description?: string;
  tags?: readonly string[];
  objective?: string;
}): Prompt {
  return createPrompt(
    {
      title: overrides.title ?? 'Extraction prompt',
      description: overrides.description ?? 'Pulls fields out of support mail.',
      tags: overrides.tags ?? ['extraction'],
      content: createBlankDocument({
        name: overrides.title ?? 'Extraction prompt',
        objective:
          overrides.objective ??
          'Extract the customer name, order id, and sentiment from the email.',
      }),
    },
    { now: () => new Date('2026-10-24T09:00:00.000Z'), newId: () => `prompt-${++sequence}` },
  );
}

describe('parseSearchQuery', () => {
  it('lowercases, splits, and de-duplicates terms', () => {
    expect(parseSearchQuery('  JSON   schema json  ')).toEqual(['json', 'schema']);
  });

  it('treats an empty or whitespace query as no query', () => {
    expect(parseSearchQuery('')).toEqual([]);
    expect(parseSearchQuery('   \n\t ')).toEqual([]);
  });
});

describe('matchPrompt', () => {
  it('finds a term in the title and reports the fields that matched', () => {
    const prompt = makePrompt({ title: 'Support triage' });
    const match = matchPrompt(prompt, 'triage');

    // The document is named after the prompt, so its name field matches too.
    expect(match?.fields).toEqual(['title', 'content']);
    expect(match?.excerpt).toContain('Support triage');
  });

  it('finds a term in the description', () => {
    const prompt = makePrompt({ title: 'Untitled', description: 'Turns invoices into JSON' });
    expect(matchPrompt(prompt, 'invoices')?.fields).toEqual(['description']);
  });

  it('finds a term in tags, case-insensitively', () => {
    const prompt = makePrompt({ title: 'Neutral title', tags: ['Extraction', 'support'] });
    expect(matchPrompt(prompt, 'EXTRACTION')?.fields).toEqual(['tag']);
  });

  it('searches the stored JSON document and returns an excerpt', () => {
    const prompt = makePrompt({ title: 'Neutral title', description: 'neutral' });
    const match = matchPrompt(prompt, 'sentiment');

    expect(match?.fields).toEqual(['content']);
    expect(match?.excerpt).toContain('sentiment');
    expect(match?.excerpt?.startsWith('"objective"')).toBe(true);
  });

  it('reports every field that matched, in a stable order', () => {
    const prompt = makePrompt({ title: 'Sentiment reader', tags: ['sentiment'] });
    expect(matchPrompt(prompt, 'sentiment')?.fields).toEqual(['title', 'tag', 'content']);
  });

  it('requires every term to appear somewhere', () => {
    const prompt = makePrompt({ title: 'Support triage' });

    expect(matchPrompt(prompt, 'support')).not.toBeNull();
    expect(matchPrompt(prompt, 'support triage')).not.toBeNull();
    expect(matchPrompt(prompt, 'support invoice')).toBeNull();
  });

  it('returns null for an empty query rather than matching everything', () => {
    expect(matchPrompt(makePrompt({}), '   ')).toBeNull();
  });

  it('does not treat the query as a regular expression', () => {
    const prompt = makePrompt({ title: 'Schema v1.0 (strict)' });

    expect(matchPrompt(prompt, 'v1.0')).not.toBeNull();
    expect(matchPrompt(prompt, '(strict)')).not.toBeNull();
    expect(matchPrompt(prompt, 'v2.*')).toBeNull();
  });

  it('caps the excerpt length', () => {
    const prompt = makePrompt({
      title: 'Long line',
      objective: `Extract ${'value '.repeat(60)}sentiment`,
    });

    const excerpt = matchPrompt(prompt, 'sentiment')?.excerpt ?? '';
    expect(excerpt.length).toBeLessThanOrEqual(SEARCH_EXCERPT_LIMIT + 1);
    expect(excerpt.endsWith('…')).toBe(true);
  });
});

describe('searchPrompts', () => {
  const prompts = [
    makePrompt({ title: 'Support triage', tags: ['support'] }),
    makePrompt({ title: 'Invoice parser', tags: ['finance'] }),
    makePrompt({ title: 'Review reply', tags: ['writing'] }),
  ];

  it('returns matches in the order given', () => {
    const results = searchPrompts(prompts, 'e');
    expect(results.map((result) => result.prompt.title)).toEqual([
      'Support triage',
      'Invoice parser',
      'Review reply',
    ]);
  });

  it('narrows to the prompts that match every term', () => {
    expect(searchPrompts(prompts, 'invoice').map((result) => result.prompt.title)).toEqual([
      'Invoice parser',
    ]);
  });

  it('returns nothing for an empty query without scanning', () => {
    expect(searchPrompts(prompts, '  ')).toEqual([]);
  });
});

describe('highlightSegments', () => {
  it('returns the whole text unhighlighted when nothing matches', () => {
    expect(highlightSegments('Support triage', 'invoice')).toEqual([
      { text: 'Support triage', match: false },
    ]);
  });

  it('marks every occurrence, preserving the original case', () => {
    expect(highlightSegments('Support support SUP', 'support')).toEqual([
      { text: 'Support', match: true },
      { text: ' ', match: false },
      { text: 'support', match: true },
      { text: ' SUP', match: false },
    ]);
  });

  it('merges overlapping and adjacent hits into one mark', () => {
    expect(highlightSegments('abcd', 'abc bcd')).toEqual([{ text: 'abcd', match: true }]);
  });

  it('handles punctuation literally', () => {
    expect(highlightSegments('Use a.b here', 'a.b')).toEqual([
      { text: 'Use ', match: false },
      { text: 'a.b', match: true },
      { text: ' here', match: false },
    ]);
  });

  it('returns one plain segment for an empty query', () => {
    expect(highlightSegments('Support', '   ')).toEqual([{ text: 'Support', match: false }]);
  });

  it('never produces empty segments', () => {
    const segments = highlightSegments('json', 'json');
    expect(segments).toEqual([{ text: 'json', match: true }]);
  });
});

describe('searchPrompts at library scale', () => {
  const prompts = Array.from({ length: 500 }, (_, index) =>
    createPrompt(
      {
        title: `Extraction prompt ${index}`,
        description: `Pulls fields out of support mail batch ${index}`,
        tags: ['extraction', `batch-${index % 12}`],
        content: createBlankDocument({
          name: `Extraction prompt ${index}`,
          objective: 'Extract the customer name, order id, and sentiment from the email.',
        }),
      },
      { now: () => new Date('2026-10-24T09:00:00.000Z'), newId: () => `scale-${index}` },
    ),
  );

  it('answers a keystroke over 500 prompts well inside the 100 ms budget', () => {
    // The first call stringifies every document; later calls reuse the cache.
    searchPrompts(prompts, 'extraction');

    const timings = Array.from({ length: 5 }, (_, index) => {
      const start = performance.now();
      const results = searchPrompts(prompts, `extraction batch-${index}`);
      const elapsed = performance.now() - start;

      // The check is useless if the query stops matching anything.
      expect(results.length).toBeGreaterThan(0);
      return elapsed;
    });

    expect(Math.max(...timings)).toBeLessThan(100);
  });

  it('keeps results in the order it was given across 500 prompts', () => {
    const results = searchPrompts(prompts, 'batch-3').map((entry) => entry.prompt.id);
    const expected = prompts.filter((prompt) => prompt.tags.includes('batch-3')).map((p) => p.id);

    expect(results).toEqual(expected);
  });
});
