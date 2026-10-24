import { ConfirmDialog } from '@/components/ui';
import type { Prompt } from '@/domain/types';

export interface DeletePromptDialogProps {
  readonly open: boolean;
  readonly prompt: Prompt | null;
  readonly revisionCount: number;
  readonly testCaseCount: number;
  readonly pending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Delete confirmation (TASK-012).
 *
 * Names the prompt, states exactly what else disappears (snapshots and test
 * cases are deleted with it, in one transaction), and uses the non-dismissible
 * destructive variant so a stray click cannot erase work.
 */
export function DeletePromptDialog({
  open,
  prompt,
  revisionCount,
  testCaseCount,
  pending,
  onOpenChange,
  onConfirm,
}: DeletePromptDialogProps) {
  const title = prompt?.title ?? 'this prompt';

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete “${title}”?`}
      description="The prompt is removed from this browser permanently."
      confirmLabel="Delete prompt"
      tone="destructive"
      pending={pending}
      onConfirm={onConfirm}
    >
      <ul className="mt-3 space-y-1.5 text-xs text-ink-secondary">
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-pill bg-line-strong" />
          <span>The prompt itself.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-pill bg-line-strong" />
          <span>
            {revisionCount === 0
              ? 'No saved snapshots — there are none yet.'
              : `${plural(revisionCount, 'saved snapshot', 'saved snapshots')} of its document.`}
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-pill bg-line-strong" />
          <span>
            {testCaseCount === 0
              ? 'No test cases — there are none yet.'
              : `${plural(testCaseCount, 'test case', 'test cases')} that reference it.`}
          </span>
        </li>
      </ul>
    </ConfirmDialog>
  );
}
