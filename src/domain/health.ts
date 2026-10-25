/**
 * Library health metrics (TASK-025).
 *
 * Everything here is a recomputation from stored records — prompts, schemas,
 * revisions, and the activity log. No number is cached, hard-coded, or
 * estimated, and no reading of a document is trusted: a prompt whose content
 * will not parse is counted as unreadable and excluded from the checks that
 * would have to read it.
 *
 * Two definitions carry the whole module, and both are shown on the screen:
 *
 * - **Unreadable** means `parseDocument` rejects the stored content. That is the
 *   only definition of "invalid" this build has, and the dashboard uses the same
 *   function so the two surfaces cannot disagree.
 * - **Untouched for N days** means `updatedAt` is at least N days before the
 *   report's `now`. The buckets are cumulative: a prompt untouched for 95 days is
 *   dormant, stale, and worth attention.
 *
 * Archived prompts are counted in the totals and then left out of every
 * per-prompt list, because the archive is outside the working set (ADR-110).
 */

import { parseDocument } from '@/domain/serialization';
import type {
  ActivityEvent,
  Collection,
  Folder,
  HealthThresholds,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
} from '@/domain/types';
import { findSchemaProblems, type PromptSchemaProblem } from '@/domain/validation';
import { extractVariableReferences, reconcileVariables } from '@/domain/variables';

/* -------------------------------------------------------------------------- */
/* Thresholds                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The threshold shape is declared in `types.ts` so the settings record can hold
 * it; this module owns the defaults, the bounds, and the meaning.
 */
export type { HealthThresholds };

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  attentionDays: 30,
  staleDays: 60,
  dormantDays: 90,
};

/** Bounds for a threshold; outside this a day count stops meaning anything. */
export const HEALTH_THRESHOLD_RANGE = { min: 1, max: 3_650 } as const;

/** The choices the settings screen offers, in days. */
export const HEALTH_THRESHOLD_OPTIONS: Readonly<Record<keyof HealthThresholds, readonly number[]>> =
  {
    attentionDays: [14, 30, 45, 60],
    staleDays: [30, 60, 90, 120],
    dormantDays: [60, 90, 180, 365],
  };

const THRESHOLD_KEYS: readonly (keyof HealthThresholds)[] = [
  'attentionDays',
  'staleDays',
  'dormantDays',
];

function clampDays(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < HEALTH_THRESHOLD_RANGE.min) return fallback;
  if (rounded > HEALTH_THRESHOLD_RANGE.max) return HEALTH_THRESHOLD_RANGE.max;
  return rounded;
}

/**
 * Reads thresholds from anything, falling back per field.
 *
 * Settings stored by an older build have no thresholds at all, and a hand-edited
 * row can hold anything, so nothing is trusted and nothing throws.
 */
export function normalizeHealthThresholds(value: unknown): HealthThresholds {
  if (typeof value !== 'object' || value === null) return DEFAULT_HEALTH_THRESHOLDS;
  const source = value as Partial<Record<keyof HealthThresholds, unknown>>;

  const normalized: Record<string, number> = {};
  for (const key of THRESHOLD_KEYS) {
    normalized[key] = clampDays(source[key], DEFAULT_HEALTH_THRESHOLDS[key]);
  }

  return {
    attentionDays: normalized.attentionDays as number,
    staleDays: normalized.staleDays as number,
    dormantDays: normalized.dormantDays as number,
  };
}

/** `30 / 60 / 90 days` — the numbers the report used, in one string. */
export function describeHealthThresholds(thresholds: HealthThresholds): string {
  return `${thresholds.attentionDays} / ${thresholds.staleDays} / ${thresholds.dormantDays} days`;
}

/* -------------------------------------------------------------------------- */
/* Report shape                                                               */
/* -------------------------------------------------------------------------- */

/** One prompt named by a metric, with the specifics behind its count. */
export interface HealthPromptRef {
  readonly promptId: string;
  readonly title: string;
  readonly updatedAt: string;
  /** How many of the thing this list is about, e.g. three broken references. */
  readonly count: number;
  /** One line of specifics, e.g. `variables[2].name, variables[5].name`. */
  readonly detail: string;
  /** The names or paths behind the count, capped for display. */
  readonly names: readonly string[];
}

