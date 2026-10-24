import { ConfirmDialog } from '@/components/ui';

export interface DeleteContainerDialogProps {
  readonly open: boolean;
  readonly kind: 'folder' | 'collection';
  readonly name: string;
  /** Prompts directly inside the folder, or prompts that are members. */
  readonly promptCount: number;
  /** Child folders re-parented when a folder is deleted. */
  readonly folderCount?: number;
  /** Where the prompts go, e.g. "Work" or "the top level". */
  readonly destination?: string;
  readonly pending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "1 prompt moves" / "3 prompts move". */
function movesOrMove(count: number): string {
  return count === 1 ? 'moves' : 'move';
}

/** "1 prompt keeps its place" / "3 prompts keep their place". */
function keepsOrKeep(count: number): string {
  return count === 1 ? 'keeps its place' : 'keep their place';
}

/**
 * Container deletion confirmation (TASK-012).
 *
 * Deleting a folder or collection never deletes prompts — that is the whole
 * point of the copy. The dialog states where prompts go before it runs.
 */
export function DeleteContainerDialog({
  open,
  kind,
  name,
  promptCount,
  folderCount = 0,
  destination = 'the top level',
  pending,
  onOpenChange,
  onConfirm,
}: DeleteContainerDialogProps) {
  const isFolder = kind === 'folder';

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isFolder ? `Delete folder “${name}”?` : `Delete collection “${name}”?`}
      description={
        isFolder
          ? 'The folder is removed. Prompts inside it are kept and moved up one level.'
          : 'The collection is removed. Prompts in it are kept; only the membership is cleared.'
      }
      confirmLabel={isFolder ? 'Delete folder' : 'Delete collection'}
      tone="destructive"
      pending={pending}
      onConfirm={onConfirm}
    >
      <ul className="mt-3 space-y-1.5 text-xs text-ink-secondary">
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-pill bg-line-strong" />
          <span>
            {isFolder
              ? `${plural(promptCount, 'prompt', 'prompts')} ${movesOrMove(promptCount)} to ${destination}.`
              : `${plural(promptCount, 'prompt', 'prompts')} ${keepsOrKeep(promptCount)}.`}
          </span>
        </li>
        {isFolder ? (
          <li className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1 shrink-0 rounded-pill bg-line-strong"
            />
            <span>
              {folderCount === 0
                ? 'No subfolders to re-parent.'
                : `${plural(folderCount, 'subfolder', 'subfolders')} move up one level.`}
            </span>
          </li>
        ) : null}
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-pill bg-line-strong" />
          <span>No prompts or documents are deleted.</span>
        </li>
      </ul>
    </ConfirmDialog>
  );
}
