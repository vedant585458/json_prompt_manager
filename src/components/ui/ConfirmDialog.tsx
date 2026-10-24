import { AlertTriangle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Explain the consequence in plain language, including what cannot be undone. */
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  /**
   * When set, the user must type this phrase before confirming. Reserved for
   * irreversible, library-wide operations.
   */
  confirmationPhrase?: string;
  /** Async work: the confirm button shows a pending state and stays disabled. */
  pending?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

/**
 * Confirmation dialog (TASK-004).
 *
 * The destructive variant is intentionally not dismissible by overlay click or
 * Escape: dismissing a destructive prompt must be a deliberate "Cancel".
 * Confirmation text, when required, is compared case-sensitively after trimming.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  confirmationPhrase,
  pending = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const requiresPhrase = Boolean(confirmationPhrase);
  const phraseMatches = !requiresPhrase || typed.trim() === confirmationPhrase;
  const destructive = tone === 'destructive';

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        size="sm"
        dismissible={!destructive}
        hideCloseButton={destructive}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              onClick={onConfirm}
              loading={pending}
              loadingLabel="Applying change"
              disabled={!phraseMatches}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {destructive ? (
          <p className="flex items-start gap-2 rounded-sm border border-danger/35 bg-danger-soft px-3 py-2 text-xs text-danger">
            <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>This action cannot be undone.</span>
          </p>
        ) : null}

        {children}

        {requiresPhrase ? (
          <div className="mt-3">
            <Field
              label={`Type “${confirmationPhrase}” to confirm`}
              hint="Case-sensitive, surrounding spaces are ignored."
            >
              {(control) => (
                <Input
                  {...control}
                  mono
                  value={typed}
                  disabled={pending}
                  autoComplete="off"
                  onChange={(event) => setTyped(event.target.value)}
                />
              )}
            </Field>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
