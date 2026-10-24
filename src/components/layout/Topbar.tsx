import { Menu, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { routeLabel } from '@/components/layout/navigation';
import { StorageModeBadge } from '@/components/layout/StorageModeBadge';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button, IconButton } from '@/components/ui';

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
          disabled
          aria-describedby="search-unavailable"
          title="Search and the command palette arrive in TASK-009."
          className="hidden gap-2 md:inline-flex"
        >
          <Search aria-hidden="true" size={14} />
          Search
        </Button>
        <span id="search-unavailable" className="sr-only">
          Search is not available yet: the command palette ships in TASK-009. Nothing on this screen
          can be searched.
        </span>

        <StorageModeBadge className="hidden sm:inline-flex" />
        <ThemeToggle className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
