/**
 * Structural quality review (TASK-024).
 *
 * The inspector answers one question: "does this document look unfinished or
 * inconsistent?" It does not answer "is this a good prompt", and it never edits
 * anything. Every finding comes from a rule that is written down here, listed in
 * `QUALITY_RULES`, and documented in `docs/QUALITY-RULES.md`.
 *
 * Two classifications, and the difference is the point:
 *
 * - **deterministic** — a fact about the document. A placeholder with no
 *   declaration, a list entry that appears twice, a snippet id that no longer
 *   exists. If the rule fires, the described problem is really there.
 * - **heuristic** — a rule of thumb about prompt writing. A missing role, no
 *   worked example, a field past a length threshold. It can be wrong, and it is
 *   always dismissible.
 *
 * Rules only fire when their input exists. A rule that needs the snippet
 * library says so (`skipped`) instead of guessing that a snippet is missing, and
 * a rule that needs the prompt record says so instead of assuming a description
 * is empty. Nothing is invented.
 *
 * This module is pure: no React, no storage, no clock. Callers pass the
 * documents and the timestamp.
 */

import { scanJson } from '@/domain/jsonText';
import { documentToJson } from '@/domain/serialization';
import type { IsoTimestamp, JsonValue, PromptDocument } from '@/domain/types';
import { extractVariableReferences, reconcileVariables } from '@/domain/variables';

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

export type QualitySeverity = 'error' | 'warning' | 'info';
export type QualityClassification = 'deterministic' | 'heuristic';

export type QualityRuleId =
  | 'name-missing'
  | 'objective-missing'
  | 'instructions-empty'
  | 'description-missing'
  | 'undefined-variable'
  | 'unused-variable'
  | 'duplicate-instruction'
  | 'duplicate-json-key'
  | 'unexpected-property'
  | 'output-example-mismatch'
  | 'missing-snippet'
  | 'missing-schema-reference'
  | 'role-missing'
  | 'examples-missing'
  | 'oversized-content';

export const QUALITY_SEVERITIES: readonly QualitySeverity[] = ['error', 'warning', 'info'];

export const QUALITY_SEVERITY_LABELS: Readonly<Record<QualitySeverity, string>> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Suggestion',
};

export const QUALITY_CLASSIFICATION_LABELS: Readonly<Record<QualityClassification, string>> = {
  deterministic: 'Deterministic',
  heuristic: 'Heuristic',
};

/** What each classification promises, in the words the banner uses. */
export const QUALITY_CLASSIFICATION_NOTES: Readonly<Record<QualityClassification, string>> = {
  deterministic:
    'A fact about the document: if the rule fired, the problem it names is really there.',
  heuristic: 'A rule of thumb about prompt writing. It can be wrong, and it is always your call.',
};

export const QUALITY_LIMITS = {
  /** Findings kept per rule; the rest are counted in `dropped`. */
  maxFindingsPerRule: 20,
  /** Characters of evidence copied into a finding. */
  evidenceChars: 160,
  /** Characters allowed in a dismissal reason. */
  reasonChars: 300,
  /** Characters a dismissal reason needs before it is useful. */
  minReasonChars: 3,
  /** Dismissals kept per prompt; past this the oldest is dropped by the caller. */
  maxDismissals: 200,
} as const;

/**
 * Length thresholds used by the `oversized-content` rule.
 *
 * These are heuristic judgements, not limits: nothing is truncated or refused.
 * They are exported so the screen can state them (the UI must never apply a
 * threshold it does not show).
 */
export const QUALITY_THRESHOLDS = {
  objective: 800,
  instruction: 400,
  contextDescription: 1_000,
  notes: 800,
  document: 8_000,
} as const;

/** Context a rule can need beyond the document itself. */
export type QualityInputNeed = 'record' | 'snippets' | 'schemas' | 'rawText';

export interface QualityRuleDefinition {
  readonly id: QualityRuleId;
  readonly title: string;
  readonly severity: QualitySeverity;
  readonly classification: QualityClassification;
  /** What the rule looks at. */
  readonly checks: string;
  /** Why the thing it finds matters. */
  readonly why: string;
  /** How it can be wrong, or when it cannot run. */
  readonly caveat: string;
  /** Inputs beyond the document that the rule needs to run at all. */
  readonly needs: readonly QualityInputNeed[];
}

