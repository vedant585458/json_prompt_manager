import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface KbdProps extends ComponentPropsWithRef<'kbd'> {
  children: ReactNode;
}

/** Keyboard key or shortcut hint (TASK-003). */
export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-surface-2 px-1.5',
        'font-mono text-2xs text-ink-secondary',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

/** Renders a platform-appropriate modifier label, e.g. ⌘K or Ctrl K. */
export function ShortcutHint({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? (
            <span aria-hidden="true" className="text-2xs text-ink-muted">
              +
            </span>
          ) : null}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}
