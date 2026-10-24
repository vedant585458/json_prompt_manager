import { describe, expect, it } from 'vitest';

import {
  buildJsonTree,
  defaultExpandedPaths,
  findJsonTreeNode,
  formatJsonPath,
  jsonNodeKind,
  jsonValuePreview,
  jsonValueText,
  treeKeyboardAction,
  visibleJsonTreeRows,
} from '@/domain/jsonTree';
import type { JsonValue } from '@/domain/types';

const DOCUMENT: JsonValue = {
  name: 'Extractor',
  objective: 'Pull fields out of mail',
  instructions: ['Read the email', 'Return JSON'],
  output: { format: 'json', schema: null },
  temperature: 0.2,
  strict: true,
};

function rowsFor(value: JsonValue, expandedPaths?: readonly string[]) {
  const root = buildJsonTree(value);
  const expanded = expandedPaths ? new Set(expandedPaths) : defaultExpandedPaths(root);
  return { root, expanded, rows: visibleJsonTreeRows(root, expanded) };
}

describe('jsonNodeKind', () => {
  it('names every JSON type', () => {
    expect(jsonNodeKind(null)).toBe('null');
    expect(jsonNodeKind([])).toBe('array');
    expect(jsonNodeKind({})).toBe('object');
    expect(jsonNodeKind('x')).toBe('string');
    expect(jsonNodeKind(1)).toBe('number');
    expect(jsonNodeKind(false)).toBe('boolean');
  });
});

describe('formatJsonPath', () => {
  it('uses dot notation for identifier keys and brackets for the rest', () => {
    expect(formatJsonPath([])).toBe('$');
    expect(formatJsonPath(['output', 'format'])).toBe('$.output.format');
    expect(formatJsonPath(['instructions', 0])).toBe('$.instructions[0]');
    expect(formatJsonPath(['a b'])).toBe("$['a b']");
    expect(formatJsonPath(['draft-v2'])).toBe("$['draft-v2']");
  });

  it('escapes quotes and backslashes inside bracketed keys', () => {
    expect(formatJsonPath(["it's"])).toBe("$['it\\'s']");
    expect(formatJsonPath(['a\\b'])).toBe("$['a\\\\b']");
  });
});

describe('buildJsonTree', () => {
  it('builds the root with its children in document order', () => {
    const root = buildJsonTree(DOCUMENT);

    expect(root).toMatchObject({ path: '$', key: '$', kind: 'object', depth: 0, expandable: true });
    expect(root.children.map((child) => child.key)).toEqual([
      'name',
      'objective',
      'instructions',
      'output',
      'temperature',
      'strict',
    ]);
    expect(root.children.map((child) => child.path)).toContain('$.instructions');
  });

  it('summarises containers and scalars', () => {
    const root = buildJsonTree(DOCUMENT);
    const byKey = new Map(root.children.map((child) => [child.key, child]));

    expect(root.summary).toBe('6 keys');
    expect(byKey.get('instructions')?.summary).toBe('2 items');
    expect(byKey.get('output')?.summary).toBe('2 keys');
    expect(byKey.get('strict')?.summary).toBe('true');
    expect(byKey.get('temperature')?.summary).toBe('0.2');
    expect(byKey.get('name')?.summary).toBe('"Extractor"');
  });

  it('labels array items by index and nests depth correctly', () => {
    const root = buildJsonTree(DOCUMENT);
    const instructions = root.children.find((child) => child.key === 'instructions');

    expect(instructions?.children.map((child) => child.key)).toEqual(['[0]', '[1]']);
    expect(instructions?.children[0]?.path).toBe('$.instructions[0]');
    expect(instructions?.children[0]?.depth).toBe(2);
  });

  it('marks empty containers as expandable but childless', () => {
    const root = buildJsonTree({ list: [], map: {} });
    expect(root.children.map((child) => [child.key, child.expandable, child.summary])).toEqual([
      ['list', true, 'empty array'],
      ['map', true, 'empty object'],
    ]);
  });

  it('handles nested nulls and empty strings', () => {
    const root = buildJsonTree({ a: null, b: '' });
    expect(root.children.map((child) => child.summary)).toEqual(['null', 'empty string']);
  });
});