export const QUALITY_RULES: readonly QualityRuleDefinition[] = [
  {
    id: 'name-missing',
    title: 'The document has no name',
    severity: 'error',
    classification: 'deterministic',
    checks: '`name` is empty after trimming.',
    why: 'The name is the heading a reader sees first, and the playground and history screens use it.',
    caveat:
      'The document parser refuses an empty name, so this can only fire on a corrupt row or a document built in code.',
    needs: [],
  },
  {
    id: 'objective-missing',
    title: 'No objective is stated',
    severity: 'error',
    classification: 'deterministic',
    checks: '`objective` is empty after trimming.',
    why: 'Without a stated task, the rest of the document has nothing to be consistent with.',
    caveat: 'An objective can be implied by the instructions; the rule cannot tell.',
    needs: [],
  },
  {
    id: 'instructions-empty',
    title: 'There are no instructions',
    severity: 'error',
    classification: 'deterministic',
    checks: '`instructions` is an empty list.',
    why: 'Instructions are the part of the document that actually asks for work.',
    caveat: 'A prompt built only from snippets or context is unusual but not impossible.',
    needs: [],
  },
  {
    id: 'description-missing',
    title: 'The prompt has no description',
    severity: 'warning',
    classification: 'deterministic',
    checks: 'The prompt record’s `description` is empty.',
    why: 'The library shows the description under the title, which is how a reader picks a prompt.',
    caveat:
      'The description lives on the prompt record, not in the document, so this only runs when one is supplied.',
    needs: ['record'],
  },
  {
    id: 'undefined-variable',
    title: 'A placeholder was never declared',
    severity: 'error',
    classification: 'deterministic',
    checks: 'A `{{name}}` token in the document whose name is not in `variables`.',
    why: 'Nothing can fill it in, so the rendered prompt keeps the braces instead of a value.',
    caveat: 'The token is a plain substitution; there are no expressions or helpers to misread.',
    needs: [],
  },
  {
    id: 'unused-variable',
    title: 'A declared variable is never used',
    severity: 'warning',
    classification: 'deterministic',
    checks: 'A `variables` entry whose name appears in no string in the document.',
    why: 'It asks a reader of the playground for a value that changes nothing in the text.',
    caveat: 'The scan covers every string in the document, including examples and metadata.',
    needs: [],
  },
  {
    id: 'duplicate-instruction',
    title: 'Two instructions say the same thing',
    severity: 'warning',
    classification: 'deterministic',
    checks: 'Two `instructions` entries that are equal after trimming and ignoring case.',
    why: 'Repeated instructions consume attention and make it unclear whether they differ.',
    caveat: 'Only exact matches after case folding; the parser already removes identical strings.',
    needs: [],
  },
  {
    id: 'duplicate-json-key',
    title: 'A JSON object repeats a key',
    severity: 'warning',
    classification: 'deterministic',
    checks: 'The raw draft text holds the same key twice in one object.',
    why: 'Reading the document keeps the last value, so the earlier one is silently discarded.',
    caveat:
      'Only the editor has the raw text; the rule is skipped when a caller supplies a document alone.',
    needs: ['rawText'],
  },
  {
    id: 'unexpected-property',
    title: 'This document carries a field the app does not read',
    severity: 'info',
    classification: 'deterministic',
    checks: 'A top-level key that is not one of the canonical document fields.',
    why: 'The value round-trips on save but no screen reads it, so it is invisible work.',
    caveat: 'It may be there on purpose for another tool that consumes the same JSON.',
    needs: [],
  },
  {
    id: 'output-example-mismatch',
    title: 'The output example contradicts the output format',
    severity: 'warning',
    classification: 'deterministic',
    checks:
      '`output.format` is `json` but the example is a string, or the format is `text`/`markdown` but the example is an object or array.',
    why: 'An example is read as a model of the answer, so the wrong shape teaches the wrong shape.',
    caveat: 'The rule compares JSON types only; it says nothing about the content of the example.',
    needs: [],
  },
  {
    id: 'missing-snippet',
    title: 'An included snippet no longer exists',
    severity: 'error',
    classification: 'deterministic',
    checks: '`includes` names a snippet id that the snippet library does not hold.',
    why: 'The document claims a fragment is part of it, but there is nothing left to merge.',
    caveat: 'Only runs when the snippet library is supplied; otherwise the rule is skipped.',
    needs: ['snippets'],
  },
  {
    id: 'missing-schema-reference',
    title: 'The output names a schema that is not stored',
    severity: 'error',
    classification: 'deterministic',
    checks: '`output.schemaRef` names a schema id that the schema library does not hold.',
    why: 'Validation has nothing to check the output against, so the reference is a dead link.',
    caveat: 'Only runs when the stored schema ids are supplied; otherwise the rule is skipped.',
    needs: ['schemas'],
  },
  {
    id: 'role-missing',
    title: 'No role is given',
    severity: 'info',
    classification: 'heuristic',
    checks: '`role` is empty after trimming.',
    why: 'Naming who the prompt speaks as is a cheap way to steady its voice.',
    caveat: 'Plenty of good prompts have no role; the rule is a suggestion, not a fault.',
    needs: [],
  },
  {
    id: 'examples-missing',
    title: 'There is no worked example',
    severity: 'info',
    classification: 'heuristic',
    checks: '`examples` is an empty list.',
    why: 'One input and output pair often communicates a format faster than a description does.',
    caveat: 'Short prompts rarely need one, and an example can anchor a reader to a single shape.',
    needs: [],
  },
  {
    id: 'oversized-content',
    title: 'A field is longer than the threshold',
    severity: 'warning',
    classification: 'heuristic',
    checks: `A field is past its stated threshold (objective ${QUALITY_THRESHOLDS.objective}, each instruction ${QUALITY_THRESHOLDS.instruction}, context description ${QUALITY_THRESHOLDS.contextDescription}, notes ${QUALITY_THRESHOLDS.notes}, whole document ${QUALITY_THRESHOLDS.document} characters).`,
    why: 'Long single fields are hard to scan and usually hold several ideas that belong apart.',
    caveat:
      'The thresholds are stated, not enforced, and a deliberately long spec can be right; nothing is truncated.',
    needs: [],
  },
];

