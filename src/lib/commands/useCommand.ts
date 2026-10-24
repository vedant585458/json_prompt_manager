/**
 * React bindings for the command system (TASK-009).
 *
 * - `useCommandEnvironment` turns live application state into a context factory,
 *   so a command always sees the current route, theme, and panel state.
 * - `useCommands` subscribes to the registry for the palette and help overlay.
 * - `useShortcutListener` owns the one global `keydown` listener.
 * - `useCommand` exposes a single command as a callback for future toolbars and
 *   menu items (TASK-012+), with the same availability rules.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useTheme } from '@/app/providers/theme-context';
import { focusLibrarySearch } from '@/lib/commands/librarySearchFocus';
import {
  openPromptSnapshot,
  openPromptValidation,
  togglePromptFavorite,
} from '@/lib/commands/promptActions';
import { isWithinOverlay } from '@/lib/overlay';
import {
  commandRegistry,
  commandRunner,
  isCommandAvailable,
  type CommandRegistry,
  type CommandRunner,
} from '@/lib/commands/registry';
import { createShortcutMatcher, detectPlatform, isTypingTarget } from '@/lib/commands/shortcuts';
import type { CommandContext, CommandDefinition } from '@/lib/commands/types';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';

export interface CommandEnvironment {
  readonly buildContext: () => CommandContext;
}

/**
 * Builds a fresh `CommandContext` on demand.
 *
 * Reads go through `getState()` rather than render-captured values so a command
 * activated a moment later (or from a timer) still sees the truth.
 */
export function useCommandEnvironment(): CommandEnvironment {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setPreference } = useTheme();
  const platform = useMemo(() => detectPlatform(), []);

  const buildContext = useCallback((): CommandContext => {
    const ui = useUiStore.getState();
    const preferences = usePreferencesStore.getState();

    return {
      pathname,
      isTyping: isTypingTarget(document.activeElement),
      paletteOpen: ui.paletteOpen,
      helpOpen: ui.helpOpen,
      themePreference: preferences.themePreference,
      railCollapsed: !ui.sidebarOpen,
      dev: import.meta.env.DEV,
      platform,
      navigate: (to) => navigate(to),
      setPaletteOpen: (open) => useUiStore.getState().setPaletteOpen(open),
      toggleTheme: () => setPreference(preferences.resolvedTheme === 'dark' ? 'light' : 'dark'),
      toggleRail: () => useUiStore.getState().toggleSidebar(),
      setHelpOpen: (open) => useUiStore.getState().setHelpOpen(open),
      focusLibrarySearch: () => {
        focusLibrarySearch();
      },
      togglePromptFavorite: () => {
        togglePromptFavorite();
      },
      validatePrompt: () => {
        openPromptValidation();
      },
      saveSnapshot: () => {
        openPromptSnapshot();
      },
    };
  }, [navigate, pathname, platform, setPreference]);

  return useMemo(() => ({ buildContext }), [buildContext]);
}

/** Live list of registered commands, stable between registry mutations. */
export function useCommands(
  registry: CommandRegistry = commandRegistry,
): readonly CommandDefinition[] {
  return useSyncExternalStore(registry.subscribe, registry.list, registry.list);
}

/**
 * The single global keyboard listener.
 *
 * It ignores auto-repeat, consumed events, overlays (they own their keys),
 * everything while the palette or help overlay is open, and — except for
 * commands explicitly marked `allowInInput` — everything typed into a field.
 */
export function useShortcutListener(
  buildContext: () => CommandContext,
  registry: CommandRegistry = commandRegistry,
  runner: CommandRunner = commandRunner,
): void {
  const builderRef = useRef(buildContext);

  useEffect(() => {
    builderRef.current = buildContext;
  }, [buildContext]);

  useEffect(() => {
    const matcher = createShortcutMatcher();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;

      const context = builderRef.current();
      if (context.paletteOpen || context.helpOpen) return;
      if (isWithinOverlay(document.activeElement)) return;

      const commands = registry
        .list()
        .filter(
          (command) =>
            isCommandAvailable(command, context) && (command.allowInInput || !context.isTyping),
        );

      const match = matcher.match(event, commands, context.platform, Date.now());
      if (!match) return;

      // A pending sequence still consumes the key so it cannot leak into the page.
      event.preventDefault();
      if (match.kind === 'pending') return;

      void runner.run(match.command, context);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      matcher.reset();
    };
  }, [registry, runner]);
}

/**
 * Runs one command by id with the current context.
 *
 * Returns false when the command is unknown or currently unavailable, so a
 * caller can decide to hide its own control rather than call a no-op.
 */
export function useCommand(
  id: string,
  registry: CommandRegistry = commandRegistry,
  runner: CommandRunner = commandRunner,
): () => Promise<boolean> {
  const { buildContext } = useCommandEnvironment();

  return useCallback(async () => {
    const command = registry.get(id);
    if (!command) return false;

    const context = buildContext();
    if (!isCommandAvailable(command, context)) return false;

    return runner.run(command, context);
  }, [buildContext, id, registry, runner]);
}
