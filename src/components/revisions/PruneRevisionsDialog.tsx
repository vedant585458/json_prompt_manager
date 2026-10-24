import { useEffect, useState } from 'react';

import { Button, Dialog, DialogContent, Field, Select } from '@/components/ui';
import { PRUNE_KEEP_OPTIONS, prunePlan } from '@/domain/revisions';
import type { PromptRevision } from '@/domain/types';

export interface PruneRevisionsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly revisions: readonly PromptRevision[];
  readonly busy: boolean;
  readonly onConfirm: (keep: number) => void;
}

/**
 * Prune old snapshots (TASK-019).
 *
 * Pruning is explicitly opt-in and never automatic: the dialog shows how many
 * snapshots would be removed and how many would stay *before* the button is
 * pressed, because "delete some history" is exactly the kind of action that
 * should never be described only after the fact.
 */
export function PruneRevisionsDialog({
  open,
  onOpenChange,
  revisions,
  busy,
  onConfirm,
}: PruneRevisionsDialogProps) {
  const [keep, setKeep] = useState<number>(PRUNE_KEEP_OPTIONS[1] ?? 25);

  useEffect(() => {
    if (!open) return;
    // Start at the smallest option that would actually remove something, so the
    // dialog is useful on its first render.
    const firstUseful = PRUNE_KEEP_OPTIONS.find(
      (option) => prunePlan(revisions, option).removalCount > 0,
    );
    setKeep(firstUseful ?? PRUNE_KEEP_OPTIONS[PRUNE_KEEP_OPTIONS.length - 1] ?? 25);
  }, [open, revisions]);

  const plan = prunePlan(revisions, keep);
  const nothingToRemove = plan.removalCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Prune old snapshots"
        description="Removes the oldest snapshots of this prompt. The newest ones stay, and nothing else in the library is touched."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => onConfirm(keep)}
              disabled={busy || nothingToRemove}
            >
              {nothingToRemove ? 'Nothing to remove' : `Remove ${plan.removalCount}`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Snapshots to keep"
            hint="The newest snapshots are kept. Remaining snapshots keep their original numbers, so gaps are expected."
          >
            {(control) => (
              <Select
                {...control}
                value={String(keep)}
                onChange={(event) => setKeep(Number(event.target.value))}
                options={PRUNE_KEEP_OPTIONS.map((option) => ({
                  value: String(option),
                  label: `Keep the newest ${option}`,
                }))}
              />
            )}
          </Field>

          <div role="status" className="rounded-md border border-line bg-surface-2 px-3 py-2">
            <p className="text-xs leading-relaxed text-ink-secondary">
              {nothingToRemove ? (
                <>
                  This history holds {revisions.length}{' '}
                  {revisions.length === 1 ? 'snapshot' : 'snapshots'}, which is more than this limit
                  keeps would remove nothing. Choose a smaller number to prune.
                </>
              ) : (
                <>
                  <span className="font-medium text-ink">{plan.removalCount}</span>{' '}
                  {plan.removalCount === 1 ? 'snapshot' : 'snapshots'} will be removed and{' '}
                  <span className="font-medium text-ink">{plan.keep.length}</span> kept. The oldest
                  affected {plan.removalCount === 1 ? 'is' : 'are'}{' '}
                  {plan.remove.map((revision) => `v${revision.revisionNumber}`).join(', ')}.
                </>
              )}
            </p>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-muted">
              This cannot be undone. Pruning never removes the newest snapshot, and it never touches
              the prompt itself.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
