import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { FilterBar } from '@/components/library/FilterBar';
import { IngredientRail } from '@/components/library/IngredientRail';
import { PromptGrid } from '@/components/library/PromptGrid';
import { PromptList } from '@/components/library/PromptList';
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  SkeletonCard,
  buttonVariants,
} from '@/components/ui';
import { registerLibrarySearchFocus } from '@/lib/commands/librarySearchFocus';
import { cn } from '@/lib/cn';
import { folderSubtreeIds } from '@/lib/folderTree';
import { readLibraryView, writeLibraryView, type LibraryView } from '@/lib/viewPreference';
import { searchPrompts, type PromptMatch } from '@/domain/search';
import { getBrowserStorage } from '@/styles/theme';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { findDocumentProblems } from '@/store/dashboard';
import {
  createLibrarySelector,
  selectTagCounts,
  type LibraryQuery,
  type TagCount,
} from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';
import {
  readLibraryState,
  toggleTag,
  writeLibraryState,
  editedAfter,
  hasActiveFilters,
  type LibraryState,
} from '@/routes/library/libraryQuery';

/**
 * Library (TASK-011).
 *
 * The URL is the state: search text, tags, folder, collection, status, document
 * health, archive scope, edit range, sort, and view all round-trip through the
 * query string, so back/forward and shared in-app links work without a second
 * source of truth. Filtering itself is a pure selector (`src/store/selectors`)
 * over stored prompts; "will not parse" comes from the same parser the
 * dashboard uses, computed once per data change rather than per keystroke.
 *
 * Pinned prompts are listed separately and left out of the main results. Card
 * and list views render the same facts; only the density differs.
 */
