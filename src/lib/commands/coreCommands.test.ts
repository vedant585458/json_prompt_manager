import { describe, expect, it, vi } from 'vitest';

import { PALETTE_SHORTCUT, createCoreCommands } from '@/lib/commands/coreCommands';
import { registerPromptSnapshot, registerPromptValidation } from '@/lib/commands/promptActions';
import { createCommandRegistry, isCommandAvailable } from '@/lib/commands/registry';
import { createTestContext } from '@/test/commandContext';

const commands = createCoreCommands();
const byId = new Map(commands.map((command) => [command.id, command]));

function run(id: string, overrides: Parameters<typeof createTestContext>[0] = {}) {
  const command = byId.get(id);
  if (!command) throw new Error(`Missing command ${id}`);
  command.run(createTestContext(overrides));
  return command;
}

describe('core command catalogue', () => {
  it('registers without duplicate ids or shortcut collisions', () => {
    const registry = createCommandRegistry();
    expect(() => registry.registerAll(commands)).not.toThrow();
  });

  it('has a navigation command for every destination', () => {
    const navigation = commands.filter((command) => command.group === 'Navigation');
    expect(navigation.map((command) => command.id).sort()).toEqual([
      'navigation.composer',
      'navigation.dashboard',
      'navigation.design',
      'navigation.health',
      'navigation.library',
      'navigation.settings',
      'navigation.templates',
      'navigation.validation',
    ]);
  });

  it('only registers behaviour that exists today', () => {
    for (const unimplemented of [
      'prompt.create',
      'prompt.save',
      'prompt.delete',
      'editor.format',
      'prompt.import',
      'prompt.export',
      'validation.run',
      'history.diff',
    ]) {
      expect(byId.has(unimplemented)).toBe(false);
    }
  });

  it('offers the library create flows without claiming CRUD commands', () => {
    const navigate = vi.fn();

    run('prompt.new', { navigate });
    run('folder.new', { navigate });

    expect(navigate).toHaveBeenNthCalledWith(1, '/library?new=prompt');
    expect(navigate).toHaveBeenNthCalledWith(2, '/library?new=folder');
    expect(byId.get('prompt.new')?.group).toBe('Workspace');
    expect(byId.get('folder.new')?.group).toBe('Workspace');
  });

  it('only registers behaviour that exists today', () => {
    expect(PALETTE_SHORTCUT).toBe('Mod+K');
    expect(byId.get('palette.open')?.shortcut).toBe('Mod+K');
    expect(byId.get('help.shortcuts')?.shortcut).toBe('?');
    expect(byId.get('appearance.toggle-theme')?.shortcut).toBe('Mod+Shift+L');
    expect(byId.get('workspace.toggle-rail')?.shortcut).toBe('Mod+B');
    expect(byId.get('navigation.library')?.shortcut).toBe('G L');
  });

  it('lets the palette shortcut work while typing but not other shortcuts', () => {
    expect(byId.get('palette.open')?.allowInInput).toBe(true);
    expect(byId.get('help.shortcuts')?.allowInInput).toBeUndefined();
  });

  it('hides the development gallery outside development builds', () => {
    const gallery = byId.get('development.design-gallery');
    if (!gallery) throw new Error('Missing gallery command');

    expect(isCommandAvailable(gallery, createTestContext({ dev: true }))).toBe(true);
    expect(isCommandAvailable(gallery, createTestContext({ dev: false }))).toBe(false);
  });

  it('hides commands whose overlay is already open', () => {
    const palette = byId.get('palette.open');
    const help = byId.get('help.shortcuts');
    if (!palette || !help) throw new Error('Missing overlay commands');

    expect(isCommandAvailable(palette, createTestContext({ paletteOpen: true }))).toBe(false);
    expect(isCommandAvailable(help, createTestContext({ helpOpen: true }))).toBe(false);
  });
});

