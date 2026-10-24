import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import { NavList } from '@/components/layout/NavList';
import { StorageModeNote } from '@/components/layout/StorageModeBadge';
import { IconButton, Tooltip } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface SidebarProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

/**
 * Desktop navigation rail (TASK-008).
 *
 * 240 px expanded, 64 px collapsed. Collapsing hides labels visually but keeps
 * them as accessible names (`sr-only` plus `title`), so the rail never becomes a
 * row of mystery icons. The rail is hidden below `lg`, where `MobileNav` takes
 * over — the same `NavList` renders in both, so the two can't drift apart.
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      id="app-sidebar"
      aria-label="Workspace navigation"
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-1',
        'transition-[width] duration-[var(--pf-duration-base)] ease-[var(--pf-ease-out)]',
        'motion-reduce:transition-none lg:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-line px-3">
        <Link
          to="/"
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-sm px-1 py-1',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            collapsed && 'justify-center',
          )}
        >
          <span aria-hidden="true" className="font-mono text-md text-accent">
            {'{'}
          </span>
          <span
            className={cn(
              'truncate font-display text-sm font-semibold tracking-tight text-ink',
              collapsed && 'sr-only',
            )}
          >
            PromptForge
          </span>
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2.5 py-4">
        <NavList compact={collapsed} />
      </div>

      <div className="shrink-0 space-y-3 border-t border-line px-3 py-3">
        {collapsed ? null : <StorageModeNote />}
        <div className={cn('flex', collapsed ? 'justify-center' : 'justify-end')}>
          <Tooltip content={collapsed ? 'Expand navigation' : 'Collapse navigation'} side="right">
            <IconButton
              label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              onClick={onToggle}
              size="sm"
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