const RULES_BY_ID = new Map(QUALITY_RULES.map((rule) => [rule.id, rule]));

export function describeQualityRule(id: QualityRuleId): string {
  return RULES_BY_ID.get(id)?.title ?? id;
}

/* -------------------------------------------------------------------------- */
/* Findings                                                                   */
/* -------------------------------------------------------------------------- */

export interface QualityFinding {
  /** Stable identity of this finding for the current document. */
  readonly id: string;
  readonly ruleId: QualityRuleId;
  readonly severity: QualitySeverity;
  readonly classification: QualityClassification;
  /** Document path, e.g. `instructions[2]`, `output.example`, or `name`. */
  readonly path: string;
  /** False when the path names a field outside the document (the record). */
  readonly inDocument: boolean;
  readonly title: string;
  /** Why the rule fired — the explanation the disclosure reveals. */
  readonly explanation: string;
  /** What the reader could do about it. Never applied automatically. */
  readonly suggestion: string;
  /** Excerpt of the offending value, clipped to `QUALITY_LIMITS.evidenceChars`. */
  readonly evidence: string;
  /** Content hash of rule + path + evidence; a dismissal is tied to it. */
  readonly fingerprint: string;
}

export interface QualityRuleSkip {
  readonly ruleId: QualityRuleId;
  readonly reason: string;
}

export interface QualityCounts {
  readonly total: number;
  readonly errors: number;
  readonly warnings: number;
  readonly suggestions: number;
  readonly deterministic: number;
  readonly heuristic: number;
}

export interface QualityReport {
  readonly findings: readonly QualityFinding[];
  readonly counts: QualityCounts;
  /** Rules that produced at least one finding or were checked and found nothing. */
  readonly ran: readonly QualityRuleId[];
  /** Rules that could not run, with the missing input. */
  readonly skipped: readonly QualityRuleSkip[];
  /** Findings past the per-rule cap, counted rather than silently dropped. */
  readonly dropped: number;
  readonly thresholds: typeof QUALITY_THRESHOLDS;
}

export interface QualityInput {
  readonly document: PromptDocument;
  /** The prompt record, when the caller has one (the editor and the dashboard do). */
  readonly record?: { readonly description: string } | null;
  /** Snippet ids in the library; when omitted, `missing-snippet` is skipped. */
  readonly snippetIds?: readonly string[] | null;
  /** Stored schema ids; when omitted, `missing-schema-reference` is skipped. */
  readonly schemaIds?: readonly string[] | null;
  /** Raw draft text; when omitted, `duplicate-json-key` is skipped. */
  readonly rawText?: string | null;
}

/**
 * FNV-1a over the finding's identity.
 *
 * A dismissal is remembered by this hash, so the dismissal survives a rename but
 * not an edit to the text it was made about — which is exactly the behaviour the
 * screen promises.
 */
export function qualityFingerprint(ruleId: string, path: string, evidence: string): string {
  const source = `${ruleId}\u0000${path}\u0000${evidence}`;
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

/** A one-line excerpt of a JSON value, clipped and marked when clipped. */
export function qualityEvidence(value: JsonValue | string): string {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? 'null');
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= QUALITY_LIMITS.evidenceChars) return collapsed;

  return `${collapsed.slice(0, QUALITY_LIMITS.evidenceChars - 1).trimEnd()}…`;
}

export function countQuality(findings: readonly QualityFinding[]): QualityCounts {
  let errors = 0;
  let warnings = 0;
  let suggestions = 0;
  let deterministic = 0;
  let heuristic = 0;

  for (const finding of findings) {
    if (finding.severity === 'error') errors += 1;
    else if (finding.severity === 'warning') warnings += 1;
    else suggestions += 1;

    if (finding.classification === 'deterministic') deterministic += 1;
    else heuristic += 1;
  }

  return {
    total: findings.length,
    errors,
    warnings,
    suggestions,
    deterministic,
    heuristic,
  };
}

