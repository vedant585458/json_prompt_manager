/**
 * Template variables (TASK-021).
 *
 * A prompt document refers to variables with `{{name}}` tokens. This module is
 * the whole vocabulary of that idea, and nothing more:
 *
 * - **Scanning**: find the tokens in one string, and say which ones are not a
 *   usable identifier instead of quietly ignoring them.
 * - **Extraction**: walk every string in a document and collect the references,
 *   with the path they came from, so the UI can point at `instructions[2]`.
 * - **Reconciliation**: declared variables that are used, declared ones that are
 *   not, and references that were never declared.
 * - **Input parsing**: turn the playground's raw text into a typed value for the
 *   variable's declared type, or into a sentence explaining why it cannot.
 * - **Coercion**: turn a typed value into the exact text a token is replaced
 *   with, per type.
 *
 * There are no expressions, no function calls, no helpers, and no iteration
 * syntax, because there is no evaluator: `{{` is matched, an identifier is
 * read, and that identifier is looked up. A token that is not an identifier is
 * reported and copied through verbatim — never dropped.
 */

import { scanJson } from '@/domain/jsonText';
import { documentToJson } from '@/domain/serialization';
import type { JsonValue, PromptDocument, VariableDefinition, VariableType } from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/** A variable name that a token may refer to: `role_brief`, `ticket`, `_x`. */
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Tokens scanned per string before the scan stops and says so. */
export const MAX_TOKENS_PER_STRING = 1_000;

export const VARIABLE_TYPE_LABELS: Readonly<Record<VariableType, string>> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  json: 'JSON',
};

export const VARIABLE_TYPE_HINTS: Readonly<Record<VariableType, string>> = {
  string: 'Inserted as written, with its line breaks.',
  number: 'Inserted as a plain number, for example 42 or 3.5.',
  boolean: 'Inserted as true or false.',
  json: 'Inserted as compact JSON, so objects and arrays stay valid JSON.',
};

export function describeVariableType(type: VariableType): string {
  return VARIABLE_TYPE_LABELS[type];
}

/* -------------------------------------------------------------------------- */
/* Scanning one string                                                        */
/* -------------------------------------------------------------------------- */

export type TemplateTokenProblem = 'unclosed' | 'empty-name' | 'invalid-name';

export interface TemplateToken {
  /** Index of the opening `{{`. */
  readonly start: number;
  /** Index just past the closing `}}` (or the end of the text if unclosed). */
  readonly end: number;
  /** The exact source text, capped for display when it is unclosed. */
  readonly raw: string;
  /** The trimmed identifier, or `null` when the token is not usable. */
  readonly name: string | null;
  readonly problem: TemplateTokenProblem | null;
}

export interface TemplateScan {
  readonly tokens: readonly TemplateToken[];
  /** True when `maxTokens` stopped the scan. */
  readonly truncated: boolean;
}

const MAX_UNCLOSED_PREVIEW = 40;

/**
 * Finds `{{` placeholders in one string.
 *
 * The rules are deliberately narrow:
 * - `{{name}}` → a reference; internal whitespace is allowed (`{{ name }}`).
 * - `{{}}` and `{{ }}` → `empty-name`.
 * - `{{a + b}}`, `{{outer {{inner}}}}`, `{{a.b}}` → `invalid-name`; the text is
 *   copied through unchanged and reported, so nothing looks evaluated.
 * - a `{{` with no closing `}}` → `unclosed`, and scanning stops there because
 *   the rest of the string cannot be interpreted.
 * - a single `{` or `}` is ordinary text.
 *
 * There is no escape sequence for a literal `{{`; such text is reported as an
 * invalid token rather than silently rewritten.
 */
