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
  nextRevisionNumber,
  normalizeTags,
  normalizeTitle,
} from '@/domain/invariants';
import type {
  ActivityType,
  ActivityEvent,
  Collection,
  Folder,
  Prompt,
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
  readonly settings: Settings | null;

  /** Binds repositories opened by the bootstrap. Does not read anything. */
  attach: (repositories: Repositories, mode: StorageMode) => void;
  /** Reads every repository into state. Safe to call again (retry). */
  hydrate: () => Promise<void>;

  addPrompt: (input?: CreatePromptInput) => Promise<Prompt>;
  editPrompt: (id: string, changes: PromptEdit) => Promise<Prompt>;
  archivePrompt: (id: string) => Promise<Prompt>;
  unarchivePrompt: (id: string) => Promise<Prompt>;
  deletePrompt: (id: string) => Promise<void>;
  /** Saves a manual snapshot revision for a prompt. */
  snapshotPrompt: (id: string, label?: string | null) => Promise<PromptRevision>;

  addFolder: (name: string) => Promise<Folder>;
  addCollection: (name: string, description?: string) => Promise<Collection>;

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

  return create<DataState>()((set) => {
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
      verb: string,
    ): Promise<Prompt> {
      return run(async (repos) => {
        const current = await repos.prompts.get(id);
        if (!current) throw new RecordNotFoundError(`Prompt ${id} no longer exists.`);

        const next = applyEdit(current, changes, dependencies.now().toISOString());
        const saved = await repos.prompts.update(next, { expectedVersion: current.version });

        set((state) => ({ prompts: upsertPrompt(state.prompts, saved) }));
        await recordActivity({
          type: activityType,
          summary: `${verb} "${saved.title}"`,
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

      editPrompt: (id, changes) => writePrompt(id, changes, 'updated', 'Updated'),

      archivePrompt: (id) => writePrompt(id, { archived: true }, 'archived', 'Archived'),

      unarchivePrompt: (id) =>
        writePrompt(id, { archived: false }, 'updated', 'Restored from the archive'),

      deletePrompt: async (id) =>
        run(async (repos) => {
          const current = await repos.prompts.get(id);
          await repos.prompts.delete(id);

          set((state) => ({
            prompts: state.prompts.filter((prompt) => prompt.id !== id),
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

          await recordActivity({
            type: 'snapshot',
            summary: `Saved snapshot v${saved.revisionNumber} of "${prompt.title}"`,
            promptId: prompt.id,
            promptTitle: prompt.title,
          });
          return saved;
        }),

      addFolder: async (name) =>
        run(async (repos) => {
          const folder = await repos.folders.create(createFolder({ name }, dependencies));
          set((state) => ({ folders: sortByName([folder, ...state.folders]) }));
          return folder;
        }),

      addCollection: async (name, description) =>
        run(async (repos) => {
          const collection = await repos.collections.create(
            createCollection(
              { name, ...(description === undefined ? {} : { description }) },
              dependencies,
            ),
          );
          set((state) => ({ collections: sortByName([collection, ...state.collections]) }));
          return collection;
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
