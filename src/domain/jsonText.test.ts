import { describe, expect, it } from 'vitest';

import {
  LARGE_DOCUMENT_CHARS,
  MAX_JSON_DEPTH,
  PARSE_DEBOUNCE_MS,
  describeJsonSyntaxError,
  findJsonSyntaxError,
  formatJsonText,
  isLargeJsonText,
  jsonTextStats,
  lineColumnAt,
  minifyJsonText,
  offsetAtLineColumn,
  scanJson,
  stringifyJsonValue,
} from '@/domain/jsonText';

describe('line and column conversion', () => {
  const text = '{\n  "name": "A",\n  "list": [1, 2]\n}';

  it('reports 1-based positions for the start of each line', () => {
    expect(lineColumnAt(text, 0)).toEqual({ line: 1, column: 1 });
    expect(lineColumnAt(text, 2)).toEqual({ line: 2, column: 1 });
    expect(lineColumnAt(text, text.indexOf('"list"'))).toEqual({ line: 3, column: 3 });
  });

  it('clamps offsets outside the text', () => {
    expect(lineColumnAt(text, -5)).toEqual({ line: 1, column: 1 });
    expect(lineColumnAt(text, text.length + 100)).toEqual({ line: 4, column: 2 });
  });

  it('round-trips a position through the offset', () => {
    const offset = text.indexOf('"list"');
    const { line, column } = lineColumnAt(text, offset);
    expect(offsetAtLineColumn(text, line, column)).toBe(offset);
  });

  it('clamps a line past the end to the last line', () => {
    expect(offsetAtLineColumn('{\n}', 99, 1)).toBe(2);
  });
});

describe('scanJson', () => {
  it('accepts every JSON shape', () => {
    expect(scanJson('{"a": 1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(scanJson('null')).toEqual({ ok: true, value: null });
    expect(scanJson('[]')).toEqual({ ok: true, value: [] });
    expect(scanJson(' [ -0, 1.5e3, true, false, "x" ] ')).toEqual({
      ok: true,
      value: [-0, 1500, true, false, 'x'],
    });
  });

  it('keeps the last value for a duplicated key, like JSON.parse', () => {
    expect(scanJson('{"a": 1, "a": 2}')).toEqual({ ok: true, value: { a: 2 } });
  });

  it('treats whitespace-only input as empty and locates it at the start', () => {
    expect(scanJson('   \n ')).toEqual({
      ok: false,
      error: { message: 'The document is empty.', line: 1, column: 1, offset: 0 },
    });
  });

  it('points at a trailing comma before a closing brace', () => {
    const text = '{\n  "a": 1,\n}';
    const result = scanJson(text);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.line).toBe(3);
    expect(result.error.column).toBe(1);
    expect(result.error.message).toMatch(/trailing comma/i);
    expect(result.error.offset).toBe(text.lastIndexOf('}'));
  });

  it('points at a trailing comma inside an array', () => {
    const result = scanJson('[1, 2, ]');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.message).toMatch(/trailing comma/i);
    expect(result.error.column).toBe(8);
  });

  it('points at the line whose comma is missing', () => {
    const result = scanJson('{\n  "a": 1\n  "b": 2\n}');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.line).toBe(3);
    expect(result.error.column).toBe(3);
    expect(result.error.message).toContain('Expected “,” or “}”');
  });

  it('points at an unterminated string', () => {
    const result = scanJson('{\n  "a": "oops}');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.line).toBe(2);
    expect(result.error.column).toBe(14);
    expect(result.error.message).toMatch(/unterminated string/i);
  });

  it('reports a raw newline inside a string as a control character', () => {
    const error = findJsonSyntaxError('{\n  "a": "oops\n}');
    expect(error?.line).toBe(2);
    expect(error?.message).toMatch(/control character/i);
  });

  it('anchors a missing value at the end of the text', () => {
    const text = '{"a": ';
    const result = scanJson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.offset).toBe(text.length);
    expect(result.error.line).toBe(1);
    expect(result.error.column).toBe(text.length + 1);
    expect(result.error.message).toMatch(/end of input/i);
  });

  it('locates the offending token in a longer document exactly', () => {
    const lines = ['{'];
    for (let index = 0; index < 40; index += 1) lines.push(`  "k${index}": ${index},`);
    lines.push('  "last": nope');
    lines.push('}');
    const text = lines.join('\n');

    const result = scanJson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.line).toBe(42);
    expect(result.error.column).toBe(11);
    expect(result.error.message).toContain('Unexpected character “n”');
  });

  it('rejects a bare word and a single-quoted string', () => {
    expect(findJsonSyntaxError("'a'")?.message).toContain('Unexpected character');
    expect(findJsonSyntaxError("'a'")?.message).toContain('“' + "'" + '”');
    expect(findJsonSyntaxError('nope')?.message).toContain('Unexpected character “n”');
  });

  it('rejects content after a complete document', () => {
    const result = scanJson('{} {}');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.column).toBe(4);
    expect(result.error.message).toMatch(/after the document/i);
  });

  it('rejects a property name without quotes and a missing colon', () => {
    expect(findJsonSyntaxError('{a: 1}')?.message).toMatch(/property name in double quotes/i);
    expect(findJsonSyntaxError('{"a" 1}')?.message).toMatch(/Expected “:”/i);
  });

  it('rejects control characters and bad escapes inside strings', () => {
    expect(findJsonSyntaxError('{"a": "x\ty"}')?.message).toMatch(/control character/i);
    expect(findJsonSyntaxError('{"a": "x\\q"}')?.message).toMatch(/invalid escape/i);
    expect(findJsonSyntaxError('{"a": "x\\u12"}')?.message).toMatch(/four hexadecimal/i);
  });

  it('accepts every valid escape sequence', () => {
    expect(scanJson('{"a": "\\"\\\\\\/\\b\\f\\n\\r\\t\\u00e9"}')).toEqual({
      ok: true,
      value: { a: '"\\/\b\f\n\r\té' },
    });
  });

  it('rejects malformed and out-of-range numbers', () => {
    expect(findJsonSyntaxError('{"a": 01}')?.message).toMatch(/not a valid number/i);
    expect(findJsonSyntaxError('{"a": 1.2.3}')?.message).toMatch(/not a valid number/i);
    expect(findJsonSyntaxError('{"a": 1e999}')?.message).toMatch(/outside the range/i);
  });

  it('refuses a document nested past the limit', () => {
    const text = `${'['.repeat(MAX_JSON_DEPTH + 1)}${']'.repeat(MAX_JSON_DEPTH + 1)}`;
    expect(findJsonSyntaxError(text)?.message).toMatch(/nested more than/i);
  });
});

