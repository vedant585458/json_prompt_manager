import { describe, expect, it } from 'vitest';

import { filterCommands, groupCommands, subsequenceScore } from '@/lib/commands/filter';
import type { CommandDefinition } from '@/lib/commands/types';
import { createTestContext } from '@/test/commandContext';

const COMMANDS: readonly CommandDefinition[] = [
  {
    id: 'navigation.library',
    title: 'Go to Library',
    group: 'Navigation',
    description: 'Every prompt, searchable and filterable.',
    keywords: ['prompts', 'browse'],
    run: () => undefined,
  },
  {
    id: 'navigation.health',
    title: 'Go to Health',
    group: 'Navigation',
    description: 'Find stale prompts and duplicates.',
    run: () => undefined,
  },
  {
    id: 'workspace.toggle-rail',
    title: 'Toggle the navigation rail',
    group: 'Workspace',
    keywords: ['sidebar', 'collapse'],
    run: () => undefined,
  },
  {
    id: 'appearance.toggle-theme',
    title: 'Toggle dark and light theme',
    group: 'Appearance',
    keywords: ['color', 'colour'],
    run: () => undefined,
  },
  {
    id: 'development.gallery',
    title: 'Open the design system gallery',
    group: 'Development',
    when: (context) => context.dev,
    run: () => undefined,
  },
];

describe('subsequenceScore', () => {
  it('requires the characters in order', () => {
    expect(subsequenceScore('library', 'lbr')).not.toBeNull();
    expect(subsequenceScore('library', 'rbl')).toBeNull();
  });

  it('prefers contiguous runs over scattered characters', () => {
    expect(subsequenceScore('library', 'library')).toBeGreaterThan(
      subsequenceScore('library', 'lry') ?? 0,
    );
    expect(subsequenceScore('toggle theme', 'theme')).not.toBeNull();
  });

  it('returns zero for an empty query', () => {
    expect(subsequenceScore('anything', '')).toBe(0);
  });
});

describe('filterCommands', () => {
  const context = createTestContext();

  it('returns every available command for an empty query', () => {
    expect(filterCommands(COMMANDS, '', context)).toHaveLength(COMMANDS.length);
  });

  it('matches titles, keywords, and descriptions', () => {
    const byTitle = filterCommands(COMMANDS, 'libr', context).map((match) => match.command.id);
    expect(byTitle[0]).toBe('navigation.library');

    const byKeyword = filterCommands(COMMANDS, 'sidebar', context).map((match) => match.command.id);
    expect(byKeyword).toEqual(['workspace.toggle-rail']);

    const byDescription = filterCommands(COMMANDS, 'duplicates', context).map(
      (match) => match.command.id,
    );
    expect(byDescription).toEqual(['navigation.health']);
  });

  it('drops unavailable commands entirely', () => {
    const hidden = filterCommands(COMMANDS, 'gallery', createTestContext({ dev: false }));
    expect(hidden).toHaveLength(0);
    expect(filterCommands(COMMANDS, 'gallery', createTestContext({ dev: true }))).toHaveLength(1);
  });

  it('ranks title matches above keyword matches', () => {
    const matches = filterCommands(COMMANDS, 'theme', context);
    expect(matches[0]?.command.id).toBe('appearance.toggle-theme');
  });

  it('returns nothing when the query matches nothing', () => {
    expect(filterCommands(COMMANDS, 'zzzz', context)).toEqual([]);
  });
});

describe('groupCommands', () => {
  const context = createTestContext();
  const matches = filterCommands(COMMANDS, '', context);

  it('groups in canonical order when the query is empty', () => {
    const sections = groupCommands(matches, { query: '', recentIds: [] });
    expect(sections.map((section) => section.group)).toEqual([
      'Navigation',
      'Workspace',
      'Appearance',
      'Development',
    ]);
  });

  it('shows recent commands first without duplicating them', () => {
    const sections = groupCommands(matches, {
      query: '',
      recentIds: ['appearance.toggle-theme', 'navigation.library'],
    });

    expect(sections[0]?.group).toBe('Recent');
    expect(sections[0]?.commands.map((command) => command.id)).toEqual([
      'appearance.toggle-theme',
      'navigation.library',
    ]);

    const rest = sections.slice(1).flatMap((section) => section.commands.map((item) => item.id));
    expect(rest).not.toContain('navigation.library');
    expect(rest).not.toContain('appearance.toggle-theme');
  });

  it('leads with the group holding the best match when searching', () => {
    const searching = filterCommands(COMMANDS, 'rail', context);
    const sections = groupCommands(searching, { query: 'rail', recentIds: [] });

    expect(sections[0]?.group).toBe('Workspace');
  });
});
