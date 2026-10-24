import { cn } from '@/lib/cn';

/**
 * Loading indicator (TASK-003).
 *
 * Decorative by default because it usually sits next to a label that already
 * describes the pending action. Pass `label` when it is the only signal, which
 * promotes it to a `status` role for assistive technology.
 */
export function Spinner({
  size = 16,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
