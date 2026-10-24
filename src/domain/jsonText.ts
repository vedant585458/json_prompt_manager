/**
 * JSON text utilities for the editor (TASK-014).
 *
 * Everything here is pure: it takes the text the user typed and returns either
 * a rewritten document or a precise location for the syntax error. No DOM, no
 * React, no storage.
 *
 * The location comes from `scanJson`, a small recursive-descent parser rather
 * than `JSON.parse`. V8 reports either a character offset or a truncated snippet
 * depending on the message length, and its `Unexpected token 'o'` for `nope`
 * points past the real mistake. A scanner that owns its own cursor reports the
 * position of the token that is actually wrong, with a sentence a person can
 * act on.
 */

import type { JsonValue } from '@/domain/types';

/** Above this size the editor stops parsing on every keystroke. */
export const LARGE_DOCUMENT_CHARS = 500_000;

/** Debounce window for the editor's parse pass, in milliseconds. */
export const PARSE_DEBOUNCE_MS = 220;

/** Nesting limit; a document deeper than this is refused, not rendered. */
export const MAX_JSON_DEPTH = 200;

/** A syntax failure with a 1-based line and column and a 0-based offset. */
export interface JsonSyntaxError {
  /** A sentence describing what is wrong. */
  readonly message: string;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column number. */
  readonly column: number;
  /** 0-based character offset, for `EditorView.dispatch`. */
  readonly offset: number;
}

/** Result of a parse or a text rewrite. */
export type JsonScanResult =
  | { readonly ok: true; readonly value: JsonValue }
  | { readonly ok: false; readonly error: JsonSyntaxError };

/** Result of a text rewrite; a failure never carries partial output. */
export type JsonTextResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: JsonSyntaxError };

/** Counts shown in the editor status bar. */
export interface JsonTextStats {
  readonly lines: number;
  readonly characters: number;
  readonly nonEmptyLines: number;
}

/** Internal carrier for a failure at a known offset. */
class JsonScanFailure extends Error {
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(message);
    this.name = 'JsonScanFailure';
    this.offset = offset;
  }
}

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function quoteCharacter(character: string): string {
  return character === '\n' ? 'end of line' : `“${character}”`;
}

/**
 * Recursive-descent JSON parser that reports the exact offset of a failure.
 *
 * It accepts exactly what `JSON.parse` accepts (minus duplicate-key semantics
 * that only matter for reading) and adds two refusals the engine does not make:
 * nesting beyond `MAX_JSON_DEPTH`, and numbers that overflow to `Infinity`.
 */
class JsonScanner {
  private index = 0;
  private depth = 0;

  constructor(private readonly text: string) {}

  scanDocument(): JsonValue {
    this.skipWhitespace();

    if (this.index >= this.text.length) {
      throw new JsonScanFailure('The document is empty.', 0);
    }

    const value = this.scanValue();
    this.skipWhitespace();

    if (this.index < this.text.length) {
      throw new JsonScanFailure(
        `Unexpected content after the document: ${quoteCharacter(this.peek())}.`,
        this.index,
      );
    }

    return value;
  }

  private get length(): number {
    return this.text.length;
  }

  private peek(): string {
    return this.text[this.index] ?? '';
  }

  private skipWhitespace(): void {
    while (this.index < this.length && WHITESPACE.has(this.peek())) this.index += 1;
  }

  private failAtCursor(message: string): never {
    throw new JsonScanFailure(message, this.index);
  }

  private scanValue(): JsonValue {
    this.skipWhitespace();

    if (this.index >= this.length) {
      throw new JsonScanFailure('Unexpected end of input — a value is missing.', this.index);
    }

    const character = this.peek();

    if (character === '{') return this.scanObject();
    if (character === '[') return this.scanArray();
    if (character === '"') return this.scanString();
    if (character === '-' || (character >= '0' && character <= '9')) return this.scanNumber();

    for (const [literal, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (this.text.startsWith(literal, this.index)) {
        this.index += literal.length;
        return value;
      }
    }

    return this.failAtCursor(
      `Unexpected character ${quoteCharacter(character)} — a value is expected.`,
    );
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > MAX_JSON_DEPTH) {
      throw new JsonScanFailure(
        `This document is nested more than ${MAX_JSON_DEPTH} levels deep, which the editor will not open.`,
        this.index,
      );
    }
  }

