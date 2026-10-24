import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Tooltip (TASK-003).
 *
 * Radix handles the hard parts: it opens on keyboard focus as well as hover,
 * closes on Escape, keeps `role="tooltip"` associated through
 * `aria-describedby`, and skips opening on touch long-press.
 *
 * Usage: `<Tooltip content="Copy path"><IconButton …/></Tooltip>`.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Hides the visual arrow while keeping the same accessible semantics. */
  hideArrow?: boolean;
}

export function Tooltip({ content, children, side = 'top', align = 'center' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-popover max-w-64 rounded-sm border border-line-strong bg-surface-3 px-2.5 py-1.5',
            'text-xs text-ink shadow-panel',
            'data-[state=delayed-open]:animate-fade-in',
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
