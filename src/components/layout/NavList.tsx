import { NavLink } from 'react-router-dom';

import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '@/components/layout/navigation';
import { cn } from '@/lib/cn';

export interface NavListProps {
  /** Icon-only rail: labels stay available to assistive technology. */
  readonly compact?: boolean;
  readonly onNavigate?: () => void;
  readonly className?: string;
}

function NavSection({
  heading,
  items,
  compact,
  onNavigate,
}: {
  heading: string;
  items: readonly NavItem[];
  compact: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <p
        className={cn(
          'px-3 pb-1.5 font-mono text-2xs tracking-[0.14em] text-ink-muted uppercase',
          compact && 'sr-only',
        )}
      >
        {heading}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                title={compact ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors duration-[var(--pf-duration-fast)]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    isActive
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
                    compact && 'justify-center px-0',
                  )
                }
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
                <span className={cn('truncate', compact && 'sr-only')}>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Navigation list (TASK-008).
 *
 * Shared by the desktop rail and the mobile drawer so both always offer the
 * same destinations. `NavLink` marks the current route with `aria-current`.
 */
export function NavList({ compact = false, onNavigate, className }: NavListProps) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div role="navigation" aria-label="Workspace">
        <NavSection
          heading="Workspace"
          items={PRIMARY_NAV}
          compact={compact}
          onNavigate={onNavigate}
        />
      </div>
      <div role="navigation" aria-label="Reference">
        <NavSection
          heading="Reference"
          items={SECONDARY_NAV}
          compact={compact}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