/** `3 findings: 1 error, 2 warnings` — used by the chip and the results header. */
export function summarizeQuality(findings: readonly QualityFinding[]): string {
  const counts = countQuality(findings);
  if (counts.total === 0) return 'No structural findings';

  const parts: string[] = [];
  if (counts.errors > 0) parts.push(`${counts.errors} ${counts.errors === 1 ? 'error' : 'errors'}`);
  if (counts.warnings > 0) {
    parts.push(`${counts.warnings} ${counts.warnings === 1 ? 'warning' : 'warnings'}`);
  }
  if (counts.suggestions > 0) {
    parts.push(`${counts.suggestions} ${counts.suggestions === 1 ? 'suggestion' : 'suggestions'}`);
  }

  return `${counts.total} ${counts.total === 1 ? 'finding' : 'findings'}: ${parts.join(', ')}`;
}

/** The copyable text of one finding; the screen copies exactly this. */
export function findingToText(finding: QualityFinding): string {
  return [
    `${QUALITY_SEVERITY_LABELS[finding.severity]} · ${finding.title}`,
    `Rule: ${finding.ruleId} (${finding.classification})`,
    `Path: ${finding.path}`,
    `Why: ${finding.explanation}`,
    `Suggestion: ${finding.suggestion}`,
    finding.evidence ? `Evidence: ${finding.evidence}` : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* Rule implementations                                                       */
/* -------------------------------------------------------------------------- */

interface FindingDraft {
  readonly ruleId: QualityRuleId;
  readonly path: string;
  readonly inDocument?: boolean;
  readonly title: string;
  readonly explanation: string;
  readonly suggestion: string;
  /** Clipped excerpt shown and copied. */
  readonly evidence: string;
  /**
   * Full value the dismissal is tied to.
   *
   * Defaults to the evidence, but a finding whose evidence is clipped (a long
   * field, a whole document) passes the complete text, so an edit anywhere in it
   * produces a new fingerprint and the finding comes back.
   */
  readonly source?: string;
}

function nonEmpty(value: string | undefined): boolean {
  return (value ?? '').trim().length > 0;
}

function lengthOf(value: string): number {
  return value.trim().length;
}

function characters(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'character' : 'characters'}`;
}

/** Keys repeated inside one JSON object of the raw text. */
export function findDuplicateJsonKeys(text: string): { path: string; key: string }[] {
  const scan = new DuplicateKeyScan(text);
  return scan.run();
}

class DuplicateKeyScan {
  private index = 0;
  private readonly duplicates: { path: string; key: string }[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly text: string) {}

  run(): { path: string; key: string }[] {
    this.skipSpace();
    if (this.index < this.text.length) this.scanValue('');
    return this.duplicates;
  }

  private peek(): string {
    return this.text[this.index] ?? '';
  }

  private skipSpace(): void {
    while (this.index < this.text.length && ' \t\n\r'.includes(this.text[this.index] as string)) {
      this.index += 1;
    }
  }

  private scanValue(path: string): void {
    this.skipSpace();
    const character = this.peek();

    if (character === '{') this.scanObject(path);
    else if (character === '[') this.scanArray(path);
    else if (character === '"') this.scanString();
    else this.scanLiteral();
  }

  private scanObject(path: string): void {
    this.index += 1;
    const keys = new Set<string>();
    this.skipSpace();
    if (this.peek() === '}') {
      this.index += 1;
      return;
    }

    for (;;) {
      this.skipSpace();
      if (this.peek() !== '"') return;
      const key = this.scanString();
      const keyPath = path.length === 0 ? key : `${path}.${key}`;

      if (keys.has(key)) {
        const identity = `${keyPath}\u0000${key}`;
        if (!this.seen.has(identity)) {
          this.seen.add(identity);
          this.duplicates.push({ path: keyPath, key });
        }
      }
      keys.add(key);

      this.skipSpace();
      if (this.peek() === ':') this.index += 1;
      this.scanValue(keyPath);

      this.skipSpace();
      const next = this.peek();
      this.index += 1;
      if (next === '}') return;
      if (next !== ',') return;
    }
  }

  private scanArray(path: string): void {
    this.index += 1;
    let item = 0;
    this.skipSpace();
    if (this.peek() === ']') {
      this.index += 1;
      return;
    }

    for (;;) {
      this.scanValue(`${path}[${item}]`);
      item += 1;
      this.skipSpace();
      const next = this.peek();
      this.index += 1;
      if (next === ']') return;
      if (next !== ',') return;
    }
  }

  /** Reads a quoted string and returns its unescaped value. */
  private scanString(): string {
    this.index += 1;
    let value = '';

    while (this.index < this.text.length) {
      const character = this.text[this.index] as string;
      this.index += 1;

      if (character === '"') return value;
      if (character !== '\\') {
        value += character;
        continue;
      }

      const escaped = this.text[this.index] ?? '';
      this.index += 1;
      if (escaped === 'u') {
        const hex = this.text.slice(this.index, this.index + 4);
        this.index += 4;
        const code = Number.parseInt(hex, 16);
        value += Number.isNaN(code) ? '' : String.fromCharCode(code);
      } else {
        value += escaped;
      }
    }

    return value;
  }

  private scanLiteral(): void {
    while (this.index < this.text.length && !',}] \t\n\r'.includes(this.peek())) {
      this.index += 1;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Inspection                                                                 */
/* -------------------------------------------------------------------------- */

interface Collector {
  push: (draft: FindingDraft) => void;
}

function createCollector(): {
  collector: Collector;
  findings: QualityFinding[];
  dropped: () => number;
} {
  const findings: QualityFinding[] = [];
  const fingerprints = new Set<string>();
  const perRule = new Map<QualityRuleId, number>();
  let dropped = 0;

  const collector: Collector = {
    push: (draft) => {
      // Defensive: every draft names a rule in `QualityRuleId`, so this only
      // guards against a future edit that renames one without its call sites.
      const rule = RULES_BY_ID.get(draft.ruleId);
      if (!rule) return;

      const used = perRule.get(draft.ruleId) ?? 0;
      if (used >= QUALITY_LIMITS.maxFindingsPerRule) {
        dropped += 1;
        return;
      }

      const fingerprint = qualityFingerprint(
        draft.ruleId,
        draft.path,
        draft.source ?? draft.evidence,
      );
      if (fingerprints.has(fingerprint)) return;

      fingerprints.add(fingerprint);
      perRule.set(draft.ruleId, used + 1);
      findings.push({
        id: fingerprint,
        ruleId: draft.ruleId,
        severity: rule.severity,
        classification: rule.classification,
        path: draft.path,
        inDocument: draft.inDocument ?? true,
        title: draft.title,
        explanation: draft.explanation,
        suggestion: draft.suggestion,
        evidence: draft.evidence,
        fingerprint,
      });
    },
  };

  return { collector, findings, dropped: () => dropped };
}

const SEVERITY_RANK: Readonly<Record<QualitySeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

/** Checks a document against every rule and returns the findings, sorted. */
export function inspectQuality(input: QualityInput): QualityReport {
  const { document } = input;
  const { collector, findings, dropped } = createCollector();
  const skipped: QualityRuleSkip[] = [];

  const record = input.record ?? null;
  const snippetIds = input.snippetIds ?? null;
  const schemaIds = input.schemaIds ?? null;
  const rawText = input.rawText ?? null;

  /* --- identity ---------------------------------------------------------- */

  if (!nonEmpty(document.name)) {
    collector.push({
      ruleId: 'name-missing',
      path: 'name',
      title: describeQualityRule('name-missing'),
      explanation:
        'The document’s name is blank, so screens that label it have nothing to show. The parser normally refuses this, which is why it is rare.',
      suggestion: 'Give the document a short name, for example “Support triage”.',
      evidence: '',
    });
  }

  if (!nonEmpty(document.objective)) {
    collector.push({
      ruleId: 'objective-missing',
      path: 'objective',
      title: describeQualityRule('objective-missing'),
      explanation:
        'The objective is what the prompt is for. With it empty, a reader has to infer the task from the instructions.',
      suggestion:
        'Write one sentence in `objective` that names the task, for example “Classify each support ticket”.',
      evidence: '',
    });
  }

  if (document.instructions.length === 0) {
    collector.push({
      ruleId: 'instructions-empty',
      path: 'instructions',
      title: describeQualityRule('instructions-empty'),
      explanation:
        'The instructions list is empty, so nothing in the document asks the reader to do anything.',
      suggestion: 'Add the steps the prompt should follow to `instructions`, one step per entry.',
      evidence: '',
    });
  }

  if (record === null) {
    skipped.push({
      ruleId: 'description-missing',
      reason: 'The prompt record was not supplied, so the description was not read.',
    });
  } else if (!nonEmpty(record.description)) {
    collector.push({
      ruleId: 'description-missing',
      path: 'description',
      inDocument: false,
      title: describeQualityRule('description-missing'),
      explanation:
        'This prompt’s description is empty. The library shows it under the title, and it is how somebody chooses between similar prompts.',
      suggestion:
        'Describe what the prompt does in a sentence, in the prompt’s details on the library screen.',
      evidence: '',
    });
  }

  /* --- variables --------------------------------------------------------- */

  const scan = extractVariableReferences(document);
  const reconciliation = reconcileVariables(document.variables, scan.references);

  for (const undeclared of reconciliation.undeclared) {
    collector.push({
      ruleId: 'undefined-variable',
      path: undeclared.paths[0] ?? 'objective',
      title: `“${undeclared.name}” is used but never declared`,
      explanation: `{{${undeclared.name}}} appears in ${undeclared.paths.join(', ')}, but no variable in \`variables\` has that name. Nothing can fill it in, so the rendered prompt keeps the braces.`,
      suggestion: `Add a variable named “${undeclared.name}” to \`variables\`, or replace the placeholder with a fixed value.`,
      evidence: qualityEvidence(`{{${undeclared.name}}}`),
    });
  }

  document.variables.forEach((variable, index) => {
    const used = reconciliation.used.some((entry) => entry.name === variable.name);
    if (used) return;

    collector.push({
      ruleId: 'unused-variable',
      path: `variables[${index}].name`,
      title: `“${variable.name}” is declared but never used`,
      explanation: `The document declares “${variable.name}”, but no string in it contains {{${variable.name}}}. The playground therefore asks for a value that changes nothing.`,
      suggestion: `Use {{${variable.name}}} somewhere in the document, or remove the declaration.`,
      evidence: qualityEvidence(variable.name),
    });
  });

  /* --- lists ------------------------------------------------------------- */

  const seenInstructions = new Map<string, number>();
  document.instructions.forEach((instruction, index) => {
    const key = instruction.trim().toLowerCase().replace(/\s+/g, ' ');
    const first = seenInstructions.get(key);
    if (first === undefined) {
      seenInstructions.set(key, index);
      return;
    }

    collector.push({
      ruleId: 'duplicate-instruction',
      path: `instructions[${index}]`,
      title: 'This instruction repeats an earlier one',
      explanation: `It matches \`instructions[${first}]\` when case and spacing are ignored. The document parser only removes exact duplicates, so both entries are stored.`,
      suggestion: 'Keep one of the two, or rewrite this one to say something different.',
      evidence: qualityEvidence(instruction),
      source: instruction,
    });
  });

  /* --- raw text ---------------------------------------------------------- */

  if (rawText === null) {
    skipped.push({
      ruleId: 'duplicate-json-key',
      reason: 'The raw draft text was not supplied, so repeated keys could not be seen.',
    });
  } else if (scanJson(rawText).ok) {
    // Only meaningful on text that parses; a syntax error is a different problem
    // with its own screen, and guessing at half-written JSON would be noise.
    for (const duplicate of findDuplicateJsonKeys(rawText)) {
      collector.push({
        ruleId: 'duplicate-json-key',
        path: duplicate.path,
        title: `“${duplicate.key}” appears twice in one object`,
        explanation: `The object at \`${duplicate.path}\` repeats the key “${duplicate.key}”. Reading JSON keeps the last value, so the earlier one is silently discarded — and an editor that shows the raw text shows both.`,
        suggestion: 'Delete the duplicate key and keep the value that should win.',
        evidence: qualityEvidence(duplicate.key),
      });
    }
  }

  /* --- extras ------------------------------------------------------------ */

  for (const key of Object.keys(document.extras ?? {}).sort((left, right) =>
    left.localeCompare(right),
  )) {
    collector.push({
      ruleId: 'unexpected-property',
      path: key,
      title: `“${key}” is stored but never read`,
      explanation: `\`${key}\` is not one of the document’s fields, so it is kept in \`extras\` and round-trips untouched, but no screen displays or uses it.`,
      suggestion:
        'Keep it if another tool reads this JSON; otherwise remove it so the document says only what it means.',
      evidence: qualityEvidence(document.extras?.[key] ?? null),
    });
  }

  /* --- output ------------------------------------------------------------ */

  const example = document.output.example;
  if (example !== undefined) {
    const exampleIsString = typeof example === 'string';
    const exampleIsContainer =
      Array.isArray(example) || (example !== null && typeof example === 'object');
    const contradicts =
      (document.output.format === 'json' && exampleIsString) ||
      (document.output.format !== 'json' && exampleIsContainer);

    if (contradicts) {
      collector.push({
        ruleId: 'output-example-mismatch',
        path: 'output.example',
        title: 'The example does not look like the declared format',
        explanation: `\`output.format\` is “${document.output.format}”, but the example is ${describeJsonShape(example)}. An example is read as a model of the answer.`,
        suggestion:
          document.output.format === 'json'
            ? 'Give the example as a JSON object or array, or change the format to `text`/`markdown`.'
            : 'Write the example as text, or change the format to `json` if the answer is structured.',
        evidence: qualityEvidence(example),
      });
    }
  }

  if (schemaIds === null) {
    skipped.push({
      ruleId: 'missing-schema-reference',
      reason: 'Stored schema ids were not supplied, so a schema reference could not be checked.',
    });
  } else if (document.output.schemaRef !== undefined) {
    const reference = document.output.schemaRef;
    if (!schemaIds.includes(reference)) {
      collector.push({
        ruleId: 'missing-schema-reference',
        path: 'output.schemaRef',
        title: 'The output names a schema that is not stored',
        explanation: `\`output.schemaRef\` is “${reference}”, but no stored schema has that id, so validation has nothing to check the output against.`,
        suggestion:
          'Attach the intended schema on the validation screen, or clear the reference from `output.schemaRef`.',
        evidence: qualityEvidence(reference),
      });
    }
  }

  /* --- snippets ---------------------------------------------------------- */

  if (snippetIds === null) {
    skipped.push({
      ruleId: 'missing-snippet',
      reason: 'The snippet library was not supplied, so included snippets were not checked.',
    });
  } else {
    for (const id of document.includes) {
      if (snippetIds.includes(id)) continue;

      collector.push({
        ruleId: 'missing-snippet',
        path: 'includes',
        title: 'An included snippet no longer exists',
        explanation: `\`includes\` names “${id}”, but the snippet library has no such record. The document claims a fragment is part of it, and there is nothing left to merge.`,
        suggestion: 'Remove the id from `includes`, or recreate the snippet from the composer.',
        evidence: qualityEvidence(id),
      });
    }
  }

  /* --- heuristics -------------------------------------------------------- */

  if (!nonEmpty(document.role)) {
    collector.push({
      ruleId: 'role-missing',
      path: 'role',
      title: describeQualityRule('role-missing'),
      explanation:
        'The role field is empty. Naming who the prompt speaks as is a cheap way to steady its voice — though many prompts work without one.',
      suggestion: 'Add a role such as “Support triage assistant” if the voice matters here.',
      evidence: '',
    });
  }

  if (document.examples.length === 0) {
    collector.push({
      ruleId: 'examples-missing',
      path: 'examples',
      title: describeQualityRule('examples-missing'),
      explanation:
        'No worked example is stored. One input/output pair often communicates an output shape faster than describing it.',
      suggestion: 'Add an example with an input and the output you expect, if the shape is subtle.',
      evidence: '',
    });
  }

  const oversized: {
    path: string;
    label: string;
    size: number;
    limit: number;
    evidence: string;
    /** Full text the threshold was measured on; ties a dismissal to the content. */
    source: string;
  }[] = [];

  if (lengthOf(document.objective) > QUALITY_THRESHOLDS.objective) {
    oversized.push({
      path: 'objective',
      label: 'The objective',
      size: lengthOf(document.objective),
      limit: QUALITY_THRESHOLDS.objective,
      evidence: qualityEvidence(document.objective),
      source: document.objective,
    });
  }
  document.instructions.forEach((instruction, index) => {
    if (lengthOf(instruction) > QUALITY_THRESHOLDS.instruction) {
      oversized.push({
        path: `instructions[${index}]`,
        label: `Instruction ${index + 1}`,
        size: lengthOf(instruction),
        limit: QUALITY_THRESHOLDS.instruction,
        evidence: qualityEvidence(instruction),
        source: instruction,
      });
    }
  });
  if (lengthOf(document.context.description ?? '') > QUALITY_THRESHOLDS.contextDescription) {
    oversized.push({
      path: 'context.description',
      label: 'The context description',
      size: lengthOf(document.context.description ?? ''),
      limit: QUALITY_THRESHOLDS.contextDescription,
      evidence: qualityEvidence(document.context.description ?? ''),
      source: document.context.description ?? '',
    });
  }
  if (lengthOf(document.metadata.notes ?? '') > QUALITY_THRESHOLDS.notes) {
    oversized.push({
      path: 'metadata.notes',
      label: 'The notes',
      size: lengthOf(document.metadata.notes ?? ''),
      limit: QUALITY_THRESHOLDS.notes,
      evidence: qualityEvidence(document.metadata.notes ?? ''),
      source: document.metadata.notes ?? '',
    });
  }

  // The whole-document measure is the serialized length, which is what storage
  // measures; the evidence is the size itself, not 8,000 characters of text.
  const documentSize = JSON.stringify(documentToJson(document)).length;
  if (documentSize > QUALITY_THRESHOLDS.document) {
    oversized.push({
      path: '',
      label: 'The whole document',
      size: documentSize,
      limit: QUALITY_THRESHOLDS.document,
      evidence: qualityEvidence(`${characters(documentSize)} of JSON`),
      source: String(documentSize),
    });
  }

  for (const item of oversized) {
    collector.push({
      ruleId: 'oversized-content',
      path: item.path,
      title: `${item.label} is past ${characters(item.limit)}`,
      explanation: `${item.label} holds ${characters(item.size)}, past the ${characters(item.limit)} threshold this rule uses. Long single fields are hard to scan and usually hold several ideas.`,
      suggestion:
        'Split it into separate instructions, or move background material into `context`. The threshold is a suggestion, not a limit.',
      evidence: item.evidence,
      source: item.source,
    });
  }

  findings.sort(
    (left, right) =>
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
      left.ruleId.localeCompare(right.ruleId) ||
      left.path.localeCompare(right.path) ||
      left.fingerprint.localeCompare(right.fingerprint),
  );

  const skippedIds = new Set(skipped.map((skip) => skip.ruleId));

  return {
    findings,
    counts: countQuality(findings),
    ran: QUALITY_RULES.filter((rule) => !skippedIds.has(rule.id)).map((rule) => rule.id),
    skipped,
    dropped: dropped(),
    thresholds: QUALITY_THRESHOLDS,
  };
}