export function scanTemplate(
  text: string,
  maxTokens: number = MAX_TOKENS_PER_STRING,
): TemplateScan {
  const tokens: TemplateToken[] = [];
  const limit = Math.max(1, maxTokens);

  let cursor = 0;
  let truncated = false;

  while (cursor < text.length) {
    const start = text.indexOf('{{', cursor);
    if (start === -1) break;

    if (tokens.length >= limit) {
      truncated = true;
      break;
    }

    const close = text.indexOf('}}', start + 2);
    if (close === -1) {
      tokens.push({
        start,
        end: text.length,
        raw: abbreviate(text.slice(start), MAX_UNCLOSED_PREVIEW),
        name: null,
        problem: 'unclosed',
      });
      break;
    }

    const raw = text.slice(start, close + 2);
    const inner = text.slice(start + 2, close);
    const name = inner.trim();

    if (name.length === 0) {
      tokens.push({ start, end: close + 2, raw, name: null, problem: 'empty-name' });
    } else if (!VARIABLE_NAME_PATTERN.test(name)) {
      tokens.push({ start, end: close + 2, raw, name: null, problem: 'invalid-name' });
    } else {
      tokens.push({ start, end: close + 2, raw, name, problem: null });
    }

    cursor = close + 2;
  }

  return { tokens, truncated };
}

function abbreviate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

/* -------------------------------------------------------------------------- */
/* Extracting references from a document                                      */
/* -------------------------------------------------------------------------- */

export interface VariableReference {
  readonly name: string;
  /** Where the token appears, e.g. `instructions[1]` or `context.description`. */
  readonly path: string;
  /** Tokens of this name in this string. */
  readonly occurrences: number;
}

export interface TemplateProblem {
  readonly path: string;
  readonly token: TemplateToken;
}

export interface ReferenceScan {
  readonly references: readonly VariableReference[];
  readonly problems: readonly TemplateProblem[];
  readonly truncated: boolean;
}

/** Walks every string in a JSON value, reporting its path. */
function walkStrings(
  value: JsonValue,
  path: string,
  visit: (text: string, path: string) => void,
): void {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkStrings(item, `${path}[${index}]`, visit);
    });
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      walkStrings(value[key] as JsonValue, path ? `${path}.${key}` : key, visit);
    }
  }
}

/**
 * Collects every `{{name}}` reference in a document, with paths.
 *
 * All strings are scanned, including examples, metadata, and imported extras:
 * a token anywhere in the document is a reference the user should know about,
 * even when the rendered preview does not include that field.
 */
export function extractVariableReferences(document: PromptDocument): ReferenceScan {
  const references = new Map<string, { name: string; path: string; occurrences: number }>();
  const problems: TemplateProblem[] = [];
  let truncated = false;

  walkStrings(documentToJson(document), '', (text, path) => {
    if (!text.includes('{{')) return;

    const scan = scanTemplate(text);
    if (scan.truncated) truncated = true;

    for (const token of scan.tokens) {
      if (token.problem !== null) {
        // Unclosed tokens are reported once per string; repeating the same
        // truncated tail for every following field would be noise.
        problems.push({ path, token });
        continue;
      }

      const name = token.name as string;
      const key = `${name}\u0000${path}`;
      const existing = references.get(key);
      if (existing) existing.occurrences += 1;
      else references.set(key, { name, path, occurrences: 1 });
    }
  });

  const sorted = [...references.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path),
  );

  return { references: sorted, problems, truncated };
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                             */
/* -------------------------------------------------------------------------- */

export interface VariableUsage {
  readonly name: string;
  readonly paths: readonly string[];
  readonly occurrences: number;
}

export interface VariableReconciliation {
  /** Declared and referenced, in declaration order. */
  readonly used: readonly VariableUsage[];
  /** Declared but never referenced, in declaration order. */
  readonly unused: readonly VariableDefinition[];
  /** Referenced but not declared, alphabetically. */
  readonly undeclared: readonly VariableUsage[];
}

function usageOf(references: readonly VariableReference[]): VariableUsage[] {
  const byName = new Map<string, { paths: string[]; occurrences: number }>();

  for (const reference of references) {
    const entry = byName.get(reference.name);
    if (entry) {
      entry.paths.push(reference.path);
      entry.occurrences += reference.occurrences;
    } else {
      byName.set(reference.name, {
        paths: [reference.path],
        occurrences: reference.occurrences,
      });
    }
  }

  return [...byName.entries()].map(([name, entry]) => ({
    name,
    paths: entry.paths,
    occurrences: entry.occurrences,
  }));
}

