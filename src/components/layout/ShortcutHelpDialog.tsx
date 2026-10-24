import { Dialog, DialogClose, DialogContent } from '@/components/ui';
import { Kbd } from '@/components/ui/Kbd';
import { Button } from '@/components/ui/Button';
import { commandRegistry, isCommandAvailable, type CommandRegistry } from '@/lib/commands/registry';
import { parsedShortcutOf, shortcutTokens } from '@/lib/commands/shortcuts';
import type { CommandContext } from '@/lib/commands/types';
import { useCommands } from '@/lib/commands/useCommand';
import { COMMAND_GROUPS } from '@/lib/commands/types';
import { useUiStore } from '@/store/uiStore';

export interface ShortcutHelpDialogProps {
  readonly buildContext: () => CommandContext;
  readonly registry?: CommandRegistry;
}

/**
 * Keyboard shortcut reference (TASK-009).
 *
 * Generated from the command registry at open time — there is no hand-written
 * list that can drift out of date. Only available commands are shown, so a
 * shortcut cannot be advertised for something that would not run.
 */
export function ShortcutHelpDialog({
  buildContext,
  registry = commandRegistry,
}: ShortcutHelpDialogProps) {
  const open = useUiStore((state) => state.helpOpen);
  const setOpen = useUiStore((state) => state.setHelpOpen);
  const commands = useCommands(registry);

  const context = buildContext();
  const withShortcuts = commands.filter(
    (command) => parsedShortcutOf(command) !== null && isCommandAvailable(command, context),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        title="Keyboard shortcuts"
        description="Every shortcut this build registers, read from the same registry the palette and the global listener use."
        size="lg"
        footer={
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        }
      >
        <p className="text-xs leading-relaxed text-ink-muted">
          Shortcuts are ignored while you are typing in a field, except the palette’s own{' '}
          <Kbd>Mod</Kbd>+<Kbd>K</Kbd>. Two-step shortcuts must be pressed in order, without
          modifiers.
        </p>

        <div className="mt-4 space-y-4">
          {COMMAND_GROUPS.map((group) => {
            const inGroup = withShortcuts.filter((command) => command.group === group);
            if (inGroup.length === 0) return null;

            return (
              <section key={group} aria-labelledby={`shortcuts-${group}`}>
                <h3
                  id={`shortcuts-${group}`}
                  className="font-mono text-2xs tracking-[0.12em] text-ink-muted uppercase"
                >
                  {group}
                </h3>
                <ul className="mt-1.5 divide-y divide-line/60">
                  {inGroup.map((command) => {
                    const shortcut = parsedShortcutOf(command);
                    if (!shortcut) return null;

                    return (
                      <li
                        key={command.id}
                        className="flex items-center justify-between gap-4 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block text-ink">{command.title}</span>
                          {command.description ? (
                            <span className="mt-0.5 block text-xs text-ink-muted">
                              {command.description}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {shortcutTokens(shortcut, context.platform).map((tokens, index) => (
                            <span
                              key={`${command.id}-${index}`}
                              className="flex items-center gap-1"
                            >
                              {index > 0 ? (
                                <span className="text-2xs text-ink-muted">then</span>
                              ) : null}
                              {tokens.map((token) => (
                                <Kbd key={`${command.id}-${index}-${token}`}>{token}</Kbd>
                              ))}
                            </span>
                          ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
