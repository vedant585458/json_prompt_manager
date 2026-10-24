import { cn } from '@/lib/cn';

/**
 * Skip link (TASK-008).
 *
 * The first focusable element in the document. It stays visually hidden until
 * focused, then appears above the shell so keyboard users can bypass the
 * navigation rail without tabbing through every destination.
 */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only',
        'focus:fixed focus:top-3 focus:left-3 focus:z-popover',
        'focus:rounded-sm focus:border focus:border-accent focus:bg-surface-1',
        'focus:px-3 focus:py-2 focus:text-sm focus:text-ink',
      )}
    >
      Skip to content
    </a>
  );
}