/** Compares declarations with references in both directions. */
export function reconcileVariables(
  variables: readonly VariableDefinition[],
  references: readonly VariableReference[],
): VariableReconciliation {
  const usage = usageOf(references);
  const usedByName = new Map(usage.map((entry) => [entry.name, entry]));
  const declaredNames = new Set(variables.map((variable) => variable.name));

  const used: VariableUsage[] = [];
  const unused: VariableDefinition[] = [];

  for (const variable of variables) {
    const entry = usedByName.get(variable.name);
    if (entry) used.push(entry);
    else unused.push(variable);
  }

  const undeclared = usage
    .filter((entry) => !declaredNames.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { used, unused, undeclared };
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export type VariableInputState =
  | { readonly state: 'empty' }
  | { readonly state: 'invalid'; readonly error: string }
  | { readonly state: 'value'; readonly value: JsonValue };

const DECIMAL_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Turns the form's raw text into a typed value.
 *
 * An empty string means "not supplied" for every type except `string`, where
 * it is a legitimate value — the field is the value, so clearing it is a
 * choice, and "Reset to default" is how you go back. Numbers are parsed with a
 * decimal pattern rather than `Number()`, which would accept `0x10` and `1e999`
 * in ways the declaration does not promise.
 */
export function parseVariableInput(
  definition: VariableDefinition,
  raw: string,
): VariableInputState {
  switch (definition.type) {
    case 'string':
      return { state: 'value', value: raw };

    case 'number': {
      const text = raw.trim();
      if (text.length === 0) return { state: 'empty' };
      if (!DECIMAL_PATTERN.test(text)) {
        return { state: 'invalid', error: 'Enter a number, for example 42 or 3.5.' };
      }
      const value = Number(text);
      if (!Number.isFinite(value)) {
        return { state: 'invalid', error: 'That number is too large to use.' };
      }
      return { state: 'value', value };
    }

    case 'boolean': {
      const text = raw.trim();
      if (text.length === 0) return { state: 'empty' };
      if (text === 'true') return { state: 'value', value: true };
      if (text === 'false') return { state: 'value', value: false };
      return { state: 'invalid', error: 'A boolean is either true or false.' };
    }

    case 'json': {
      if (raw.trim().length === 0) return { state: 'empty' };
      const scanned = scanJson(raw);
      if (!scanned.ok) {
        return {
          state: 'invalid',
          error: `Line ${scanned.error.line}, column ${scanned.error.column}: ${scanned.error.message}`,
        };
      }
      return { state: 'value', value: scanned.value };
    }
  }
}

/** The raw text a field should start with for a value (default or restored). */
export function formatVariableInput(definition: VariableDefinition, value: JsonValue): string {
  switch (definition.type) {
    case 'string':
      return typeof value === 'string' ? value : JSON.stringify(value);
    case 'number':
      return typeof value === 'number' ? String(value) : JSON.stringify(value);
    case 'boolean':
      return value === true ? 'true' : 'false';
    case 'json':
      return JSON.stringify(value, null, 2);
  }
}

/** One short line describing a default value, for the form's hint. */
export function describeVariableDefault(
  definition: VariableDefinition,
  maxLength = 80,
): string | null {
  if (definition.defaultValue === undefined) return null;

  const text = formatVariableInput(definition, definition.defaultValue).replace(/\s+/g, ' ').trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

/* -------------------------------------------------------------------------- */
/* Coercion                                                                   */
/* -------------------------------------------------------------------------- */

export type CoercedValue =
  { readonly ok: true; readonly text: string } | { readonly ok: false; readonly error: string };

/**
 * The exact text a token is replaced with, per declared type.
 *
 * `string` inserts the value as-is (no quoting, newlines preserved), `number`
 * and `boolean` use their literals, and `json` uses compact JSON so an object
 * or array inserted into prose is still valid JSON. A value whose type does not
 * match the declaration is an error rather than a guess.
 */
export function coerceVariableText(value: JsonValue, type: VariableType): CoercedValue {
  switch (type) {
    case 'string':
      return { ok: true, text: typeof value === 'string' ? value : JSON.stringify(value) };

    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, error: 'The declared type is number, but the value is not a number.' };
      }
      return { ok: true, text: String(value) };

    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          ok: false,
          error: 'The declared type is boolean, but the value is not a boolean.',
        };
      }
      return { ok: true, text: value ? 'true' : 'false' };

    case 'json':
      return { ok: true, text: JSON.stringify(value) };
  }
}
