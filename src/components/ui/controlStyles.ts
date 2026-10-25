import { cva } from 'class-variance-authority';

/**
 * Shared visual treatment for text-entry controls (TASK-003).
 * Kept in one place so Input, Textarea, and Select cannot drift apart.
 */
export const controlVariants = cva(
  [
    'w-full rounded-sm border bg-surface-2 text-ink placeholder:text-ink-muted',
    'transition-colors duration-[var(--pf-duration-fast)]',
    'disabled:cursor-not-allowed disabled:opacity-70',
    'aria-invalid:border-danger',
  ],
  {
    variants: {
      size: {
        sm: 'min-h-8 px-2.5 py-1.5 text-xs',
        md: 'min-h-9 px-3 py-2 text-sm',
        lg: 'min-h-11 px-3.5 py-2.5 text-base',
      },
      invalid: {
        true: 'border-danger',
        false: 'border-line-control hover:border-line-strong',
      },
    },
    defaultVariants: { size: 'md', invalid: false },
  },
);
