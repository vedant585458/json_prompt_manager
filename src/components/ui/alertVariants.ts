import { cva } from 'class-variance-authority';

/** Alert tone recipe (TASK-004). */
export const alertVariants = cva('flex items-start gap-3 rounded-md border p-3 text-sm', {
  variants: {
    tone: {
      info: 'border-info/30 bg-info-soft text-info',
      success: 'border-success/30 bg-success-soft text-success',
      warning: 'border-warning/30 bg-warning-soft text-warning',
      danger: 'border-danger/35 bg-danger-soft text-danger',
    },
  },
  defaultVariants: { tone: 'info' },
});
