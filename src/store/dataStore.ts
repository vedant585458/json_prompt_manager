/**
 * Application data store (TASK-007).
 *
 * The store owns the in-memory view of persisted data and is the only place
 * that mutates it. Every action:
 *
 * 1. calls a repository (the source of truth),
 * 2. refreshes state from the value the repository returned — never from an
 *    optimistic guess, so the UI cannot show a "saved" state that storage never
 *    accepted,
 * 3. records an activity event describing what changed.
 *
 * Errors are typed, stored on `error` for inline display, and rethrown so a
 * caller (dialog, form) can decide what to do next.
 */

import { create } from 'zustand';

import {
  RecordNotFoundError,
  StorageError,
  StorageUnavailableError,
  type Repositories,
  type StorageMode,
} from '@/data';
import {
  createActivityEvent,
  createCollection,
  createFolder,
  createPrompt as createPromptEntity,
  createPromptSchema,
  createRevision,
  createTemplate as createTemplateEntity,
  systemDependencies,
  type CreatePromptInput,
  type DomainDependencies,
} from '@/domain/factories';
import {
  ACTIVITY_LOG_LIMIT,
  applyTagEdit,
  capActivityLog,
  checkCollectionName,
  checkFolderMove,
  checkFolderName,
  checkNewFolder,
  hasErrors,
  nextRevisionNumber,
  normalizeTag,
  normalizeTags,
  normalizeTitle,
} from '@/domain/invariants';
import { RuleViolationError } from '@/domain/errors';
import {
  builtInTemplateIssue,
  checkTemplateName,
  instantiateTemplate,
  nextTemplateName,
  templateDraftFromPrompt,
  templateIssues,
} from '@/domain/templates';
import type {
  ActivityType,
  ActivityEvent,
  Collection,
  DomainIssue,
  Folder,
  JsonObject,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
  PromptStatus,
  PromptTemplate,
  Settings,
  Snippet,
  TestCase,
  VariableDefinition,
} from '@/domain/types';

export type { StorageMode } from '@/data';
export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Fields a caller may change; identity, timestamps, and counters are derived. */
/** Optional guard for a prompt write (TASK-015). */
export interface WriteGuard {
  /** Version the edit was based on; a newer stored version is a conflict. */
  readonly expectedVersion?: number;
}

/** A new schema record. Identity and timestamps are derived by the store. */
export interface SchemaInput {
  readonly name: string;
  readonly description?: string;
  readonly schemaContent: JsonObject;
}

/** Fields a caller may change on a stored schema. */
export interface SchemaEdit {
  readonly name?: string;
  readonly description?: string;
  readonly schemaContent?: JsonObject;
}

/** What deleting a schema did to the prompts that used it. */
export interface SchemaDeletion {
  readonly schema: PromptSchema;
  readonly detachedPrompts: number;
}

export interface PromptEdit {
  readonly title?: string;
  readonly description?: string;
  readonly content?: Prompt['content'];
  readonly tags?: readonly string[];
  readonly status?: PromptStatus;
  readonly folderId?: string | null;
  readonly collectionIds?: readonly string[];
  readonly favorite?: boolean;
  readonly pinned?: boolean;
  readonly archived?: boolean;
  readonly schemaId?: string | null;
  readonly variables?: readonly VariableDefinition[];
  readonly metadata?: Readonly<Record<string, string>>;
}

/** What a folder deletion did, so the caller can report it honestly. */
export interface FolderDeletion {
  readonly promptsMoved: number;
  readonly foldersMoved: number;
}

/** What a collection deletion did: prompts are kept, membership removed. */
export interface CollectionDeletion {
  readonly promptsDetached: number;
}

export interface FolderEdit {
  readonly name?: string;
  readonly parentId?: string | null;
}

export interface CollectionEdit {
  readonly name?: string;
  readonly description?: string;
}

/** What a bulk edit changed, with the previous values so it can be undone. */
export interface BulkPromptResult {
  readonly prompts: readonly Prompt[];
  readonly previous: readonly Prompt[];
}

/** Everything needed to bring deleted prompts back, for undo. */
export interface DeletedPrompts {
  readonly prompts: readonly Prompt[];
  readonly revisions: readonly PromptRevision[];
  readonly testCases: readonly TestCase[];
}

/** How many stored prompts a tag operation rewrote. */
export interface TagUpdateResult {
  readonly updated: number;
}

/** A new user template. Identity and timestamps are derived by the store. */
export interface TemplateInput {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly content: PromptDocument;
}

/** Fields a caller may change on a stored user template. */
export interface TemplateEdit {
  readonly name?: string;
  readonly description?: string;
  readonly category?: string;
}

/** Metadata for "save this prompt as a template"; the document comes from the prompt. */
export interface TemplateFromPromptInput {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
}

export interface UseTemplateOptions {
  /** Title for the new prompt; defaults to the template name. */
  readonly title?: string;
}

export interface DataState {
  /** Whether writes survive a reload. Set by `attach`. */
  readonly mode: StorageMode;
  readonly status: DataStatus;
  /** Last failure message, safe to display. Cleared by the next action. */
  readonly error: string | null;
  /** True while a mutation is in flight. */
  readonly busy: boolean;

  readonly prompts: readonly Prompt[];
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly templates: readonly PromptTemplate[];
  readonly testCases: readonly TestCase[];
  readonly schemas: readonly PromptSchema[];
  readonly snippets: readonly Snippet[];
  readonly activity: readonly ActivityEvent[];
  /** Every stored revision, newest first as `hydrate` sorts them; the dashboard counts them. */
  readonly revisions: readonly PromptRevision[];
  readonly settings: Settings | null;

  /** Binds repositories opened by the bootstrap. Does not read anything. */
  attach: (repositories: Repositories, mode: StorageMode) => void;
  /** Reads every repository into state. Safe to call again (retry). */
  hydrate: () => Promise<void>;

