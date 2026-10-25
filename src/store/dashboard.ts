/**
 * Dashboard selectors (TASK-010).
 *
 * Every number the dashboard shows comes from here, and every derivation is a
 * pure function of stored records — no counts are hard-coded and no prompt is
 * assumed to be valid. Document problems are found by actually parsing the
 * stored content with the domain parser, which is the only definition of
 * "invalid" this build has. Valid syntax is never presented as quality.
 */

import {
  DEFAULT_HEALTH_THRESHOLDS,
  findDocumentProblems,
  type DocumentProblem,
} from '@/domain/health';
import { findSchemaProblems, type PromptSchemaProblem } from '@/domain/validation';
import type {
  ActivityEvent,
  Collection,
  Prompt,
  PromptRevision,
  PromptSchema,
  PromptTemplate,
} from '@/domain/types';
import { selectCounts } from '@/store/selectors';

export const DASHBOARD_LIMITS = {
  recent: 5,
  pinned: 6,
  favorites: 5,
  activity: 8,
  templates: 3,
  attention: 5,
} as const;

/**
 * A prompt untouched for this long is surfaced as "worth a look".
 *
 * The same default the health report uses (TASK-025), so the two screens greet
 * the same library with the same definition of quiet.
 */
export const STALE_AFTER_DAYS = DEFAULT_HEALTH_THRESHOLDS.attentionDays;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A prompt whose stored content will not read back as a document.
 *
 * Defined and computed in `domain/health` (TASK-025) so the dashboard's
 * attention list and the health report cannot disagree about what is broken.
 */
export type { DocumentProblem };
export { findDocumentProblems };

export type AttentionKind = 'invalid-document' | 'schema-mismatch' | 'quality-findings' | 'stale';

export interface AttentionItem {
  readonly id: string;
  readonly kind: AttentionKind;
  readonly promptId: string;
  readonly title: string;
  readonly detail: string;
  readonly updatedAt: string;
}

/**
 * A prompt the quality inspector has something to say about (TASK-024).
 *
 * Counts only: the dashboard says how many findings a prompt has and links to
 * the inspector, where the findings and their dismissals live.
 */
export interface QualityAttentionSource {
  readonly promptId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly errors: number;
  readonly warnings: number;
}

export interface DashboardCounts {
  /** Non-archived prompts: the library's default view. */
  readonly total: number;
  readonly active: number;
  readonly favorites: number;
  readonly archived: number;
  readonly collections: number;
  readonly snapshots: number;
  readonly invalidDocuments: number;
  /** Prompts whose stored document fails the schema they point at (TASK-016). */
  readonly schemaMismatches: number;
  readonly templates: number;
}

export interface DashboardData {
  readonly counts: DashboardCounts;
  readonly recent: readonly Prompt[];
  readonly pinned: readonly Prompt[];
  readonly favorites: readonly Prompt[];
  readonly templates: readonly PromptTemplate[];
  readonly attention: readonly AttentionItem[];
  readonly activity: readonly ActivityEvent[];
  /** True when the library holds no prompts at all (archived included). */
  readonly isEmpty: boolean;
}

export interface DashboardInput {
  readonly prompts: readonly Prompt[];
  readonly collections: readonly Collection[];
  readonly templates: readonly PromptTemplate[];
  readonly revisions: readonly PromptRevision[];
  readonly activity: readonly ActivityEvent[];
  /** Stored schemas; when omitted, no schema check is attempted (TASK-016). */
  readonly schemas?: readonly PromptSchema[];
  /** Quality findings per prompt, already filtered by dismissals (TASK-024). */
  readonly quality?: readonly QualityAttentionSource[];
  readonly now?: Date;
}

function byUpdatedDesc(left: Prompt, right: Prompt): number {
  if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
  return left.id.localeCompare(right.id);
}

function byActivityDesc(left: ActivityEvent, right: ActivityEvent): number {
  if (left.createdAt !== right.createdAt) return right.createdAt.localeCompare(left.createdAt);
  return right.id.localeCompare(left.id);
}

function isStale(prompt: Prompt, now: Date): boolean {
  const updated = new Date(prompt.updatedAt).getTime();
  if (Number.isNaN(updated)) return false;
  return now.getTime() - updated > STALE_AFTER_DAYS * DAY_MS;
}

/**
 * What needs attention: documents that do not parse first, then prompts that
 * have not been touched for a month. Capped so the dashboard stays a summary.
 */