export interface HealthDistribution {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export interface HealthTotals {
  /** Every stored prompt, archived included. */
  readonly all: number;
  readonly active: number;
  readonly archived: number;
}

export interface HealthStaleBuckets {
  /** Untouched for at least `attentionDays`. */
  readonly attention: HealthPromptRef[];
  /** Untouched for at least `staleDays`. */
  readonly stale: HealthPromptRef[];
  /** Untouched for at least `dormantDays`. */
  readonly dormant: HealthPromptRef[];
}

export interface HealthRevisionStats {
  readonly total: number;
  readonly promptsWithHistory: number;
  readonly newestAt: string | null;
}

export interface HealthActivityStats {
  /** Events in the loaded log, which is capped at `ACTIVITY_LOG_LIMIT`. */
  readonly total: number;
  readonly newestAt: string | null;
}

export interface HealthReport {
  readonly totals: HealthTotals;
  /** Per-collection counts, largest first then by name. */
  readonly collections: HealthDistribution[];
  readonly withoutCollection: number;
  /** Per-folder counts, largest first then by name. */
  readonly folders: HealthDistribution[];
  readonly unfiled: number;
  /** Prompts whose stored document does not parse, by title. */
  readonly invalidDocuments: HealthPromptRef[];
  /** Prompts whose attached schema rejects the stored document, by title. */
  readonly schemaMismatches: HealthPromptRef[];
  /** Prompts with placeholders that were never declared, worst first. */
  readonly unresolvedVariables: HealthPromptRef[];
  /** Prompts with declarations the text never uses, worst first. */
  readonly unusedVariables: HealthPromptRef[];
  /** Prompts whose record description is empty, by title. */
  readonly missingDescriptions: HealthPromptRef[];
  readonly stale: HealthStaleBuckets;
  readonly revisions: HealthRevisionStats;
  readonly activity: HealthActivityStats;
  readonly oldestEdit: string | null;
  readonly newestEdit: string | null;
  readonly thresholds: HealthThresholds;
  /** The clock the report was computed against. */
  readonly computedAt: string;
}

export interface HealthInput {
  readonly prompts: readonly Prompt[];
  readonly collections: readonly Collection[];
  readonly folders: readonly Folder[];
  readonly revisions: readonly PromptRevision[];
  readonly schemas: readonly PromptSchema[];
  readonly activity: readonly ActivityEvent[];
  readonly thresholds?: HealthThresholds;
  readonly now: Date;
}

/** Keeps a names list from turning a row into a page. */
export const HEALTH_NAMES_LIMIT = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Unreadable documents                                                       */
/* -------------------------------------------------------------------------- */

/** A prompt whose stored content will not read back as a prompt document. */
export interface DocumentProblem {
  readonly promptId: string;
  readonly title: string;
  readonly path: string;
  readonly message: string;
  readonly updatedAt: string;
}

export interface StoredDocumentScan {
  /** Documents that parsed, keyed by prompt id. */
  readonly documents: ReadonlyMap<string, PromptDocument>;
  /** Documents that did not, sorted by title. */
  readonly problems: DocumentProblem[];
}

/**
 * Parses stored documents once and splits them into readable and unreadable.
 *
 * The single definition of "invalid document" in this build: the dashboard's
 * attention list and the health report both call `findDocumentProblems`, so
 * their counts cannot drift apart.
 */
export function scanStoredDocuments(prompts: readonly Prompt[]): StoredDocumentScan {
  const documents = new Map<string, PromptDocument>();
  const problems: DocumentProblem[] = [];

  for (const prompt of prompts) {
    // `content` is typed, but storage is untrusted input: a corrupt or
    // hand-edited row can hold anything, so it is parsed as unknown.
    const parsed = parseDocument(prompt.content as unknown);
    if (parsed.ok) {
      documents.set(prompt.id, parsed.value);
      continue;
    }

    const first = parsed.issues[0];
    problems.push({
      promptId: prompt.id,
      title: prompt.title,
      path: first && first.path.length > 0 ? first.path : '(document root)',
      message: first?.message ?? 'The stored document could not be read.',
      updatedAt: prompt.updatedAt,
    });
  }

  return {
    documents,
    problems: problems.sort((left, right) => left.title.localeCompare(right.title)),
  };
}

/** Prompts whose stored document will not parse, sorted by title. */
export function findDocumentProblems(prompts: readonly Prompt[]): DocumentProblem[] {
  return scanStoredDocuments(prompts).problems;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function byTitle(left: { title: string }, right: { title: string }): number {
  return left.title.localeCompare(right.title);
}

/** Worst first, then alphabetically, so the list is stable and useful. */
function byCountThenTitle(left: HealthPromptRef, right: HealthPromptRef): number {
  if (left.count !== right.count) return right.count - left.count;
  return left.title.localeCompare(right.title);
}

function cappedNames(names: readonly string[]): string[] {
  return names.slice(0, HEALTH_NAMES_LIMIT);
}

function joinNames(names: readonly string[]): string {
  const shown = cappedNames(names);
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
}

function latestTimestamp(values: readonly string[]): string | null {
  let newest: string | null = null;
  for (const value of values) {
    if (newest === null || value > newest) newest = value;
  }
  return newest;
}

function earliestTimestamp(values: readonly string[]): string | null {
  let oldest: string | null = null;
  for (const value of values) {
    if (oldest === null || value < oldest) oldest = value;
  }
  return oldest;
}

function daysSince(updatedAt: string, now: Date): number | null {
  const time = Date.parse(updatedAt);
  if (Number.isNaN(time)) return null;
  return (now.getTime() - time) / DAY_MS;
}

function distribution(
  entries: readonly { id: string; label: string; count: number }[],
): HealthDistribution[] {
  return [...entries]
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      return left.label.localeCompare(right.label);
    });
}

