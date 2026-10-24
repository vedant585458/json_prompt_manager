import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

export interface SeparatorProps extends ComponentPropsWithRef<'div'> {
  orientation?: 'horizontal' | 'vertical';
  /** Purely decorative separators are hidden from assistive technology. */
  decorative?: boolean;
}

/** Separator (TASK-003). */
export function Separator({
  orientation = 'horizontal',
  decorative = false,
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? 'presentation' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}