export function selectAttention(
  prompts: readonly Prompt[],
  problems: readonly DocumentProblem[],
  now: Date,
  schemaProblems: readonly PromptSchemaProblem[] = [],
  quality: readonly QualityAttentionSource[] = [],
  limit: number = DASHBOARD_LIMITS.attention,
): AttentionItem[] {
  const invalid: AttentionItem[] = problems.map((problem) => ({
    id: `invalid:${problem.promptId}`,
    kind: 'invalid-document',
    promptId: problem.promptId,
    title: problem.title,
    detail: `${problem.path} — ${problem.message}`,
    updatedAt: problem.updatedAt,
  }));

  const stale: AttentionItem[] = prompts
    .filter((prompt) => !prompt.archived && isStale(prompt, now))
    .sort(byUpdatedDesc)
    .map((prompt) => ({
      id: `stale:${prompt.id}`,
      kind: 'stale',
      promptId: prompt.id,
      title: prompt.title,
      detail: `Not edited in over ${STALE_AFTER_DAYS} days.`,
      updatedAt: prompt.updatedAt,
    }));

  // A document that parses but fails its attached schema is a different problem
  // from one that will not parse, so it gets its own kind and its own wording.
  const mismatched: AttentionItem[] = schemaProblems.map((problem) => ({
    id: `schema:${problem.promptId}`,
    kind: 'schema-mismatch',
    promptId: problem.promptId,
    title: problem.title,
    detail: `${problem.schemaName}: ${problem.issues.length} ${
      problem.issues.length === 1 ? 'schema error' : 'schema errors'
    }, first at ${problem.issues[0]?.path ?? '$'}.`,
    updatedAt: prompts.find((prompt) => prompt.id === problem.promptId)?.updatedAt ?? '',
  }));

  // Findings are advisory, so they follow the two problems that actually block
  // reading a document, and they precede "not touched recently".
  const findings: AttentionItem[] = quality.map((item) => {
    const total = item.errors + item.warnings;

    return {
      id: `quality:${item.promptId}`,
      kind: 'quality-findings',
      promptId: item.promptId,
      title: item.title,
      detail: `${total} structural ${total === 1 ? 'finding' : 'findings'} in the inspector`,
      updatedAt: item.updatedAt,
    };
  });

  return [...invalid, ...mismatched, ...findings, ...stale].slice(0, Math.max(0, limit));
}

/** Every dashboard value, derived once from stored records. */
export function selectDashboardData(input: DashboardInput): DashboardData {
  const now = input.now ?? new Date();
  const counts = selectCounts(input.prompts);
  const live = input.prompts.filter((prompt) => !prompt.archived);
  // Archived prompts are outside the working set, so a document that only
  // fails to parse while archived does not inflate the dashboard's attention
  // list or its "invalid documents" count.
  const problems = findDocumentProblems(live);
  const schemaProblems = input.schemas ? findSchemaProblems(live, input.schemas) : [];
  const recent = [...live].sort(byUpdatedDesc).slice(0, DASHBOARD_LIMITS.recent);
  const pinned = live
    .filter((prompt) => prompt.pinned)
    .sort(byUpdatedDesc)
    .slice(0, DASHBOARD_LIMITS.pinned);
  const favorites = live
    .filter((prompt) => prompt.favorite)
    .sort(byUpdatedDesc)
    .slice(0, DASHBOARD_LIMITS.favorites);

  const templates = [...input.templates]
    .sort((left, right) => {
      if (left.isBuiltIn !== right.isBuiltIn) return left.isBuiltIn ? -1 : 1;
      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    })
    .slice(0, DASHBOARD_LIMITS.templates);

  const activity = [...input.activity].sort(byActivityDesc).slice(0, DASHBOARD_LIMITS.activity);

  return {
    counts: {
      total: counts.all - counts.archived,
      active: counts.active,
      favorites: counts.favorites,
      archived: counts.archived,
      collections: input.collections.length,
      snapshots: input.revisions.length,
      invalidDocuments: problems.length,
      schemaMismatches: schemaProblems.length,
      templates: input.templates.length,
    },
    recent,
    pinned,
    favorites,
    templates,
    attention: selectAttention(input.prompts, problems, now, schemaProblems, input.quality ?? []),
    activity,
    isEmpty: input.prompts.length === 0,
  };
}

/** One noun with its count, e.g. `1 prompt`, `4 collections`, `0 prompts`. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The dashboard header's one-line summary.
 *
 * Written from the same counts the stat strip renders, so the sentence can
 * never disagree with the numbers beside it. It deliberately says nothing about
 * prompt quality: a document that parses is only syntactically readable.
 */
export function describeDashboardSummary(counts: DashboardCounts): string {
  if (counts.total === 0 && counts.archived === 0) {
    return 'Your library is empty — the fastest way in is a template.';
  }

  const library =
    counts.collections === 0
      ? `${plural(counts.total, 'prompt')} and no collections yet.`
      : `${plural(counts.total, 'prompt')} across ${plural(counts.collections, 'collection')}.`;

  const parsed =
    counts.invalidDocuments === 0
      ? 'Every stored document parses.'
      : `${plural(counts.invalidDocuments, 'document')} will not parse and ${counts.invalidDocuments === 1 ? 'needs' : 'need'} a fix.`;

  const schema =
    counts.schemaMismatches === 0
      ? ''
      : ` ${plural(counts.schemaMismatches, 'document')} ${counts.schemaMismatches === 1 ? 'fails' : 'fail'} an attached schema.`;

  return `${library} ${parsed}${schema}`;
}