function describeJsonShape(value: JsonValue): string {
  if (typeof value === 'string') return 'a string';
  if (Array.isArray(value)) return 'an array';
  if (value === null) return 'null';
  if (typeof value === 'object') return 'an object';
  if (typeof value === 'number') return 'a number';
  return 'a boolean';
}

/* -------------------------------------------------------------------------- */
/* Dismissals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A remembered decision to stop reporting one finding.
 *
 * The fingerprint ties it to the exact evidence it was made about, so editing
 * that field produces a new finding with a new fingerprint and the old dismissal
 * stops applying — "it comes back when the content changes", without a separate
 * invalidation step.
 */
export interface QualityDismissal {
  readonly ruleId: QualityRuleId;
  readonly fingerprint: string;
  readonly reason: string;
  readonly dismissedAt: IsoTimestamp;
}

export type QualityDismissResult =
  | { readonly ok: true; readonly dismissal: QualityDismissal }
  | { readonly ok: false; readonly error: string };

/** Validates a reason and builds a dismissal, or explains why it cannot. */
export function createDismissal(
  finding: QualityFinding,
  reason: string,
  dismissedAt: IsoTimestamp,
): QualityDismissResult {
  const trimmed = reason.trim();

  if (trimmed.length < QUALITY_LIMITS.minReasonChars) {
    return {
      ok: false,
      error: `Give a reason of at least ${QUALITY_LIMITS.minReasonChars} characters, so the decision is readable later.`,
    };
  }
  if (trimmed.length > QUALITY_LIMITS.reasonChars) {
    return {
      ok: false,
      error: `Keep the reason under ${QUALITY_LIMITS.reasonChars} characters.`,
    };
  }

  return {
    ok: true,
    dismissal: {
      ruleId: finding.ruleId,
      fingerprint: finding.fingerprint,
      reason: trimmed,
      dismissedAt,
    },
  };
}

