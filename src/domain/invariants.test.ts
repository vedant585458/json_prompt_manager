import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_LOG_LIMIT,
  AUTOSAVE_DELAY,
  MAX_FOLDER_DEPTH,
  MAX_TAG_LENGTH,
  capActivityLog,
  checkCollectionName,
  checkFolderMove,
  checkFolderName,
  checkNewFolder,
  clampAutosaveDelay,
  findFolderCycles,
  folderDepth,
  folderNameKey,
  folderPath,
  hasErrors,
  hasTag,
  hasWarnings,
  isDescendantFolder,
  isRevisionNumberAvailable,
  isValidTag,
  isValidVariableName,
  nextRevisionNumber,
  normalizeTag,
  normalizeTags,
  normalizeTitle,
  normalizeVariableName,
  sortRevisions,
  titleKey,
  wouldCreateFolderCycle,
} from '@/domain/invariants';
import type { ActivityEvent, Collection, Folder, PromptRevision } from '@/domain/types';

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return {
    id,
    name,
    parentId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function revision(
  id: string,
  promptId: string,
  revisionNumber: number,
  createdAt = '2026-01-01T00:00:00.000Z',
): PromptRevision {
  return {
    id,
    promptId,
    revisionNumber,
    contentSnapshot: {
      schemaVersion: '1.0',
      name: 'x',
      role: '',
      objective: '',
      instructions: [],
      context: {},
      constraints: [],
      variables: [],
      output: { format: 'json' },
      examples: [],
      metadata: {},
      includes: [],
    },
    titleSnapshot: 'x',
    descriptionSnapshot: '',
    tagsSnapshot: [],
    variablesSnapshot: [],
    label: null,
    kind: 'manual',
    createdAt,
  };
}

function event(id: string, createdAt: string): ActivityEvent {
  return { id, type: 'updated', summary: 'Changed', createdAt };
}

describe('issue helpers', () => {
  it('distinguishes errors from warnings', () => {
    expect(hasErrors([])).toBe(false);
    expect(hasWarnings([])).toBe(false);
    expect(hasErrors([{ path: '', message: 'x', severity: 'warning' }])).toBe(false);
    expect(hasWarnings([{ path: '', message: 'x', severity: 'warning' }])).toBe(true);
    expect(
      hasErrors([
        { path: '', message: 'x', severity: 'warning' },
        { path: '', message: 'y', severity: 'error' },
      ]),
    ).toBe(true);
  });
});

describe('tag normalization', () => {
  it('lowercases, trims, and hyphenates', () => {
    expect(normalizeTag('  Release Notes ')).toBe('release-notes');
    expect(normalizeTag('snake_case_tag')).toBe('snake-case-tag');
    expect(normalizeTag('multiple   spaces')).toBe('multiple-spaces');
    expect(normalizeTag('--already--hyphenated--')).toBe('already-hyphenated');
    expect(normalizeTag('UPPER')).toBe('upper');
  });

  it('drops unsupported characters and truncates long values', () => {
    expect(normalizeTag('c++ / rust')).toBe('c-rust');
    expect(normalizeTag('emoji 🚀 tag')).toBe('emoji-tag');
    expect(normalizeTag('x'.repeat(80))).toHaveLength(MAX_TAG_LENGTH);
    expect(normalizeTag('trailing-')).toBe('trailing');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(normalizeTag('   ')).toBe('');
    expect(normalizeTag('!!!')).toBe('');
    expect(isValidTag('!!!')).toBe(false);
    expect(isValidTag('Docs')).toBe(true);
  });

  it('normalizes lists without duplicates and keeps order', () => {
    expect(normalizeTags(['Docs', ' docs ', 'Release Notes', '!!!', 'docs'])).toEqual([
      'docs',
      'release-notes',
    ]);
    expect(normalizeTags([])).toEqual([]);
  });

  it('finds tags case-insensitively', () => {
    expect(hasTag(['release-notes'], 'Release Notes')).toBe(true);
    expect(hasTag(['release-notes'], 'docs')).toBe(false);
    expect(hasTag([], 'docs')).toBe(false);
    expect(hasTag(['docs'], '!!!')).toBe(false);
  });
});

describe('titles', () => {
  it('collapses whitespace and compares case-insensitively', () => {
    expect(normalizeTitle('  My   Prompt ')).toBe('My Prompt');
    expect(titleKey('  My   Prompt ')).toBe('my prompt');
    expect(titleKey('my prompt')).toBe(titleKey('MY PROMPT'));
  });
});

describe('variable names', () => {
  it('accepts mustache-friendly identifiers', () => {
    expect(isValidVariableName('name')).toBe(true);
    expect(isValidVariableName('_private')).toBe(true);
    expect(isValidVariableName('var2')).toBe(true);
    expect(isValidVariableName('2var')).toBe(false);
    expect(isValidVariableName('with-dash')).toBe(false);
    expect(isValidVariableName('with space')).toBe(false);
    expect(isValidVariableName('')).toBe(false);
  });

  it('repairs free text into an identifier', () => {
    expect(normalizeVariableName('  user name ')).toBe('user_name');
    expect(normalizeVariableName('2nd value')).toBe('v_2nd_value');
    expect(normalizeVariableName('___')).toBe('');
    expect(isValidVariableName(normalizeVariableName('user name'))).toBe(true);
  });
});

describe('autosave delay', () => {
  it('clamps into the supported window', () => {
    expect(clampAutosaveDelay(900)).toBe(900);
    expect(clampAutosaveDelay(50)).toBe(AUTOSAVE_DELAY.min);
    expect(clampAutosaveDelay(999_999)).toBe(AUTOSAVE_DELAY.max);
    expect(clampAutosaveDelay(Number.NaN)).toBe(AUTOSAVE_DELAY.defaultValue);
    expect(clampAutosaveDelay(900.6)).toBe(901);
  });
});

describe('folders', () => {
  const tree: Folder[] = [
    folder('root', 'Work'),
    folder('child', 'Drafts', 'root'),
    folder('grandchild', 'Ideas', 'child'),
    folder('other', 'Personal'),
  ];

  it('computes depth with the folder counting itself', () => {
    expect(folderDepth(tree, 'root')).toBe(1);
    expect(folderDepth(tree, 'child')).toBe(2);
    expect(folderDepth(tree, 'grandchild')).toBe(3);
    expect(folderDepth(tree, 'missing')).toBeNull();
  });

  it('returns null when a parent is missing from the tree', () => {
    expect(folderDepth([folder('orphan', 'Orphan', 'gone')], 'orphan')).toBeNull();
  });

  it('detects a corrupt parent chain', () => {
    const cyclic = [folder('a', 'A', 'b'), folder('b', 'B', 'a')];
    expect(folderDepth(cyclic, 'a')).toBe(Number.POSITIVE_INFINITY);
    expect(folderDepth(cyclic, 'b')).toBe(Number.POSITIVE_INFINITY);
  });

  it('builds readable paths', () => {
    expect(folderPath(tree, 'grandchild')).toEqual(['Work', 'Drafts', 'Ideas']);
    expect(folderPath(tree, 'missing')).toEqual([]);

    const cyclic = [folder('a', 'A', 'b'), folder('b', 'B', 'a')];
    expect(folderPath(cyclic, 'a')).toEqual([]);
  });

  it('detects descendants', () => {
    expect(isDescendantFolder(tree, 'root', 'child')).toBe(true);
    expect(isDescendantFolder(tree, 'root', 'grandchild')).toBe(true);
    expect(isDescendantFolder(tree, 'child', 'grandchild')).toBe(true);
    expect(isDescendantFolder(tree, 'child', 'root')).toBe(false);
    expect(isDescendantFolder(tree, 'root', 'other')).toBe(false);
    expect(isDescendantFolder(tree, 'root', 'missing')).toBe(false);
  });

  it('reports folders caught in a cycle', () => {
    const cyclic = [folder('a', 'A', 'b'), folder('b', 'B', 'a'), folder('c', 'C')];
    expect(findFolderCycles(cyclic).sort()).toEqual(['a', 'b']);
    expect(findFolderCycles(tree)).toEqual([]);
  });

  it('predicts cycles for moves', () => {
    expect(wouldCreateFolderCycle(tree, 'root', 'root')).toBe(true);
    expect(wouldCreateFolderCycle(tree, 'root', 'grandchild')).toBe(true);
    expect(wouldCreateFolderCycle(tree, 'grandchild', 'root')).toBe(false);
    expect(wouldCreateFolderCycle(tree, 'root', null)).toBe(false);
    expect(wouldCreateFolderCycle(tree, 'child', 'other')).toBe(false);
  });

  it('compares folder names within one parent only', () => {
    expect(folderNameKey('  Work ')).toBe('work');
    expect(folderNameKey('WORK')).toBe('work');

    expect(checkFolderName(tree, 'Work', null)).toEqual([
      {
        path: 'name',
        message: 'A folder named "Work" already exists here.',
        severity: 'error',
      },
    ]);
    expect(checkFolderName(tree, 'Drafts', null)).toEqual([]);
    expect(checkFolderName(tree, 'Drafts', 'root')).toEqual([
      {
        path: 'name',
        message: 'A folder named "Drafts" already exists here.',
        severity: 'error',
      },
    ]);
    expect(checkFolderName(tree, 'drafts', 'root', 'child')).toEqual([]);
  });

  it('rejects empty and overlong folder names', () => {
    expect(checkFolderName(tree, '   ', null)).toEqual([
      { path: 'name', message: 'Folder name cannot be empty.', severity: 'error' },
    ]);
    expect(checkFolderName(tree, 'x'.repeat(81), null)[0]?.message).toMatch(/at most 80/);
  });

  it('validates folder moves', () => {
    expect(checkFolderMove(tree, 'missing', null)[0]?.message).toMatch(/no longer exists/);
    expect(checkFolderMove(tree, 'root', 'root')[0]?.message).toMatch(/inside itself/);
    expect(checkFolderMove(tree, 'root', 'grandchild')[0]?.message).toMatch(/inside itself/);
    expect(checkFolderMove(tree, 'root', 'nope')[0]?.message).toMatch(/Target folder/);
    expect(checkFolderMove(tree, 'grandchild', null)).toEqual([]);
    expect(checkFolderMove(tree, 'grandchild', 'other')).toEqual([]);
  });

  it('enforces the maximum nesting depth for the whole subtree', () => {
    const deep: Folder[] = [
      folder('a1', 'A1'),
      folder('a2', 'A2', 'a1'),
      folder('a3', 'A3', 'a2'),
      folder('b1', 'B1'),
      folder('b2', 'B2', 'b1'),
      folder('b3', 'B3', 'b2'),
      folder('b4', 'B4', 'b3'),
    ];

    // B4 sits at depth 4, so one more level is allowed.
    expect(checkFolderMove([...deep, folder('b5', 'B5', 'b4')], 'b5', 'b4')).toEqual([]);

    // A2's subtree is 2 deep; under B4 (depth 4) it would reach depth 6.
    expect(checkFolderMove(deep, 'a2', 'b4')[0]?.message).toBe(
      `Folders nest at most ${MAX_FOLDER_DEPTH} levels deep.`,
    );

    // A3 is a single level, so under B4 it lands exactly on the limit.
    expect(checkFolderMove(deep, 'a3', 'b4')).toEqual([]);
  });

  it('refuses to move folders into a corrupt tree', () => {
    const cyclic = [folder('a', 'A', 'b'), folder('b', 'B', 'a'), folder('loose', 'Loose')];
    expect(checkFolderMove(cyclic, 'loose', 'a')[0]?.message).toMatch(/invalid tree/);
  });
});

describe('revisions', () => {
  it('numbers revisions monotonically per prompt', () => {
    const revisions = [revision('r1', 'p1', 1), revision('r2', 'p1', 3), revision('r3', 'p2', 7)];

    expect(nextRevisionNumber([])).toBe(1);
    expect(nextRevisionNumber(revisions)).toBe(8);
  });

  it('checks availability within a prompt', () => {
    const revisions = [revision('r1', 'p1', 1)];
    expect(isRevisionNumberAvailable(revisions, 'p1', 1)).toBe(false);
    expect(isRevisionNumberAvailable(revisions, 'p1', 2)).toBe(true);
    expect(isRevisionNumberAvailable(revisions, 'p2', 1)).toBe(true);
  });

  it('sorts newest first without mutating the input', () => {
    const revisions = [
      revision('r1', 'p1', 1, '2026-01-01T00:00:00.000Z'),
      revision('r2', 'p1', 2, '2026-01-02T00:00:00.000Z'),
      revision('r3', 'p1', 2, '2026-01-03T00:00:00.000Z'),
    ];

    const sorted = sortRevisions(revisions);
    expect(sorted.map((item) => item.id)).toEqual(['r3', 'r2', 'r1']);
    expect(revisions.map((item) => item.id)).toEqual(['r1', 'r2', 'r3']);
  });
});

describe('activity log', () => {
  it('keeps the newest entries up to the limit', () => {
    const events = [
      event('a', '2026-01-01T00:00:00.000Z'),
      event('b', '2026-01-03T00:00:00.000Z'),
      event('c', '2026-01-02T00:00:00.000Z'),
    ];

    expect(capActivityLog(events, 2).map((item) => item.id)).toEqual(['b', 'c']);
    expect(capActivityLog(events)).toHaveLength(3);
    expect(events.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks timestamp ties deterministically', () => {
    const sameInstant = [
      event('a', '2026-01-01T00:00:00.000Z'),
      event('b', '2026-01-01T00:00:00.000Z'),
    ];
    expect(capActivityLog(sameInstant).map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('caps at 500 entries and tolerates an empty log', () => {
    const many = Array.from({ length: ACTIVITY_LOG_LIMIT + 20 }, (_, index) =>
      event(
        `e${index}`,
        `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}.${String(index).padStart(3, '0')}Z`,
      ),
    );

    expect(capActivityLog(many)).toHaveLength(ACTIVITY_LOG_LIMIT);
    expect(capActivityLog([])).toEqual([]);
    expect(capActivityLog(many, 0)).toEqual([]);
  });
});

describe('collections', () => {
  const collection = (id: string, name: string): Collection => ({
    id,
    name,
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const existing = [collection('one', 'Starter kit'), collection('two', 'Support replies')];

  it('accepts a fresh name', () => {
    expect(checkCollectionName(existing, '  Sales  ')).toEqual([]);
  });

  it('rejects an empty or whitespace-only name', () => {
    const issues = checkCollectionName(existing, '   ');
    expect(issues[0]?.message).toBe('Collection name cannot be empty.');
  });

  it('rejects names longer than 80 characters', () => {
    const issues = checkCollectionName(existing, 'x'.repeat(81));
    expect(issues[0]?.message).toMatch(/at most 80/);
  });

  it('rejects a duplicate regardless of case and spacing', () => {
    const issues = checkCollectionName(existing, '  starter   KIT ');
    expect(issues[0]?.message).toMatch(/already exists/);
  });

  it('ignores the collection being renamed', () => {
    expect(checkCollectionName(existing, 'Starter kit', 'one')).toEqual([]);
  });
});

describe('checkNewFolder', () => {
  const tree: Folder[] = [
    folder('one', 'One'),
    folder('two', 'Two', 'one'),
    folder('three', 'Three', 'two'),
  ];

  it('accepts a valid name at the root and under a parent', () => {
    expect(checkNewFolder(tree, 'Four')).toEqual([]);
    expect(checkNewFolder(tree, 'Four', 'two')).toEqual([]);
  });

  it('reports a sibling name collision', () => {
    const issues = checkNewFolder(tree, 'two', 'one');
    expect(issues.map((issue) => issue.path)).toContain('name');
  });

  it('allows the same name under a different parent', () => {
    expect(checkNewFolder(tree, 'Three', 'one')).toEqual([]);
  });

  it('reports a missing parent', () => {
    const issues = checkNewFolder(tree, 'Four', 'gone');
    expect(issues[0]?.message).toMatch(/no longer exists/);
  });

  it('reports a corrupt parent chain', () => {
    const cyclic = [folder('a', 'A', 'a')];
    const issues = checkNewFolder(cyclic, 'Child', 'a');
    expect(issues[0]?.message).toMatch(/invalid tree/);
  });

  it('stops at the documented depth limit', () => {
    let chain: Folder[] = [];
    for (let index = 0; index < MAX_FOLDER_DEPTH; index += 1) {
      chain = [...chain, folder(`f${index}`, `F${index}`, index === 0 ? null : `f${index - 1}`)];
    }

    const deepest = `f${MAX_FOLDER_DEPTH - 1}`;
    const issues = checkNewFolder(chain, 'Too deep', deepest);
    expect(issues[0]?.message).toMatch(new RegExp(`at most ${MAX_FOLDER_DEPTH} levels`));
  });
});
