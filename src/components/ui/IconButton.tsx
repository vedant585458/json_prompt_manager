import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-sm',
    'transition-colors duration-[var(--pf-duration-fast)] ease-[var(--pf-ease-out)]',
    'select-none disabled:cursor-not-allowed disabled:opacity-55',
  ],
  {
    variants: {
      variant: {
        ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        secondary: 'border border-line-control bg-surface-2 text-ink hover:bg-surface-3',
        accent: 'bg-accent-fill text-accent-foreground hover:bg-accent-fill-hover',
      },
      size: {
        sm: 'size-7',
        md: 'size-9',
        lg: 'size-11',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends
    Omit<ComponentPropsWithRef<'button'>, 'children' | 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  /** Required: the icon is decorative, so this is the only accessible name. */
  label: string;
  children: ReactNode;
}

/** Square icon-only button (TASK-003). Always requires an accessible name. */
export function IconButton({
  label,
  variant,
  size,
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex">
        {children}
      </span>
    </button>
  );
}
