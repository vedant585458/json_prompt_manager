/**
 * Serialization for prompt documents (TASK-005).
 *
 * Three concerns live here:
 * 1. **Stable output** — key order is canonical, so two equal values always
 *    serialize to identical text (diffs, hashes, and exports depend on it).
 * 2. **Parsing** — `parseDocument` accepts raw text or a parsed value and
 *    returns a `DomainResult`; a malformed document never throws at the UI.
 * 3. **Hashing** — a pure FNV-1a hash for conflict detection, with no
 *    dependency on `crypto.subtle` (async) or any browser-only API.
 */

import { isJsonValue, isPlainObject, validatePromptDocument } from '@/domain/promptDocument';
import type { DomainResult, JsonValue, PromptDocument } from '@/domain/types';

/** Raised by helpers that cannot express failure as a value (hash/stringify). */
export class SerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerializationError';
  }
}

/* -------------------------------------------------------------------------- */
/* Stable stringify                                                          */
/* -------------------------------------------------------------------------- */

export interface StableStringifyOptions {
  /** Insert line breaks and this many spaces of indentation. */
  readonly indent?: number;
}

/** Keys that are emitted in this order before any remaining keys (A→Z). */
const DOCUMENT_KEY_ORDER: readonly string[] = [
  'schemaVersion',
  'name',
  'role',
  'objective',
  'instructions',
  'context',
  'constraints',
  'variables',
  'output',
  'examples',
  'metadata',
  'includes',
];

/**
 * JSON with sorted keys and no insignificant whitespace (or a stable pretty
 * print when `indent` is given).
 *
 * Differences from `JSON.stringify`:
 * - object keys are sorted, so insertion order cannot leak into output;
 * - `undefined` object entries are dropped (as in `JSON.stringify`) while
 *   `undefined` array entries become `null`;
 * - cycles, functions, symbols, and non-finite numbers raise `SerializationError`
 *   instead of silently producing invalid JSON.
 */