describe('formatJsonText', () => {
  const compact = '{"name":"Extractor","tags":["a","b"],"nested":{"ok":true}}';

  it('pretty-prints with two spaces by default', () => {
    const result = formatJsonText(compact);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.text).toBe(
      [
        '{',
        '  "name": "Extractor",',
        '  "tags": [',
        '    "a",',
        '    "b"',
        '  ],',
        '  "nested": {',
        '    "ok": true',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('honours the four-space preference', () => {
    const result = formatJsonText(compact, 4);
    expect(result.ok && result.text.split('\n')[1]).toBe('    "name": "Extractor",');
  });

  it('is idempotent for both indents', () => {
    for (const indent of [2, 4] as const) {
      const once = formatJsonText(compact, indent);
      expect(once.ok).toBe(true);
      if (!once.ok) return;

      expect(formatJsonText(once.text, indent)).toEqual(once);
    }
  });

  it('preserves key order', () => {
    expect(formatJsonText('{"b":1,"a":2}').ok && formatJsonText('{"b":1,"a":2}')).toMatchObject({
      text: '{\n  "b": 1,\n  "a": 2\n}',
    });
  });

  it('refuses invalid JSON and reports the location instead', () => {
    const result = formatJsonText('{"a": }');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.line).toBe(1);
    expect(result.error.column).toBe(7);
    expect(result.error.message.length).toBeGreaterThan(0);
  });
});

describe('minifyJsonText', () => {
  it('collapses whitespace and keeps the values', () => {
    expect(minifyJsonText('{\n  "a": [1, 2],\n  "b": "x"\n}')).toEqual({
      ok: true,
      text: '{"a":[1,2],"b":"x"}',
    });
  });

  it('is stable when run twice', () => {
    const once = minifyJsonText('{"a": 1}');
    expect(once.ok && minifyJsonText(once.text)).toEqual(once);
  });
});

describe('status-bar statistics', () => {
  it('counts lines and characters, including an empty document', () => {
    expect(jsonTextStats('')).toEqual({ lines: 1, characters: 0, nonEmptyLines: 0 });
    expect(jsonTextStats('{\n  "a": 1\n}')).toEqual({ lines: 3, characters: 12, nonEmptyLines: 3 });
    expect(jsonTextStats('{\n\n}')).toEqual({ lines: 3, characters: 4, nonEmptyLines: 2 });
  });

  it('flags a document over the large-document guard', () => {
    expect(isLargeJsonText('{}')).toBe(false);
    expect(isLargeJsonText('x'.repeat(LARGE_DOCUMENT_CHARS + 1))).toBe(true);
  });
});

describe('copy helpers', () => {
  it('stringifies a value at the requested indent', () => {
    expect(stringifyJsonValue({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
    expect(stringifyJsonValue([1], 4)).toBe('[\n    1\n]');
  });

  it('describes an error with its location', () => {
    expect(
      describeJsonSyntaxError({ message: 'Unexpected token', line: 3, column: 1, offset: 12 }),
    ).toBe('Line 3, column 1 — Unexpected token');
  });

  it('keeps the debounce window short enough to feel immediate', () => {
    expect(PARSE_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(PARSE_DEBOUNCE_MS).toBeLessThan(500);
  });
});
