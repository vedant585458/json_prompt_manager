import { Archive, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { BulkActionBar } from '@/components/library/BulkActionBar';
import { BulkTagDialog, type BulkTagValues } from '@/components/library/BulkTagDialog';
import { FilterBar } from '@/components/library/FilterBar';
import { IngredientRail } from '@/components/library/IngredientRail';
import { TagManagerDialog } from '@/components/library/TagManagerDialog';
import { PromptGrid } from '@/components/library/PromptGrid';
import { PromptList } from '@/components/library/PromptList';
import type { PromptActionHandlers } from '@/components/prompts/PromptActionsMenu';
import { DeletePromptDialog } from '@/components/prompts/DeletePromptDialog';
import { PromptFormDialog, type PromptFormValues } from '@/components/prompts/PromptFormDialog';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonCard,
  buttonVariants,
  useToast,
} from '@/components/ui';
import { countPrompts, rangeIds, tagCensus } from '@/features/bulk/bulkActions';
import { DeleteContainerDialog } from '@/features/organization/DeleteContainerDialog';
import {
  CollectionDialog,
  type CollectionFormValues,
} from '@/features/organization/CollectionDialog';
import { FolderDialog, type FolderFormValues } from '@/features/organization/FolderDialog';
import {
  countCollectionMembers,
  countFolderContents,
  parentFolderLabel,
} from '@/features/organization/organization';
import { registerLibrarySearchFocus } from '@/lib/commands/librarySearchFocus';
import { cn } from '@/lib/cn';
import { folderSubtreeIds } from '@/lib/folderTree';
import { readLibraryView, writeLibraryView, type LibraryView } from '@/lib/viewPreference';
import { searchPrompts, type PromptMatch } from '@/domain/search';
import { findSchemaProblems } from '@/domain/validation';
import { getBrowserStorage } from '@/styles/theme';
import { describeDataError } from '@/store/dataStore';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { findDocumentProblems } from '@/store/dashboard';
import { useTransfer } from '@/features/transfer/useTransfer';
import {
  createLibrarySelector,
  selectTagCounts,
  sortPinnedByTitle,
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
import { instantiateTemplate } from '@/domain/templates';
import type { Collection, Folder, Prompt } from '@/domain/types';

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
 *
 * Since TASK-012 the screen also owns the prompt lifecycle: create, edit
 * metadata, duplicate, move, archive/restore, delete, and folder/collection
 * management. Every mutation goes through the store, so storage is the source
 * of truth, and failures are reported instead of being optimistically applied.
 */
export function LibraryRoute() {
  const store = useDataStoreApi();
  const transfer = useTransfer();
  const prompts = store((state) => state.prompts);
  const folders = store((state) => state.folders);
  const collections = store((state) => state.collections);
  const revisions = store((state) => state.revisions);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);

  const templates = store((state) => state.templates);
  const schemas = store((state) => state.schemas);
  const testCases = store((state) => state.testCases);
  const addPrompt = store((state) => state.addPrompt);
  const editPrompt = store((state) => state.editPrompt);
  const duplicatePrompt = store((state) => state.duplicatePrompt);
  const archivePrompt = store((state) => state.archivePrompt);
  const unarchivePrompt = store((state) => state.unarchivePrompt);
  const deletePrompt = store((state) => state.deletePrompt);
  const toggleFavorite = store((state) => state.toggleFavorite);
  const togglePin = store((state) => state.togglePin);
  const setFavorite = store((state) => state.setFavorite);
  const setArchived = store((state) => state.setArchived);
  const editTags = store((state) => state.editTags);
  const restorePrompts = store((state) => state.restorePrompts);
  const deletePrompts = store((state) => state.deletePrompts);
  const restoreDeletedPrompts = store((state) => state.restoreDeletedPrompts);
  const renameTag = store((state) => state.renameTag);
  const deleteTag = store((state) => state.deleteTag);
  const addFolder = store((state) => state.addFolder);
  const updateFolder = store((state) => state.updateFolder);
  const deleteFolder = store((state) => state.deleteFolder);
  const addCollection = store((state) => state.addCollection);
  const updateCollection = store((state) => state.updateCollection);
  const deleteCollection = store((state) => state.deleteCollection);

  const toast = useToast();
  const navigate = useNavigate();

  const selectedPromptIds = useUiStore((state) => state.selectedPromptIds);
  const toggleSelection = useUiStore((state) => state.toggleSelection);
  const setSelection = useUiStore((state) => state.setSelection);
  const clearSelection = useUiStore((state) => state.clearSelection);

  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null);
  const [folderDialog, setFolderDialog] = useState<{
    readonly mode: 'create' | 'edit';
    readonly folder: Folder | null;
    readonly parentId: string | null;
  } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [collectionDialog, setCollectionDialog] = useState<{
    readonly mode: 'create' | 'edit';
    readonly collection: Collection | null;
  } | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [pending, setPending] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectionAnchor = useRef<string | null>(null);

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

  // A stored document can parse and still fail the schema its prompt points at;
  // the badge is per prompt and carries how many schema errors it has (TASK-016).
  const schemaIssueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (schemas.length === 0) return counts;
    for (const problem of findSchemaProblems(prompts, schemas)) {
      counts.set(problem.promptId, problem.issues.length);
    }
    return counts;
  }, [prompts, schemas]);
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
  // Pin recency is not stored, so pinned prompts are ordered A→Z like the rail
  // (ADR-69). The visible order is also what a Shift range selects.
  const pinned = sortPinnedByTitle(results.filter((prompt) => prompt.pinned));
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
  const visibleOrder = [...pinned, ...others].map((prompt) => prompt.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const libraryTags = useMemo(() => tagCensus(prompts), [prompts]);
  const selectionTags = useMemo(
    () => tagCensus(prompts.filter((prompt) => selected.has(prompt.id))),
    [prompts, selected],
  );
  const tagSuggestions = useMemo(() => libraryTags.map((entry) => entry.tag), [libraryTags]);

  /**
   * Selection follows the URL: any filter, search, sort, dialog, or route change
   * drops the selection, so a bulk action can never reach rows the user can no
   * longer see (ADR-70).
   */
  useEffect(() => {
    clearSelection();
    selectionAnchor.current = null;
  }, [search, clearSelection]);

  const handleToggleSelected = useCallback(
    (id: string, options?: { readonly range?: boolean }) => {
      const anchor = selectionAnchor.current;
      if (options?.range && anchor && anchor !== id) {
        const range = rangeIds(visibleOrder, anchor, id);
        setSelection([...new Set([...useUiStore.getState().selectedPromptIds, ...range])]);
      } else {
        toggleSelection(id);
      }
      selectionAnchor.current = id;
    },
    [visibleOrder, setSelection, toggleSelection],
  );

  const update = useCallback(
    (patch: Partial<LibraryState>) => {
      const next = writeLibraryState({ ...state, ...patch });
      const keys = Object.keys(patch);
      // Typing should not fill the back stack; a deliberate filter should.
      // Opening or closing a dialog never adds an entry either.
      const replace =
        (keys.length === 1 && 'q' in patch) || (keys.length === 1 && 'dialog' in patch);
      setSearchParams(next, { replace });
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

  /* ----------------------------- prompt actions ---------------------------- */

  const promptActions = useMemo<PromptActionHandlers>(
    () => ({
      onEdit: setEditingPrompt,
      onDuplicate: (prompt) => void handleDuplicate(prompt),
      onToggleArchive: (prompt) => void handleToggleArchive(prompt),
      onToggleFavorite: (prompt) => void handleToggleFavorite(prompt),
      onTogglePin: (prompt) => void handleTogglePin(prompt),
      onDelete: setDeletingPrompt,
    }),
    // The handlers are recreated with the component; behaviour is identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function submitPromptForm(values: PromptFormValues) {
    if (editingPrompt) {
      await editPrompt(editingPrompt.id, {
        title: values.title,
        description: values.description,
        folderId: values.folderId,
        collectionIds: values.collectionIds,
        tags: values.tags,
        status: values.status,
        schemaId: values.schemaId,
      });
      setEditingPrompt(null);
      toast.success({ title: 'Prompt details saved', description: values.title });
      return;
    }

    const template =
      values.templateId === null
        ? null
        : (templates.find((candidate) => candidate.id === values.templateId) ?? null);

    const created = await addPrompt({
      title: values.title,
      description: values.description,
      folderId: values.folderId,
      collectionIds: values.collectionIds,
      tags: values.tags,
      status: values.status,
      schemaId: values.schemaId,
      // One materialisation rule for every creation path (ADR-94): a deep copy
      // with snippet references dropped and an unresolvable schema reference
      // removed, so the new prompt shares nothing with the template.
      ...(template
        ? {
            content: instantiateTemplate(template, {
              knownSchemaIds: new Set(schemas.map((schema) => schema.id)),
            }).content,
          }
        : {}),
    });

    update({ dialog: null });
    toast.success({ title: 'Prompt created', description: created.title });
    navigate(`/prompts/${created.id}`);
  }

  async function handleDuplicate(prompt: Prompt) {
    try {
      const copy = await duplicatePrompt(prompt.id);
      toast.success({ title: 'Prompt duplicated', description: copy.title });
    } catch (error) {
      toast.error({
        title: 'The prompt could not be duplicated',
        description: describeDataError(error),
      });
    }
  }

  async function handleToggleArchive(prompt: Prompt) {
    try {
      if (prompt.archived) await unarchivePrompt(prompt.id);
      else await archivePrompt(prompt.id);

      const archived = !prompt.archived;
      toast.success({
        title: archived ? 'Prompt archived' : 'Prompt restored',
        description: prompt.title,
        action: {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              try {
                if (archived) await unarchivePrompt(prompt.id);
                else await archivePrompt(prompt.id);
              } catch (error) {
                toast.error({
                  title: 'That change could not be undone',
                  description: describeDataError(error),
                });
              }
            })();
          },
        },
      });
    } catch (error) {
      toast.error({
        title: 'The prompt was not updated',
        description: describeDataError(error),
      });
    }
  }

  async function confirmDeletePrompt() {
    if (!deletingPrompt) return;

    setPending(true);
    try {
      await deletePrompt(deletingPrompt.id);
      toast.success({ title: 'Prompt deleted', description: deletingPrompt.title });
      setDeletingPrompt(null);
    } catch (error) {
      toast.error({
        title: 'The prompt was not deleted',
        description: describeDataError(error),
      });
    } finally {
      setPending(false);
    }
  }

  /* -------------------------- folder and collection ------------------------ */

  function closeFolderDialog() {
    setFolderDialog(null);
    if (state.dialog === 'folder') update({ dialog: null });
  }

  function closeCollectionDialog() {
    setCollectionDialog(null);
    if (state.dialog === 'collection') update({ dialog: null });
  }

  async function submitFolder(values: FolderFormValues) {
    if (folderDialog?.mode === 'edit' && folderDialog.folder) {
      await updateFolder(folderDialog.folder.id, values);
      toast.success({ title: 'Folder saved', description: values.name });
    } else {
      await addFolder(values.name, values.parentId);
      toast.success({ title: 'Folder created', description: values.name });
    }

    closeFolderDialog();
  }

  async function submitCollection(values: CollectionFormValues) {
    if (collectionDialog?.mode === 'edit' && collectionDialog.collection) {
      await updateCollection(collectionDialog.collection.id, values);
      toast.success({ title: 'Collection saved', description: values.name });
    } else {
      await addCollection(values.name, values.description);
      toast.success({ title: 'Collection created', description: values.name });
    }

    closeCollectionDialog();
  }

  async function confirmDeleteFolder() {
    if (!deletingFolder) return;

    const destination = parentFolderLabel(folders, deletingFolder.parentId);
    setPending(true);
    try {
      const result = await deleteFolder(deletingFolder.id);
      toast.success({
        title: 'Folder deleted',
        description: `${result.promptsMoved} prompt${result.promptsMoved === 1 ? '' : 's'} moved to ${destination}.`,
      });
      setDeletingFolder(null);
    } catch (error) {
      toast.error({
        title: 'The folder was not deleted',
        description: describeDataError(error),
      });
    } finally {
      setPending(false);
    }
  }

  async function confirmDeleteCollection() {
    if (!deletingCollection) return;

    setPending(true);
    try {
      const result = await deleteCollection(deletingCollection.id);
      toast.success({
        title: 'Collection deleted',
        description: `${result.promptsDetached} prompt${result.promptsDetached === 1 ? '' : 's'} kept, membership removed.`,
      });
      setDeletingCollection(null);
    } catch (error) {
      toast.error({
        title: 'The collection was not deleted',
        description: describeDataError(error),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleToggleFavorite(prompt: Prompt) {
    try {
      const saved = await toggleFavorite(prompt.id);
      toast.success({
        title: saved.favorite ? 'Added to favorites' : 'Removed from favorites',
        description: prompt.title,
      });
    } catch (error) {
      toast.error({
        title: 'The favorite was not changed',
        description: describeDataError(error),
      });
    }
  }

  async function handleTogglePin(prompt: Prompt) {
    try {
      const saved = await togglePin(prompt.id);
      toast.success({
        title: saved.pinned ? 'Pinned' : 'Unpinned',
        description: prompt.title,
      });
    } catch (error) {
      toast.error({ title: 'The pin was not changed', description: describeDataError(error) });
    }
  }

  /* ------------------------------- bulk actions ---------------------------- */

  async function undoBulkChange(previous: readonly Prompt[]) {
    try {
      const restored = await restorePrompts(previous);
      toast.success({
        title: 'Bulk change undone',
        description: `${countPrompts(restored)} restored`,
      });
    } catch (error) {
      toast.error({
        title: 'That change could not be undone',
        description: describeDataError(error),
      });
    }
  }

  /**
   * Runs one bulk write and offers Undo with the exact rows that changed.
   *
   * The toast reports what the store returned, not what the selection looked
   * like: a row deleted in another tab is skipped by the store and must not be
   * counted as updated. Failures are re-thrown so a dialog can show them inline.
   */
  async function applyBulk(
    task: () => Promise<{
      readonly prompts: readonly Prompt[];
      readonly previous: readonly Prompt[];
    }>,
    title: string,
  ): Promise<void> {
    try {
      const result = await task();
      clearSelection();
      toast.success({
        title,
        description: `${countPrompts(result.prompts.length)} updated`,
        action: {
          label: 'Undo',
          onClick: () => {
            void undoBulkChange(result.previous);
          },
        },
      });
    } catch (error) {
      toast.error({
        title: 'That change was not saved',
        description: describeDataError(error),
      });
      throw error;
    }
  }

  /** Downloads the selected prompts as one bundle (TASK-026). */
  function handleBulkExport() {
    void transfer.exportSelectedPrompts(selectedPromptIds);
  }

  function handleBulkFavorite() {
    void applyBulk(() => setFavorite(selectedPromptIds, true), 'Added to favorites').catch(
      () => undefined,
    );
  }

  function handleBulkUnfavorite() {
    void applyBulk(() => setFavorite(selectedPromptIds, false), 'Removed from favorites').catch(
      () => undefined,
    );
  }

  function handleBulkArchive() {
    void applyBulk(() => setArchived(selectedPromptIds, true), 'Prompts archived').catch(
      () => undefined,
    );
  }

  function handleBulkRestore() {
    void applyBulk(() => setArchived(selectedPromptIds, false), 'Prompts restored').catch(
      () => undefined,
    );
  }

  async function submitBulkTags(values: BulkTagValues) {
    await applyBulk(() => editTags(selectedPromptIds, values), 'Tags updated');
  }

  async function confirmBulkDelete() {
    const ids = [...selectedPromptIds];
    setPending(true);
    try {
      const snapshot = await deletePrompts(ids);
      setBulkDeleteOpen(false);
      clearSelection();
      toast.success({
        title: 'Prompts deleted',
        description: countPrompts(snapshot.prompts.length),
        action: {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              try {
                const restored = await restoreDeletedPrompts(snapshot);
                toast.success({
                  title: 'Prompts restored',
                  description: `${countPrompts(restored)} brought back`,
                });
              } catch (error) {
                toast.error({
                  title: 'Those prompts could not be restored',
                  description: describeDataError(error),
                });
              }
            })();
          },
        },
      });
    } catch (error) {
      toast.error({
        title: 'The prompts were not deleted',
        description: describeDataError(error),
      });
    } finally {
      setPending(false);
    }
  }

  async function handleRenameTag(from: string, to: string) {
    const result = await renameTag(from, to);
    if (result.updated === 0) {
      toast.info({ title: 'No prompts carry that tag', description: 'Nothing was changed.' });
      return;
    }
    toast.success({ title: 'Tag renamed', description: `${countPrompts(result.updated)} updated` });
  }

  async function handleDeleteTag(tag: string) {
    const result = await deleteTag(tag);
    toast.success({
      title: 'Tag removed',
      description:
        result.updated === 0
          ? 'No prompts carried that tag.'
          : `${countPrompts(result.updated)} updated`,
    });
  }

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
  const archivedTotal = prompts.filter((prompt) => prompt.archived).length;
  const filtersActive = hasActiveFilters(state);

  const emptyState = libraryEmpty ? (
    <EmptyState
      title="Your library is empty"
      description="Prompts you create are stored in this browser. Start with a template or write the first one."
      icon={Plus}
      action={
        <Button variant="primary" onClick={() => update({ dialog: 'prompt' })}>
          Create a prompt
        </Button>
      }
      secondaryAction={
        <Link to="/templates" className={cn(buttonVariants({ variant: 'secondary' }))}>
          Browse templates
        </Link>
      }
    />
  ) : state.archived && archivedTotal === 0 ? (
    <EmptyState
      title="Your archive is empty"
      description="Archiving a prompt keeps it out of the working library without deleting it. Nothing is archived yet."
      icon={Archive}
      action={
        <Button variant="primary" onClick={() => update({ archived: false })}>
          Back to the library
        </Button>
      }
    />
  ) : state.archived ? (
    <EmptyState
      title="No archived prompts match"
      description="Nothing in the archive matches these filters. Clearing them shows every archived prompt again."
      icon={Archive}
      action={
        <Button variant="primary" onClick={clearAll}>
          Clear filters
        </Button>
      }
      secondaryAction={
        <Button variant="secondary" onClick={() => update({ archived: false })}>
          Back to the library
        </Button>
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
          <Button variant="secondary" onClick={() => update({ dialog: 'prompt' })}>
            New prompt
          </Button>
        ) : undefined
      }
    />
  );

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <LibraryHeader
          resultCount={0}
          totalCount={prompts.length}
          filtersActive={false}
          onNewPrompt={() => update({ dialog: 'prompt' })}
        />
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
        schemaIssueCounts={schemaIssueCounts}
        matches={matches}
        query={state.q}
        now={now}
        selectedIds={selected}
        onToggleSelected={handleToggleSelected}
        empty={emptyState}
        label="Matching prompts"
        actions={promptActions}
      />
    ) : (
      <PromptList
        prompts={others}
        parsableIds={parsableIds}
        schemaIssueCounts={schemaIssueCounts}
        matches={matches}
        query={state.q}
        now={now}
        selectedIds={selected}
        onToggleSelected={handleToggleSelected}
        empty={emptyState}
        label="Matching prompts"
        actions={promptActions}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <LibraryHeader
        resultCount={results.length}
        totalCount={prompts.length}
        filtersActive={filtersActive}
        onNewPrompt={() => update({ dialog: 'prompt' })}
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
            onNewFolder={(parentId) => setFolderDialog({ mode: 'create', folder: null, parentId })}
            onEditFolder={(folder) => setFolderDialog({ mode: 'edit', folder, parentId: null })}
            onDeleteFolder={setDeletingFolder}
            onNewCollection={() => setCollectionDialog({ mode: 'create', collection: null })}
            onEditCollection={(collection) => setCollectionDialog({ mode: 'edit', collection })}
            onDeleteCollection={setDeletingCollection}
            onManageTags={() => setTagManagerOpen(true)}
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
            <BulkActionBar
              selectedCount={selectedPromptIds.length}
              visibleCount={results.length}
              allVisibleSelected={allVisibleSelected}
              archivedScope={state.archived}
              busy={pending}
              onSelectAll={selectAllVisible}
              onClear={clearSelection}
              onFavorite={handleBulkFavorite}
              onUnfavorite={handleBulkUnfavorite}
              onEditTags={() => setBulkTagOpen(true)}
              onExport={handleBulkExport}
              onArchive={handleBulkArchive}
              onRestore={handleBulkRestore}
              onDelete={() => setBulkDeleteOpen(true)}
            />
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
                      schemaIssueCounts={schemaIssueCounts}
                      matches={matches}
                      query={state.q}
                      now={now}
                      selectedIds={selected}
                      onToggleSelected={handleToggleSelected}
                      empty={null}
                      label="Pinned prompts"
                      actions={promptActions}
                    />
                  ) : (
                    <PromptList
                      prompts={pinned}
                      parsableIds={parsableIds}
                      matches={matches}
                      query={state.q}
                      now={now}
                      selectedIds={selected}
                      onToggleSelected={handleToggleSelected}
                      empty={null}
                      label="Pinned prompts"
                      actions={promptActions}
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

      <PromptFormDialog
        open={state.dialog === 'prompt' || editingPrompt !== null}
        mode={editingPrompt ? 'edit' : 'create'}
        prompt={editingPrompt}
        folders={folders}
        collections={collections}
        templates={templates}
        schemas={schemas}
        tagSuggestions={tagSuggestions}
        onOpenChange={(open) => {
          if (open) return;
          if (editingPrompt) setEditingPrompt(null);
          else update({ dialog: null });
        }}
        onSubmit={submitPromptForm}
      />

      <DeletePromptDialog
        open={deletingPrompt !== null}
        prompt={deletingPrompt}
        revisionCount={
          deletingPrompt === null
            ? 0
            : revisions.filter((revision) => revision.promptId === deletingPrompt.id).length
        }
        testCaseCount={
          deletingPrompt === null
            ? 0
            : testCases.filter((testCase) => testCase.promptId === deletingPrompt.id).length
        }
        pending={pending}
        onOpenChange={(open) => {
          if (!open && !pending) setDeletingPrompt(null);
        }}
        onConfirm={() => void confirmDeletePrompt()}
      />

      <FolderDialog
        open={state.dialog === 'folder' || folderDialog !== null}
        mode={folderDialog?.mode ?? 'create'}
        folder={folderDialog?.folder ?? null}
        parentId={folderDialog?.parentId ?? null}
        folders={folders}
        onOpenChange={(open) => {
          if (!open) closeFolderDialog();
        }}
        onSubmit={submitFolder}
      />

      {deletingFolder ? (
        <DeleteContainerDialog
          open
          kind="folder"
          name={deletingFolder.name}
          promptCount={countFolderContents(prompts, folders, deletingFolder.id).prompts}
          folderCount={countFolderContents(prompts, folders, deletingFolder.id).folders}
          destination={parentFolderLabel(folders, deletingFolder.parentId)}
          pending={pending}
          onOpenChange={(open) => {
            if (!open && !pending) setDeletingFolder(null);
          }}
          onConfirm={() => void confirmDeleteFolder()}
        />
      ) : null}

      <CollectionDialog
        open={state.dialog === 'collection' || collectionDialog !== null}
        mode={collectionDialog?.mode ?? 'create'}
        collection={collectionDialog?.collection ?? null}
        onOpenChange={(open) => {
          if (!open) closeCollectionDialog();
        }}
        onSubmit={submitCollection}
      />

      {deletingCollection ? (
        <DeleteContainerDialog
          open
          kind="collection"
          name={deletingCollection.name}
          promptCount={countCollectionMembers(prompts, deletingCollection.id)}
          pending={pending}
          onOpenChange={(open) => {
            if (!open && !pending) setDeletingCollection(null);
          }}
          onConfirm={() => void confirmDeleteCollection()}
        />
      ) : null}

      <BulkTagDialog
        open={bulkTagOpen && selectedPromptIds.length > 0}
        count={selectedPromptIds.length}
        selectionTags={selectionTags}
        suggestions={tagSuggestions}
        onOpenChange={setBulkTagOpen}
        onSubmit={submitBulkTags}
      />

      <TagManagerDialog
        open={tagManagerOpen}
        tags={libraryTags}
        onOpenChange={setTagManagerOpen}
        onRename={handleRenameTag}
        onDelete={handleDeleteTag}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!pending) setBulkDeleteOpen(open);
        }}
        title={`Delete ${countPrompts(selectedPromptIds.length)}?`}
        description="The selected prompts are removed from this browser permanently, together with their saved snapshots and test cases. Undo is offered after the deletion, but nothing is guaranteed to survive a reload."
        confirmLabel="Delete prompts"
        tone="destructive"
        pending={pending}
        onConfirm={() => void confirmBulkDelete()}
      />
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
  onNewPrompt,
}: {
  readonly resultCount: number;
  readonly totalCount: number;
  readonly filtersActive: boolean;
  readonly onNewPrompt: () => void;
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

      <Button variant="primary" onClick={onNewPrompt} className="gap-2">
        <Plus aria-hidden="true" size={15} />
        New prompt
      </Button>
    </header>
  );
}
