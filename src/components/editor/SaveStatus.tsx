import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Save,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';

import { Button, Kbd } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { SaveState } from '@/features/save/useSavePipeline';

/**
 * Save status for the prompt workspace (TASK-015).
 *
 * Every state is stated in words as well as colour, and the region is a polite
 * live region: a screen reader hears "Saving…" and later "Saved", in that order.
 * The component never renders "Saved" on its own authority — it renders the
 * state the pipeline derived from a resolved write.
 */

export interface SaveStatusProps {
  readonly state: SaveState;
  readonly lastSavedAt: string | null;
  readonly error: { readonly message: string; readonly detail: string | null } | null;
  /** True when a save would do something right now. */
  readonly canSave: boolean;
  readonly autosaveEnabled: boolean;
  readonly onSave: () => void;
  readonly onRetry: () => void;
  /**
   * Explains an explicit save that had nothing to write.
   *
   * Saving a clean draft is a no-op, and saying so is the difference between a
   * button that appears broken and one that reports it had nothing to do.
   */
  readonly notice?: string | null;
  /**
   * Whether Retry can plausibly help. A refused document fails the same way
   * until it is fixed, so the bar asks the user to fix it instead of offering a
   * control that cannot do anything.
   */
  readonly retryable?: boolean;
  /** Why the explicit save is unavailable; shown as the button's description. */
  readonly disabledReason?: string | null;
  /** Re-opens storage when it failed to open; renders "Try storage again". */
  readonly onReconnect?: (() => void) | null;
}

const SHORTCUT = '⌘S';

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';

  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface Presentation {
  readonly label: string;
  readonly detail: string | null;
  readonly icon: typeof Save;
  readonly tone: string;
}

function present(
  state: SaveState,
  lastSavedAt: string | null,
  error: SaveStatusProps['error'],
  autosaveEnabled: boolean,
): Presentation {
  switch (state) {
    case 'saving':
      return {
        label: 'Saving…',
        detail: 'Writing to this browser. Nothing is confirmed until the write resolves.',
        icon: Loader2,
        tone: 'text-ink-secondary',
      };
    case 'saved':
      return {
        label: lastSavedAt ? `Saved at ${formatSavedAt(lastSavedAt)}` : 'Saved',
        detail: 'Stored in this browser.',
        icon: CheckCircle2,
        tone: 'text-success',
      };
    case 'dirty':
      return {
        label: 'Unsaved changes',
        detail: autosaveEnabled
          ? 'Autosave writes after you stop typing.'
          : `Autosave is off. Press ${SHORTCUT} to save.`,
        icon: CircleDashed,
        tone: 'text-warning',
      };
    case 'error':
      return {
        label: 'Not saved',
        detail: error?.message ?? 'The last write did not complete.',
        icon: AlertTriangle,
        tone: 'text-danger',
      };
    case 'conflict':
      return {
        label: 'Not saved — the stored version changed',
        detail: 'Choose which version to keep. Nothing is overwritten until you do.',
        icon: ShieldAlert,
        tone: 'text-danger',
      };
    case 'disabled':
      return {
        label: 'Saving is off',
        detail: 'Storage did not open. Drafts stay in this browser, but nothing is persisted.',
        icon: WifiOff,
        tone: 'text-warning',
      };
    case 'clean':
    default:
      return {
        label: 'No unsaved changes',
        detail: null,
        icon: Save,
        tone: 'text-ink-muted',
      };
  }
}

export function SaveStatus({
  state,
  lastSavedAt,
  error,
  canSave,
  autosaveEnabled,
  onSave,
  onRetry,
  notice = null,
  retryable = true,
  disabledReason = null,
  onReconnect = null,
}: SaveStatusProps) {
  const { label, detail, icon: Icon, tone } = present(state, lastSavedAt, error, autosaveEnabled);
  const reasonId = 'save-status-disabled-reason';
  const shownDetail = notice ?? detail;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-surface-2 px-3 py-2"
    >
      <span className={cn('flex items-center gap-1.5 text-xs font-medium', tone)}>
        <Icon
          aria-hidden="true"
          size={13}
          className={state === 'saving' ? 'motion-safe:animate-spin' : undefined}
        />
        {label}
      </span>

      {shownDetail ? (
        <span className="text-2xs leading-relaxed text-ink-muted">{shownDetail}</span>
      ) : null}

      {state === 'error' && error?.detail ? (
        <span className="basis-full font-mono text-2xs break-words text-ink-muted">
          {error.detail}
        </span>
      ) : null}

      {state === 'error' && !retryable ? (
        <span className="basis-full text-2xs leading-relaxed text-ink-muted">
          Fix the document above, then save again — retrying the same text would fail the same way.
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {state === 'error' && retryable ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {state === 'disabled' && onReconnect ? (
          <Button variant="secondary" size="sm" onClick={onReconnect}>
            Try storage again
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          disabled={!canSave}
          {...(disabledReason && !canSave
            ? { title: disabledReason, 'aria-describedby': reasonId }
            : {})}
        >
          <Save aria-hidden="true" size={12} />
          Save now
          <Kbd aria-hidden="true">{SHORTCUT}</Kbd>
        </Button>
        {disabledReason && !canSave ? (
          <span id={reasonId} className="sr-only">
            {disabledReason}
          </span>
        ) : null}
      </div>
    </div>
  );
}
