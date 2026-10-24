import { describe, expect, it, vi } from 'vitest';

import { PALETTE_SHORTCUT, createCoreCommands } from '@/lib/commands/coreCommands';
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

  it('binds the palette, help, theme, and rail shortcuts', () => {
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
