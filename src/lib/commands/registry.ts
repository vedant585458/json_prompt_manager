/**
 * Command registry (TASK-009).
 *
 * One ordered, observable store of command definitions. Registration is checked
 * eagerly — duplicate ids and duplicate shortcuts throw — because a silent
 * collision would mean one of the two commands can never run. The palette, the
 * shortcut dispatcher, and the help overlay all read from this single list, so
 * there is no second place for a shortcut to be documented.
 *
 * Extensibility contract (for TASK-012 and later): a feature module defines its
 * commands with `createCommand`-shaped objects and registers them while its
 * screen is mounted. `when` decides availability from live context; returning
 * false hides the command from the palette *and* unbinds its shortcut. Commands
 * without shortcuts still appear in the palette; commands that are not
 * implemented yet must not be registered at all.
 */

import { parseShortcut, parsedShortcutOf, shortcutKey } from '@/lib/commands/shortcuts';
import { COMMAND_GROUPS, type CommandContext, type CommandDefinition } from '@/lib/commands/types';

export interface CommandRegistry {
  /** Returns an unregister function. Throws on duplicate id or shortcut. */
  register: (command: CommandDefinition) => () => void;
  /** Registers a batch; any failure rolls the whole batch back. */
  registerAll: (commands: readonly CommandDefinition[]) => () => void;
  get: (id: string) => CommandDefinition | undefined;
  /** Stable snapshot, ordered by group then title. */
  list: () => readonly CommandDefinition[];
  subscribe: (listener: () => void) => () => void;
  /** Empties the registry. For tests and hot reload; not called by the app. */
  clear: () => void;
}

function compareCommands(a: CommandDefinition, b: CommandDefinition): number {
  const groupDelta = COMMAND_GROUPS.indexOf(a.group) - COMMAND_GROUPS.indexOf(b.group);
  if (groupDelta !== 0) return groupDelta;
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

function assertValid(command: CommandDefinition): void {
  if (!command.id.trim()) throw new Error('A command needs a non-empty id.');
  if (!/\S/.test(command.id) || /\s/.test(command.id)) {
    throw new Error(`Command id "${command.id}" must not contain whitespace.`);
  }
  if (!COMMAND_GROUPS.includes(command.group)) {
    throw new Error(`Command "${command.id}" uses unknown group "${command.group}".`);
  }
  if (!command.title.trim()) throw new Error(`Command "${command.id}" needs a title.`);
  if (command.shortcut) parseShortcut(command.shortcut);
}

export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, CommandDefinition>();
  let snapshot: readonly CommandDefinition[] = [];
  const listeners = new Set<() => void>();

  function publish(): void {
    snapshot = [...commands.values()].sort(compareCommands);
    for (const listener of listeners) listener();
  }

  function assertNoConflict(command: CommandDefinition): void {
    if (commands.has(command.id)) {
      throw new Error(`Duplicate command id "${command.id}".`);
    }

    const shortcut = parsedShortcutOf(command);
    if (!shortcut) return;

    const key = shortcutKey(shortcut);
    for (const existing of commands.values()) {
      const existingShortcut = parsedShortcutOf(existing);
      if (existingShortcut && shortcutKey(existingShortcut) === key) {
        throw new Error(
          `Shortcut "${command.shortcut}" for "${command.id}" is already bound to "${existing.id}".`,
        );
      }
    }
  }

  function register(command: CommandDefinition): () => void {
    assertValid(command);
    assertNoConflict(command);

    commands.set(command.id, command);
    publish();

    return () => {
      // Only remove this exact registration: a re-registered command with the
      // same id must not be removed by a stale disposer (React StrictMode).
      if (commands.get(command.id) === command) {
        commands.delete(command.id);
        publish();
      }
    };
  }

  function registerAll(batch: readonly CommandDefinition[]): () => void {
    const disposers: (() => void)[] = [];
    try {
      for (const command of batch) disposers.push(register(command));
    } catch (error) {
      for (const dispose of disposers.reverse()) dispose();
      throw error;
    }

    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }

  return {
    register,
    registerAll,
    get: (id) => commands.get(id),
    list: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear: () => {
      commands.clear();
      publish();
    },
  };
}

/** The application registry. Tests create their own with `createCommandRegistry`. */
export const commandRegistry = createCommandRegistry();

/** Availability is a pure predicate over the live context. */
export function isCommandAvailable(command: CommandDefinition, context: CommandContext): boolean {
  return command.when ? command.when(context) : true;
}

export interface CommandRunner {
  /**
   * Runs a command exactly once per in-flight activation. Returns false when the
   * command was already running, which is how a double keydown or double click
   * is prevented from firing it twice.
   */
  run: (command: CommandDefinition, context: CommandContext) => Promise<boolean>;
  isRunning: (id: string) => boolean;
}

export function createCommandRunner(): CommandRunner {
  const inFlight = new Set<string>();

  return {
    isRunning: (id) => inFlight.has(id),
    run: async (command, context) => {
      if (inFlight.has(command.id)) return false;
      inFlight.add(command.id);
      try {
        await command.run(context);
        return true;
      } finally {
        inFlight.delete(command.id);
      }
    },
  };
}

/** Shared runner so the palette and the shortcut listener cannot double-fire. */
export const commandRunner = createCommandRunner();