export interface DismissedFinding {
  readonly finding: QualityFinding;
  readonly dismissal: QualityDismissal;
}

export interface QualityDismissalResult {
  /** Findings that are not dismissed, in the order they were given. */
  readonly visible: readonly QualityFinding[];
  /** Findings the user dismissed, with the reason they gave. */
  readonly dismissed: readonly DismissedFinding[];
  /** Stored dismissals whose finding no longer exists in this document. */
  readonly orphaned: readonly QualityDismissal[];
}

/** Splits findings by the stored dismissals, without losing any of them. */
export function applyDismissals(
  findings: readonly QualityFinding[],
  dismissals: readonly QualityDismissal[],
): QualityDismissalResult {
  const byFingerprint = new Map(dismissals.map((dismissal) => [dismissal.fingerprint, dismissal]));
  const visible: QualityFinding[] = [];
  const dismissed: DismissedFinding[] = [];
  const matched = new Set<string>();

  for (const finding of findings) {
    const dismissal = byFingerprint.get(finding.fingerprint);
    if (dismissal) {
      dismissed.push({ finding, dismissal });
      matched.add(dismissal.fingerprint);
    } else {
      visible.push(finding);
    }
  }

  const orphaned = dismissals.filter((dismissal) => !matched.has(dismissal.fingerprint));

  return { visible, dismissed, orphaned };
}