describe('TASK-013 commands', () => {
  it('opens the favorites and archive filters', () => {
    const navigate = vi.fn();

    run('library.favorites', { navigate });
    run('library.archived', { navigate });

    expect(navigate).toHaveBeenNthCalledWith(1, '/library?favorites=1');
    expect(navigate).toHaveBeenNthCalledWith(2, '/library?archived=1');
  });

  it('offers validation only while a workspace has registered it', () => {
    const command = byId.get('validation.validate-prompt');
    if (!command) throw new Error('Missing validation.validate-prompt');

    const cleanup = registerPromptValidation(() => undefined);
    try {
      expect(isCommandAvailable(command, createTestContext({ pathname: '/prompts/abc' }))).toBe(
        true,
      );
      expect(isCommandAvailable(command, createTestContext({ pathname: '/library' }))).toBe(false);

      const validatePrompt = vi.fn();
      run('validation.validate-prompt', { pathname: '/prompts/abc', validatePrompt });
      expect(validatePrompt).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }

    expect(isCommandAvailable(command, createTestContext({ pathname: '/prompts/abc' }))).toBe(
      false,
    );
  });

  it('offers snapshots and history only from a prompt workspace', () => {
    const snapshot = byId.get('history.snapshot');
    const open = byId.get('history.open');
    if (!snapshot || !open) throw new Error('Missing history commands');

    expect(isCommandAvailable(open, createTestContext({ pathname: '/prompts/abc' }))).toBe(true);
    expect(isCommandAvailable(open, createTestContext({ pathname: '/library' }))).toBe(false);
    // Already on the history screen: navigating "to" it again would do nothing.
    expect(isCommandAvailable(open, createTestContext({ pathname: '/prompts/abc/history' }))).toBe(
      false,
    );

    // The snapshot command exists only while a screen has registered a dialog.
    expect(isCommandAvailable(snapshot, createTestContext({ pathname: '/prompts/abc' }))).toBe(
      false,
    );
    const cleanup = registerPromptSnapshot(() => undefined);
    try {
      expect(isCommandAvailable(snapshot, createTestContext({ pathname: '/prompts/abc' }))).toBe(
        true,
      );
      expect(
        isCommandAvailable(snapshot, createTestContext({ pathname: '/prompts/abc/history' })),
      ).toBe(true);

      const saveSnapshot = vi.fn();
      run('history.snapshot', { pathname: '/prompts/abc', saveSnapshot });
      expect(saveSnapshot).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
    expect(isCommandAvailable(snapshot, createTestContext({ pathname: '/prompts/abc' }))).toBe(
      false,
    );

    const navigate = vi.fn();
    run('history.open', { pathname: '/prompts/abc', navigate });
    expect(navigate).toHaveBeenCalledWith('/prompts/abc/history');
  });

  it('opens a comparison from a prompt and from anywhere', () => {
    const compare = byId.get('diff.compare');
    const open = byId.get('diff.open');
    if (!compare || !open) throw new Error('Missing diff commands');

    expect(isCommandAvailable(compare, createTestContext({ pathname: '/prompts/p1' }))).toBe(true);
    expect(isCommandAvailable(compare, createTestContext({ pathname: '/library' }))).toBe(false);
    expect(
      isCommandAvailable(compare, createTestContext({ pathname: '/prompts/p1/history' })),
    ).toBe(false);
    expect(isCommandAvailable(open, createTestContext({ pathname: '/library' }))).toBe(true);

    const navigate = vi.fn();
    run('diff.compare', { pathname: '/prompts/p1', navigate });
    run('diff.open', { pathname: '/library', navigate });

    expect(navigate).toHaveBeenNthCalledWith(1, '/diff?prompt=p1');
    expect(navigate).toHaveBeenNthCalledWith(2, '/diff');
  });

  it('only offers the favorite toggle while a prompt is open', () => {
    const command = byId.get('prompt.toggle-favorite');
    if (!command) throw new Error('Missing prompt.toggle-favorite');

    expect(isCommandAvailable(command, createTestContext({ pathname: '/prompts/abc' }))).toBe(true);
    expect(isCommandAvailable(command, createTestContext({ pathname: '/library' }))).toBe(false);
    expect(isCommandAvailable(command, createTestContext({ pathname: '/prompts' }))).toBe(false);

    const togglePromptFavorite = vi.fn();
    run('prompt.toggle-favorite', {
      pathname: '/prompts/abc',
      togglePromptFavorite,
    });
    expect(togglePromptFavorite).toHaveBeenCalledTimes(1);
  });
});

describe('core command behaviour', () => {
  it('navigates through the router callback', () => {
    const navigate = vi.fn();
    run('navigation.library', { navigate });
    run('development.design-gallery', { navigate, dev: true });

    expect(navigate).toHaveBeenNthCalledWith(1, '/library');
    expect(navigate).toHaveBeenNthCalledWith(2, '/design');
  });

  it('opens the palette and the shortcut help', () => {
    const setPaletteOpen = vi.fn();
    const setHelpOpen = vi.fn();

    run('palette.open', { setPaletteOpen });
    run('help.shortcuts', { setHelpOpen });

    expect(setPaletteOpen).toHaveBeenCalledWith(true);
    expect(setHelpOpen).toHaveBeenCalledWith(true);
  });

  it('toggles the theme and the rail through their owners', () => {
    const toggleTheme = vi.fn();
    const toggleRail = vi.fn();

    run('appearance.toggle-theme', { toggleTheme });
    run('workspace.toggle-rail', { toggleRail });

    expect(toggleTheme).toHaveBeenCalledTimes(1);
    expect(toggleRail).toHaveBeenCalledTimes(1);
  });
});
