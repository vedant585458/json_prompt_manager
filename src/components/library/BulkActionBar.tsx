import { Archive, ArchiveRestore, Star, StarOff, Tags, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui';
import { countPrompts } from '@/features/bulk/bulkActions';

export interface BulkActionBarProps {
  readonly selectedCount: number;
  /** How many prompts the current filters show. */
  readonly visibleCount: number;
  readonly allVisibleSelected: boolean;
  /** True while the archive scope is on, so "Restore" is the sensible action. */
  readonly archivedScope: boolean;
  readonly busy: boolean;
  readonly onSelectAll: () => void;
  readonly onClear: () => void;
  readonly onFavorite: () => void;
  readonly onUnfavorite: () => void;
  readonly onEditTags: () => void;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
  readonly onDelete: () => void;
}

/**
 * Sticky multi-select bar (TASK-013).
 *
 * Every action here targets exactly the selected ids — never "everything that
 * matches", which the separate select-all control states in words. The bar is a
 * labelled region so a screen reader can jump to it, and its count is a live
 * status so a selection change is announced.
 */
export function BulkActionBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  archivedScope,
  busy,
  onSelectAll,
  onClear,
  onFavorite,
  onUnfavorite,
  onEditTags,
  onArchive,
  onRestore,
  onDelete,
}: BulkActionBarProps) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-3 z-sticky flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-1 px-3 py-2 shadow-panel"
    >
      <p className="text-xs text-ink" role="status">
        <span className="font-medium">{countPrompts(selectedCount)} selected</span>
        {visibleCount > 0 ? (
          <span className="ml-2 text-ink-muted">
            {allVisibleSelected
              ? `All ${countPrompts(visibleCount)} shown`
              : `of ${countPrompts(visibleCount)} shown`}
          </span>
        ) : null}
      </p>

      {visibleCount > 0 && !allVisibleSelected ? (
        <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-7">
          Select all {visibleCount} shown
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button variant="secondary" size="sm" onClick={onFavorite} disabled={busy} className="h-7">
          <Star aria-hidden="true" size={14} />
          Favorite
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onUnfavorite}
          disabled={busy}
          className="h-7"
        >
          <StarOff aria-hidden="true" size={14} />
          Unfavorite
        </Button>
        <Button variant="secondary" size="sm" onClick={onEditTags} disabled={busy} className="h-7">
          <Tags aria-hidden="true" size={14} />
          Tags…
        </Button>
        {archivedScope ? (
          <Button variant="secondary" size="sm" onClick={onRestore} disabled={busy} className="h-7">
            <ArchiveRestore aria-hidden="true" size={14} />
            Restore
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onArchive} disabled={busy} className="h-7">
            <Archive aria-hidden="true" size={14} />
            Archive
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={onDelete} disabled={busy} className="h-7">
          <Trash2 aria-hidden="true" size={14} />
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7"
          aria-label="Clear selection"
        >
          <X aria-hidden="true" size={14} />
          Clear
        </Button>
      </div>
    </div>
  );
}
