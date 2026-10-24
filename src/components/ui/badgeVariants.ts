import { cva } from 'class-variance-authority';

/** Badge and status-pill recipe (TASK-003). */
export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 font-mono text-2xs tracking-wide uppercase',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-2 text-ink-secondary',
        accent: 'border-accent/40 bg-accent-soft text-accent',
        success: 'border-success/35 bg-success-soft text-success',
        warning: 'border-warning/35 bg-warning-soft text-warning',
        danger: 'border-danger/35 bg-danger-soft text-danger',
        info: 'border-info/35 bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);
