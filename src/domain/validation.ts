/**
 * Validation reports for prompt documents (TASK-016).
 *
 * One function turns text (or a parsed value) plus an optional JSON Schema into a
 * single report with three clearly separated kinds of finding:
 *
 * - **syntax** — the text is not JSON; there is nothing else to say;
 * - **schema** — the schema itself is unusable, or the document does not conform
 *   to it (these are errors);
 * - **document** — the value is not the PromptForge prompt-document shape
 *   (warnings: they describe the stored shape, and never block a save).
 *
 * Nothing here touches storage, React, or the network, and nothing mutates the
 * prompt or the schema. The report only describes what was checked — validity is
 * syntax and structure, never prompt quality (ADR-85).
 */

import { scanJson } from '@/domain/jsonText';
import { formatJsonPath } from '@/domain/jsonTree';
import {
  compileJsonSchema,
  validateInstance,
  type SchemaCompileResult,
  type SchemaProblem,
} from '@/domain/jsonSchema';
import { validatePromptDocument } from '@/domain/promptDocument';
import type { JsonValue, Prompt, PromptSchema } from '@/domain/types';

export type ValidationKind = 'syntax' | 'schema' | 'document';
export type ValidationSeverity = 'error' | 'warning';

/** Overall outcome, in a form the UI can render without re-deriving anything. */
export type ValidationStatus = 'valid' | 'warning' | 'invalid' | 'skipped';

/** What happened to the attached schema (if any). */
export type SchemaStatus = 'none' | 'checked' | 'rejected' | 'unchecked';

export interface ValidationIssue {
  readonly kind: ValidationKind;
  readonly severity: ValidationSeverity;
  /** Readable location: `$.variables[0].name`, or `$` for the root. */
  readonly path: string;
  /** JSON Pointer (`/variables/0/name`); empty string for the root. */
  readonly pointer: string;
  readonly message: string;
  /** The keyword responsible, when there is one. */
  readonly keyword?: string;
  /** 1-based line, for syntax findings. */
  readonly line?: number;
  /** 1-based column, for syntax findings. */
  readonly column?: number;
}

export interface ValidationCounts {
  readonly syntax: number;
  readonly schema: number;
  readonly document: number;
  readonly errors: number;
  readonly warnings: number;
  readonly total: number;
}

export interface ValidationReport {
  readonly status: ValidationStatus;
  /** True only when nothing at all was found and everything was checked. */
  readonly valid: boolean;
  readonly syntaxOk: boolean;
  readonly schemaStatus: SchemaStatus;
  /** True when a schema was attached and the document conformed to it. */
  readonly conforms: boolean | null;
  readonly counts: ValidationCounts;
  readonly issues: readonly ValidationIssue[];
  /** Schema notes that do not affect the document (unknown `format`, etc.). */
  readonly schemaWarnings: readonly ValidationIssue[];
  /** True when an error cap stopped the walk. */
  readonly truncated: boolean;
  /** Why nothing was checked, when that is the case. */
  readonly skippedReason: string | null;
}

export const VALIDATION_LIMITS = {
  /** Documents larger than this are not deep-validated. */
  maxTextChars: 2_000_000,
  /** Compiled schemas kept in memory, keyed by their text. */
  maxCachedSchemas: 32,
} as const;

