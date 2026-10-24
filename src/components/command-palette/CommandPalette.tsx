import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';

import { OVERLAY_ATTRIBUTE, restoreFocus, trackExternalFocus } from '@/components/ui/focus-return';
import { Kbd } from '@/components/ui/Kbd';
import { groupCommands, filterCommands } from '@/lib/commands/filter';
import {
  commandRegistry,
  commandRunner,
  type CommandRegistry,
  type CommandRunner,
} from '@/lib/commands/registry';
import { parsedShortcutOf, shortcutTokens } from '@/lib/commands/shortcuts';
import type { CommandContext, CommandDefinition } from '@/lib/commands/types';
import { useCommands } from '@/lib/commands/useCommand';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/store/uiStore';

/** Captures the opener once the portal mounts, so focus can go back to it. */
function FocusCapture({ openerRef }: { openerRef: RefObject<Element | null> }) {
  useLayoutEffect(() => {
    trackExternalFocus();
    openerRef.current = document.activeElement;
  }, [openerRef]);
  return null;
}

function ShortcutKeys({
  command,
  platform,
}: {
  command: CommandDefinition;
  platform: 'apple' | 'other';
}) {
  const shortcut = parsedShortcutOf(command);
  if (!shortcut) return null;

  return (
    <span className="ml-3 hidden shrink-0 items-center gap-1 sm:flex">
      {shortcutTokens(shortcut, platform).map((tokens, index) => (
        <span key={`${command.id}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <span className="text-2xs text-ink-muted">then</span> : null}
          {tokens.map((token) => (
            <Kbd key={`${command.id}-${index}-${token}`}>{token}</Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="px-3 py-8 text-center" role="status">
      <p className="text-sm font-medium text-ink">No commands match “{query.trim()}”</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-ink-muted">
        Try a screen name such as “library”, or an action such as “theme”. Commands that are not
        implemented yet are not listed.
      </p>
    </div>
  );
}

export interface CommandPaletteProps {
  /** Built from live application state; commands always see the current route. */
  readonly buildContext: () => CommandContext;
  readonly registry?: CommandRegistry;
  readonly runner?: CommandRunner;
}

/**
 * Command palette (TASK-009).
 *
 * A Radix dialog that keeps focus in the search field and moves a virtual
 * selection with the arrow keys (`aria-activedescendant`), which is the pattern
 * screen readers expect for a combobox-driven list. Results are grouped and
 * fuzzy-ranked; unavailable commands never appear. On phones it becomes a
 * full-screen sheet.
 *
 * Running a command closes the palette first (so focus returns to the opener)
 * and is guarded twice against duplicate activation: a local click/key ref and
 * the shared runner's in-flight set.
 */
export function CommandPalette({
  buildContext,
  registry = commandRegistry,
  runner = commandRunner,
}: CommandPaletteProps) {
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);
  const recentIds = useUiStore((state) => state.recentCommandIds);
  const pushRecent = useUiStore((state) => state.pushRecentCommand);

  const commands = useCommands(registry);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<Element | null>(null);
  const executingRef = useRef(false);

  const listId = useId();
  const context = open ? buildContext() : null;
  const platform = context?.platform ?? 'other';

  const matches = open && context ? filterCommands(commands, query, context) : [];
  const sections = open ? groupCommands(matches, { query, recentIds }) : [];
  const options = sections.flatMap((section) => section.commands);
  const activeCommand = options[Math.min(activeIndex, options.length - 1)] ?? null;
  const activeOptionId = activeCommand
    ? `${listId}-option-${options.indexOf(activeCommand)}`
    : undefined;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    executingRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!activeOptionId) return;
    const element = document.getElementById(activeOptionId);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [activeOptionId]);

  const runCommand = useCallback(
    (command: CommandDefinition) => {
      if (executingRef.current) return;
      executingRef.current = true;

      const nextContext = buildContext();
      setOpen(false);
      pushRecent(command.id);
      void runner.run(command, nextContext).catch((error: unknown) => {
        // Commands are local and synchronous today; a rejection here is a bug,
        // not a state the palette can recover from.
        console.error('Command failed', command.id, error);
      });
    },
    [buildContext, pushRecent, runner, setOpen],
  );

  const move = useCallback(
    (delta: number) => {
      if (options.length === 0) return;
      setActiveIndex((current) => {
        const next = current + delta;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
    },
    [options.length],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeCommand) runCommand(activeCommand);
      return;
    }
    if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleCloseAutoFocus = (event: Event) => {
    if (restoreFocus(openerRef.current)) event.preventDefault();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <FocusCapture openerRef={openerRef} />
        <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-overlay data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          {...{ [OVERLAY_ATTRIBUTE]: '' }}
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={handleCloseAutoFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            'fixed top-[10vh] left-1/2 z-modal flex w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col',
            'max-h-[70vh] overflow-hidden rounded-lg border border-line bg-surface-1 shadow-panel',
            'data-[state=open]:animate-fade-in focus:outline-none',
            // Phones: full-screen sheet, so the list is not a cramped sliver.
            'max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:rounded-none max-sm:border-0',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and run commands. Arrow keys move through the results, Enter runs the highlighted
            command, and Escape closes this dialog.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search aria-hidden="true" size={16} className="shrink-0 text-ink-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search commands…"
              aria-label="Search commands"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              className="h-8 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
            <kbd className="hidden shrink-0 rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-ink-muted sm:inline">
              Esc
            </kbd>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {options.length === 0 ? (
              <NoResults query={query} />
            ) : (
              <ul id={listId} role="listbox" aria-label="Commands" className="space-y-1">
                {sections.map((section) => (
                  <li key={section.group} role="presentation">
                    <p
                      aria-hidden="true"
                      className="px-2 pt-1.5 pb-1 font-mono text-2xs tracking-[0.12em] text-ink-muted uppercase"
                    >
                      {section.group}
                    </p>
                    <ul role="group" aria-label={section.group} className="space-y-0.5">
                      {section.commands.map((command) => {
                        const index = options.indexOf(command);
                        const isActive = index === activeIndex;
                        return (
                          <li
                            key={command.id}
                            id={`${listId}-option-${index}`}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => runCommand(command)}
                            onMouseMove={() => setActiveIndex(index)}
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2',
                              isActive ? 'bg-accent-soft text-accent' : 'text-ink',
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{command.title}</span>
                              {command.description ? (
                                <span
                                  className={cn(
                                    'mt-0.5 block truncate text-xs',
                                    isActive ? 'text-accent/80' : 'text-ink-muted',
                                  )}
                                >
                                  {command.description}
                                </span>
                              ) : null}
                            </span>
                            <ShortcutKeys command={command} platform={platform} />
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-3 py-2 text-2xs text-ink-muted">
            <span className="flex flex-wrap items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>to move</span>
              <Kbd>↵</Kbd>
              <span>to run</span>
            </span>
            <span>
              {options.length} command{options.length === 1 ? '' : 's'}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
