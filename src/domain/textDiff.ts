/**
 * Line-level comparison for recovery hints (TASK-015).
 *
 * When a draft is found after a reload, the user deserves to know *how* it
 * differs from the stored prompt before restoring it. This is deliberately a
 * summary, not a diff viewer: it reports where the change starts and how many
 * lines were added and removed.
 */

export interface LineDifference {
  /** 1-based line where the two texts first differ; `0` when identical. */
  readonly firstDifferingLine: number;
  readonly added: number;
  readonly removed: number;
}

export function splitLines(text: string): string[] {
  return text.split('\n');
}

/**
 * Compares two texts by their common prefix and suffix.
 *
 * Only the changed middle is counted, so an edit near the end of a long document
 * reports a small number rather than every line below it.
 */
export function summarizeLineDifference(from: string, to: string): LineDifference {
  if (from === to) return { firstDifferingLine: 0, added: 0, removed: 0 };

  const before = splitLines(from);
  const after = splitLines(to);

  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    firstDifferingLine: prefix + 1,
    removed: before.length - prefix - suffix,
    added: after.length - prefix - suffix,
  };
}

/** One sentence describing a difference, used as the recovery hint. */
export function describeLineDifference(difference: LineDifference): string {
  if (difference.firstDifferingLine === 0) return 'Identical to the stored document.';

  const parts: string[] = [];
  if (difference.added > 0) {
    parts.push(`+${difference.added} ${difference.added === 1 ? 'line' : 'lines'}`);
  }
  if (difference.removed > 0) {
    parts.push(`−${difference.removed} ${difference.removed === 1 ? 'line' : 'lines'}`);
  }

  return `Differs from the stored document at line ${difference.firstDifferingLine}${
    parts.length > 0 ? ` (${parts.join(', ')})` : ''
  }.`;
}
