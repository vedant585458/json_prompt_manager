import type { ComponentPropsWithRef, ReactNode } from 'react';

import { controlVariants } from '@/components/ui/controlStyles';
import { cn } from '@/lib/cn';

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  /** Leading adornment, e.g. an icon. Purely decorative. */
  adornment?: ReactNode;
}

export function Input({ size, invalid = false, className, adornment, ...props }: InputProps) {
  const input = (
    <input
      className={cn(controlVariants({ size, invalid }), adornment && 'pl-9', className)}
      aria-invalid={invalid ? true : props['aria-invalid']}
      {...props}
    />
  );

  if (!adornment) return input;

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 text-ink-muted"
      >
        {adornment}
      </span>
      {input}
    </div>
  );
}
