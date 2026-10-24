import { cva } from 'class-variance-authority';

/** Field hint/error text recipe (TASK-003). */
export const fieldMessageVariants = cva('mt-1.5 text-xs', {
  variants: {
    tone: {
      hint: 'text-ink-muted',
      error: 'text-danger',
    },
  },
  defaultVariants: { tone: 'hint' },
});
