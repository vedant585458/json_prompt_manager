import { useEffect, useState, type FormEvent } from 'react';

import { Button, Checkbox, Dialog, DialogContent, Field, Input } from '@/components/ui';
import { isEmptyTagEdit, type TagCensus } from '@/features/bulk/bulkActions';
import { formatTagInput, parseTagInput } from '@/features/organization/organization';

export interface BulkTagValues {
  readonly add: readonly string[];
  readonly remove: readonly string[];
}

export interface BulkTagDialogProps {
  readonly open: boolean;
  /** How many prompts the change will touch. */
  readonly count: number;
  /** Tags already present on the selection, with how many carry each. */
  readonly selectionTags: readonly TagCensus[];
  /** Tags used anywhere in the library, offered as suggestions. */
  readonly suggestions: readonly string[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: BulkTagValues) => Promise<void>;
}

/**
 * Tag editor for a multi-selection (TASK-013).
 *
 * The dialog states the exact number of prompts it will rewrite before the
 * button is pressed, and never guesses: the counts come from the same selection
 * the store will write. Additions are typed (comma separated, normalized on
 * submit); removals are ticked from tags the selection actually carries, so a
 * removal cannot silently match nothing.
 */
export function BulkTagDialog({
  open,
  count,
  selectionTags,
  suggestions,
  onOpenChange,
  onSubmit,
}: BulkTagDialogProps) {
  const [addInput, setAddInput] = useState('');
  const [removals, setRemovals] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setAddInput('');
    setRemovals([]);
    setError(undefined);
    setPending(false);
  }, [open]);

  const values: BulkTagValues = { add: parseTagInput(addInput), remove: removals };
  const nothingToDo = isEmptyTagEdit(values);
  const availableSuggestions = suggestions.filter((tag) => !values.add.includes(tag));

  function toggleRemoval(tag: string, checked: boolean) {
    setRemovals((current) =>
      checked ? [...new Set([...current, tag])] : current.filter((candidate) => candidate !== tag),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nothingToDo) {
      setError('Add or remove at least one tag.');
      return;
    }

    setError(undefined);
    setPending(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : 'The tags could not be saved. Nothing was changed.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent
        title="Edit tags"
        description={`Applies to ${count === 1 ? 'the selected prompt' : `all ${count} selected prompts`}. Every other prompt is untouched.`}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="bulk-tag-form"
              loading={pending}
              loadingLabel="Saving"
              disabled={nothingToDo}
            >
              Apply tags
            </Button>
          </>
        }
      >
        <form
          id="bulk-tag-form"
          className="flex flex-col gap-3"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          {error ? (
            <p
              role="alert"
              className="rounded-sm border border-danger/35 bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              {error}
            </p>
          ) : null}

          <Field
            label="Add tags"
            hint="Comma separated. Tags are lowercased, trimmed, and de-duplicated."
          >
            {(control) => (
              <Input
                {...control}
                value={addInput}
                onChange={(event) => setAddInput(event.target.value)}
                placeholder="finance, extraction"
                mono
              />
            )}
          </Field>

          {availableSuggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availableSuggestions.slice(0, 12).map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 font-mono text-2xs"
                  onClick={() => setAddInput(formatTagInput([...values.add, tag]))}
                >
                  #{tag}
                </Button>
              ))}
            </div>
          ) : null}

          <fieldset className="min-w-0">
            <legend className="text-xs font-medium text-ink-secondary">Remove tags</legend>
            {selectionTags.length === 0 ? (
              <p className="mt-1.5 text-xs text-ink-muted">
                The selection carries no tags yet, so there is nothing to remove.
              </p>
            ) : (
              <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-sm border border-line bg-surface-2 p-2">
                {selectionTags.map((entry) => (
                  <Checkbox
                    key={entry.tag}
                    id={`remove-tag-${entry.tag}`}
                    name={`remove-tag-${entry.tag}`}
                    checked={removals.includes(entry.tag)}
                    onCheckedChange={(checked) => toggleRemoval(entry.tag, checked === true)}
                    label={
                      <span className="font-mono">
                        #{entry.tag}
                        <span className="ml-2 font-sans text-2xs text-ink-muted">
                          on {entry.count} of {count}
                        </span>
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
