import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface RadioOption {
  value: string;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<
  ComponentPropsWithRef<typeof RadioGroupPrimitive.Root>,
  'children'
> {
  /** Accessible name for the group. */
  label: string;
  options: readonly RadioOption[];
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Radio group (TASK-003).
 *
 * Radix provides roving focus and arrow-key selection with a single tab stop,
 * which is the expected pattern for mutually exclusive choices.
 */
export function RadioGroup({
  label,
  options,
  orientation = 'vertical',
  className,
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      orientation={orientation}
      className={cn(
        'flex gap-3',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const optionId = `${props.name ?? 'radio'}-${option.value}-label`;
        return (
          <div key={option.value} className="flex items-start gap-2.5">
            <RadioGroupPrimitive.Item
              id={optionId}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                'mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-pill border border-line-control bg-surface-2',
                'transition-colors duration-[var(--pf-duration-fast)]',
                'data-[state=checked]:border-accent',
                'disabled:cursor-not-allowed disabled:opacity-55',
              )}
            >
              <RadioGroupPrimitive.Indicator className="block size-2 rounded-pill bg-accent" />
            </RadioGroupPrimitive.Item>
            <div className="min-w-0">
              <label htmlFor={optionId} className="text-sm leading-5 text-ink select-none">
                {option.label}
              </label>
              {option.hint ? <p className="mt-0.5 text-xs text-ink-muted">{option.hint}</p> : null}
            </div>
          </div>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