export function stableStringify(value: unknown, options: StableStringifyOptions = {}): string {
  const indent = options.indent ?? 0;
  const seen = new Set<unknown>();

  const serialize = (current: unknown, depth: number): string => {
    if (current === null) return 'null';

    switch (typeof current) {
      case 'string':
        return JSON.stringify(current);
      case 'boolean':
        return current ? 'true' : 'false';
      case 'number':
        if (!Number.isFinite(current)) {
          throw new SerializationError('Numbers must be finite to serialize.');
        }
        return JSON.stringify(current);
      case 'object':
        break;
      default:
        throw new SerializationError(`Cannot serialize a value of type "${typeof current}".`);
    }

    if (seen.has(current)) {
      throw new SerializationError('Cannot serialize a cyclic structure.');
    }
    seen.add(current);

    const pad = indent > 0 ? '\n' + ' '.repeat(indent * (depth + 1)) : '';
    const closePad = indent > 0 ? '\n' + ' '.repeat(indent * depth) : '';
    const separator = indent > 0 ? ': ' : ':';

    try {
      if (Array.isArray(current)) {
        if (current.length === 0) return '[]';
        const items = current.map((item) =>
          item === undefined ? 'null' : serialize(item, depth + 1),
        );
        return `[${pad}${items.join(`,${pad}`)}${closePad}]`;
      }

      if (!isPlainObject(current)) {
        throw new SerializationError('Only plain objects and arrays can be serialized.');
      }

      const entries = Object.keys(current)
        .filter((key) => current[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}${separator}${serialize(current[key], depth + 1)}`);

      if (entries.length === 0) return '{}';
      return `{${pad}${entries.join(`,${pad}`)}${closePad}}`;
    } finally {
      seen.delete(current);
    }
  };

  return serialize(value, 0);
}

/** Value-returning variant of `stableStringify`; failures become issues. */
export function tryStableStringify(
  value: unknown,
  options: StableStringifyOptions = {},
): DomainResult<string> {
  try {
    return { ok: true, value: stableStringify(value, options), issues: [] };
  } catch (error) {
    return {
      ok: false,
      issues: [{ path: '', message: describeError(error), severity: 'error' }],
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Document ⇄ JSON                                                            */
/* -------------------------------------------------------------------------- */

function orderedDocumentJson(document: PromptDocument): Record<string, JsonValue> {
  const json: Record<string, JsonValue> = {
    schemaVersion: document.schemaVersion,
    name: document.name,
    role: document.role,
    objective: document.objective,
    instructions: [...document.instructions],
    context: { ...document.context } as Record<string, JsonValue>,
    constraints: [...document.constraints],
    variables: document.variables.map((variable) => ({ ...variable }) as Record<string, JsonValue>),
    output: { ...document.output } as Record<string, JsonValue>,
    examples: document.examples.map((example) => ({ ...example }) as Record<string, JsonValue>),
    metadata: { ...document.metadata } as Record<string, JsonValue>,
    includes: [...document.includes],
  };

  // Preserved unknown fields are written after the canonical sections so a
  // human-readable export keeps the familiar order.
  for (const [key, value] of Object.entries(document.extras ?? {})) {
    if (key in json) continue;
    json[key] = value;
  }

  return json;
}

/**
 * Plain JSON object for a document, in canonical key order.
 *
 * `extras` are merged back in, so an import → edit → export cycle preserves
 * fields this build does not understand.
 */
export function documentToJson(document: PromptDocument): Record<string, JsonValue> {
  return orderedDocumentJson(document);
}

/** Pretty-printed canonical JSON for the editor and for exports. */
export function formatDocument(document: PromptDocument, indent = 2): string {
  const json = documentToJson(document);
  const ordered: Record<string, JsonValue> = {};

  for (const key of DOCUMENT_KEY_ORDER) {
    if (key in json) ordered[key] = json[key] as JsonValue;
  }
  for (const [key, value] of Object.entries(json)) {
    if (!(key in ordered)) ordered[key] = value;
  }

  return JSON.stringify(ordered, null, indent);
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown serialization failure.';
}

/**
 * Converts a JSON parse failure into one readable sentence.
 *
 * Engine messages differ by version: some include `(line X column Y)`, some only
 * a character offset, and some embed a snippet of the input. The reason is
 * normalized and the location is reported whenever the engine supplies it.
 */
function describeJsonSyntaxError(source: string, error: unknown): string {
  const message = describeError(error);

  const reason = message
    .replace(/\s*in JSON at position \d+.*$/i, '')
    .replace(/\s*is not valid JSON\s*$/i, '')
    .replace(/,\s*(?:\.\.\.\s*)?"[\s\S]*$/i, '')
    .trim();

  const explicit = /\(line (\d+) column (\d+)\)/.exec(message);
  if (explicit?.[1] && explicit[2]) {
    return `Invalid JSON at line ${explicit[1]}, column ${explicit[2]} — ${reason}`;
  }

  const position = /position (\d+)/.exec(message);
  if (position?.[1]) {
    const offset = Number(position[1]);
    const before = source.slice(0, offset);
    const line = before.split('\n').length;
    const column = offset - before.lastIndexOf('\n');
    return `Invalid JSON at line ${line}, column ${column} — ${reason}`;
  }

  return `Invalid JSON — ${reason}`;
}

/**
 * Parses a document from text or from an already-parsed value.
 *
 * - Text is parsed with a friendly syntax error (line/column), never a throw.
 * - The result is passed through `validatePromptDocument`, so callers get the
 *   normalized document plus every issue in one pass.
 */
export function parseDocument(input: string | unknown): DomainResult<PromptDocument> {
  let value: unknown = input;

  if (typeof input === 'string') {
    if (input.trim().length === 0) {
      return {
        ok: false,
        issues: [{ path: '', message: 'The document is empty.', severity: 'error' }],
      };
    }
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return {
        ok: false,
        issues: [{ path: '', message: describeJsonSyntaxError(input, error), severity: 'error' }],
      };
    }
  }

  return validatePromptDocument(value);
}

/**
 * Parses any JSON text into a value, returning issues instead of throwing.
 * Used by import validation and by the editor's syntax check.
 */
export function parseJson(input: string): DomainResult<JsonValue> {
  if (input.trim().length === 0) {
    return { ok: false, issues: [{ path: '', message: 'The input is empty.', severity: 'error' }] };
  }

  try {
    const value = JSON.parse(input) as unknown;
    if (!isJsonValue(value)) {
      return {
        ok: false,
        issues: [{ path: '', message: 'Value is not JSON data.', severity: 'error' }],
      };
    }
    return { ok: true, value, issues: [] };
  } catch (error) {
    return {
      ok: false,
      issues: [{ path: '', message: describeJsonSyntaxError(input, error), severity: 'error' }],
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Hashing                                                                    */
/* -------------------------------------------------------------------------- */

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/**
 * FNV-1a 64-bit hash, as 16 lowercase hex characters.
 *
 * Deterministic across platforms and synchronous. Not cryptographic: it exists
 * to detect "did the content change?" (import conflicts, autosave diffing) and
 * is never used for secrecy or identity.
 */
export function hashString(input: string): string {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index) & 0xff);
    hash = (hash * FNV_PRIME) & MASK_64;
    hash ^= BigInt(input.charCodeAt(index) >> 8);
    hash = (hash * FNV_PRIME) & MASK_64;
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * Content hash of any JSON value (canonical key order, so formatting and key
 * order never change the hash).
 */
export function contentHash(value: JsonValue): string {
  return hashString(stableStringify(value));
}

/** Hash of a prompt document, ignoring unknown preserved fields. */
export function documentHash(document: PromptDocument): string {
  return contentHash(documentToJson(document));
}

/** Issue-producing variant for callers that hold untrusted values. */
export function tryContentHash(value: unknown): DomainResult<string> {
  const serialized = tryStableStringify(value);
  if (!serialized.ok) {
    return { ok: false, issues: serialized.issues };
  }
  return { ok: true, value: hashString(serialized.value), issues: [] };
}
