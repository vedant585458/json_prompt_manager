import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef } from 'react';

import { surfaceVariants } from '@/components/ui/surfaceVariants';
import { cn } from '@/lib/cn';

export interface SurfaceProps
  extends ComponentPropsWithRef<'div'>, VariantProps<typeof surfaceVariants> {}

/** Generic plane (TASK-003). */
export function Surface({ variant, padding, className, ...props }: SurfaceProps) {
  return <div className={cn(surfaceVariants({ variant, padding }), className)} {...props} />;
}

export interface CardProps extends SurfaceProps {
  /** Render as an article landmark when the card is self-contained content. */
  as?: 'div' | 'article' | 'section';
}

/** Content container built on Surface (TASK-003). */
export function Card({
  as: Tag = 'div',
  padding = 'md',
  variant = 'panel',
  className,
  ...props
}: CardProps) {
  return <Tag className={cn(surfaceVariants({ variant, padding }), className)} {...props} />;
}