export interface ValidateOptions {
  /** JSON Schema content from the schema library, or `null` for none. */
  readonly schema?: unknown;
  /** Set false to validate arbitrary JSON without the prompt-document rules. */
  readonly checkDocument?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pointers and paths                                                         */
/* -------------------------------------------------------------------------- */

function segmentsOf(pointer: string): readonly (string | number)[] {
  if (pointer.length === 0) return [];

  return pointer
    .slice(1)
    .split('/')
    .map((segment) => {
      const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
      return /^\d+$/.test(key) ? Number(key) : key;
    });
}

/** Turns a JSON Pointer into the `$`-rooted path the rest of the app shows. */
export function pointerToPath(pointer: string): string {
  return formatJsonPath(segmentsOf(pointer));
}

/** Turns a `$`-rooted path back into a JSON Pointer (`$.a[0]` → `/a/0`). */
export function pathToPointer(path: string): string {
  const segments: string[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]|\['((?:[^'\\]|\\.)*)'\]/g;
  let match = pattern.exec(path);

  while (match) {
    const named = match[1];
    const index = match[2];
    const quoted = match[3];
    if (named !== undefined && named !== '$') {
      segments.push(named.replaceAll('~', '~0').replaceAll('/', '~1'));
    } else if (index !== undefined) segments.push(index);
    else if (quoted !== undefined) {
      // A bracketed key needs the same pointer escaping as a dotted one.
      segments.push(quoted.replaceAll("\\'", "'").replaceAll('~', '~0').replaceAll('/', '~1'));
    }
    match = pattern.exec(path);
  }

  return segments.length > 0 ? `/${segments.join('/')}` : '';
}

/* -------------------------------------------------------------------------- */
/* Schema compilation cache                                                   */
/* -------------------------------------------------------------------------- */

const schemaCache = new Map<string, SchemaCompileResult>();

/** Compiles a schema, reusing a cached result for identical content. */
export function compileSchema(schema: unknown): SchemaCompileResult {
  let key: string;
  try {
    key = JSON.stringify(schema) ?? 'null';
  } catch {
    return compileJsonSchema(schema);
  }

  const cached = schemaCache.get(key);
  if (cached) {
    // Refresh recency: the map is a small LRU, not a permanent store.
    schemaCache.delete(key);
    schemaCache.set(key, cached);
    return cached;
  }

  const result = compileJsonSchema(schema);
  schemaCache.set(key, result);
  while (schemaCache.size > VALIDATION_LIMITS.maxCachedSchemas) {
    const oldest = schemaCache.keys().next();
    if (oldest.done) break;
    schemaCache.delete(oldest.value);
  }

  return result;
}

/** Empties the compile cache. Tests use this; the app never needs to. */
export function clearSchemaCache(): void {
  schemaCache.clear();
}

/* -------------------------------------------------------------------------- */
/* Report assembly                                                            */
/* -------------------------------------------------------------------------- */

function emptyReport(overrides: Partial<ValidationReport>): ValidationReport {
  const issues = overrides.issues ?? [];

  const counts = countIssues(overrides.issues ?? issues);

  return {
    status: 'valid',
    valid: true,
    syntaxOk: true,
    schemaStatus: 'none',
    conforms: null,
    schemaWarnings: [],
    truncated: false,
    skippedReason: null,
    ...overrides,
    issues,
    counts,
  };
}

/** Turns a dotted document path (`variables[0].name`) into a JSON Pointer. */
function documentPathToPointer(path: string): string {
  const segments: string[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]/g;
  let match = pattern.exec(path);

  while (match) {
    const named = match[1];
    const index = match[2];
    if (named !== undefined) segments.push(named.replaceAll('~', '~0').replaceAll('/', '~1'));
    else if (index !== undefined) segments.push(index);
    match = pattern.exec(path);
  }

  return segments.length > 0 ? `/${segments.join('/')}` : '';
}

export function countIssues(issues: readonly ValidationIssue[]): ValidationCounts {
  const counts = {
    syntax: 0,
    schema: 0,
    document: 0,
    errors: 0,
    warnings: 0,
    total: issues.length,
  };

  for (const issue of issues) {
    counts[issue.kind] += 1;
    if (issue.severity === 'error') counts.errors += 1;
    else counts.warnings += 1;
  }

  return counts;
}

function statusOf(issues: readonly ValidationIssue[], skipped: string | null): ValidationStatus {
  if (skipped) return 'skipped';
  if (issues.some((issue) => issue.severity === 'error')) return 'invalid';
  if (issues.length > 0) return 'warning';
  return 'valid';
}

