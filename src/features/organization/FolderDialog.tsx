import { useEffect, useState, type FormEvent } from 'react';

import { Button, Dialog, DialogContent, Field, Input, Select } from '@/components/ui';
import {
  ROOT_FOLDER_VALUE,
  folderMoveIssues,
  folderOptions,
} from '@/features/organization/organization';
import { RuleViolationError } from '@/domain/errors';
import type { Folder } from '@/domain/types';

export interface FolderFormValues {
  readonly name: string;
  readonly parentId: string | null;
}

export interface FolderDialogProps {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  /** The folder being edited; ignored when creating. */
  readonly folder?: Folder | null;
  /** Pre-selected parent for a new subfolder. */
  readonly parentId?: string | null;
  readonly folders: readonly Folder[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: FolderFormValues) => Promise<void>;
}

/**
 * Create/rename/move folder dialog (TASK-012).
 *
 * The parent list omits the folder itself and its subtree, so the common cycle
 * cannot be expressed; the domain rule still runs on submit for stored trees
 * that are already inconsistent, and its message appears under the select.
 */
export function FolderDialog({
  open,
  mode,
  folder = null,
  parentId = null,
  folders,
  onOpenChange,
  onSubmit,
}: FolderDialogProps) {
  const [name, setName] = useState('');
  const [parent, setParent] = useState(ROOT_FOLDER_VALUE);
  const [nameError, setNameError] = useState<string>();
  const [parentError, setParentError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    setName(folder?.name ?? '');
    setParent(folder?.parentId ?? parentId ?? ROOT_FOLDER_VALUE);
    setNameError(undefined);
    setParentError(undefined);
    setFormError(undefined);
    setPending(false);
  }, [open, folder, parentId]);

  const options = folderOptions(folders, {
    excludeFolderId: folder?.id ?? null,
    rootLabel: 'Top level',
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    const nextParent = parent === ROOT_FOLDER_VALUE ? null : parent;

    if (trimmed.length === 0) {
      setNameError('Give the folder a name.');
      return;
    }

    if (folder) {
      const issues = folderMoveIssues(folders, folder.id, nextParent);
      if (issues.length > 0) {
        setParentError(issues[0]?.message);
        return;
      }
    }

    setNameError(undefined);
    setParentError(undefined);
    setFormError(undefined);
    setPending(true);

    try {
      await onSubmit({ name: trimmed, parentId: nextParent });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof RuleViolationError) {
        const nameIssue = error.issueFor('name');
        const parentIssue = error.issueFor('parentId');
        setNameError(nameIssue);
        setParentError(parentIssue);
        // A field message is already announced under its control; mirroring it
        // in the form alert would read the same sentence twice.
        if (nameIssue !== undefined || parentIssue !== undefined) return;
      }
      setFormError(error instanceof Error ? error.message : 'The folder could not be saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent
        title={mode === 'create' ? 'New folder' : 'Folder settings'}
        description={
          mode === 'create'
            ? 'Folders nest up to five levels and hold prompts from any collection.'
            : 'Rename the folder or move it, with everything inside, to a new parent.'
        }
        size="sm"
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
            <Button type="submit" form="folder-form" loading={pending} loadingLabel="Saving">
              {mode === 'create' ? 'Create folder' : 'Save folder'}
            </Button>
          </>
        }
      >
        <form
          id="folder-form"
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
        >
          {formError ? (
            <p
              role="alert"
              className="rounded-sm border border-danger/35 bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              {formError}
            </p>
          ) : null}

          <Field label="Name" required error={nameError}>
            {(control) => (
              <Input
                {...control}
                value={name}
                autoFocus
                maxLength={80}
                placeholder="Client work"
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Parent folder"
            error={parentError}
            hint="A folder cannot be moved inside itself or one of its own subfolders."
          >
            {(control) => (
              <Select
                {...control}
                value={parent}
                options={options}
                onChange={(event) => setParent(event.target.value)}
              />
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
