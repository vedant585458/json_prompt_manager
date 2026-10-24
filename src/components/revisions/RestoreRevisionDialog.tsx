import { AlertTriangle } from 'lucide-react';

import { Button, Dialog, DialogContent } from '@/components/ui';
import { RESTORE_UNCHANGED_FIELDS, restoreImpact, summariseRevision } from '@/domain/revisions';
import type { Prompt, PromptRevision } from '@/domain/types';

export interface RestoreRevisionDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly revision: PromptRevision | null;
  readonly prompt: Prompt | null;
  readonly busy: boolean;
  /** Number the safety snapshot will receive, for the confirmation copy. */
  readonly safetyNumber: number;
  readonly onConfirm: () => void;
}

/**
 * Restore confirmation (TASK-019).
 *
 * The dialog's job is to describe the write before it happens: which fields
 * change and to what, which fields already match, and which fields a snapshot
 * never covered so they stay as they are. It also names the safety snapshot the
 * restore will take first, so "this can be undone" is a concrete statement
 * rather than a reassurance.
 *
 * The tone is destructive because the stored state is replaced — but the safety
 * snapshot is why the copy can promise the change is reversible.
 */
export function RestoreRevisionDialog({
  open,
  onOpenChange,
  revision,
  prompt,
  busy,
  safetyNumber,
  onConfirm,
}: RestoreRevisionDialogProps) {
  const summary = revision ? summariseRevision(revision) : null;
  const impact = revision && prompt ? restoreImpact(revision, prompt) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={summary ? `Restore snapshot ${summary.versionLabel}?` : 'Restore snapshot'}
        description="The stored prompt is replaced with this snapshot. The current state is saved first, so this can be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirm} disabled={busy || impact?.noop === true}>
              {impact?.noop ? 'Nothing to restore' : `Restore and save v${safetyNumber} first`}
            </Button>
          </>
        }
      >
        {!revision || !prompt || !impact || !summary ? (
          <p className="text-sm text-ink-secondary">
            This snapshot is no longer available. Close this dialog and pick another one.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-secondary">
              <p className="flex items-start gap-2 text-ink">
                <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 text-warning" />
                <span>
                  Snapshot <span className="font-mono">{summary.versionLabel}</span> was saved{' '}
                  {new Date(revision.createdAt).toLocaleString()}
                  {revision.label ? ` as “${revision.label}”` : ' without a label'}.
                </span>
              </p>
            </div>

            <section aria-labelledby="restore-changes" className="space-y-2">
              <h3 id="restore-changes" className="text-sm font-semibold text-ink">
                {impact.noop ? 'Nothing would change' : 'What will change'}
              </h3>
              {impact.noop ? (
                <p className="text-xs leading-relaxed text-ink-secondary">
                  Every field in this snapshot already matches the stored prompt, so there is
                  nothing to restore. Taking a new snapshot instead records the same state under a
                  new number.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs leading-relaxed">
                  {impact.changes.map((change) => (
                    <li key={change.field} className="rounded-sm border border-line px-2.5 py-1.5">
                      <span className="font-medium text-ink">{change.field}</span>
                      <span className="mt-0.5 block break-words text-ink-secondary">
                        <span className="text-ink-muted">now: </span>
                        {change.from}
                        <span aria-hidden="true" className="text-ink-muted">
                          {' → '}
                        </span>
                        <span className="text-ink-muted">after: </span>
                        {change.to}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {impact.unchanged.length > 0 ? (
                <p className="text-2xs leading-relaxed text-ink-muted">
                  Already identical: {impact.unchanged.join(', ')}.
                </p>
              ) : null}
            </section>

            <section aria-labelledby="restore-untouched" className="space-y-1.5">
              <h3 id="restore-untouched" className="text-sm font-semibold text-ink">
                What stays as it is
              </h3>
              <p className="text-xs leading-relaxed text-ink-secondary">
                A snapshot covers the document and the fields above.{' '}
                {RESTORE_UNCHANGED_FIELDS.join(', ')} are not part of it and are left untouched.
              </p>
            </section>

            <p className="rounded-md border border-info/40 bg-info-soft px-3 py-2 text-xs leading-relaxed text-ink-secondary">
              Before anything is replaced, the current state is saved as{' '}
              <span className="font-mono">v{safetyNumber}</span> (a safety snapshot). No snapshot is
              deleted by a restore.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