function schemaProblemToIssue(problem: SchemaProblem): ValidationIssue {
  const path = problem.pointer.length === 0 ? '$' : `$${problem.pointer}`;
  return {
    kind: 'schema',
    severity: 'error',
    path,
    pointer: problem.pointer,
    message: problem.message,
    keyword: problem.keyword,
  };
}

function documentIssuesOf(value: unknown): ValidationIssue[] {
  const result = validatePromptDocument(value);
  if (result.ok) return [];

  return result.issues.map((issue) => ({
    kind: 'document',
    // The document rules describe shape; they never block a save, so every one
    // is a warning rather than an error (ADR-86).
    severity: 'warning',
    path: issue.path.length > 0 ? `$.${issue.path}` : '$',
    pointer: documentPathToPointer(issue.path),
    message: issue.message,
    keyword: 'document',
  }));
}

function finish(
  issues: readonly ValidationIssue[],
  overrides: Partial<ValidationReport> & { readonly skippedReason?: string | null },
): ValidationReport {
  const skipped = overrides.skippedReason ?? null;
  const status = statusOf(issues, skipped);

  return emptyReport({
    ...overrides,
    status,
    valid: status === 'valid',
    issues,
  });
}

/**
 * Validates text: syntax first, then the optional schema, then the document
 * shape. A syntax error stops the chain — there is no value to check.
 */
export function validateJsonText(text: string, options: ValidateOptions = {}): ValidationReport {
  if (text.length > VALIDATION_LIMITS.maxTextChars) {
    return finish([], {
      syntaxOk: false,
      schemaStatus: 'unchecked',
      skippedReason: `This document is larger than ${VALIDATION_LIMITS.maxTextChars.toLocaleString()} characters, so it was not validated.`,
    });
  }

  const scanned = scanJson(text);
  if (!scanned.ok) {
    const issue: ValidationIssue = {
      kind: 'syntax',
      severity: 'error',
      path: '$',
      pointer: '',
      message: scanned.error.message,
      keyword: 'syntax',
      line: scanned.error.line,
      column: scanned.error.column,
    };
    return finish([issue], { syntaxOk: false, schemaStatus: 'unchecked' });
  }

  return validateJsonValue(scanned.value, options);
}

/** Validates an already-parsed value. Same rules as `validateJsonText`. */
export function validateJsonValue(
  value: JsonValue,
  options: ValidateOptions = {},
): ValidationReport {
  const { schema, checkDocument = true } = options;
  const issues: ValidationIssue[] = [];

  if (checkDocument) issues.push(...documentIssuesOf(value));

  if (schema === undefined || schema === null) {
    return finish(issues, { schemaStatus: 'none' });
  }

  const compiled = compileSchema(schema);
  if (!compiled.ok) {
    // An unusable schema produces schema findings and no document conformance
    // findings. Saying "invalid document" here would blame the wrong artefact.
    issues.push(...compiled.problems.map(schemaProblemToIssue));
    return finish(issues, { schemaStatus: 'rejected', conforms: null });
  }

  const result = validateInstance(compiled.schema, value);
  for (const error of result.errors) {
    issues.push({
      kind: 'schema',
      severity: 'error',
      path: pointerToPath(error.pointer),
      pointer: error.pointer,
      message: error.message,
      keyword: error.keyword,
    });
  }

  const warnings: ValidationIssue[] = compiled.warnings.map((warning) => ({
    ...schemaProblemToIssue(warning),
    severity: 'warning',
  }));

  return finish(issues, {
    schemaStatus: 'checked',
    conforms: result.errors.length === 0,
    truncated: result.truncated,
    schemaWarnings: warnings,
  });
}

/* -------------------------------------------------------------------------- */
/* Library-wide helpers                                                       */
/* -------------------------------------------------------------------------- */

/** A prompt that does not meet the schema attached to it. */
export interface PromptSchemaProblem {
  readonly promptId: string;
  readonly title: string;
  readonly schemaId: string;
  readonly schemaName: string;
  readonly issues: readonly ValidationIssue[];
}