describe('visibleJsonTreeRows', () => {
  it('shows the root and its first level by default', () => {
    const { rows } = rowsFor(DOCUMENT);
    expect(rows[0]?.node.path).toBe('$');
    expect(rows).toHaveLength(7);
    expect(rows.filter((row) => row.expanded).map((row) => row.node.key)).toEqual(['$']);
  });

  it('reveals children of expanded nodes', () => {
    const { rows } = rowsFor(DOCUMENT, ['$', '$.instructions']);
    const keys = rows.map((row) => row.node.key);

    expect(keys).toContain('[0]');
    expect(rows.find((row) => row.node.key === 'instructions')?.expanded).toBe(true);
  });

  it('hides the whole subtree when the root is collapsed', () => {
    const { rows } = rowsFor(DOCUMENT, []);
    expect(rows).toHaveLength(1);
  });
});

describe('findJsonTreeNode', () => {
  it('finds a node by path and returns null when it is absent', () => {
    const root = buildJsonTree(DOCUMENT);
    expect(findJsonTreeNode(root, '$.output.format')?.kind).toBe('string');
    expect(findJsonTreeNode(root, '$.missing')).toBeNull();
  });
});

describe('treeKeyboardAction', () => {
  const { rows } = rowsFor(DOCUMENT, ['$', '$.instructions']);

  it('moves focus through visible rows without wrapping', () => {
    expect(treeKeyboardAction(rows, 0, 'ArrowDown', new Set(['$']))).toEqual({
      path: rows[1]?.node.path,
    });
    expect(treeKeyboardAction(rows, 0, 'ArrowUp', new Set(['$']))).toBeNull();
    expect(treeKeyboardAction(rows, rows.length - 1, 'ArrowDown', new Set())).toBeNull();
    expect(treeKeyboardAction(rows, 2, 'Home', new Set())).toEqual({ path: '$' });
    expect(treeKeyboardAction(rows, 0, 'End', new Set())).toEqual({
      path: rows[rows.length - 1]?.node.path,
    });
  });

  it('expands a collapsed node with Right, then steps into its first child', () => {
    const index = rows.findIndex((row) => row.node.key === 'output');
    const expanded = new Set(['$', '$.instructions']);

    expect(treeKeyboardAction(rows, index, 'ArrowRight', expanded)).toEqual({
      path: '$.output',
      expansion: { path: '$.output', expanded: true },
    });

    const expandedRows = visibleJsonTreeRows(
      buildJsonTree(DOCUMENT),
      new Set([...expanded, '$.output']),
    );
    const outputIndex = expandedRows.findIndex((row) => row.node.key === 'output');

    expect(
      treeKeyboardAction(
        expandedRows,
        outputIndex,
        'ArrowRight',
        new Set([...expanded, '$.output']),
      ),
    ).toEqual({ path: '$.output.format' });
  });

  it('collapses with Left, and otherwise climbs to the parent', () => {
    const expanded = new Set(['$', '$.instructions']);
    const parentIndex = rows.findIndex((row) => row.node.key === 'instructions');
    const childIndex = rows.findIndex((row) => row.node.path === '$.instructions[0]');

    expect(treeKeyboardAction(rows, parentIndex, 'ArrowLeft', expanded)).toEqual({
      path: '$.instructions',
      expansion: { path: '$.instructions', expanded: false },
    });
    expect(treeKeyboardAction(rows, childIndex, 'ArrowLeft', expanded)).toEqual({
      path: '$.instructions',
    });
    expect(treeKeyboardAction(rows, 0, 'ArrowLeft', expanded)).toEqual({
      path: '$',
      expansion: { path: '$', expanded: false },
    });
  });

  it('ignores Right on a leaf', () => {
    const index = rows.findIndex((row) => row.node.key === 'name');
    expect(treeKeyboardAction(rows, index, 'ArrowRight', new Set(['$']))).toBeNull();
  });

  it('returns null for an index that is not on screen', () => {
    expect(treeKeyboardAction(rows, 99, 'ArrowDown', new Set())).toBeNull();
  });
});

describe('value copy helpers', () => {
  it('previews a value on one line and truncates long ones', () => {
    expect(jsonValuePreview('text')).toBe('"text"');
    expect(jsonValuePreview({ a: 1 })).toBe('{"a":1}');
    expect(jsonValuePreview('x'.repeat(100))).toHaveLength(60);
    expect(jsonValuePreview('x'.repeat(100)).endsWith('…')).toBe(true);
  });

  it('stringifies a value for copying', () => {
    expect(jsonValueText({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(jsonValueText(null)).toBe('null');
  });
});
