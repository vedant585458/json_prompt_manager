import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<
  ComponentPropsWithRef<typeof CheckboxPrimitive.Root>,
  'children'
> {
  label: ReactNode;
  hint?: string;
}

/**
 * Checkbox (TASK-003).
 *
 * Radix supplies the indeterminate/checked state machine, Space activation,
 * and `role="checkbox"`; the label is a real `<label>` so clicking the text
 * toggles the control.
 */
export function Checkbox({ label, hint, className, id, ...props }: CheckboxProps) {
  const controlId = id ?? props.name;
  const hintId = hint && controlId ? `${controlId}-hint` : undefined;

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <CheckboxPrimitive.Root
        id={controlId}
        aria-describedby={hintId}
        className={cn(
          'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-xs border border-line-control bg-surface-2',
          'transition-colors duration-[var(--pf-duration-fast)]',
          'data-[state=checked]:border-accent data-[state=checked]:bg-accent-fill',
          'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent-soft',
          'disabled:cursor-not-allowed disabled:opacity-55',
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-accent-foreground">
          {props.checked === 'indeterminate' ? (
            <Minus aria-hidden="true" size={12} strokeWidth={3} />
          ) : (
            <Check aria-hidden="true" size={12} strokeWidth={3} />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="min-w-0">
        <label
          htmlFor={controlId}
          className="text-sm leading-5 text-ink select-none has-disabled:cursor-not-allowed"
        >
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="mt-0.5 text-xs text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
