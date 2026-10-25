import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { Button, Checkbox, IconButton, Input, Select, Sheet } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCompactLayout } from '@/lib/useMediaQuery';
import type { LibraryView } from '@/lib/viewPreference';
import {
  EDITED_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  VALIDATION_OPTIONS,
  hasActiveFilters,
  type LibraryState,
} from '@/routes/library/libraryQuery';

export interface FilterBarProps {
  readonly state: LibraryState;
  readonly onChange: (patch: Partial<LibraryState>) => void;
  readonly onClear: () => void;
  readonly searchInputRef: RefObject<HTMLInputElement | null>;
  readonly resultCount: number;
  readonly totalCount: number;
  readonly view: LibraryView;
  readonly onViewChange: (view: LibraryView) => void;
  readonly folderName: string | null;
  readonly collectionName: string | null;
}

interface Chip {
  readonly key: string;
  readonly label: string;
  readonly remove: () => void;
}

/**
 * Library filter bar (TASK-011).
 *
 * The search field types locally and debounces into the URL, so keystrokes stay
 * responsive while the URL remains the source of truth. Everything else writes
 * immediately. Active filters are listed as removable chips, which is also the
 * only place some filters (favorites, archived, snapshots) are shown, so a link
 * from the dashboard is always visible and can always be undone.
 */
