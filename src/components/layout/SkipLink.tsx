import { cn } from '@/lib/cn';

/**
 * Skip link (TASK-008).
 *
 * The first focusable element in the document. It stays visually hidden until
 * focused, then appears above the shell so keyboard users can bypass the
 * navigation rail without tabbing through every destination.
 *
 * The click handler focuses the target explicitly. Browsers move focus on a
 * fragment navigation for some targets and not others, and a skip link that
 * scrolls without moving the caret leaves the next Tab press back at the top of
 * the page — the exact problem the link exists to avoid (TASK-028).
 */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      onClick={() => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.focus();
        // jsdom (and any environment without layout) has no scrollIntoView;
        // focusing is the part that matters for the next Tab press.
        if (typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ block: 'start' });
        }
      }}
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
