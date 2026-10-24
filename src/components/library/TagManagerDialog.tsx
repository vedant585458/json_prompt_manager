import { useState, type FormEvent } from 'react';

import { Button, Dialog, DialogContent, Field, Input } from '@/components/ui';
import { countPrompts, type TagCensus } from '@/features/bulk/bulkActions';

export interface TagManagerDialogProps {
  readonly open: boolean;
  /** Every tag in the library with the number of prompts that carry it. */
  readonly tags: readonly TagCensus[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onRename: (from: string, to: string) => Promise<void>;
  readonly onDelete: (tag: string) => Promise<void>;
}

/**
 * Library-wide tag management (TASK-013).
 *
 * Renaming rewrites every prompt that carries the tag; deleting removes it
 * everywhere. Both state the affected count first, and both keep the dialog
 * open on failure so the message sits next to the row that failed. Renaming onto
 * an existing tag merges them — the copy says so rather than pretending it is
 * a conflict.
 */
export function TagManagerDialog({
  open,
  tags,
  onOpenChange,
  onRename,
  onDelete,
}: TagManagerDialogProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ readonly tag: string; readonly message: string } | null>(
    null,
  );

  function reset() {
    setEditing(null);
    setDraft('');
    setConfirming(null);
    setPending(false);
    setError(null);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>, from: string) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onRename(from, draft);
      setEditing(null);
      setDraft('');
    } catch (caught) {
      setError({
        tag: from,
        message:
          caught instanceof Error && caught.message
            ? caught.message
            : 'The tag could not be renamed.',
      });
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete(tag: string) {
    setError(null);
    setPending(true);
    try {
      await onDelete(tag);
      setConfirming(null);
    } catch (caught) {
      setError({
        tag,
        message:
          caught instanceof Error && caught.message
            ? caught.message
            : 'The tag could not be removed.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Manage tags"
        description="Renaming or removing a tag changes every prompt that carries it. Prompts themselves are never deleted."
        size="md"
        footer={
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Close
          </Button>
        }
      >
        {tags.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            No tags yet. Add tags from a prompt’s details, or select prompts and use the bulk tag
            editor.
          </p>
        ) : (
          <ul aria-label="Tags in this library" className="divide-y divide-line">
            {tags.map((entry) => {
              const isEditing = editing === entry.tag;
              const isConfirming = confirming === entry.tag;
              const rowError = error?.tag === entry.tag ? error.message : null;

              return (
                <li key={entry.tag} className="flex flex-col gap-2 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-ink">#{entry.tag}</span>
                    <span className="font-mono text-2xs text-ink-muted tabular">
                      {countPrompts(entry.count)}
                    </span>

                    {!isEditing && !isConfirming ? (
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => {
                            setEditing(entry.tag);
                            setDraft(entry.tag);
                            setConfirming(null);
                            setError(null);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-danger"
                          onClick={() => {
                            setConfirming(entry.tag);
                            setEditing(null);
                            setError(null);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(event) => void submitRename(event, entry.tag)}
                    >
                      <Field label={`Rename #${entry.tag}`} hideLabel className="min-w-40 flex-1">
                        {(control) => (
                          <Input
                            {...control}
                            value={draft}
                            autoFocus
                            mono
                            onChange={(event) => setDraft(event.target.value)}
                          />
                        )}
                      </Field>
                      <Button type="submit" size="sm" loading={pending} loadingLabel="Renaming">
                        Save tag
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(null)}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : null}

                  {isConfirming ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-danger/35 bg-danger-soft px-3 py-2">
                      <p className="text-xs text-danger">
                        Remove #{entry.tag} from {countPrompts(entry.count)}? The prompts stay.
                      </p>
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="danger"
                          size="sm"
                          className="h-7"
                          loading={pending}
                          loadingLabel="Removing"
                          onClick={() => void confirmDelete(entry.tag)}
                        >
                          Remove tag
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => setConfirming(null)}
                          disabled={pending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {rowError ? (
                    <p role="alert" className="text-xs text-danger">
                      {rowError}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-2xs leading-relaxed text-ink-muted">
          Renaming onto a tag that already exists merges the two. Deleting a tag never deletes a
          prompt.
        </p>
      </DialogContent>
    </Dialog>
  );
}