/* -------------------------------------------------------------------------- */
/* Report                                                                     */
/* -------------------------------------------------------------------------- */

/** Recomputes every health metric from stored records. Never mutates its input. */
export function computeHealth(input: HealthInput): HealthReport {
  const thresholds = normalizeHealthThresholds(input.thresholds ?? DEFAULT_HEALTH_THRESHOLDS);
  const now = input.now;

  const archived = input.prompts.filter((prompt) => prompt.archived);
  const active = input.prompts.filter((prompt) => !prompt.archived);

  /* --- distribution ------------------------------------------------------ */

  const collectionCounts = new Map<string, number>();
  let withoutCollection = 0;
  for (const prompt of active) {
    if (prompt.collectionIds.length === 0) withoutCollection += 1;
    for (const collectionId of new Set(prompt.collectionIds)) {
      collectionCounts.set(collectionId, (collectionCounts.get(collectionId) ?? 0) + 1);
    }
  }

  const folderCounts = new Map<string, number>();
  let unfiled = 0;
  for (const prompt of active) {
    if (prompt.folderId === null) unfiled += 1;
    else folderCounts.set(prompt.folderId, (folderCounts.get(prompt.folderId) ?? 0) + 1);
  }

  /* --- unreadable and schema-invalid ------------------------------------- */

  const scan = scanStoredDocuments(active);

  const schemaProblems: PromptSchemaProblem[] = findSchemaProblems(active, input.schemas);

  const invalidDocuments: HealthPromptRef[] = scan.problems.map((problem) => ({
    promptId: problem.promptId,
    title: problem.title,
    updatedAt: problem.updatedAt,
    count: 1,
    detail: `${problem.path} — ${problem.message}`,
    names: [problem.path],
  }));

  const schemaMismatches: HealthPromptRef[] = schemaProblems
    .map((problem) => ({
      promptId: problem.promptId,
      title: problem.title,
      updatedAt: active.find((prompt) => prompt.id === problem.promptId)?.updatedAt ?? '',
      count: problem.issues.length,
      detail: `${problem.schemaName}: ${problem.issues.length} ${
        problem.issues.length === 1 ? 'schema error' : 'schema errors'
      }, first at ${problem.issues[0]?.path ?? '$'}.`,
      names: cappedNames(problem.issues.map((issue) => issue.path)),
    }))
    .sort(byTitle);

  /* --- document checks --------------------------------------------------- */

  const unresolvedVariables: HealthPromptRef[] = [];
  const unusedVariables: HealthPromptRef[] = [];

  for (const prompt of active) {
    // A document that cannot be read has no reliable variables to talk about.
    const document = scan.documents.get(prompt.id);
    if (!document) continue;

    const references = extractVariableReferences(document);
    const reconciliation = reconcileVariables(document.variables, references.references);

    if (reconciliation.undeclared.length > 0) {
      const names = reconciliation.undeclared.map((entry) => entry.name);
      unresolvedVariables.push({
        promptId: prompt.id,
        title: prompt.title,
        updatedAt: prompt.updatedAt,
        count: names.length,
        detail: `Not declared: ${joinNames(names)}.`,
        names: cappedNames(names),
      });
    }

    if (reconciliation.unused.length > 0) {
      const names = reconciliation.unused.map((variable) => variable.name);
      unusedVariables.push({
        promptId: prompt.id,
        title: prompt.title,
        updatedAt: prompt.updatedAt,
        count: names.length,
        detail: `Never used: ${joinNames(names)}.`,
        names: cappedNames(names),
      });
    }
  }

  const missingDescriptions: HealthPromptRef[] = active
    .filter((prompt) => prompt.description.trim().length === 0)
    .map((prompt) => ({
      promptId: prompt.id,
      title: prompt.title,
      updatedAt: prompt.updatedAt,
      count: 1,
      detail: 'The description shown under the title is empty.',
      names: [],
    }))
    .sort(byTitle);

  /* --- staleness --------------------------------------------------------- */

  const staleRefs = (days: number): HealthPromptRef[] =>
    active
      .map((prompt) => ({ prompt, age: daysSince(prompt.updatedAt, now) }))
      .filter((entry): entry is { prompt: Prompt; age: number } => entry.age !== null)
      .filter((entry) => entry.age >= days)
      .sort((left, right) => {
        if (left.age !== right.age) return right.age - left.age;
        return left.prompt.title.localeCompare(right.prompt.title);
      })
      .map(({ prompt, age }) => ({
        promptId: prompt.id,
        title: prompt.title,
        updatedAt: prompt.updatedAt,
        count: Math.floor(age),
        detail: `Not edited for ${Math.floor(age)} ${Math.floor(age) === 1 ? 'day' : 'days'}.`,
        names: [],
      }));

  /* --- revisions and activity -------------------------------------------- */

  const promptsWithHistory = new Set(input.revisions.map((revision) => revision.promptId));

  /* --- totals and timestamps --------------------------------------------- */

  const updatedTimes = input.prompts.map((prompt) => prompt.updatedAt);

  return {
    totals: {
      all: input.prompts.length,
      active: active.length,
      archived: archived.length,
    },
    collections: distribution(
      input.collections.map((collection) => ({
        id: collection.id,
        label: collection.name,
        count: collectionCounts.get(collection.id) ?? 0,
      })),
    ),
    withoutCollection,
    folders: distribution(
      input.folders.map((folder) => ({
        id: folder.id,
        label: folder.name,
        count: folderCounts.get(folder.id) ?? 0,
      })),
    ),
    unfiled,
    invalidDocuments,
    schemaMismatches,
    unresolvedVariables: unresolvedVariables.sort(byCountThenTitle),
    unusedVariables: unusedVariables.sort(byCountThenTitle),
    missingDescriptions,
    stale: {
      attention: staleRefs(thresholds.attentionDays),
      stale: staleRefs(thresholds.staleDays),
      dormant: staleRefs(thresholds.dormantDays),
    },
    revisions: {
      total: input.revisions.length,
      promptsWithHistory: promptsWithHistory.size,
      newestAt: latestTimestamp(input.revisions.map((revision) => revision.createdAt)),
    },
    activity: {
      total: input.activity.length,
      newestAt: latestTimestamp(input.activity.map((event) => event.createdAt)),
    },
    oldestEdit: earliestTimestamp(updatedTimes),
    newestEdit: latestTimestamp(updatedTimes),
    thresholds,
    computedAt: now.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Presentation helpers                                                       */
/* -------------------------------------------------------------------------- */

/** `3 prompts` / `1 prompt` / `No prompts`, for metric cards. */
export function describeCount(count: number, singular: string, plural = `${singular}s`): string {
  if (count === 0) return `No ${plural}`;
  return `${count} ${count === 1 ? singular : plural}`;
}

export interface HealthSummaryLine {
  readonly tone: 'ok' | 'attention';
  readonly text: string;
}

/**
 * One sentence describing the library, written from the same numbers the cards
 * render so it cannot disagree with them.
 */
export function describeHealth(report: HealthReport): HealthSummaryLine {
  if (report.totals.all === 0) {
    return {
      tone: 'ok',
      text: 'This library holds no prompts yet, so there is nothing to report.',
    };
  }

  const broken = report.invalidDocuments.length;
  const stale = report.stale.attention.length;

  if (broken > 0) {
    return {
      tone: 'attention',
      text: `${describeCount(broken, 'stored document')} will not parse. Everything else here describes the documents that do.`,
    };
  }

  if (stale > 0) {
    return {
      tone: 'attention',
      text: `${describeCount(stale, 'active prompt')} ${stale === 1 ? 'has' : 'have'} not been edited for ${report.thresholds.attentionDays} days.`,
    };
  }

  return {
    tone: 'ok',
    text: `Every stored document parses, and nothing active has been idle for ${report.thresholds.attentionDays} days.`,
  };
}

/**
 * Storage usage, when the browser reports it.
 *
 * `navigator.storage.estimate` is behind a secure-context API that is absent in
 * some browsers and refused in others, so the outcome is a value, not an
 * exception — the screen must be able to say "this browser does not report it".
 */
export type StorageEstimate =
  | { readonly available: true; readonly usage: number; readonly quota: number }
  | { readonly available: false; readonly reason: string };

export function describeStorage(estimate: StorageEstimate): string {
  if (!estimate.available) return estimate.reason;
  if (estimate.quota <= 0) return 'This browser reports no quota for this origin.';

  const used = formatBytes(estimate.usage);
  const total = formatBytes(estimate.quota);
  const share = Math.min(100, Math.round((estimate.usage / estimate.quota) * 100));
  return `${used} of ${total} used (${share}%). The figure covers this whole origin, not just PromptForge.`;
}

/** `1.4 MB`, `812 kB`, `0 B`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1_000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
