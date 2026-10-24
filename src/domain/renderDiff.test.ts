import { describe, expect, it } from 'vitest';

import {
  RENDER_DIFF_LIMITS,
  describeRenderedComparison,
  diffRenderedVariants,
  renderedComparisonToText,
  type RenderedVariant,
} from '@/domain/renderDiff';

const BEFORE: RenderedVariant = { label: 'Stored prompt · Refund', text: 'ROLE\nSupport lead' };
const AFTER: RenderedVariant = { label: 'Stored prompt · Refund', text: 'ROLE\nBilling lead' };

function kinds(rows: readonly { kind: string }[]): string[] {
  return rows.map((row) => row.kind);
}

describe('rendered comparison', () => {
  it('reports identical texts as identical, keeping the labels in the result', () => {
    const text = 'ROLE\nSupport lead\n\nOBJECTIVE\nHelp.';
    const comparison = diffRenderedVariants({ label: 'Case A', text }, { label: 'Case B', text });

    expect(comparison.identical).toBe(true);
    expect(comparison.added).toBe(0);
    expect(comparison.removed).toBe(0);
    expect(comparison.truncated).toBe(false);
    expect(comparison.before.label).toBe('Case A');
    expect(comparison.after.label).toBe('Case B');
    expect(kinds(comparison.rows)).toEqual(['same', 'same', 'same', 'same', 'same']);
    expect(comparison.rows[0]).toEqual({ kind: 'same', text: 'ROLE', beforeLine: 1, afterLine: 1 });
  });

  it('shows a replaced line as a removal followed by an addition', () => {
    const comparison = diffRenderedVariants(BEFORE, AFTER);

    expect(comparison.identical).toBe(false);
    expect(comparison.added).toBe(1);
    expect(comparison.removed).toBe(1);
    expect(comparison.rows).toEqual([
      { kind: 'same', text: 'ROLE', beforeLine: 1, afterLine: 1 },
      { kind: 'removed', text: 'Support lead', beforeLine: 2, afterLine: null },
      { kind: 'added', text: 'Billing lead', beforeLine: null, afterLine: 2 },
    ]);
  });

  it('keeps insertion and deletion counts to the lines that actually moved', () => {
    const three = 'a\nb\nc';
    const inserted = diffRenderedVariants(
      { label: 'A', text: three },
      { label: 'B', text: 'a\nb\nx\nc' },
    );
    expect(inserted.added).toBe(1);
    expect(inserted.removed).toBe(0);
    expect(inserted.rows.filter((row) => row.kind === 'same').map((row) => row.text)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(inserted.rows.find((row) => row.kind === 'added')).toEqual({
      kind: 'added',
      text: 'x',
      beforeLine: null,
      afterLine: 3,
    });

    const deleted = diffRenderedVariants(
      { label: 'A', text: 'a\nb\nx\nc' },
      { label: 'B', text: three },
    );
    expect(deleted.added).toBe(0);
    expect(deleted.removed).toBe(1);
    expect(deleted.rows.find((row) => row.kind === 'removed')).toEqual({
      kind: 'removed',
      text: 'x',
      beforeLine: 3,
      afterLine: null,
    });
  });

  it('aligns several hunks in reading order with correct line numbers', () => {
    const before = 'one\ntwo\nthree\nfour\nfive';
    const after = 'one\nTWO\nthree\nfour\nFIVE';
    const comparison = diffRenderedVariants(
      { label: 'A', text: before },
      { label: 'B', text: after },
    );

    expect(kinds(comparison.rows)).toEqual([
      'same',
      'removed',
      'added',
      'same',
      'same',
      'removed',
      'added',
    ]);
    expect(comparison.rows.map((row) => [row.beforeLine, row.afterLine])).toEqual([
      [1, 1],
      [2, null],
      [null, 2],
      [3, 3],
      [4, 4],
      [5, null],
      [null, 5],
    ]);
  });

  it('treats an empty side as no lines rather than one empty line', () => {
    const added = diffRenderedVariants({ label: 'A', text: '' }, { label: 'B', text: 'x' });
    expect(added.added).toBe(1);
    expect(added.removed).toBe(0);

    const removed = diffRenderedVariants({ label: 'A', text: 'x' }, { label: 'B', text: '' });
    expect(removed.added).toBe(0);
    expect(removed.removed).toBe(1);

    const bothEmpty = diffRenderedVariants({ label: 'A', text: '' }, { label: 'B', text: '' });
    expect(bothEmpty.identical).toBe(true);
    expect(bothEmpty.rows).toHaveLength(0);
  });

  it('counts a trailing newline as a difference', () => {
    const comparison = diffRenderedVariants(
      { label: 'A', text: 'ROLE' },
      { label: 'B', text: 'ROLE\n' },
    );
    expect(comparison.identical).toBe(false);
    expect(comparison.added).toBe(1);
  });

  it('compares text exactly, including unicode and carriage returns', () => {
    const emoji = diffRenderedVariants(
      { label: 'A', text: 'Grüße 👋' },
      { label: 'B', text: 'Grüße 👋' },
    );
    expect(emoji.identical).toBe(true);

    const composed = 'Café';
    const decomposed = 'Cafe\u0301';
    expect(
      diffRenderedVariants({ label: 'A', text: composed }, { label: 'B', text: decomposed })
        .identical,
    ).toBe(false);

    // A CRLF text is not normalised: the carriage return is part of the line.
    const crlf = diffRenderedVariants(
      { label: 'A', text: 'ROLE\nA' },
      { label: 'B', text: 'ROLE\r\nA' },
    );
    expect(crlf.identical).toBe(false);
    expect(crlf.added).toBe(1);
    expect(crlf.removed).toBe(1);
  });

  it('refuses to align very long texts and says so', () => {
    const before = Array.from({ length: 6 }, (_, index) => `line ${index}`).join('\n');
    const after = Array.from({ length: 6 }, (_, index) => `changed ${index}`).join('\n');

    const comparison = diffRenderedVariants(
      { label: 'A', text: before },
      { label: 'B', text: after },
      { maxLines: 3 },
    );

    expect(comparison.truncated).toBe(true);
    expect(comparison.identical).toBe(false);
    expect(comparison.added).toBe(6);
    expect(comparison.removed).toBe(6);
    expect(describeRenderedComparison(comparison)).toContain('too long to align');
  });

  it('falls back when the alignment table would be too large', () => {
    const before = Array.from({ length: 10 }, (_, index) => `a${index}`).join('\n');
    const after = Array.from({ length: 10 }, (_, index) => `b${index}`).join('\n');

    const comparison = diffRenderedVariants(
      { label: 'A', text: before },
      { label: 'B', text: after },
      { maxCells: 4 },
    );

    expect(comparison.truncated).toBe(true);
    expect(comparison.rows.length).toBeGreaterThan(0);
  });

  it('limits the fallback block size instead of emitting everything', () => {
    const before = Array.from({ length: 500 }, (_, index) => `a${index}`).join('\n');
    const after = Array.from({ length: 500 }, (_, index) => `b${index}`).join('\n');

    const comparison = diffRenderedVariants(
      { label: 'A', text: before },
      { label: 'B', text: after },
      { maxLines: 10 },
    );

    expect(comparison.truncated).toBe(true);
    expect(comparison.added).toBe(500);
    expect(comparison.removed).toBe(500);
    // 200 removed + 200 added are shown; the counts above stay truthful.
    expect(comparison.rows).toHaveLength(400);
  });

  it('describes a comparison in one sentence', () => {
    expect(
      describeRenderedComparison(
        diffRenderedVariants({ label: 'A', text: 'x' }, { label: 'B', text: 'x' }),
      ),
    ).toBe('The two rendered variants are identical.');

    expect(
      describeRenderedComparison(
        diffRenderedVariants({ label: 'A', text: 'x' }, { label: 'B', text: 'y' }),
      ),
    ).toBe('1 line added, 1 line removed.');

    expect(
      describeRenderedComparison(
        diffRenderedVariants({ label: 'A', text: 'a\nb' }, { label: 'B', text: 'a\nb\nc\nd' }),
      ),
    ).toBe('2 lines added.');
  });

  it('copies a readable comparison that names both variants', () => {
    const comparison = diffRenderedVariants(BEFORE, AFTER);
    const text = renderedComparisonToText(comparison);

    expect(text).toContain('Rendered comparison');
    expect(text).toContain('Before: Stored prompt · Refund');
    expect(text).toContain('After: Stored prompt · Refund');
    expect(text).toContain('  ROLE');
    expect(text).toContain('- Support lead');
    expect(text).toContain('+ Billing lead');
  });

  it('caps the copied text and says it was capped', () => {
    const long = 'x'.repeat(RENDER_DIFF_LIMITS.maxCopiedChars);
    const comparison = diffRenderedVariants(
      { label: 'A', text: long },
      { label: 'B', text: `${long}y` },
    );
    const text = renderedComparisonToText(comparison);

    expect(text.length).toBeLessThan(RENDER_DIFF_LIMITS.maxCopiedChars + 200);
    expect(text).toContain('truncated at');
  });
});
