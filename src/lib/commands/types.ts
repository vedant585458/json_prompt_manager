/**
 * Command system types (TASK-009).
 *
 * A command is a declarative description of something the application can do:
 * what it is called, where it belongs in the palette, which keys reach it, when
 * it is available, and what it runs. Everything else in this folder builds on
 * these shapes — the registry stores them, the shortcut matcher dispatches them,
 * and the palette and help overlay render them.
 */

import type { ThemePreference } from '@/styles/theme';

/** Palette sections, in display order. */
export const COMMAND_GROUPS = [
  'General',
  'Navigation',
  'Workspace',
  'Appearance',
  'Development',
] as const;

export type CommandGroup = (typeof COMMAND_GROUPS)[number];

export type Platform = 'apple' | 'other';

/** One key combination. `mod` is ⌘ on Apple platforms and Ctrl elsewhere. */
export interface ShortcutChord {
  /** `event.key`, matched case-insensitively. */
  readonly key: string;
  readonly mod?: boolean;
  /** Literal Control, independent of the platform (rarely wanted). */
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
}

/** A single chord, or a two-step sequence such as `G` then `L`. */
export type Shortcut = readonly [ShortcutChord] | readonly [ShortcutChord, ShortcutChord];

/**
 * Everything a command may need to know or do at the moment it runs.
 *
 * The context is rebuilt from live state on every activation, so a command can
 * never act on a stale route or theme. Actions live here (instead of inside each
 * definition) so command tests can inject spies and so the definitions stay free
 * of React imports.
 */
export interface CommandContext {
  readonly pathname: string;
  /** True when focus is in an input, textarea, select, or contenteditable. */
  readonly isTyping: boolean;
  readonly paletteOpen: boolean;
  readonly helpOpen: boolean;
  readonly themePreference: ThemePreference;
  readonly railCollapsed: boolean;
  /** Development builds only; gates commands that exist for building the app. */
  readonly dev: boolean;
  readonly platform: Platform;
  navigate: (to: string) => void;
  setPaletteOpen: (open: boolean) => void;
  toggleTheme: () => void;
  toggleRail: () => void;
  setHelpOpen: (open: boolean) => void;
}

export interface CommandDefinition {
  /** Stable, namespaced id (`navigation.library`). Duplicates are rejected. */
  readonly id: string;
  readonly title: string;
  readonly group: CommandGroup;
  /** Secondary line in the palette; keep it short and factual. */
  readonly description?: string;
  /** Extra search terms that are not in the title. */
  readonly keywords?: readonly string[];
  /** `Mod+K`, `Shift+?`, or a sequence written as `G L`. Parsed and validated. */
  readonly shortcut?: string;
  /** Hides the command everywhere while it returns false. */
  readonly when?: (context: CommandContext) => boolean;
  /**
   * Some shortcuts must work while a field has focus (the palette's own
   * `Mod+K`). Everything else is ignored while typing.
   */
  readonly allowInInput?: boolean;
  readonly run: (context: CommandContext) => void | Promise<void>;
}
