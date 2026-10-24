import type { CommandContext } from '@/lib/commands/types';

/** A complete command context for tests; override only what the case is about. */
export function createTestContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    pathname: '/',
    isTyping: false,
    paletteOpen: false,
    helpOpen: false,
    themePreference: 'system',
    railCollapsed: false,
    dev: true,
    platform: 'other',
    navigate: () => undefined,
    setPaletteOpen: () => undefined,
    toggleTheme: () => undefined,
    toggleRail: () => undefined,
    setHelpOpen: () => undefined,
    focusLibrarySearch: () => undefined,
    togglePromptFavorite: () => undefined,
    ...overrides,
  };
}
