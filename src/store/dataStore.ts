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
  createRevision,
  systemDependencies,
  type CreatePromptInput,
  type DomainDependencies,
} from '@/domain/factories';
import {
  ACTIVITY_LOG_LIMIT,
  capActivityLog,
  checkCollectionName,
  checkFolderMove,
  checkFolderName,
  checkNewFolder,
  hasErrors,
  nextRevisionNumber,
  normalizeTags,
  normalizeTitle,
} from '@/domain/invariants';
import { RuleViolationError } from '@/domain/errors';
import type {
  ActivityType,
  ActivityEvent,
  Collection,
  DomainIssue,
  Folder,
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
  editPrompt: (id: string, changes: PromptEdit) => Promise<Prompt>;
  /** Copies a prompt under a "(copy)" title; the copy shares no mutable state. */
  duplicatePrompt: (id: string) => Promise<Prompt>;
  movePrompt: (id: string, folderId: string | null) => Promise<Prompt>;
  archivePrompt: (id: string) => Promise<Prompt>;
  unarchivePrompt: (id: string) => Promise<Prompt>;
  /** Deletes the prompt, its revisions, and its test cases together. */
  deletePrompt: (id: string) => Promise<void>;
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
    ): Promise<Prompt> {
      return run(async (repos) => {
        const current = await repos.prompts.get(id);
        if (!current) throw new RecordNotFoundError(`Prompt ${id} no longer exists.`);

        const next = applyEdit(current, changes, dependencies.now().toISOString());
        const saved = await repos.prompts.update(next, { expectedVersion: current.version });

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
        set({ status: 'loading', error: null });
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

      editPrompt: (id, changes) =>
        writePrompt(id, changes, 'updated', (saved) => `Updated "${saved.title}"`),

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