  private scanObject(): Record<string, JsonValue> {
    this.enter();
    this.index += 1; // {
    const result: Record<string, JsonValue> = {};
    this.skipWhitespace();

    if (this.peek() === '}') {
      this.index += 1;
      this.depth -= 1;
      return result;
    }

    for (;;) {
      this.skipWhitespace();

      if (this.index >= this.length) {
        throw new JsonScanFailure('Unexpected end of input — “}” is missing.', this.index);
      }

      if (this.peek() !== '"') {
        throw new JsonScanFailure('Expected a property name in double quotes.', this.index);
      }

      const key = this.scanString();
      this.skipWhitespace();

      if (this.peek() !== ':') {
        throw new JsonScanFailure(
          this.index >= this.length
            ? 'Unexpected end of input — “:” is missing.'
            : `Expected “:” after the property name, found ${quoteCharacter(this.peek())}.`,
          this.index,
        );
      }

      this.index += 1;
      result[key] = this.scanValue();
      this.skipWhitespace();

      const next = this.peek();

      if (next === ',') {
        this.index += 1;
        this.skipWhitespace();
        if (this.peek() === '}') {
          throw new JsonScanFailure('A trailing comma before “}” is not allowed.', this.index);
        }
        continue;
      }

      if (next === '}') {
        this.index += 1;
        this.depth -= 1;
        return result;
      }

      throw new JsonScanFailure(
        this.index >= this.length
          ? 'Unexpected end of input — “}” is missing.'
          : `Expected “,” or “}” after the property value, found ${quoteCharacter(next)}.`,
        this.index,
      );
    }
  }

  private scanArray(): JsonValue[] {
    this.enter();
    this.index += 1; // [
    const result: JsonValue[] = [];
    this.skipWhitespace();

    if (this.peek() === ']') {
      this.index += 1;
      this.depth -= 1;
      return result;
    }

    for (;;) {
      this.skipWhitespace();
      result.push(this.scanValue());
      this.skipWhitespace();

      const next = this.peek();

      if (next === ',') {
        this.index += 1;
        this.skipWhitespace();
        if (this.peek() === ']') {
          throw new JsonScanFailure('A trailing comma before “]” is not allowed.', this.index);
        }
        continue;
      }

      if (next === ']') {
        this.index += 1;
        this.depth -= 1;
        return result;
      }

      throw new JsonScanFailure(
        this.index >= this.length
          ? 'Unexpected end of input — “]” is missing.'
          : `Expected “,” or “]” after the array item, found ${quoteCharacter(next)}.`,
        this.index,
      );
    }
  }

  private scanString(): string {
    this.index += 1; // opening quote
    let result = '';

    for (;;) {
      if (this.index >= this.length) {
        throw new JsonScanFailure(
          'Unterminated string — add the closing double quote.',
          this.index,
        );
      }

      const character = this.peek();

      if (character === '"') {
        this.index += 1;
        return result;
      }

      if (character === '\\') {
        const escape = this.text[this.index + 1];
        if (escape === undefined) {
          throw new JsonScanFailure(
            'Unterminated string — the escape sequence has no value.',
            this.index,
          );
        }

        if (escape === 'u') {
          const hex = this.text.slice(this.index + 2, this.index + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new JsonScanFailure(
              'Invalid escape — “\\u” needs four hexadecimal digits.',
              this.index,
            );
          }
          result += String.fromCharCode(Number.parseInt(hex, 16));
          this.index += 6;
          continue;
        }

        const mapped = ESCAPES[escape];
        if (mapped === undefined) {
          throw new JsonScanFailure(`Invalid escape sequence “\\${escape}”.`, this.index);
        }

        result += mapped;
        this.index += 2;
        continue;
      }

      if (character.charCodeAt(0) < 0x20) {
        throw new JsonScanFailure(
          'A control character inside a string must be escaped.',
          this.index,
        );
      }

      result += character;
      this.index += 1;
    }
  }

