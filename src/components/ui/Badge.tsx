import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { badgeVariants } from '@/components/ui/badgeVariants';
import { cn } from '@/lib/cn';

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps
  extends ComponentPropsWithRef<'span'>, VariantProps<typeof badgeVariants> {
  /** Optional count or qualifier rendered after the label. */
  count?: number;
}

export function Badge({ tone, count, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {children}
      {typeof count === 'number' ? <span className="tabular">{count}</span> : null}
    </span>
  );
}

export interface StatusPillProps extends ComponentPropsWithRef<'span'> {
  tone: Exclude<BadgeTone, 'neutral'>;
  icon: ReactNode;
  children: ReactNode;
}

/**
 * StatusPill (TASK-003).
 *
 * Semantic status always pairs its color with an icon and a text label, so
 * meaning survives color-blindness, grayscale printing, and screen readers.
 */
export function StatusPill({ tone, icon, className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(badgeVariants({ tone }), 'gap-1.5 rounded-sm px-2 py-1 normal-case', className)}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
      {children}
    </span>
  );
}
