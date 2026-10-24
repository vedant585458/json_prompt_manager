import {
  Archive,
  ArchiveRestore,
  Copy,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@/components/ui';
import type { Prompt } from '@/domain/types';

/** The per-prompt operations the library and the prompt header wire to the store. */
export interface PromptActionHandlers {
  readonly onEdit: (prompt: Prompt) => void;
  readonly onDuplicate: (prompt: Prompt) => void;
  readonly onToggleArchive: (prompt: Prompt) => void;
  readonly onToggleFavorite: (prompt: Prompt) => void;
  readonly onTogglePin: (prompt: Prompt) => void;
  readonly onDelete: (prompt: Prompt) => void;
}

export interface PromptActionsMenuProps extends PromptActionHandlers {
  readonly prompt: Prompt;
  readonly align?: 'start' | 'end';
}

/**
 * Per-prompt actions (TASK-012).
 *
 * Rendered as a sibling of the card link, never inside it, so activating a menu
 * item cannot also navigate. Every item is a real operation: edit metadata,
 * duplicate, archive/restore, or delete behind a confirmation.
 */
export function PromptActionsMenu({
  prompt,
  onEdit,
  onDuplicate,
  onToggleArchive,
  onToggleFavorite,
  onTogglePin,
  onDelete,
  align = 'end',
}: PromptActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label={`Actions for “${prompt.title}”`}
          size="sm"
          variant="ghost"
          className="data-[state=open]:bg-surface-3 data-[state=open]:text-ink"
        >
          <MoreHorizontal size={15} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuItem onSelect={() => onToggleFavorite(prompt)}>
          {prompt.favorite ? (
            <Star aria-hidden="true" size={14} fill="currentColor" />
          ) : (
            <StarOff aria-hidden="true" size={14} />
          )}
          {prompt.favorite ? 'Remove from favorites' : 'Add to favorites'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onTogglePin(prompt)}>
          {prompt.pinned ? (
            <PinOff aria-hidden="true" size={14} />
          ) : (
            <Pin aria-hidden="true" size={14} />
          )}
          {prompt.pinned ? 'Unpin prompt' : 'Pin prompt'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onEdit(prompt)}>
          <Pencil aria-hidden="true" size={14} />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(prompt)}>
          <Copy aria-hidden="true" size={14} />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onToggleArchive(prompt)}>
          {prompt.archived ? (
            <ArchiveRestore aria-hidden="true" size={14} />
          ) : (
            <Archive aria-hidden="true" size={14} />
          )}
          {prompt.archived ? 'Restore from archive' : 'Archive'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => onDelete(prompt)}>
          <Trash2 aria-hidden="true" size={14} />
          Delete prompt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