export function LibraryRoute() {
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const folders = store((state) => state.folders);
  const collections = store((state) => state.collections);
  const revisions = store((state) => state.revisions);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);

  const selectedPromptIds = useUiStore((state) => state.selectedPromptIds);
  const toggleSelection = useUiStore((state) => state.toggleSelection);
  const setSelection = useUiStore((state) => state.setSelection);
  const clearSelection = useUiStore((state) => state.clearSelection);

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const state = useMemo(() => readLibraryState(search), [search]);

  const storedView = useMemo(() => readLibraryView(getBrowserStorage()), []);
  const view: LibraryView = state.view ?? storedView;
  const now = useMemo(() => new Date(), []);
  const select = useMemo(() => createLibrarySelector(), []);

  const unparsableIds = useMemo(
    () => new Set(findDocumentProblems(prompts).map((problem) => problem.promptId)),
    [prompts],
  );
  const snapshotPromptIds = useMemo(
    () => [...new Set(revisions.map((revision) => revision.promptId))],
    [revisions],
  );
  const folderIds = useMemo(
    () => (state.folder === null ? null : folderSubtreeIds(folders, state.folder)),
    [folders, state.folder],
  );
  const editedAfterIso = useMemo(() => editedAfter(state, now), [state, now]);

  const query = useMemo<LibraryQuery>(() => {
    const documentFilter =
      state.validation === 'all' ? undefined : { kind: state.validation, ids: [...unparsableIds] };

    return {
      search: state.q,
      archived: state.archived,
      favoritesOnly: state.favorites,
      ...(state.unfiled ? { folderId: null } : {}),
      ...(folderIds ? { folderIds } : {}),
      ...(state.collection ? { collectionId: state.collection } : {}),
      hasCollection: state.hasCollection,
      ...(state.tags.length > 0 ? { tags: state.tags } : {}),
      status: state.status,
      ...(documentFilter ? { documentFilter } : {}),
      ...(state.snapshots ? { snapshotPromptIds } : {}),
      ...(editedAfterIso ? { updatedAfter: editedAfterIso } : {}),
      sort: state.sort,
    };
  }, [state, folderIds, unparsableIds, snapshotPromptIds, editedAfterIso]);

  const parsableIds = useMemo(
    () => parsableIdsOf(prompts, unparsableIds),
    [prompts, unparsableIds],
  );

  const results = select(prompts, query);
  const pinned = results.filter((prompt) => prompt.pinned);
  const others = results.filter((prompt) => !prompt.pinned);

  const matches = useMemo<ReadonlyMap<string, PromptMatch>>(() => {
    if (state.q.trim().length === 0) return new Map();
    return new Map(searchPrompts(prompts, state.q).map((entry) => [entry.prompt.id, entry.match]));
  }, [prompts, state.q]);

  // Rail counts describe the archive scope, not the search: a folder that holds
  // three prompts should keep saying three while the user types.
  const scopedPromptCounts = useMemo(() => {
    const scope = prompts.filter((prompt) => prompt.archived === state.archived);
    const folderCounts = new Map<string, number>();
    const collectionCounts = new Map<string, number>();
    let unfiledCount = 0;

    for (const prompt of scope) {
      if (prompt.folderId === null) unfiledCount += 1;
      else folderCounts.set(prompt.folderId, (folderCounts.get(prompt.folderId) ?? 0) + 1);

      for (const collectionId of prompt.collectionIds) {
        collectionCounts.set(collectionId, (collectionCounts.get(collectionId) ?? 0) + 1);
      }
    }

    return { scopeCount: scope.length, folderCounts, collectionCounts, unfiledCount };
  }, [prompts, state.archived]);

  const tagCounts = useMemo<TagCount[]>(
    () => selectTagCounts(prompts.filter((prompt) => prompt.archived === state.archived)),
    [prompts, state.archived],
  );

  const selected = useMemo(() => new Set(selectedPromptIds), [selectedPromptIds]);
  const visibleIds = results.map((prompt) => prompt.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const update = useCallback(
    (patch: Partial<LibraryState>) => {
      const next = writeLibraryState({ ...state, ...patch });
      // Typing should not fill the back stack; a deliberate filter should.
      const typingOnly = Object.keys(patch).length === 1 && 'q' in patch;
      setSearchParams(next, { replace: typingOnly });
    },
    [state, setSearchParams],
  );

  const clearAll = useCallback(() => {
    setSearchParams('', { replace: false });
  }, [setSearchParams]);

  const changeView = useCallback(
    (next: LibraryView) => {
      writeLibraryView(next, getBrowserStorage());
      setSearchParams(writeLibraryState({ ...state, view: next }), { replace: true });
    },
    [state, setSearchParams],
  );

  const selectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const visible = new Set(visibleIds);
      setSelection(selectedPromptIds.filter((id) => !visible.has(id)));
      return;
    }

    setSelection([...new Set([...selectedPromptIds, ...visibleIds])]);
  }, [allVisibleSelected, selectedPromptIds, setSelection, visibleIds]);

  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(
    () =>
      registerLibrarySearchFocus(() => {
        const field = searchRef.current;
        if (!field) return;
        field.focus();
        field.select();
      }),
    [],
  );

  const folderName =
    state.folder === null
      ? null
      : (folders.find((folder) => folder.id === state.folder)?.name ?? null);
  const collectionName =
    state.collection === null
      ? null
      : (collections.find((collection) => collection.id === state.collection)?.name ?? null);

  const libraryEmpty = prompts.length === 0;
  const filtersActive = hasActiveFilters(state);

  const emptyState = libraryEmpty ? (
    <EmptyState
      title="Your library is empty"
      description="Prompts you create are stored in this browser. Start with a template or write the first one."
      icon={Plus}
      action={
        <Link to="/composer" className={cn(buttonVariants({ variant: 'primary' }))}>
          Create a prompt
        </Link>
      }
      secondaryAction={
        <Link to="/templates" className={cn(buttonVariants({ variant: 'secondary' }))}>
          Browse templates
        </Link>
      }
    />
  ) : (
    <EmptyState
      title="No prompts match"
      description="Nothing in this library matches the current filters. Clear them to see everything again."
      action={
        <Button variant="primary" onClick={clearAll}>
          Clear filters
        </Button>
      }
      secondaryAction={
        filtersActive ? (
          <Link to="/composer" className={cn(buttonVariants({ variant: 'secondary' }))}>
            New prompt
          </Link>
        ) : undefined
      }
    />
  );

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <LibraryHeader resultCount={0} totalCount={prompts.length} filtersActive={false} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="Your library could not be read"
        description="That list of prompts could not be loaded from this browser. Nothing was changed. Try again, and reload if it keeps failing."
        action={
          <Button variant="primary" onClick={() => void hydrate()}>
            Try again
          </Button>
        }
        detail={error ?? undefined}
      />
    );
  }

  const resultsView =
    view === 'grid' ? (
      <PromptGrid
        prompts={others}
        parsableIds={parsableIds}
        matches={matches}
        query={state.q}
        now={now}
        selectedIds={selected}
        onToggleSelected={toggleSelection}
        empty={emptyState}
        label="Matching prompts"
      />
    ) : (
      <PromptList
        prompts={others}
        parsableIds={parsableIds}
        matches={matches}
        query={state.q}
        now={now}
        selectedIds={selected}
        onToggleSelected={toggleSelection}
        empty={emptyState}
        label="Matching prompts"
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <LibraryHeader
        resultCount={results.length}
        totalCount={prompts.length}
        filtersActive={filtersActive}
      />

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <div className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-20">
          <IngredientRail
            folders={folders}
            collections={collections}
            tagCounts={tagCounts}
            folderCounts={scopedPromptCounts.folderCounts}
            collectionCounts={scopedPromptCounts.collectionCounts}
            unfiledCount={scopedPromptCounts.unfiledCount}
            totalCount={scopedPromptCounts.scopeCount}
            state={state}
            onSelectFolder={(selection) =>
              update({ folder: selection.folderId, unfiled: selection.unfiled })
            }
            onSelectCollection={(collectionId) => update({ collection: collectionId })}
            onToggleTag={(tag) => update({ tags: toggleTag(state, tag).tags })}
          />
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <FilterBar
            state={state}
            onChange={update}
            onClear={clearAll}
            searchInputRef={searchRef}
            resultCount={results.length}
            totalCount={prompts.length}
            view={view}
            onViewChange={changeView}
            folderName={folderName}
            collectionName={collectionName}
          />

          {selectedPromptIds.length > 0 ? (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-ink-secondary"
            >
              <span className="font-medium text-ink">{selectedPromptIds.length} selected</span>
              <span className="text-ink-muted">
                Bulk actions arrive with TASK-013; selection is kept for it.
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="ml-auto h-7">
                Clear selection
              </Button>
            </div>
          ) : null}

          {results.length === 0 ? (
            resultsView
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  {pinned.length > 0 ? 'All prompts' : 'Prompts'}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xs text-ink-muted tabular">
                    {results.length} shown
                  </span>
                  <Checkbox
                    id="library-select-all"
                    name="library-select-all"
                    checked={allVisibleSelected}
                    onCheckedChange={selectAllVisible}
                    label="Select all shown"
                  />
                </div>
              </div>

              {pinned.length > 0 ? (
                <section aria-labelledby="library-pinned-heading" className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3
                      id="library-pinned-heading"
                      className="font-mono text-2xs tracking-wide text-ink-muted uppercase"
                    >
                      Pinned
                    </h3>
                    <span className="font-mono text-2xs text-ink-muted tabular">
                      {pinned.length}
                    </span>
                  </div>
                  {view === 'grid' ? (
                    <PromptGrid
                      prompts={pinned}
                      parsableIds={parsableIds}
                      matches={matches}
                      query={state.q}
                      now={now}
                      selectedIds={selected}
                      onToggleSelected={toggleSelection}
                      empty={null}
                      label="Pinned prompts"
                    />
                  ) : (
                    <PromptList
                      prompts={pinned}
                      parsableIds={parsableIds}
                      matches={matches}
                      query={state.q}
                      now={now}
                      selectedIds={selected}
                      onToggleSelected={toggleSelection}
                      empty={null}
                      label="Pinned prompts"
                    />
                  )}
                </section>
              ) : null}

              <section aria-labelledby="library-results-heading" className="flex flex-col gap-2">
                <h3
                  id="library-results-heading"
                  className="font-mono text-2xs tracking-wide text-ink-muted uppercase"
                >
                  {pinned.length > 0 ? 'Every matching prompt' : 'Results'}
                </h3>
                {others.length === 0 ? (
                  <p className="rounded-md border border-dashed border-line px-3 py-4 text-xs text-ink-muted">
                    Every matching prompt is pinned, so it is listed above.
                  </p>
                ) : (
                  resultsView
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Parsable = every prompt that is not in the unparsable set. */
function parsableIdsOf(
  prompts: readonly { readonly id: string }[],
  unparsable: ReadonlySet<string>,
): Set<string> {
  const parsable = new Set<string>();
  for (const prompt of prompts) {
    if (!unparsable.has(prompt.id)) parsable.add(prompt.id);
  }
  return parsable;
}

function LibraryHeader({
  resultCount,
  totalCount,
  filtersActive,
}: {
  readonly resultCount: number;
  readonly totalCount: number;
  readonly filtersActive: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="metadata-rail">Prompt library</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Library</h1>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-secondary">
          {totalCount === 0
            ? 'Every prompt you create is stored in this browser, with its full JSON document and history.'
            : `${totalCount} prompt${totalCount === 1 ? '' : 's'} in this library, ${resultCount} matching the current view${filtersActive ? '' : ' (no filters applied)'}.`}
        </p>
      </div>

      <Link
        to="/composer"
        className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}
      >
        <Plus aria-hidden="true" size={15} />
        New prompt
      </Link>
    </header>
  );
}
