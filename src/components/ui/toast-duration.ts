import {
  TOAST_DEFAULT_DURATION_MS,
  TOAST_MIN_ERROR_DURATION_MS,
  type ToastRecord,
} from '@/components/ui/toast-context';

/**
 * Auto-dismiss timing (TASK-004).
 *
 * Errors may never auto-dismiss earlier than the accessibility floor of 8 s,
 * even if a caller asks for less. Kept outside the provider module so the
 * provider file exports components only (Fast Refresh).
 */
export function resolveToastDuration(toast: Pick<ToastRecord, 'tone' | 'durationMs'>): number {
  const requested = toast.durationMs ?? TOAST_DEFAULT_DURATION_MS;
  if (toast.tone === 'error') return Math.max(requested, TOAST_MIN_ERROR_DURATION_MS);
  return Math.max(requested, 0);
}
