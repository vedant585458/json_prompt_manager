import { ChevronDown } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';

import { controlVariants } from '@/components/ui/controlStyles';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'size' | 'children'> {
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  options: readonly SelectOption[];
  placeholder?: string;
}

/**
 * Select (TASK-003).
 *
 * A styled native `<select>`: it keeps platform keyboard behavior, form
 * semantics, and screen-reader support for free. A searchable combobox is a
 * different control and is not part of this task.
 */
export function Select({
  size,
  invalid = false,
  options,
  placeholder,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(controlVariants({ size, invalid }), 'appearance-none pr-9', className)}
        aria-invalid={invalid ? true : props['aria-invalid']}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={14}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
