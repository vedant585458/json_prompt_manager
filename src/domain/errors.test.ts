import { describe, expect, it } from 'vitest';

import { RuleViolationError } from '@/domain/errors';
import { checkFolderMove, checkFolderName } from '@/domain/invariants';
import type { Folder } from '@/domain/types';

function folder(id: string, name: string, parentId: string | null = null): Folder {
  return {
    id,
    name,
    parentId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('RuleViolationError', () => {
  it('takes the first fatal message as its own', () => {
    const error = new RuleViolationError([
      { path: 'name', message: 'Folder name cannot be empty.', severity: 'error' },
    ]);

    expect(error.message).toBe('Folder name cannot be empty.');
    expect(error.name).toBe('RuleViolationError');
    expect(error).toBeInstanceOf(Error);
  });

  it('falls back to a generic message when no issue is fatal', () => {
    const error = new RuleViolationError([
      { path: 'name', message: 'Just a warning.', severity: 'warning' },
    ]);

    expect(error.message).toBe('Just a warning.');
    expect(new RuleViolationError([]).message).toBe('That change is not allowed.');
  });

  it('is a real Error subclass with a stable stack', () => {
    const error = new RuleViolationError([]);
    expect(error.stack).toContain('RuleViolationError');
  });

  it('exposes one message per field', () => {
    const tree = [folder('a', 'A'), folder('b', 'B', 'a'), folder('c', 'C', 'b')];

    const cycle = new RuleViolationError(checkFolderMove(tree, 'a', 'c'));
    expect(cycle.issueFor('parentId')).toMatch(/cannot be moved inside itself/);
    expect(cycle.issueFor('name')).toBeUndefined();

    const duplicate = new RuleViolationError(
      checkFolderName([folder('x', 'Ideas'), folder('y', 'ideas')], 'IDEAS', null),
    );
    expect(duplicate.issueFor('name')).toMatch(/already exists/);
  });

  it('copies the issues it was given', () => {
    const issues = [{ path: 'name', message: 'Nope.', severity: 'error' as const }];
    const error = new RuleViolationError(issues);

    expect(error.issues).not.toBe(issues);
    expect(error.issues).toEqual(issues);
  });
});