export function FilterBar({
  state,
  onChange,
  onClear,
  searchInputRef,
  resultCount,
  totalCount,
  view,
  onViewChange,
  folderName,
  collectionName,
}: FilterBarProps) {
  const [text, setText] = useState(state.q);
  const lastPushed = useRef(state.q);

  // An external change (back/forward, a cleared filter) replaces local typing.
  useEffect(() => {
    if (state.q === lastPushed.current) return;
    lastPushed.current = state.q;
    setText(state.q);
  }, [state.q]);

  useEffect(() => {
    if (text === lastPushed.current) return;

    const timer = window.setTimeout(() => {
      lastPushed.current = text;
      onChange({ q: text.trim() });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [text, onChange]);

  const clearSearch = () => {
    lastPushed.current = '';
    setText('');
    onChange({ q: '' });
  };

  // Clearing everything also drops uncommitted typing, so a pending debounce
  // cannot re-apply a search the user just cleared.
  const clearEverything = () => {
    lastPushed.current = '';
    setText('');
    onClear();
  };

  const chips: Chip[] = [];
  if (state.q.length > 0) {
    chips.push({ key: 'q', label: `Search “${state.q}”`, remove: clearSearch });
  }
  for (const tag of state.tags) {
    chips.push({
      key: `tag-${tag}`,
      label: `#${tag}`,
      remove: () => onChange({ tags: state.tags.filter((existing) => existing !== tag) }),
    });
  }
  if (state.folder !== null) {
    chips.push({
      key: 'folder',
      label: `Folder: ${folderName ?? 'Unknown folder'}`,
      remove: () => onChange({ folder: null }),
    });
  }
  if (state.unfiled) {
    chips.push({ key: 'unfiled', label: 'Unfiled', remove: () => onChange({ unfiled: false }) });
  }
  if (state.collection !== null) {
    chips.push({
      key: 'collection',
      label: `Collection: ${collectionName ?? 'Unknown collection'}`,
      remove: () => onChange({ collection: null }),
    });
  }
  if (state.status !== 'all') {
    chips.push({
      key: 'status',
      label: `Status: ${state.status}`,
      remove: () => onChange({ status: 'all' }),
    });
  }
  if (state.validation !== 'all') {
    chips.push({
      key: 'validation',
      label: state.validation === 'unparsable' ? 'Will not parse' : 'Parses',
      remove: () => onChange({ validation: 'all' }),
    });
  }
  if (state.edited !== 'any') {
    const option = EDITED_OPTIONS.find((candidate) => candidate.value === state.edited);
    chips.push({
      key: 'edited',
      label: `Edited ${option?.label.toLowerCase() ?? state.edited}`,
      remove: () => onChange({ edited: 'any' }),
    });
  }
  if (state.archived) {
    chips.push({ key: 'archived', label: 'Archived', remove: () => onChange({ archived: false }) });
  }
  if (state.favorites) {
    chips.push({
      key: 'favorites',
      label: 'Favorites',
      remove: () => onChange({ favorites: false }),
    });
  }
  if (state.snapshots) {
    chips.push({
      key: 'snapshots',
      label: 'With snapshots',
      remove: () => onChange({ snapshots: false }),
    });
  }
  if (state.hasCollection) {
    chips.push({
      key: 'has-collection',
      label: 'In a collection',
      remove: () => onChange({ hasCollection: false }),
    });
  }

  const compact = useCompactLayout();
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = chips.length;

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <Input
        ref={searchInputRef}
        type="search"
        size="sm"
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, 120))}
        aria-label="Search prompts"
        placeholder="Search titles, tags, and JSON…"
        adornment={<Search size={14} />}
        className="pr-9"
      />
      {text.length > 0 ? (
        <IconButton
          label="Clear search"
          size="sm"
          variant="ghost"
          onClick={clearSearch}
          className="absolute top-1/2 right-1 -translate-y-1/2"
        >
          <X size={14} />
        </IconButton>
      ) : null}
    </div>
  );

  const sortField = (
    <Select
      size="sm"
      aria-label="Sort prompts"
      className="w-40 max-sm:w-full"
      value={state.sort}
      onChange={(event) => onChange({ sort: event.target.value as LibraryState['sort'] })}
      options={SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
    />
  );

  const viewToggle = (
    <div
      role="group"
      aria-label="View"
      className="flex items-center gap-1 rounded-sm border border-line-control bg-surface-2 p-0.5"
    >
      <IconButton
        label="Card view"
        size="sm"
        variant={view === 'grid' ? 'secondary' : 'ghost'}
        aria-pressed={view === 'grid'}
        onClick={() => onViewChange('grid')}
        className={cn(view === 'grid' && 'bg-surface-3')}
      >
        <LayoutGrid size={14} />
      </IconButton>
      <IconButton
        label="List view"
        size="sm"
        variant={view === 'list' ? 'secondary' : 'ghost'}
        aria-pressed={view === 'list'}
        onClick={() => onViewChange('list')}
        className={cn(view === 'list' && 'bg-surface-3')}
      >
        <List size={14} />
      </IconButton>
    </div>
  );

  const filterSelects = (
    <>
      <Select
        size="sm"
        aria-label="Filter by status"
        className="w-36 max-sm:w-full"
        value={state.status}
        onChange={(event) => onChange({ status: event.target.value as LibraryState['status'] })}
        options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      />
      <Select
        size="sm"
        aria-label="Filter by document health"
        className="w-40 max-sm:w-full"
        value={state.validation}
        onChange={(event) =>
          onChange({ validation: event.target.value as LibraryState['validation'] })
        }
        options={VALIDATION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      />
      <Select
        size="sm"
        aria-label="Filter by last edited"
        className="w-36 max-sm:w-full"
        value={state.edited}
        onChange={(event) => onChange({ edited: event.target.value as LibraryState['edited'] })}
        options={EDITED_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      />
    </>
  );

  const filterChecks = (
    <>
      <Checkbox
        id="filter-archived"
        name="filter-archived"
        checked={state.archived}
        onCheckedChange={(checked) => onChange({ archived: checked === true })}
        label="Archived"
        className="pb-1.5"
      />
      <Checkbox
        id="filter-favorites"
        name="filter-favorites"
        checked={state.favorites}
        onCheckedChange={(checked) => onChange({ favorites: checked === true })}
        label="Favorites"
        className="pb-1.5"
      />
    </>
  );

  const countLine = (
    <p role="status" className="pb-1.5 font-mono text-2xs text-ink-muted tabular">
      {resultCount} of {totalCount} prompts
    </p>
  );

  const chipRow =
    chips.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
        <span className="metadata-rail">Active</span>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.remove}
            aria-label={`Remove filter: ${chip.label}`}
            className="inline-flex items-center gap-1 rounded-pill border border-line-control bg-surface-2 px-2 py-0.5 text-2xs text-ink-secondary hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {chip.label}
            <X aria-hidden="true" size={11} />
          </button>
        ))}
        {hasActiveFilters(state) ? (
          <Button variant="ghost" size="sm" onClick={clearEverything} className="ml-auto h-7">
            Clear all
          </Button>
        ) : null}
      </div>
    ) : null;

  /**
   * One phone-wide row instead of three wrapped ones.
   *
   * Search stays in the open — it is the filter people reach for — while sorting,
   * the three selects, the two checkboxes, and the active chips move into a
   * sheet. The chips stay outside the sheet as well, so an applied filter is
   * still visible (and removable) with the sheet closed. Everything is the same
   * control with the same handler, not a second implementation (TASK-027).
   */
  if (compact) {
    return (
      <section
        aria-label="Filter prompts"
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface-1 p-3"
      >
        <div className="flex items-center gap-2">
          {searchField}
          {viewToggle}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSheetOpen(true)}
            leadingIcon={<SlidersHorizontal size={14} strokeWidth={1.75} />}
          >
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        </div>

        {countLine}
        {chipRow}

        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Filters"
          description="Sorting and filters apply as you change them. On a narrow screen this panel opens from the bottom."
          side="right"
          footer={
            <Button variant="secondary" size="sm" onClick={() => setSheetOpen(false)}>
              Done
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {sortField}
            {filterSelects}
            <div className="flex flex-wrap items-center gap-3">{filterChecks}</div>
          </div>
        </Sheet>
      </section>
    );
  }

  return (
    <section
      aria-label="Filter prompts"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-1 p-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {searchField}
        <div className="flex items-center gap-2">
          {sortField}
          {viewToggle}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {filterSelects}
        {filterChecks}
        <div className="ml-auto">{countLine}</div>
      </div>

      {chipRow}
    </section>
  );
}
