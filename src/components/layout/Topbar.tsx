import { Keyboard, Menu, Search } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { routeLabel } from '@/components/layout/navigation';
import { StorageModeBadge } from '@/components/layout/StorageModeBadge';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button, IconButton, Kbd } from '@/components/ui';
import { PALETTE_SHORTCUT } from '@/lib/commands/coreCommands';
import {
  ariaKeyshortcuts,
  detectPlatform,
  parseShortcut,
  shortcutTokens,
} from '@/lib/commands/shortcuts';
import { useUiStore } from '@/store/uiStore';

export interface TopbarProps {
  readonly onOpenNav: () => void;
  readonly navOpen: boolean;
}

/**
 * Top bar (TASK-008).
 *
 * Breadcrumbs on the left, session status on the right. The search control is
 * rendered disabled with a written explanation: the command palette does not
 * exist yet (TASK-009), and a button that silently does nothing would be a lie.
 * There is deliberately no ⌘K hint for the same reason.
 */
export function Topbar({ onOpenNav, navOpen }: TopbarProps) {
  const { pathname } = useLocation();
  const label = routeLabel(pathname) ?? 'Not found';

  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const paletteShortcut = useMemo(() => parseShortcut(PALETTE_SHORTCUT), []);
  const paletteKeys = useMemo(
    () => shortcutTokens(paletteShortcut, detectPlatform())[0] ?? [],
    [paletteShortcut],
  );

  return (
    <header className="sticky top-0 z-sticky flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface-1 px-3 sm:gap-3 sm:px-4">
      <IconButton
        label="Open navigation"
        aria-expanded={navOpen}
        onClick={onOpenNav}
        className="lg:hidden"
      >
        <Menu size={18} />
      </IconButton>

      <Breadcrumbs className="hidden sm:block" />
      <p className="min-w-0 truncate text-xs text-ink-secondary sm:hidden">{label}</p>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Search commands"
          aria-keyshortcuts={ariaKeyshortcuts(paletteShortcut)}
          onClick={() => setPaletteOpen(true)}
          title="Search commands"
          className="gap-2"
        >
          <Search aria-hidden="true" size={14} />
          <span className="hidden md:inline">Search commands</span>
          <span className="hidden items-center gap-1 md:flex" aria-hidden="true">
            {paletteKeys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        </Button>

        <IconButton label="Keyboard shortcuts" onClick={() => setHelpOpen(true)}>
          <Keyboard size={16} />
        </IconButton>

        <StorageModeBadge className="hidden sm:inline-flex" />
        <ThemeToggle className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
