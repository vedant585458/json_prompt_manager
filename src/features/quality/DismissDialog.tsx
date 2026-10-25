import { useState } from 'react';

import { Button, Dialog, DialogContent, Field, Textarea } from '@/components/ui';
import { QUALITY_LIMITS, type QualityFinding } from '@/domain/quality';

export interface DismissDialogProps {
  readonly finding: QualityFinding | null;
  readonly onCancel: () => void;
  /** Returns an error message, or null when the dismissal was stored. */
  readonly onConfirm: (finding: QualityFinding, reason: string) => string | null;
}

/**
 * Dismiss a finding with a reason (TASK-024).
 *
 * The reason is required: a dismissal without one is indistinguishable from
 * forgetting the finding ever existed, and it would come back the moment the
 * text changed with no clue why it had been silenced.
 */
export function DismissDialog({ finding, onCancel, onConfirm }: DismissDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const open = finding !== null;

  const close = () => {
    setReason('');
    setError(null);
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        title="Dismiss this finding"
        description="It stops appearing for this prompt, in this browser. The reason is stored with it, and the finding comes back if the content it names changes."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!finding) return;
                setError(onConfirm(finding, reason));
              }}
            >
              Dismiss the finding
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="rounded-sm border border-line bg-surface-2 px-2.5 py-2 text-xs leading-relaxed text-ink-secondary">
            {finding?.title ?? ''}
          </p>

          <Field
            label="Why is it acceptable?"
            hint={`At least ${QUALITY_LIMITS.minReasonChars} characters, up to ${QUALITY_LIMITS.reasonChars}. Stored in this browser only.`}
            error={error ?? undefined}
            required
          >
            {(control) => (
              <Textarea
                {...control}
                value={reason}
                rows={3}
                maxLength={QUALITY_LIMITS.reasonChars}
                placeholder="For example: this prompt is deliberately voice-neutral."
                invalid={error !== null}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
