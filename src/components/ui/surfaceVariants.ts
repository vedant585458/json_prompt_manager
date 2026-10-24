import { cva } from 'class-variance-authority';

/** Surface plane recipe (TASK-003). */
export const surfaceVariants = cva('rounded-lg', {
  variants: {
    variant: {
      /** Bare plane, for grouping inside an existing panel. */
      flat: 'bg-surface-1',
      /** Page-level container with border and quiet elevation. */
      panel: 'border border-line bg-surface-1 shadow-panel',
      /** Recessed area such as a code or preview region. */
      sunken: 'border border-line bg-surface-sunken',
      /** Raised content block that reacts to hover; pair with a real control. */
      interactive: 'border border-line bg-surface-1 transition-colors hover:border-line-strong',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-5 sm:p-6',
    },
  },
  defaultVariants: { variant: 'panel', padding: 'none' },
});
