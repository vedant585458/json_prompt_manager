/**
 * Rendered-text comparison for the laboratory (TASK-022).
 *
 * The lab renders one prompt with several saved inputs. Two of those renders
 * usually differ in a few characters, and the useful question is *where*. This
 * module answers it with a line-level longest-common-subsequence: unchanged
 * lines are shared, removed lines belong to the left variant only, added lines
 * to the right one.
 *
 * It is deliberately separate from `src/domain/diff.ts` (TASK-020), which
 * compares two parsed JSON documents and explains a structural change by
 * pointer. Rendered prompts are prose — a pointer into them would be a line and
 * a column dressed up as a path — so line alignment is the honest model here.
 *
 * Bounded: both texts are limited to `maxLines`, the alignment table to
 * `maxCells`, and copied text to `maxCopiedChars`. When the bound is hit the
 * comparison says so instead of silently comparing a prefix.
 */

export const RENDER_DIFF_LIMITS = {
  /** Lines per variant before the comparison refuses to align them. */
  maxLines: 2_000,
  /** Alignment table cells (lines × lines). */
  maxCells: 400_000,
  /** Characters in a copied comparison. */
  maxCopiedChars: 200_000,
} as const;

export type RenderedLineKind = 'same' | 'added' | 'removed';

export interface RenderedLine {
  readonly kind: RenderedLineKind;
  readonly text: string;
  /** 1-based line number in the "before" variant, when the line exists there. */
  readonly beforeLine: number | null;
  /** 1-based line number in the "after" variant, when the line exists there. */
  readonly afterLine: number | null;
}

/** One side of a comparison: what it is, and the text it produced. */
export interface RenderedVariant {
  readonly label: string;
  readonly text: string;
}

export interface RenderedComparison {
  /** True when the two texts are byte-identical. */
  readonly identical: boolean;
  readonly rows: readonly RenderedLine[];
  readonly added: number;
  readonly removed: number;
  /** True when a limit stopped a full alignment; `rows` is then not a full diff. */
  readonly truncated: boolean;
  readonly before: RenderedVariant;
  readonly after: RenderedVariant;
}

export interface RenderedComparisonOptions {
  readonly maxLines?: number;
  readonly maxCells?: number;
}

/** Empty text has no lines, so "nothing rendered" is not one empty line. */
function splitLines(text: string): string[] {
  return text === '' ? [] : text.split('\n');
}

/**
 * Compares two rendered variants line by line.
 *
 * A line's text is compared exactly — trailing spaces, case, and unicode are
 * meaningful. Two variants that differ only in their labels are identical.
 */
export function diffRenderedVariants(
  before: RenderedVariant,
  after: RenderedVariant,
  options: RenderedComparisonOptions = {},
): RenderedComparison {
  const maxLines = options.maxLines ?? RENDER_DIFF_LIMITS.maxLines;
  const maxCells = options.maxCells ?? RENDER_DIFF_LIMITS.maxCells;

  const identical = before.text === after.text;
  if (identical) {
    return {
      identical: true,
      rows: splitLines(before.text).map((text, index) => ({
        kind: 'same' as const,
        text,
        beforeLine: index + 1,
        afterLine: index + 1,
      })),
      added: 0,
      removed: 0,
      truncated: false,
      before,
      after,
    };
  }

  const beforeLines = splitLines(before.text);
  const afterLines = splitLines(after.text);

  const tooManyLines = beforeLines.length > maxLines || afterLines.length > maxLines;
  const tooManyCells = beforeLines.length * afterLines.length > maxCells;

  if (tooManyLines || tooManyCells) {
    return overviewComparison(before, after, beforeLines, afterLines);
  }

  const rows = align(beforeLines, afterLines);

  return {
    identical: false,
    rows,
    added: rows.filter((row) => row.kind === 'added').length,
    removed: rows.filter((row) => row.kind === 'removed').length,
    truncated: false,
    before,
    after,
  };
}

/**
 * Fallback for texts that are too large to align: the shared prefix and suffix
 * are reported as unchanged and everything between them as removed/added. The
 * result is coarse but true, and `truncated` tells the interface to say so.
 */
function overviewComparison(
  before: RenderedVariant,
  after: RenderedVariant,
  beforeLines: readonly string[],
  afterLines: readonly string[],
  limit = 200,
): RenderedComparison {
  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const rows: RenderedLine[] = [];
  for (let index = 0; index < prefix; index += 1) {
    rows.push({
      kind: 'same',
      text: beforeLines[index] as string,
      beforeLine: index + 1,
      afterLine: index + 1,
    });
  }

  const removedLines = beforeLines.slice(prefix, beforeLines.length - suffix);
  let removedShown = 0;
  for (const text of removedLines) {
    if (removedShown >= limit) break;
    removedShown += 1;
    rows.push({
      kind: 'removed',
      text,
      beforeLine: prefix + removedShown,
      afterLine: null,
    });
  }

  const addedLines = afterLines.slice(prefix, afterLines.length - suffix);
  let addedShown = 0;
  for (const text of addedLines) {
    if (addedShown >= limit) break;
    addedShown += 1;
    rows.push({
      kind: 'added',
      text,
      beforeLine: null,
      afterLine: prefix + addedShown,
    });
  }

  for (let index = suffix; index > 0; index -= 1) {
    rows.push({
      kind: 'same',
      text: afterLines[afterLines.length - index] as string,
      beforeLine: beforeLines.length - index + 1,
      afterLine: afterLines.length - index + 1,
    });
  }

  return {
    identical: false,
    rows,
    added: addedLines.length,
    removed: removedLines.length,
    truncated: true,
    before,
    after,
  };
}