/** Adds or replaces a dismissal, keeping the list under its cap (newest first). */
export function addDismissal(
  dismissals: readonly QualityDismissal[],
  dismissal: QualityDismissal,
): QualityDismissal[] {
  const rest = dismissals.filter((entry) => entry.fingerprint !== dismissal.fingerprint);
  return [dismissal, ...rest].slice(0, QUALITY_LIMITS.maxDismissals);
}

/** Removes one dismissal by fingerprint; unknown fingerprints are ignored. */
export function removeDismissal(
  dismissals: readonly QualityDismissal[],
  fingerprint: string,
): QualityDismissal[] {
  return dismissals.filter((entry) => entry.fingerprint !== fingerprint);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Rejects anything that is not a dismissal, so a corrupt store cannot crash the screen. */
export function isQualityDismissal(value: unknown): value is QualityDismissal {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<QualityDismissal>;

  return (
    typeof candidate.ruleId === 'string' &&
    RULES_BY_ID.has(candidate.ruleId as QualityRuleId) &&
    typeof candidate.fingerprint === 'string' &&
    /^[0-9a-f]{8}$/.test(candidate.fingerprint) &&
    typeof candidate.reason === 'string' &&
    candidate.reason.trim().length > 0 &&
    isIsoTimestamp(candidate.dismissedAt)
  );
}

/** Reads a stored list, dropping entries that do not validate. */
export function parseDismissals(value: unknown): QualityDismissal[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isQualityDismissal).slice(0, QUALITY_LIMITS.maxDismissals);
}