/**
 * Finds prompts whose attached schema rejects their stored document.
 *
 * Pure and synchronous: the library and dashboard already parse every document
 * to answer "will this read back", and this adds one bounded schema check per
 * prompt that actually has a schema attached.
 */
export function findSchemaProblems(
  prompts: readonly Prompt[],
  schemas: readonly PromptSchema[],
): PromptSchemaProblem[] {
  const byId = new Map(schemas.map((schema) => [schema.id, schema]));
  const problems: PromptSchemaProblem[] = [];

  for (const prompt of prompts) {
    if (!prompt.schemaId) continue;
    const schema = byId.get(prompt.schemaId);
    if (!schema) continue;

    const report = validateJsonValue(prompt.content as unknown as JsonValue, {
      schema: schema.schemaContent,
    });
    const issues = report.issues.filter((issue) => issue.kind === 'schema');
    if (issues.length === 0) continue;

    problems.push({
      promptId: prompt.id,
      title: prompt.title,
      schemaId: schema.id,
      schemaName: schema.name,
      issues,
    });
  }

  return problems.sort((left, right) => left.title.localeCompare(right.title));
}

/**
 * Resolves a document path (`$.variables[3].name`) to the line holding that key.
 *
 * Syntax findings already carry a line; schema findings only carry a pointer, and
 * "find" is only useful if it can move the caret. The search walks the text for
 * the `"key":` token in order and is deliberately conservative: when it cannot be
 * sure, it returns `null` rather than jumping somewhere wrong.
 */
export function findLineForPath(text: string, path: string): number | null {
  const segments = segmentsOf(pathToPointer(path));
  if (segments.length === 0) return null;

  const lines = text.split('\n');
  const keys = segments.filter((segment) => typeof segment === 'string');
  if (keys.length === 0) return null;

  let from = 0;
  for (const key of keys) {
    const token = `"${String(key).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
    const found = lines.findIndex((line, index) => index >= from && line.includes(`${token}:`));
    if (found === -1) return null;
    from = found;
  }

  return from + 1;
}

/** How many prompts reference a schema. Used before deleting one. */
export function countSchemaUsage(prompts: readonly Prompt[], schemaId: string): number {
  return prompts.reduce((total, prompt) => (prompt.schemaId === schemaId ? total + 1 : total), 0);
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One sentence describing a report.
 *
 * Deliberately says what was checked. It never calls a document "good", and it
 * never claims a schema check that did not happen.
 */
export function describeValidation(report: ValidationReport): string {
  if (report.status === 'skipped') {
    return report.skippedReason ?? 'This document was not validated.';
  }

  if (report.counts.syntax > 0) return 'The text is not valid JSON, so nothing else was checked.';

  const parts: string[] = [];
  if (report.counts.schema > 0) {
    parts.push(`${report.counts.schema} schema ${report.counts.schema === 1 ? 'error' : 'errors'}`);
  }
  if (report.counts.document > 0) {
    parts.push(
      `${report.counts.document} document ${report.counts.document === 1 ? 'warning' : 'warnings'}`,
    );
  }
  if (report.schemaWarnings.length > 0) {
    parts.push(
      `${report.schemaWarnings.length} schema ${report.schemaWarnings.length === 1 ? 'note' : 'notes'}`,
    );
  }

  if (report.schemaStatus === 'rejected') {
    // The schema, not the document, is the problem — say so before anything else.
    const count = report.counts.schema;
    const problems = `${count} schema ${count === 1 ? 'problem' : 'problems'}`;
    return `Valid JSON, but the attached schema could not be used (${problems}); only the PromptForge shape was checked.`;
  }

  if (parts.length > 0) return `Valid JSON — ${parts.join(', ')}.`;
  if (report.schemaStatus === 'checked')
    return 'Valid JSON, and the document meets the attached schema.';
  return 'Valid JSON, and the document matches the PromptForge shape.';
}
