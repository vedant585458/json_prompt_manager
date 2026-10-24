import { useEffect, useState } from 'react';

import { Button, Dialog, DialogContent, Field, Input } from '@/components/ui';
import { MAX_REVISION_LABEL_LENGTH, checkRevisionLabel } from '@/domain/revisions';

export interface SnapshotDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly promptTitle: string;
  /** True when the editor holds unsaved text that would not be in the snapshot. */
  readonly dirty?: boolean;
  /**
   * Saves the draft first; resolves to whether the write landed. Required only
   * when `dirty` can be true — the history screen has no draft at all.
   */
  readonly onSaveDraft?: () => Promise<boolean>;
  readonly onSnapshot: (
    label: string | null,
  ) => Promise<{ readonly ok: boolean; readonly reason?: string }>;
}

/**
 * "Save snapshot" (TASK-019).
 *
 * A snapshot captures the **stored** prompt, so a dirty draft cannot be part of
 * one. When the draft is dirty the dialog says so and offers to save it first —
 * a second, real operation rather than a button that quietly does nothing.
 */
export function SnapshotDialog({
  open,
  onOpenChange,
  promptTitle,
  dirty = false,
  onSaveDraft,
  onSnapshot,
}: SnapshotDialogProps) {
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel('');
    setFailure(null);
    setPending(false);
  }, [open]);

  const labelError = checkRevisionLabel(label);
  const willSaveFirst = dirty;
  const canSubmit = labelError === null && !pending;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    setFailure(null);

    try {
      if (willSaveFirst) {
        const saved = onSaveDraft ? await onSaveDraft() : false;
        if (!saved) {
          setFailure('The draft could not be saved, so no snapshot was taken.');
          return;
        }
      }

      const result = await onSnapshot(label.trim().length > 0 ? label.trim() : null);
      if (!result.ok) {
        setFailure(result.reason ?? 'The snapshot could not be stored.');
        return;
      }

      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Save a snapshot"
        description={`Stores the current state of “${promptTitle}” — document, title, description, tags, and variables — in this browser's history.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {willSaveFirst ? 'Save draft, then snapshot' : 'Save snapshot'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="space-y-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-secondary">
            <li>The document, title, description, tags, and variables are captured together.</li>
            <li>Restoring it later is protected by a safety snapshot of the state it replaces.</li>
            <li>Autosave never creates a snapshot; only this action does.</li>
            <li>
              Folder, collections, status, pin, favorite, archive, and the attached schema are not
              part of a snapshot.
            </li>
          </ul>

          {dirty ? (
            <p
              role="status"
              className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs leading-relaxed text-ink-secondary"
            >
              This draft has unsaved changes. They are not in storage yet, so they cannot be in the
              snapshot — saving the draft first is part of this action.
            </p>
          ) : null}

          <Field
            label="Label"
            hint="Optional. Something you will recognise later, for example “before the rewrite”."
            error={labelError ?? undefined}
          >
            {(control) => (
              <Input
                {...control}
                value={label}
                maxLength={MAX_REVISION_LABEL_LENGTH}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Before the rewrite"
                autoComplete="off"
              />
            )}
          </Field>

          {failure ? (
            <p role="alert" className="text-xs text-danger">
              {failure}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
