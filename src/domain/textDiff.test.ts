import { describe, expect, it } from 'vitest';

import { describeLineDifference, splitLines, summarizeLineDifference } from '@/domain/textDiff';

const STORED = '{\n  "a": 1,\n  "b": 2\n}';

describe('summarizeLineDifference', () => {
  it('reports no difference for identical text', () => {
    expect(summarizeLineDifference(STORED, STORED)).toEqual({
      firstDifferingLine: 0,
      added: 0,
      removed: 0,
    });
  });

  it('locates an edited line', () => {
    const edited = '{\n  "a": 1,\n  "b": 3\n}';
    expect(summarizeLineDifference(STORED, edited)).toEqual({
      firstDifferingLine: 3,
      added: 1,
      removed: 1,
    });
  });

  it('counts an inserted member, including the comma it changed', () => {
    const edited = '{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}';
    expect(summarizeLineDifference(STORED, edited)).toEqual({
      firstDifferingLine: 3,
      added: 2,
      removed: 1,
    });
  });

  it('counts a removed member, including the comma it changed', () => {
    const edited = '{\n  "a": 1\n}';
    expect(summarizeLineDifference(STORED, edited)).toEqual({
      firstDifferingLine: 2,
      added: 1,
      removed: 2,
    });
  });

  it('does not count the untouched tail as changed', () => {
    const long = ['{', '  "a": 1,', '  "b": 2,', '  "c": 3', '}'].join('\n');
    const edited = long.replace('"c": 3', '"c": 4');
    expect(summarizeLineDifference(long, edited)).toEqual({
      firstDifferingLine: 4,
      added: 1,
      removed: 1,
    });
  });

  it('handles a completely different document', () => {
    expect(summarizeLineDifference('a\nb', 'c\nd')).toEqual({
      firstDifferingLine: 1,
      added: 2,
      removed: 2,
    });
  });

  it('handles an empty draft', () => {
    expect(summarizeLineDifference('', 'x')).toEqual({
      firstDifferingLine: 1,
      added: 1,
      removed: 1,
    });
  });
});

describe('describeLineDifference', () => {
  it('writes one honest sentence', () => {
    expect(describeLineDifference({ firstDifferingLine: 3, added: 1, removed: 1 })).toBe(
      'Differs from the stored document at line 3 (+1 line, −1 line).',
    );
    expect(describeLineDifference({ firstDifferingLine: 2, added: 0, removed: 0 })).toBe(
      'Differs from the stored document at line 2.',
    );
    expect(describeLineDifference({ firstDifferingLine: 0, added: 0, removed: 0 })).toBe(
      'Identical to the stored document.',
    );
  });
});

describe('splitLines', () => {
  it('keeps empty lines', () => {
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b']);
  });
});
