import { useEffect, useState } from 'react';

import { Button, Dialog, DialogContent } from '@/components/ui';
import type { SaveConflict } from '@/features/save/useSavePipeline';

/**
 * Stale-write resolution (TASK-015).
 *
 * A save only lands when it is based on the version in storage. When that is no
 * longer true the editor stops and asks, because both resolutions destroy
 * something: reloading drops the draft, keeping the draft overwrites the other
 * write. Neither happens without this dialog, and neither happens on a timeout.
 */

export interface SaveConflictDialogProps {
  readonly conflict: SaveConflict | null;
  readonly busy: boolean;
  readonly onReloadStored: () => void;
  readonly onKeepDraft: () => void;
  readonly onDismiss: () => void;
}

export function SaveConflictDialog({
  conflict,
  busy,
  onReloadStored,
  onKeepDraft,
  onDismiss,
}: SaveConflictDialogProps) {
  const [showStored, setShowStored] = useState(false);

  // A new conflict is a new question; do not inherit the previous preview state.
  useEffect(() => {
    setShowStored(false);
  }, [conflict?.detectedAt]);

  return (
    <Dialog
      open={Boolean(conflict)}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent
        title="This prompt changed in storage"
        description="Your draft was based on an older version, so saving it would overwrite a newer write. Choose which one to keep."
        footer={
          <>
            <Button variant="ghost" onClick={onDismiss} disabled={busy}>
              Decide later
            </Button>
            <Button variant="danger" onClick={onKeepDraft} disabled={busy}>
              Keep my draft as new content
            </Button>
            <Button variant="primary" onClick={onReloadStored} disabled={busy}>
              Reload the stored version
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-ink-muted">Your draft is based on</dt>
            <dd className="font-mono text-ink-secondary">version {conflict?.baseVersion ?? '—'}</dd>
            <dt className="text-ink-muted">Storage now holds</dt>
            <dd className="font-mono text-ink-secondary">
              version {conflict?.storedVersion ?? '—'}
            </dd>
          </dl>

          <p className="text-xs leading-relaxed text-ink-muted">
            <strong className="font-medium text-ink-secondary">Reload</strong> discards your draft
            and shows what is stored.{' '}
            <strong className="font-medium text-ink-secondary">Keep</strong> saves your draft over
            the stored version, as a new version — the other write is replaced but stays in the
            activity trail.
          </p>

          {conflict?.storedText ? (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showStored}
                onClick={() => setShowStored((open) => !open)}
              >
                {showStored ? 'Hide the stored version' : 'View the stored version'}
              </Button>

              {showStored ? (
                <div
                  role="region"
                  aria-label="The stored version"
                  tabIndex={0}
                  className="max-h-64 overflow-auto rounded-md border border-line bg-surface-1 p-3 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <pre className="font-mono text-2xs leading-relaxed whitespace-pre text-ink-secondary">
                    {conflict.storedText}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-2xs text-ink-muted">
              The stored version could not be read yet. Reloading retries the read; keeping the
              draft does not need it.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