  addPrompt: (input?: CreatePromptInput) => Promise<Prompt>;
  /**
   * Applies an edit and reports the saved prompt.
   *
   * `expectedVersion` is the version the caller's copy is based on (TASK-015).
   * When supplied, a write against a newer stored record fails with
   * `StaleWriteError` instead of silently overwriting it — the editor uses this
   * to detect a save from another tab. Omit it for ordinary edits.
   */
  editPrompt: (id: string, changes: PromptEdit, options?: WriteGuard) => Promise<Prompt>;
  /**
   * Reads one prompt straight from storage without touching state (TASK-015).
   *
   * Conflict resolution needs to show what is *currently* stored while the
   * editor still holds the user's draft, so it cannot go through `hydrate`.
   */
  readStoredPrompt: (id: string) => Promise<Prompt | null>;
  /** Copies a prompt under a "(copy)" title; the copy shares no mutable state. */
  duplicatePrompt: (id: string) => Promise<Prompt>;
  movePrompt: (id: string, folderId: string | null) => Promise<Prompt>;
  archivePrompt: (id: string) => Promise<Prompt>;
  unarchivePrompt: (id: string) => Promise<Prompt>;
  /** Deletes the prompt, its revisions, and its test cases together. */
  deletePrompt: (id: string) => Promise<void>;
  /** Flips favorite and reports the saved prompt; the write happens first. */
  toggleFavorite: (id: string) => Promise<Prompt>;
  /** Flips pin; pinned ordering itself belongs to the library selector. */
  togglePin: (id: string) => Promise<Prompt>;

  /** Writes one field to every prompt in `ids`, returning prior values for undo. */
  setFavorite: (ids: readonly string[], favorite: boolean) => Promise<BulkPromptResult>;
  setPinned: (ids: readonly string[], pinned: boolean) => Promise<BulkPromptResult>;
  setArchived: (ids: readonly string[], archived: boolean) => Promise<BulkPromptResult>;
  /** Adds and removes tags across `ids` in one pass (TASK-013). */
  editTags: (
    ids: readonly string[],
    edit: { readonly add?: readonly string[]; readonly remove?: readonly string[] },
  ) => Promise<BulkPromptResult>;
  /** Restores the reversible fields of `previous`, leaving other edits intact. */
  restorePrompts: (previous: readonly Prompt[]) => Promise<number>;
  /** Renames a tag on every prompt that carries it; returns the affected count. */
  renameTag: (from: string, to: string) => Promise<TagUpdateResult>;
  /** Removes a tag from every prompt that carries it. */
  deleteTag: (tag: string) => Promise<TagUpdateResult>;
  /** Deletes several prompts, returning what was removed so it can be undone. */
  deletePrompts: (ids: readonly string[]) => Promise<DeletedPrompts>;
  /** Re-creates prompts, revisions, and test cases captured by `deletePrompts`. */
  restoreDeletedPrompts: (snapshot: DeletedPrompts) => Promise<number>;
  /** Saves a manual snapshot revision for a prompt. */
  snapshotPrompt: (id: string, label?: string | null) => Promise<PromptRevision>;

  addFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  updateFolder: (id: string, changes: FolderEdit) => Promise<Folder>;
  /** Deletes a folder; its prompts and child folders move up one level. */
  deleteFolder: (id: string) => Promise<FolderDeletion>;
  addCollection: (name: string, description?: string) => Promise<Collection>;
  updateCollection: (id: string, changes: CollectionEdit) => Promise<Collection>;
  /** Deletes a collection; prompts keep their place and lose the membership. */
  deleteCollection: (id: string) => Promise<CollectionDeletion>;

  /** Creates a reusable JSON Schema (TASK-016). */
  addSchema: (input: SchemaInput) => Promise<PromptSchema>;
  updateSchema: (id: string, changes: SchemaEdit) => Promise<PromptSchema>;
  /**
   * Deletes a schema and detaches it from every prompt that used it.
   *
   * Detaching is a write to those prompts, so it happens through `updateMany`:
   * either all of them lose the reference or none does, and the stored version
   * of each prompt moves forward (which the editor treats as a metadata-only
   * change).
   */
  deleteSchema: (id: string) => Promise<SchemaDeletion>;
  /** Attaches a schema to one prompt, or detaches it with `null`. */
  setPromptSchema: (promptId: string, schemaId: string | null) => Promise<Prompt>;

  /**
   * Stores a user template (TASK-018).
   *
   * The document is validated first: a template that could not become a valid
   * prompt must never be offered as a starting point. Names are unique
   * case-insensitively across built-ins and user templates.
   */
  createTemplate: (input: TemplateInput) => Promise<PromptTemplate>;
  /** Saves a copy of a stored prompt's document as a user template. */
  createTemplateFromPrompt: (
    promptId: string,
    input: TemplateFromPromptInput,
  ) => Promise<PromptTemplate>;
  /** Renames, re-describes, or re-categorises a user template. */
  updateTemplate: (id: string, changes: TemplateEdit) => Promise<PromptTemplate>;
  /** Copies any template into a user template; the source is never touched. */
  duplicateTemplate: (id: string, changes?: TemplateEdit) => Promise<PromptTemplate>;
  /** Deletes a user template; built-ins are refused, never silently skipped. */
  deleteTemplate: (id: string) => Promise<PromptTemplate>;
  /**
   * Creates an independent prompt from a template and records the usage.
   *
   * Snippet references are dropped (a template carries no snippet merges) and,
   * when the referenced schema is not stored, so is the schema reference. Both
   * removals are reported by `instantiateTemplate` and by the preview.
   */
  useTemplate: (id: string, options?: UseTemplateOptions) => Promise<Prompt>;

  saveSettings: (settings: Settings) => Promise<Settings>;

  clearError: () => void;
}

export type DataStore = ReturnType<typeof createDataStore>;

export interface DataStoreOptions {
  readonly now?: () => Date;
  readonly newId?: () => string;
}

const collator = new Intl.Collator('en', { sensitivity: 'base' });

/** `updatedAt` descending, id ascending — the repository's prompt order. */
function sortPrompts(prompts: readonly Prompt[]): Prompt[] {
  return [...prompts].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
    return left.id.localeCompare(right.id);
  });
}