  private scanNumber(): number {
    NUMBER.lastIndex = this.index;
    const match = NUMBER.exec(this.text);

    if (!match?.[0]) {
      return this.failAtCursor('Expected a number.');
    }

    const raw = match[0];
    this.index += raw.length;

    // `01`, `1.2.3`, `1e` and friends: the matched prefix is a number, but what
    // follows it proves the token was not one.
    if (/[0-9A-Za-z._]/.test(this.peek())) {
      throw new JsonScanFailure('This is not a valid number.', this.index);
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new JsonScanFailure(
        `The number ${raw} is outside the range JavaScript can represent.`,
        this.index - raw.length,
      );
    }

    return value;
  }
}

/** Converts a 0-based character offset into a 1-based line and column. */
export function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, clamped);
  const lastBreak = before.lastIndexOf('\n');

  return { line: before.split('\n').length, column: clamped - lastBreak };
}

/** Inverse of `lineColumnAt`: a 1-based line/column to a 0-based offset. */
export function offsetAtLineColumn(text: string, line: number, column: number): number {
  const lines = text.split('\n');
  const targetLine = Math.max(1, Math.min(Math.trunc(line), lines.length));

  let offset = 0;
  for (let index = 0; index < targetLine - 1; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1;
  }

  const lineLength = lines[targetLine - 1]?.length ?? 0;
  return offset + Math.max(0, Math.min(column - 1, lineLength));
}

/**
 * Parses JSON text, or explains where it stops being JSON.
 *
 * Never throws: an empty document, a missing brace, a trailing comma, an
 * unterminated string, an invalid escape, and an out-of-range number all come
 * back as a located `error`.
 */
export function scanJson(text: string): JsonScanResult {
  if (text.trim().length === 0) {
    return {
      ok: false,
      error: { message: 'The document is empty.', line: 1, column: 1, offset: 0 },
    };
  }

  try {
    return { ok: true, value: new JsonScanner(text).scanDocument() };
  } catch (error) {
    if (error instanceof JsonScanFailure) {
      return {
        ok: false,
        error: {
          message: error.message,
          ...lineColumnAt(text, error.offset),
          offset: error.offset,
        },
      };
    }

    throw error;
  }
}

/** Convenience wrapper for callers that only need the failure. */
export function findJsonSyntaxError(text: string): JsonSyntaxError | null {
  const result = scanJson(text);
  return result.ok ? null : result.error;
}

/** True when the document is big enough to warrant the keystroke-parsing guard. */
export function isLargeJsonText(text: string): boolean {
  return text.length > LARGE_DOCUMENT_CHARS;
}

/** Line and character counts for the status bar. */
export function jsonTextStats(text: string): JsonTextStats {
  const lines = text.length === 0 ? 1 : text.split('\n').length;
  const nonEmpty = text.split('\n').filter((line) => line.trim().length > 0).length;

  return { lines, characters: text.length, nonEmptyLines: nonEmpty };
}

/** Formats any JSON value with the requested indentation. */
export function stringifyJsonValue(value: unknown, indent: 2 | 4): string {
  return JSON.stringify(value, null, indent);
}

function rewrite(text: string, indent: 2 | 4, minify: boolean): JsonTextResult {
  const result = scanJson(text);
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    text: minify ? JSON.stringify(result.value) : stringifyJsonValue(result.value, indent),
  };
}

/**
 * Pretty-prints the document.
 *
 * Idempotent by construction: the output is produced from the parsed value, so
 * formatting twice yields the exact same text.
 */
export function formatJsonText(text: string, indent: 2 | 4 = 2): JsonTextResult {
  return rewrite(text, indent, false);
}

/** Collapses the document to a single line. */
export function minifyJsonText(text: string): JsonTextResult {
  return rewrite(text, 2, true);
}

/** The user-facing copy for a syntax error, used by toasts and the panel. */
export function describeJsonSyntaxError(error: JsonSyntaxError): string {
  return `Line ${error.line}, column ${error.column} — ${error.message}`;
}
