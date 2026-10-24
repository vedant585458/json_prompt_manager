import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { resolveToastDuration } from '@/components/ui/toast-duration';
import {
  ToastContext,
  type ToastApi,
  type ToastOptions,
  type ToastRecord,
  type ToastTone,
} from '@/components/ui/toast-context';
import { cn } from '@/lib/cn';

const MAX_VISIBLE_TOASTS = 3;

const TONE_ICON = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'border-success/40 bg-success-soft text-success',
  error: 'border-danger/45 bg-danger-soft text-danger',
  info: 'border-line-strong bg-surface-3 text-ink',
};

let toastCounter = 0;
function nextToastId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}`;
}

interface ToastItemProps {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}

/**
 * A single toast keeps its own countdown so hovering or focusing it pauses
 * *that* timer only, then resumes with the remaining time.
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const total = resolveToastDuration(toast);
  const [remaining, setRemaining] = useState(total);
  const [paused, setPaused] = useState(false);
  const startedAt = useRef(Date.now());
  const Icon = TONE_ICON[toast.tone];
  const visibleAction = toast.action;

  useEffect(() => {
    if (paused || total <= 0) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining);
    return () => {
      clearTimeout(timer);
      const elapsed = Date.now() - startedAt.current;
      setRemaining((current) => Math.max(current - elapsed, 0));
    };
    // `remaining` is intentionally excluded: it is read when the effect starts,
    // and pausing is what reschedules the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, toast.id, onDismiss, total]);

  const handleAction = useCallback(() => {
    visibleAction?.onClick();
    onDismiss(toast.id);
  }, [visibleAction, onDismiss, toast.id]);

  return (
    <div
      data-tone={toast.tone}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-md border p-3 shadow-panel',
        TONE_CLASS[toast.tone],
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{toast.description}</p>
        ) : null}
        {visibleAction ? (
          <Button
            size="sm"
            variant="secondary"
            className="mt-2.5"
            onClick={handleAction}
            data-toast-action="true"
          >
            {visibleAction.label}
          </Button>
        ) : null}
      </div>
      <IconButton
        label="Dismiss notification"
        size="sm"
        className="-mt-1 -mr-1 text-current hover:bg-transparent hover:text-current"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={14} />
      </IconButton>
    </div>
  );
}

/**
 * Toast provider (TASK-004).
 *
 * - One provider for the whole app; mounted in `src/app/App.tsx`.
 * - At most three toasts are visible; further notifications queue in order.
 * - Reusing an id updates the existing toast instead of duplicating it.
 * - Errors are announced assertively and clamp their auto-dismiss to 8 s;
 *   success and info messages are announced politely.
 * - Every toast can be dismissed by keyboard and pausing on focus stops the
 *   countdown, so screen-reader users are never raced by a vanishing message.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ visible: ToastRecord[]; queued: ToastRecord[] }>({
    visible: [],
    queued: [],
  });

  const dismiss = useCallback((id: string) => {
    setState((current) => {
      const visible = current.visible.filter((toast) => toast.id !== id);
      if (visible.length === current.visible.length) return current;

      // Promote the oldest queued toast only when a slot actually freed up.
      const [promoted, ...queued] = current.queued;
      return promoted
        ? { visible: [...visible, promoted], queued }
        : { visible, queued: current.queued };
    });
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = options.id ?? nextToastId();
    const record: ToastRecord = {
      ...options,
      id,
      tone: options.tone ?? 'info',
      createdAt: Date.now(),
    };

    setState((current) => {
      const visibleIndex = current.visible.findIndex((toast) => toast.id === id);
      if (visibleIndex !== -1) {
        const visible = [...current.visible];
        visible[visibleIndex] = record;
        return { ...current, visible };
      }

      const queued = current.queued.filter((toast) => toast.id !== id);
      if (current.visible.length < MAX_VISIBLE_TOASTS) {
        return { visible: [...current.visible, record], queued };
      }
      return { visible: current.visible, queued: [...queued, record] };
    });

    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (options) => show({ ...options, tone: 'success' }),
      error: (options) => show({ ...options, tone: 'error' }),
      info: (options) => show({ ...options, tone: 'info' }),
      dismiss,
      dismissAll: () => setState({ visible: [], queued: [] }),
    }),
    [show, dismiss],
  );

  const polite = state.visible.filter((toast) => toast.tone !== 'error');
  const assertive = state.visible.filter((toast) => toast.tone === 'error');

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Two regions so errors are announced immediately while ordinary
          confirmations stay polite. Both stay mounted for reliable announcements. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
        <div
          aria-live="assertive"
          aria-atomic="false"
          className="flex w-full flex-col gap-2 sm:max-w-sm"
        >
          {assertive.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
        <div
          aria-live="polite"
          aria-atomic="false"
          className="flex w-full flex-col gap-2 sm:max-w-sm"
        >
          {polite.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