/** Name ascending, case-insensitive, id ascending — the repository's order. */
function sortByName<T extends { id: string; name: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const byName = collator.compare(left.name, right.name);
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });
}

function upsertPrompt(prompts: readonly Prompt[], prompt: Prompt): Prompt[] {
  return sortPrompts([prompt, ...prompts.filter((candidate) => candidate.id !== prompt.id)]);
}

/** Replaces a record by id, or appends it; schemas keep their stored order. */
function upsertById<T extends { readonly id: string }>(items: readonly T[], next: T): T[] {
  const found = items.some((item) => item.id === next.id);
  return found ? items.map((item) => (item.id === next.id ? next : item)) : [...items, next];
}

/** Templates are ordered by name, matching the repository contract. */
function upsertTemplate(
  templates: readonly PromptTemplate[],
  next: PromptTemplate,
): PromptTemplate[] {
  return sortByName([next, ...templates.filter((candidate) => candidate.id !== next.id)]);
}

/** User-safe message for any failure the store caught. */
export function describeDataError(error: unknown): string {
  if (error instanceof StorageError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Storage failed for an unknown reason.';
}

function applyEdit(current: Prompt, changes: PromptEdit, updatedAt: string): Prompt {
  const content = changes.content ?? current.content;
  const title = changes.title === undefined ? current.title : normalizeTitle(changes.title);

  return {
    id: current.id,
    title: title.length > 0 ? title : current.title,
    description: changes.description ?? current.description,
    content,
    format: current.format,
    folderId: changes.folderId === undefined ? current.folderId : changes.folderId,
    collectionIds: changes.collectionIds ? [...changes.collectionIds] : current.collectionIds,
    tags: changes.tags ? normalizeTags(changes.tags) : current.tags,
    favorite: changes.favorite ?? current.favorite,
    pinned: changes.pinned ?? current.pinned,
    archived: changes.archived ?? current.archived,
    status: changes.status ?? current.status,
    createdAt: current.createdAt,
    updatedAt,
    schemaId: changes.schemaId === undefined ? current.schemaId : changes.schemaId,
    variables: changes.variables ?? changes.content?.variables ?? current.variables,
    metadata: changes.metadata ? { ...changes.metadata } : current.metadata,
    version: current.version + 1,
  };
}

/** Throws the first fatal rule issue, if any. */
function throwIfInvalid(issues: readonly DomainIssue[]): void {
  if (hasErrors(issues)) throw new RuleViolationError(issues);
}

/**
 * Deep copy for document bodies.
 *
 * Documents are JSON by definition, so a round-trip is exact and guarantees a
 * duplicate or a template-based prompt shares no nested arrays or objects with
 * its source.
 */
function copyDocument(document: PromptDocument): PromptDocument {
  return JSON.parse(JSON.stringify(document)) as PromptDocument;
}

/**
 * "Title (copy)", then "Title (copy 2)", and so on.
 *
 * Comparison is case-insensitive over every prompt in the library, so two
 * copies created in a row cannot end up with the same name.
 */
function copyTitle(title: string, prompts: readonly Prompt[]): string {
  const taken = new Set(prompts.map((prompt) => prompt.title.toLowerCase()));
  let candidate = `${title} (copy)`;
  let attempt = 2;

  while (taken.has(candidate.toLowerCase())) {
    candidate = `${title} (copy ${attempt})`;
    attempt += 1;
  }

  return candidate;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Creates a store instance.
 *
 * Dependencies are injectable so tests can drive a fixed clock and id sequence
 * without touching the module-level singleton the application uses.
 */
export function createDataStore(options: DataStoreOptions = {}) {
  const dependencies: DomainDependencies = {
    now: options.now ?? systemDependencies.now,
    newId: options.newId ?? systemDependencies.newId,
  };

  let repositories: Repositories | null = null;

  return create<DataState>()((set, get) => {
    function requireRepositories(): Repositories {
      if (!repositories) {
        throw new StorageUnavailableError(
          'Storage is not ready yet. PromptForge has not finished opening the database.',
        );
      }
      return repositories;
    }

    async function run<T>(task: (repos: Repositories) => Promise<T>): Promise<T> {
      set({ busy: true, error: null });
      try {
        const repos = requireRepositories();
        const value = await task(repos);
        set({ busy: false });
        return value;
      } catch (error) {
        set({ busy: false, error: describeDataError(error) });
        throw error;
      }
    }

    /**
     * Appends an activity event.
     *
     * Activity is secondary: if it cannot be written, the mutation has already
     * succeeded and must not be rolled back or hidden. The failure is surfaced
     * on `error` so the user knows the timeline is incomplete.
     */
    async function recordActivity(input: {
      type: ActivityType;
      summary: string;
      promptId?: string;
      promptTitle?: string;
    }): Promise<void> {
      const repos = requireRepositories();
      const event = createActivityEvent(input, dependencies);

      try {
        await repos.activity.append(event);
      } catch (error) {
        set({
          error: `That change was saved, but its activity entry could not be recorded. ${describeDataError(error)}`,
        });
        return;
      }

      set((state) => ({
        activity: capActivityLog([event, ...state.activity], ACTIVITY_LOG_LIMIT),
      }));
    }

    async function writePrompt(
      id: string,
      changes: PromptEdit,
      activityType: ActivityType,
      describe: (saved: Prompt, previous: Prompt) => string,
      guard?: WriteGuard,
    ): Promise<Prompt> {
      return run(async (repos) => {
        const current = await repos.prompts.get(id);
        if (!current) throw new RecordNotFoundError(`Prompt ${id} no longer exists.`);

        const next = applyEdit(current, changes, dependencies.now().toISOString());
        const saved = await repos.prompts.update(next, {
          expectedVersion: guard?.expectedVersion ?? current.version,
        });

        set((state) => ({ prompts: upsertPrompt(state.prompts, saved) }));
        await recordActivity({
          type: activityType,
          summary: describe(saved, current),
          promptId: saved.id,
          promptTitle: saved.title,
        });
        return saved;
      });
    }

    /**
     * Validates and stores a new template.
     *
     * Both checks run against the current state, not against the caller's copy:
     * a second tab may have created the same name between render and save. Every
     * rule issue is fatal here — a template is a blueprint, so it must be usable
     * the moment it appears in the catalogue.
     */
    async function saveTemplate(
      repos: Repositories,
      candidate: PromptTemplate,
      summary: string,
    ): Promise<PromptTemplate> {
      throwIfInvalid([
        ...templateIssues(candidate),
        ...checkTemplateName(candidate.name, get().templates),
      ]);

      const saved = await repos.templates.create(candidate);
      set((state) => ({ templates: upsertTemplate(state.templates, saved) }));
      await recordActivity({ type: 'template', summary });
      return saved;
    }

    /**
     * Applies one edit to every prompt in `ids`.
     *
     * Prompts that vanished between selection and execution are skipped rather
     * than recreated: the caller selected rows it could see, and a row that no
     * longer exists has nothing to change. A failure anywhere re-reads storage,
     * so a half-applied bulk edit can never be shown as if it succeeded.
     */
    async function bulkWrite(
      ids: readonly string[],
      derive: (prompt: Prompt) => PromptEdit,
      activityType: ActivityType,
      describe: (count: number) => string,
    ): Promise<BulkPromptResult> {
      return run(async (repos) => {
        const wanted = new Set(ids);
        const targets = get().prompts.filter((prompt) => wanted.has(prompt.id));
        const updatedAt = dependencies.now().toISOString();

        try {
          // One transaction: a stale row or a storage failure leaves every
          // prompt at its stored value instead of half-applying the batch.
          const saved = await repos.prompts.updateMany(
            targets.map((prompt) => ({
              prompt: applyEdit(prompt, derive(prompt), updatedAt),
              expectedVersion: prompt.version,
            })),
          );

          set((current) => ({
            prompts: saved.reduce((list, prompt) => upsertPrompt(list, prompt), current.prompts),
          }));

          const [only] = saved;
          await recordActivity({
            type: activityType,
            summary: describe(saved.length),
            ...(saved.length === 1 && only ? { promptId: only.id, promptTitle: only.title } : {}),
          });

          return { prompts: saved, previous: targets };
        } catch (error) {
          await get().hydrate();
          throw error;
        }
      });
    }

    return {
      mode: 'durable',
      status: 'idle',
      error: null,
      busy: false,
      prompts: [],
      folders: [],
      collections: [],
      templates: [],
      testCases: [],
      schemas: [],
      snippets: [],
      activity: [],
      revisions: [],
      settings: null,

      attach: (nextRepositories, mode) => {
        // React StrictMode mounts effects twice in development, so a boot can be
        // repeated. Release the connection the previous boot opened instead of
        // leaking it; a no-op for the in-memory adapter.
        const previous = repositories;
        repositories = nextRepositories;
        if (previous && previous !== nextRepositories) void previous.close();

        set({ mode, status: 'idle', error: null, busy: false });
      },

      hydrate: async () => {
        // Re-syncing an already-rendered screen must not blank it: the first
        // load shows loading/aria-busy, later re-reads keep the current view.
        set((state) => ({ status: state.status === 'ready' ? 'ready' : 'loading', error: null }));
        try {
          const repos = requireRepositories();
          const [
            prompts,
            folders,
            collections,
            templates,
            testCases,
            schemas,
            snippets,
            activity,
            settings,
          ] = await Promise.all([
            repos.prompts.list(),
            repos.folders.list(),
            repos.collections.list(),
            repos.templates.list(),
            repos.testCases.list(),
            repos.schemas.list(),
            repos.snippets.list(),
            repos.activity.list(ACTIVITY_LOG_LIMIT),
            repos.settings.get(),
          ]);

          // Revisions are fetched per prompt: the repository contract exposes
          // them by prompt (that is how the history panel will read them), and
          // the dashboard only needs the total for its snapshot statistic.
          const revisions = (
            await Promise.all(prompts.map((prompt) => repos.revisions.listByPrompt(prompt.id)))
          )
            .flat()
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

          set({
            status: 'ready',
            prompts,
            folders,
            collections,
            templates,
            testCases,
            schemas,
            snippets,
            activity,
            revisions,
            settings,
          });
        } catch (error) {
          set({ status: 'error', error: describeDataError(error) });
        }
      },

      addPrompt: async (input = {}) =>
        run(async (repos) => {
          const prompt = createPromptEntity(input, dependencies);
          const saved = await repos.prompts.create(prompt);

          set((state) => ({ prompts: upsertPrompt(state.prompts, saved) }));
          await recordActivity({
            type: 'created',
            summary: `Created "${saved.title}"`,
            promptId: saved.id,
            promptTitle: saved.title,
          });
          return saved;
        }),

      editPrompt: (id, changes, guard) =>
        writePrompt(id, changes, 'updated', (saved) => `Updated "${saved.title}"`, guard),

      readStoredPrompt: async (id) => {
        const repos = requireRepositories();
        try {
          return await repos.prompts.get(id);
        } catch (error) {
          set({ error: describeDataError(error) });
          throw error;
        }
      },

      duplicatePrompt: async (id) =>
        run(async (repos) => {
          const state = get();
          const source = state.prompts.find((prompt) => prompt.id === id);
          if (!source) throw new RecordNotFoundError(`Prompt ${id} no longer exists.`);

          const copy = createPromptEntity(
            {
              title: copyTitle(source.title, state.prompts),
              description: source.description,
              content: copyDocument(source.content),
              format: source.format,
              folderId: source.folderId,
              collectionIds: [...source.collectionIds],
              tags: [...source.tags],
              status: source.status,
              schemaId: source.schemaId,
              variables: JSON.parse(JSON.stringify(source.variables)) as VariableDefinition[],
              metadata: { ...source.metadata },
            },
            dependencies,
          );
          const saved = await repos.prompts.create(copy);
          set((current) => ({ prompts: upsertPrompt(current.prompts, saved) }));

          await recordActivity({
            type: 'created',
            summary: `Duplicated "${source.title}"`,
            promptId: saved.id,
            promptTitle: saved.title,
          });
          return saved;
        }),

      movePrompt: async (id, folderId) => {
        const state = get();
        const folder =
          folderId === null ? null : state.folders.find((item) => item.id === folderId);
        if (folderId !== null && !folder) {
          throw new RuleViolationError([
            { path: 'folderId', message: 'Target folder no longer exists.', severity: 'error' },
          ]);
        }

        return writePrompt(
          id,
          { folderId },
          'updated',
          (saved) => `Moved "${saved.title}" to ${folder?.name ?? 'Unfiled'}`,
        );
      },

      archivePrompt: (id) =>
        writePrompt(id, { archived: true }, 'archived', (saved) => `Archived "${saved.title}"`),

      unarchivePrompt: (id) =>
        writePrompt(
          id,
          { archived: false },
          'updated',
          (saved) => `Restored "${saved.title}" from the archive`,
        ),

      deletePrompt: async (id) =>
        run(async (repos) => {
          const current = await repos.prompts.get(id);
          // Revisions and test cases go in the same transaction as the prompt.
          await repos.prompts.deleteCascade(id);

          set((state) => ({
            prompts: state.prompts.filter((prompt) => prompt.id !== id),
            revisions: state.revisions.filter((revision) => revision.promptId !== id),
            testCases: state.testCases.filter((testCase) => testCase.promptId !== id),
          }));

          await recordActivity({
            type: 'deleted',
            summary: current
              ? `Deleted "${current.title}"`
              : 'Deleted a prompt that no longer existed',
            ...(current ? { promptId: current.id, promptTitle: current.title } : {}),
          });
        }),

      toggleFavorite: (id) => {
        const current = get().prompts.find((prompt) => prompt.id === id);
        const favorite = !(current?.favorite ?? false);
        return writePrompt(id, { favorite }, 'updated', (saved) =>
          favorite ? `Favorited "${saved.title}"` : `Removed "${saved.title}" from favorites`,
        );
      },

      togglePin: (id) => {
        const current = get().prompts.find((prompt) => prompt.id === id);
        const pinned = !(current?.pinned ?? false);
        return writePrompt(id, { pinned }, 'updated', (saved) =>
          pinned ? `Pinned "${saved.title}"` : `Unpinned "${saved.title}"`,
        );
      },

      setFavorite: (ids, favorite) =>
        bulkWrite(
          ids,
          () => ({ favorite }),
          'updated',
          (count) =>
            favorite
              ? `Favorited ${plural(count, 'prompt', 'prompts')}`
              : `Removed ${plural(count, 'prompt', 'prompts')} from favorites`,
        ),

      setPinned: (ids, pinned) =>
        bulkWrite(
          ids,
          () => ({ pinned }),
          'updated',
          (count) =>
            pinned
              ? `Pinned ${plural(count, 'prompt', 'prompts')}`
              : `Unpinned ${plural(count, 'prompt', 'prompts')}`,
        ),

      setArchived: (ids, archived) =>
        bulkWrite(
          ids,
          () => ({ archived }),
          archived ? 'archived' : 'updated',
          (count) =>
            archived
              ? `Archived ${plural(count, 'prompt', 'prompts')}`
              : `Restored ${plural(count, 'prompt', 'prompts')} from the archive`,
        ),

      editTags: (ids, edit) =>
        bulkWrite(
          ids,
          (prompt) => ({
            tags: applyTagEdit(prompt.tags, {
              add: edit.add ?? [],
              remove: edit.remove ?? [],
            }),
          }),
          'updated',
          (count) => `Updated tags on ${plural(count, 'prompt', 'prompts')}`,
        ),

      restorePrompts: async (previous) =>
        run(async (repos) => {
          const live = get().prompts;
          const updatedAt = dependencies.now().toISOString();

          try {
            const writes = previous.flatMap((snapshot) => {
              const current = live.find((prompt) => prompt.id === snapshot.id);
              // A prompt deleted since the bulk edit has nothing to restore; its
              // own delete performed the irreversible part.
              if (!current) return [];

              return [
                {
                  prompt: applyEdit(
                    current,
                    {
                      favorite: snapshot.favorite,
                      pinned: snapshot.pinned,
                      archived: snapshot.archived,
                      tags: [...snapshot.tags],
                    },
                    updatedAt,
                  ),
                  expectedVersion: current.version,
                },
              ];
            });

            const saved = await repos.prompts.updateMany(writes);

            set((state) => ({
              prompts: saved.reduce((list, prompt) => upsertPrompt(list, prompt), state.prompts),
            }));

            await recordActivity({
              type: 'updated',
              summary: `Undid a bulk change on ${plural(saved.length, 'prompt', 'prompts')}`,
            });
            return saved.length;
          } catch (error) {
            await get().hydrate();
            throw error;
          }
        }),

      renameTag: async (from, to) => {
        const source = normalizeTag(from);
        const target = normalizeTag(to);

        if (target.length === 0) {
          throw new RuleViolationError([
            {
              path: 'tag',
              message: 'Use letters, numbers, or dashes for the new tag name.',
              severity: 'error',
            },
          ]);
        }
        if (source.length === 0 || source === target) return { updated: 0 };

        const affected = get().prompts.filter((prompt) => prompt.tags.includes(source));
        if (affected.length === 0) return { updated: 0 };

        const result = await bulkWrite(
          affected.map((prompt) => prompt.id),
          // Rename in place so a prompt's tag order survives, then de-duplicate
          // for the case where the target already existed (a merge).
          (prompt) => ({
            tags: normalizeTags(prompt.tags.map((tag) => (tag === source ? target : tag))),
          }),
          'updated',
          (count) =>
            `Renamed tag "#${source}" to "#${target}" on ${plural(count, 'prompt', 'prompts')}`,
        );

        return { updated: result.prompts.length };
      },

      deleteTag: async (tag) => {
        const normalized = normalizeTag(tag);
        if (normalized.length === 0) return { updated: 0 };

        const affected = get().prompts.filter((prompt) => prompt.tags.includes(normalized));
        if (affected.length === 0) return { updated: 0 };

        const result = await bulkWrite(
          affected.map((prompt) => prompt.id),
          (prompt) => ({
            tags: applyTagEdit(prompt.tags, { add: [], remove: [normalized] }),
          }),
          'updated',
          (count) => `Removed tag "#${normalized}" from ${plural(count, 'prompt', 'prompts')}`,
        );

        return { updated: result.prompts.length };
      },

      deletePrompts: async (ids) => {
        const wanted = new Set(ids);
        const state = get();
        const targets = state.prompts.filter((prompt) => wanted.has(prompt.id));
        const snapshot: DeletedPrompts = {
          prompts: targets,
          revisions: state.revisions.filter((revision) => wanted.has(revision.promptId)),
          testCases: state.testCases.filter((testCase) => wanted.has(testCase.promptId)),
        };

        return run(async (repos) => {
          try {
            // One transaction across the whole selection: a failure cannot
            // leave half the list deleted without an undo affordance.
            await repos.prompts.deleteManyCascade(targets.map((prompt) => prompt.id));
          } catch (error) {
            await get().hydrate();
            throw error;
          }

          set((current) => ({
            prompts: current.prompts.filter((prompt) => !wanted.has(prompt.id)),
            revisions: current.revisions.filter((revision) => !wanted.has(revision.promptId)),
            testCases: current.testCases.filter((testCase) => !wanted.has(testCase.promptId)),
          }));

          await recordActivity({
            type: 'deleted',
            summary: `Deleted ${plural(targets.length, 'prompt', 'prompts')}`,
          });

          return snapshot;
        });
      },

      restoreDeletedPrompts: async (snapshot) =>
        run(async (repos) => {
          try {
            const prompts: Prompt[] = [];
            for (const prompt of snapshot.prompts) prompts.push(await repos.prompts.create(prompt));

            const revisions: PromptRevision[] = [];
            for (const revision of snapshot.revisions) {
              revisions.push(await repos.revisions.create(revision));
            }

            const testCases: TestCase[] = [];
            for (const testCase of snapshot.testCases) {
              testCases.push(await repos.testCases.create(testCase));
            }

            set((state) => ({
              prompts: prompts.reduce((list, prompt) => upsertPrompt(list, prompt), state.prompts),
              revisions: [...revisions, ...state.revisions],
              testCases: [...testCases, ...state.testCases],
            }));

            await recordActivity({
              type: 'restored',
              summary: `Restored ${plural(prompts.length, 'prompt', 'prompts')}`,
            });
            return prompts.length;
          } catch (error) {
            await get().hydrate();
            throw error;
          }
        }),

      snapshotPrompt: async (id, label = null) =>
        run(async (repos) => {
          const prompt = await repos.prompts.get(id);
          if (!prompt) throw new RecordNotFoundError(`Prompt ${id} no longer exists.`);

          const existing = await repos.revisions.listByPrompt(id);
          const revision = createRevision(
            prompt,
            {
              revisionNumber: nextRevisionNumber(existing),
              kind: 'manual',
              label,
            },
            dependencies,
          );
          const saved = await repos.revisions.create(revision);
          set((state) => ({ revisions: [saved, ...state.revisions] }));

          await recordActivity({
            type: 'snapshot',
            summary: `Saved snapshot v${saved.revisionNumber} of "${prompt.title}"`,
            promptId: prompt.id,
            promptTitle: prompt.title,
          });
          return saved;
        }),

      addFolder: async (name, parentId = null) =>
        run(async (repos) => {
          throwIfInvalid(checkNewFolder(get().folders, name, parentId));

          const folder = await repos.folders.create(createFolder({ name, parentId }, dependencies));
          set((state) => ({ folders: sortByName([folder, ...state.folders]) }));
          await recordActivity({ type: 'created', summary: `Created folder "${folder.name}"` });
          return folder;
        }),

      updateFolder: async (id, changes) =>
        run(async (repos) => {
          const state = get();
          const current = state.folders.find((folder) => folder.id === id);
          if (!current) throw new RecordNotFoundError(`Folder ${id} no longer exists.`);

          const name = changes.name === undefined ? current.name : normalizeTitle(changes.name);
          const parentId = changes.parentId === undefined ? current.parentId : changes.parentId;

          throwIfInvalid([
            ...checkFolderName(state.folders, name, parentId, id),
            ...checkFolderMove(state.folders, id, parentId),
          ]);

          const saved = await repos.folders.update({
            ...current,
            name,
            parentId,
            updatedAt: dependencies.now().toISOString(),
          });
          set((state) => ({
            folders: sortByName([saved, ...state.folders.filter((folder) => folder.id !== id)]),
          }));

          const parentName =
            parentId === null
              ? null
              : (state.folders.find((folder) => folder.id === parentId)?.name ?? null);
          const renamed = saved.name !== current.name;
          const moved = saved.parentId !== current.parentId;
          const summary = renamed
            ? `Renamed folder "${current.name}" to "${saved.name}"${moved ? ' and moved it' : ''}`
            : `Moved folder "${saved.name}" to ${parentName ?? 'the top level'}`;

          await recordActivity({ type: 'updated', summary });
          return saved;
        }),

      deleteFolder: async (id) =>
        run(async (repos) => {
          const state = get();
          const folder = state.folders.find((candidate) => candidate.id === id);
          if (!folder) throw new RecordNotFoundError(`Folder ${id} no longer exists.`);

          const parentId = folder.parentId;
          const childFolders = state.folders.filter((candidate) => candidate.parentId === id);
          const affectedPrompts = state.prompts.filter((prompt) => prompt.folderId === id);
          const updatedAt = dependencies.now().toISOString();

          try {
            const savedFolders: Folder[] = [];
            for (const child of childFolders) {
              savedFolders.push(await repos.folders.update({ ...child, parentId, updatedAt }));
            }

            const savedPrompts: Prompt[] = [];
            for (const prompt of affectedPrompts) {
              savedPrompts.push(
                await repos.prompts.update(applyEdit(prompt, { folderId: parentId }, updatedAt), {
                  expectedVersion: prompt.version,
                }),
              );
            }

            await repos.folders.delete(id);

            const movedIds = new Set(childFolders.map((child) => child.id));
            set((state) => ({
              folders: sortByName([
                ...savedFolders,
                ...state.folders.filter(
                  (candidate) => candidate.id !== id && !movedIds.has(candidate.id),
                ),
              ]),
              prompts: savedPrompts.reduce(
                (prompts, prompt) => upsertPrompt(prompts, prompt),
                state.prompts,
              ),
            }));

            const destination =
              parentId === null
                ? 'the top level'
                : (state.folders.find((candidate) => candidate.id === parentId)?.name ??
                  'the parent folder');
            await recordActivity({
              type: 'deleted',
              summary:
                `Deleted folder "${folder.name}" — ` +
                `${plural(affectedPrompts.length, 'prompt', 'prompts')} moved to ${destination}`,
            });

            return {
              promptsMoved: affectedPrompts.length,
              foldersMoved: childFolders.length,
            };
          } catch (error) {
            // A partial cascade must never be shown as if it succeeded: re-read
            // storage so the screen matches what is actually saved.
            await get().hydrate();
            throw error;
          }
        }),

      addCollection: async (name, description) =>
        run(async (repos) => {
          throwIfInvalid(checkCollectionName(get().collections, name));

          const collection = await repos.collections.create(
            createCollection(
              { name, ...(description === undefined ? {} : { description }) },
              dependencies,
            ),
          );
          set((state) => ({ collections: sortByName([collection, ...state.collections]) }));
          await recordActivity({
            type: 'created',
            summary: `Created collection "${collection.name}"`,
          });
          return collection;
        }),

      updateCollection: async (id, changes) =>
        run(async (repos) => {
          const state = get();
          const current = state.collections.find((collection) => collection.id === id);
          if (!current) throw new RecordNotFoundError(`Collection ${id} no longer exists.`);

          const name = changes.name === undefined ? current.name : normalizeTitle(changes.name);
          throwIfInvalid(checkCollectionName(state.collections, name, id));

          const saved = await repos.collections.update({
            ...current,
            name,
            description:
              changes.description === undefined ? current.description : changes.description.trim(),
            updatedAt: dependencies.now().toISOString(),
          });
          set((state) => ({
            collections: sortByName([
              saved,
              ...state.collections.filter((collection) => collection.id !== id),
            ]),
          }));
          await recordActivity({
            type: 'updated',
            summary:
              saved.name === current.name
                ? `Updated collection "${saved.name}"`
                : `Renamed collection "${current.name}" to "${saved.name}"`,
          });
          return saved;
        }),

      deleteCollection: async (id) =>
        run(async (repos) => {
          const state = get();
          const collection = state.collections.find((candidate) => candidate.id === id);
          if (!collection) throw new RecordNotFoundError(`Collection ${id} no longer exists.`);

          const members = state.prompts.filter((prompt) => prompt.collectionIds.includes(id));
          const updatedAt = dependencies.now().toISOString();

          try {
            const savedPrompts: Prompt[] = [];
            for (const prompt of members) {
              savedPrompts.push(
                await repos.prompts.update(
                  applyEdit(
                    prompt,
                    {
                      collectionIds: prompt.collectionIds.filter(
                        (collectionId) => collectionId !== id,
                      ),
                    },
                    updatedAt,
                  ),
                  { expectedVersion: prompt.version },
                ),
              );
            }

            await repos.collections.delete(id);

            set((state) => ({
              collections: state.collections.filter((candidate) => candidate.id !== id),
              prompts: savedPrompts.reduce(
                (prompts, prompt) => upsertPrompt(prompts, prompt),
                state.prompts,
              ),
            }));

            await recordActivity({
              type: 'deleted',
              summary:
                `Deleted collection "${collection.name}" — ` +
                `${plural(members.length, 'prompt', 'prompts')} kept, membership removed`,
            });

            return { promptsDetached: members.length };
          } catch (error) {
            await get().hydrate();
            throw error;
          }
        }),

      addSchema: async (input) =>
        run(async (repos) => {
          const schema = createPromptSchema(
            {
              name: input.name,
              description: input.description,
              schemaContent: input.schemaContent,
            },
            dependencies,
          );
          const saved = await repos.schemas.create(schema);
          set((state) => ({ schemas: upsertById(state.schemas, saved) }));
          return saved;
        }),

      updateSchema: async (id, changes) =>
        run(async (repos) => {
          const current = await repos.schemas.get(id);
          if (!current) throw new RecordNotFoundError(`Schema ${id} no longer exists.`);

          const next: PromptSchema = {
            ...current,
            name: changes.name === undefined ? current.name : normalizeTitle(changes.name),
            description:
              changes.description === undefined ? current.description : changes.description,
            schemaContent: changes.schemaContent ?? current.schemaContent,
            updatedAt: dependencies.now().toISOString(),
          };

          const saved = await repos.schemas.update(next);
          set((state) => ({ schemas: upsertById(state.schemas, saved) }));
          return saved;
        }),

      deleteSchema: async (id) =>
        run(async (repos) => {
          const schema = await repos.schemas.get(id);
          if (!schema) throw new RecordNotFoundError(`Schema ${id} no longer exists.`);

          const updatedAt = dependencies.now().toISOString();
          const attached = get().prompts.filter((prompt) => prompt.schemaId === id);

          // Detach first: a prompt must never point at a schema that is gone.
          const detached =
            attached.length === 0
              ? []
              : await repos.prompts.updateMany(
                  attached.map((prompt) => ({
                    prompt: { ...prompt, schemaId: null, updatedAt, version: prompt.version + 1 },
                    expectedVersion: prompt.version,
                  })),
                );

          await repos.schemas.delete(id);

          set((state) => ({
            schemas: state.schemas.filter((candidate) => candidate.id !== id),
            prompts: detached.reduce((list, prompt) => upsertPrompt(list, prompt), state.prompts),
          }));

          return { schema, detachedPrompts: detached.length };
        }),

      setPromptSchema: async (promptId, schemaId) =>
        run(async (repos) => {
          if (schemaId !== null) {
            const schema = await repos.schemas.get(schemaId);
            if (!schema) throw new RecordNotFoundError(`Schema ${schemaId} no longer exists.`);
          }

          const current = await repos.prompts.get(promptId);
          if (!current) throw new RecordNotFoundError(`Prompt ${promptId} no longer exists.`);

          const next = applyEdit(current, { schemaId }, dependencies.now().toISOString());
          const saved = await repos.prompts.update(next, { expectedVersion: current.version });

          set((state) => ({ prompts: upsertPrompt(state.prompts, saved) }));
          return saved;
        }),

      createTemplate: async (input) =>
        run(async (repos) => {
          const candidate = createTemplateEntity(
            {
              name: input.name,
              description: input.description,
              category: input.category,
              content: input.content,
              isBuiltIn: false,
            },
            dependencies,
          );

          return saveTemplate(repos, candidate, `Created the “${candidate.name}” template`);
        }),

      createTemplateFromPrompt: async (promptId, input) =>
        run(async (repos) => {
          const prompt = await repos.prompts.get(promptId);
          if (!prompt) throw new RecordNotFoundError(`Prompt ${promptId} no longer exists.`);

          // `draft.content` has `includes` cleared: a template never claims a
          // snippet merge that belongs to one particular document (ADR-95).
          const draft = templateDraftFromPrompt(prompt);
          const candidate = createTemplateEntity(
            {
              name: input.name.trim().length > 0 ? input.name : draft.name,
              description: input.description ?? draft.description,
              category: input.category,
              content: draft.content,
              isBuiltIn: false,
            },
            dependencies,
          );

          return saveTemplate(
            repos,
            candidate,
            `Saved “${prompt.title}” as the template “${candidate.name}”`,
          );
        }),

      updateTemplate: async (id, changes) =>
        run(async (repos) => {
          const current = await repos.templates.get(id);
          if (!current) throw new RecordNotFoundError(`Template ${id} no longer exists.`);
          if (current.isBuiltIn) throw new RuleViolationError([builtInTemplateIssue('edit')]);

          const name = changes.name === undefined ? current.name : normalizeTitle(changes.name);
          const next: PromptTemplate = {
            ...current,
            name,
            description:
              changes.description === undefined ? current.description : changes.description.trim(),
            category:
              changes.category === undefined
                ? current.category
                : normalizeTitle(changes.category) || current.category,
            updatedAt: dependencies.now().toISOString(),
          };

          // A rename must not collide with another template (ADR-96).
          throwIfInvalid(checkTemplateName(next.name, get().templates, { excludeId: id }));

          const saved = await repos.templates.update(next);
          set((state) => ({ templates: upsertTemplate(state.templates, saved) }));
          await recordActivity({
            type: 'template',
            summary:
              saved.name === current.name
                ? `Updated the “${saved.name}” template`
                : `Renamed the “${current.name}” template to “${saved.name}”`,
          });
          return saved;
        }),

      duplicateTemplate: async (id, changes = {}) =>
        run(async (repos) => {
          const source = await repos.templates.get(id);
          if (!source) throw new RecordNotFoundError(`Template ${id} no longer exists.`);

          const candidate = createTemplateEntity(
            {
              name: changes.name ?? nextTemplateName(source.name, get().templates),
              description: changes.description ?? source.description,
              category: changes.category ?? source.category,
              // Clone through the factory: the copy must not share the
              // document with the built-in it came from.
              content: JSON.parse(JSON.stringify(source.content)) as PromptDocument,
              isBuiltIn: false,
            },
            dependencies,
          );

          return saveTemplate(
            repos,
            candidate,
            `Duplicated the “${source.name}” template as “${candidate.name}”`,
          );
        }),

      deleteTemplate: async (id) =>
        run(async (repos) => {
          const template = await repos.templates.get(id);
          if (!template) throw new RecordNotFoundError(`Template ${id} no longer exists.`);
          if (template.isBuiltIn) throw new RuleViolationError([builtInTemplateIssue('delete')]);

          await repos.templates.delete(id);
          set((state) => ({
            templates: state.templates.filter((candidate) => candidate.id !== id),
          }));
          await recordActivity({
            type: 'template',
            summary: `Deleted the “${template.name}” template`,
          });
          return template;
        }),

      useTemplate: async (id, options = {}) =>
        run(async (repos) => {
          const template = await repos.templates.get(id);
          if (!template) throw new RecordNotFoundError(`Template ${id} no longer exists.`);

          // The schema table is read fresh: a reference is only kept when the
          // schema is actually stored in this browser (ADR-95).
          const schemas = await repos.schemas.list();
          const instantiation = instantiateTemplate(template, {
            knownSchemaIds: new Set(schemas.map((schema) => schema.id)),
            ...(options.title ? { title: options.title } : {}),
          });

          const prompt = createPromptEntity(
            {
              title: instantiation.title,
              description: instantiation.description,
              content: instantiation.content,
              tags: instantiation.tags,
            },
            dependencies,
          );

          const saved = await repos.prompts.create(prompt);
          set((state) => ({ prompts: upsertPrompt(state.prompts, saved) }));
          await recordActivity({
            type: 'template',
            summary: `Created “${saved.title}” from the “${template.name}” template`,
            promptId: saved.id,
            promptTitle: saved.title,
          });
          return saved;
        }),

      saveSettings: async (settings) =>
        run(async (repos) => {
          const saved = await repos.settings.save(settings);
          set({ settings: saved });
          await recordActivity({ type: 'settings', summary: 'Updated preferences' });
          return saved;
        }),

      clearError: () => set({ error: null }),
    };
  });
}

/** Application-wide instance; the bootstrap attaches repositories to it. */
export const useDataStore = createDataStore();
