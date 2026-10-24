import { cva } from 'class-variance-authority';

/**
 * Button recipe (TASK-003). Kept out of the component module so the component
 * file exports only React components, which keeps Fast Refresh reliable.
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap',
    'transition-colors duration-[var(--pf-duration-fast)] ease-[var(--pf-ease-out)]',
    'select-none disabled:cursor-not-allowed disabled:opacity-55',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent-fill text-accent-foreground hover:bg-accent-fill-hover',
        secondary: 'border border-line-control bg-surface-2 text-ink hover:bg-surface-3',
        ghost: 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
        danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-ink-inverse',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-11 px-5 text-base',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md', block: false },
  },
);
