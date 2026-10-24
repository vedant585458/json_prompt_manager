import { useEffect } from 'react';

import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { ShortcutHelpDialog } from '@/components/layout/ShortcutHelpDialog';
import { ensureCoreCommands } from '@/lib/commands/coreCommands';
import { useCommandEnvironment, useShortcutListener } from '@/lib/commands/useCommand';

/**
 * Command layer (TASK-009).
 *
 * Mounts the single global shortcut listener, registers the core commands for
 * as long as the shell is alive, and renders the palette and shortcut help. It
 * sits inside the shell so every route — and only real app routes — gets them.
 */
export function CommandLayer() {
  const { buildContext } = useCommandEnvironment();

  useEffect(() => {
    ensureCoreCommands();
  }, []);

  useShortcutListener(buildContext);

  return (
    <>
      <CommandPalette buildContext={buildContext} />
      <ShortcutHelpDialog buildContext={buildContext} />
    </>
  );
}