/**
 * Longest-common-subsequence alignment of two line arrays.
 *
 * The table is `(n+1) × (m+1)` of 32-bit integers — bounded by the caller —
 * and the walk back produces rows in reading order. Within one changed run,
 * removals are emitted before additions, so a replaced line reads as what went
 * away followed by what replaced it.
 */
function align(beforeLines: readonly string[], afterLines: readonly string[]): RenderedLine[] {
  const rows: RenderedLine[] = [];
  const n = beforeLines.length;
  const m = afterLines.length;

  if (n === 0 && m === 0) return rows;
  if (n === 0) {
    return afterLines.map((text, index) => ({
      kind: 'added' as const,
      text,
      beforeLine: null,
      afterLine: index + 1,
    }));
  }
  if (m === 0) {
    return beforeLines.map((text, index) => ({
      kind: 'removed' as const,
      text,
      beforeLine: index + 1,
      afterLine: null,
    }));
  }

  const width = m + 1;
  const table = new Int32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const current = i * width + j;
      if (beforeLines[i] === afterLines[j]) {
        table[current] = (table[(i + 1) * width + j + 1] as number) + 1;
      } else {
        const down = table[(i + 1) * width + j] as number;
        const right = table[i * width + j + 1] as number;
        table[current] = down >= right ? down : right;
      }
    }
  }

  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (beforeLines[i] === afterLines[j]) {
      rows.push({
        kind: 'same',
        text: beforeLines[i] as string,
        beforeLine: i + 1,
        afterLine: j + 1,
      });
      i += 1;
      j += 1;
      continue;
    }

    const down = table[(i + 1) * width + j] as number;
    const right = table[i * width + j + 1] as number;

    if (right > down) {
      rows.push({
        kind: 'added',
        text: afterLines[j] as string,
        beforeLine: null,
        afterLine: j + 1,
      });
      j += 1;
    } else {
      // Ties prefer the removal; the next iteration then re-tests the same
      // position against the next line, which is where the addition lands.
      rows.push({
        kind: 'removed',
        text: beforeLines[i] as string,
        beforeLine: i + 1,
        afterLine: null,
      });
      i += 1;
    }
  }

  while (i < n) {
    rows.push({
      kind: 'removed',
      text: beforeLines[i] as string,
      beforeLine: i + 1,
      afterLine: null,
    });
    i += 1;
  }

  while (j < m) {
    rows.push({ kind: 'added', text: afterLines[j] as string, beforeLine: null, afterLine: j + 1 });
    j += 1;
  }

  return rows;
}

/** One sentence describing a comparison, for headings and live regions. */
export function describeRenderedComparison(comparison: RenderedComparison): string {
  if (comparison.identical) return 'The two rendered variants are identical.';

  const parts: string[] = [];
  if (comparison.added > 0) {
    parts.push(`${comparison.added} line${comparison.added === 1 ? '' : 's'} added`);
  }
  if (comparison.removed > 0) {
    parts.push(`${comparison.removed} line${comparison.removed === 1 ? '' : 's'} removed`);
  }

  const base = parts.length > 0 ? parts.join(', ') : 'The lines differ';
  return comparison.truncated
    ? `${base}. These texts are too long to align line by line, so only the changed blocks are shown.`
    : `${base}.`;
}

/** A plain-text rendering suitable for the clipboard; prefixed `+`/`-`/` `. */
export function renderedComparisonToText(comparison: RenderedComparison): string {
  const header = [
    'Rendered comparison',
    `Before: ${comparison.before.label}`,
    `After: ${comparison.after.label}`,
    describeRenderedComparison(comparison),
    '',
  ].join('\n');

  const body: string[] = [];
  for (const row of comparison.rows) {
    const prefix = row.kind === 'added' ? '+ ' : row.kind === 'removed' ? '- ' : '  ';
    body.push(`${prefix}${row.text}`);
  }

  const text = `${header}${body.join('\n')}`;
  if (text.length <= RENDER_DIFF_LIMITS.maxCopiedChars) return text;

  return `${text.slice(0, RENDER_DIFF_LIMITS.maxCopiedChars)}\n… truncated at ${RENDER_DIFF_LIMITS.maxCopiedChars.toLocaleString()} characters.`;
}
