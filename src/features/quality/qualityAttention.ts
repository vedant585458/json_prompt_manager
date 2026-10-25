/**
 * Dashboard attention feed for quality findings (TASK-024).
 *
 * The dashboard is a summary, so it asks a narrow question: which prompts have
 * errors or warnings that the user has not already dismissed? Suggestions alone
 * never reach it — a rule of thumb is not a reason to put a prompt on a list of
 * things that need attention.
 *
 * Like the rest of the dashboard, this is derived from stored records: the same
 * rule set, the same dismissals, and no scoring.
 */

import { parseDocument } from '@/domain/serialization';
import {
  applyDismissals,
  inspectQuality,
  type QualityDismissal,
  type QualityRuleId,
} from '@/domain/quality';
import type { Prompt } from '@/domain/types';
import { loadDismissals } from '@/features/quality/dismissalStorage';

/**
 * The rules the dashboard escalates (TASK-024).
 *
 * These five describe something *inconsistent* — a reference that points at
 * nothing, a key that is silently discarded, an example that contradicts the
 * declared format. An unfinished document (no objective, no instructions) is a
 * draft, not a defect, and a rule of thumb is not a reason to put a prompt on a
 * list of things that need attention. Both of those stay in the inspector, where
 * the reader can judge them.
 */
export const QUALITY_ATTENTION_RULES: readonly QualityRuleId[] = [
  'undefined-variable',
  'duplicate-json-key',
  'output-example-mismatch',
  'missing-snippet',
  'missing-schema-reference',
];

const ATTENTION_RULE_SET = new Set<string>(QUALITY_ATTENTION_RULES);

export interface QualityAttentionItem {
  readonly promptId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly errors: number;
  readonly warnings: number;
}

export interface QualityAttentionOptions {
  readonly snippetIds?: readonly string[];
  readonly schemaIds?: readonly string[];
  /** Injected so the collector can be tested without a browser. */
  readonly dismissedFor?: (promptId: string) => readonly QualityDismissal[];
}

/** Prompts whose stored document has at least one visible error or warning. */
export function collectQualityAttention(
  prompts: readonly Prompt[],
  options: QualityAttentionOptions = {},
): QualityAttentionItem[] {
  const {
    snippetIds = [],
    schemaIds = [],
    dismissedFor = (promptId: string) => loadDismissals(promptId),
  } = options;

  const items: QualityAttentionItem[] = [];

  for (const prompt of prompts) {
    if (prompt.archived) continue;

    // A document that does not parse is already on the list as invalid; running
    // rules over a document that cannot be read would describe a different one.
    const parsed = parseDocument(prompt.content as unknown);
    if (!parsed.ok) continue;

    const report = inspectQuality({
      document: parsed.value,
      record: { description: prompt.description },
      snippetIds,
      schemaIds,
    });
    const { visible } = applyDismissals(report.findings, dismissedFor(prompt.id));
    const defects = visible.filter((finding) => ATTENTION_RULE_SET.has(finding.ruleId));

    const errors = defects.filter((finding) => finding.severity === 'error').length;
    const warnings = defects.filter((finding) => finding.severity === 'warning').length;
    if (errors + warnings === 0) continue;

    items.push({
      promptId: prompt.id,
      title: prompt.title,
      updatedAt: prompt.updatedAt,
      errors,
      warnings,
    });
  }

  return items.sort(
    (left, right) =>
      right.errors - left.errors ||
      right.warnings - left.warnings ||
      left.title.localeCompare(right.title),
  );
}

/** `2 errors, 1 warning` — the words the attention row uses. */
export function describeQualityAttention(item: QualityAttentionItem): string {
  const parts: string[] = [];
  if (item.errors > 0) parts.push(`${item.errors} ${item.errors === 1 ? 'error' : 'errors'}`);
  if (item.warnings > 0) {
    parts.push(`${item.warnings} ${item.warnings === 1 ? 'warning' : 'warnings'}`);
  }

  const total = item.errors + item.warnings;
  return `${total} structural ${total === 1 ? 'finding' : 'findings'}: ${parts.join(', ')}`;
}
