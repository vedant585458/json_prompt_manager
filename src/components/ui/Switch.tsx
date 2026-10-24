import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface SwitchProps extends Omit<
  ComponentPropsWithRef<typeof SwitchPrimitive.Root>,
  'children'
> {
  label: ReactNode;
  hint?: string;
}

/**
 * Switch (TASK-003).
 *
 * Uses `role="switch"` with `aria-checked`, so state is announced rather than
 * implied by the track color alone.
 */
export function Switch({ label, hint, className, id, ...props }: SwitchProps) {
  const controlId = id ?? props.name;
  const hintId = hint && controlId ? `${controlId}-hint` : undefined;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={controlId} className="text-sm leading-5 text-ink select-none">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="mt-0.5 text-xs text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <SwitchPrimitive.Root
        id={controlId}
        aria-describedby={hintId}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border border-line-control bg-surface-3',
          'transition-colors duration-[var(--pf-duration-fast)]',
          'data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft',
          'disabled:cursor-not-allowed disabled:opacity-55',
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block size-3.5 rounded-pill bg-ink-secondary shadow-sm',
            'translate-x-0.5 transition-transform duration-[var(--pf-duration-fast)] ease-[var(--pf-ease-out)]',
            'data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent',
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
