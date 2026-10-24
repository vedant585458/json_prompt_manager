/**
 * Repository interfaces (TASK-006, ADR-02).
 *
 * The UI and the stores depend on these interfaces only. IndexedDB is one
 * implementation, the in-memory adapter is another, and a future server-backed
 * adapter would be a third — all validated by one shared contract suite
 * (`contract.ts`).
 *
 * Ordering is part of the contract, not an implementation detail:
 * - prompts — `updatedAt` descending, `id` ascending as the tie-breaker;
 * - revisions — `revisionNumber` descending;
 * - named entities — name ascending (case-insensitive), `id` ascending;
 * - activity — `createdAt` descending, `id` descending.
 */

import type {
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
} from '@/domain/types';

/** Filters used by the library, dashboard, and search (TASK-010/TASK-011). */
export interface PromptQuery {
  /** `null` selects Unfiled prompts; omit to include every folder. */
  readonly folderId?: string | null;
  readonly collectionId?: string;
  readonly tag?: string;
  readonly status?: PromptStatus;
  readonly archived?: boolean;
  readonly favorite?: boolean;
  readonly pinned?: boolean;
  /** Inclusive lower bound on `updatedAt` (ISO string). */
  readonly updatedAfter?: string;
  /** Inclusive upper bound on `updatedAt` (ISO string). */
  readonly updatedBefore?: string;
}

/** CRUD shared by the simple, non-versioned entities. */
export interface EntityRepository<T> {
  list: () => Promise<T[]>;
  get: (id: string) => Promise<T | null>;
  /** Rejects with `DuplicateRecordError` when the id already exists. */
  create: (entity: T) => Promise<T>;
  /** Rejects with `RecordNotFoundError` when the id is unknown. */
  update: (entity: T) => Promise<T>;
  /** Idempotent: deleting a missing record resolves without error. */
  delete: (id: string) => Promise<void>;
}

export interface PromptRepository {
  list: () => Promise<Prompt[]>;
  query: (criteria?: PromptQuery) => Promise<Prompt[]>;
  get: (id: string) => Promise<Prompt | null>;
  create: (prompt: Prompt) => Promise<Prompt>;
  /**
   * Persists an edit under optimistic concurrency.
   *
   * - `expectedVersion` must equal the stored `version`;
   * - the incoming record must carry `expectedVersion + 1` (`tasks.md` §6.5.3);
   * - a stale base version rejects with `StaleWriteError` and changes nothing.
   */
  update: (prompt: Prompt, options: { readonly expectedVersion: number }) => Promise<Prompt>;
  delete: (id: string) => Promise<void>;
}

export interface RevisionRepository {
  /** Newest first (revision number descending). */
  listByPrompt: (promptId: string) => Promise<PromptRevision[]>;
  get: (id: string) => Promise<PromptRevision | null>;
  /** Rejects duplicate `(promptId, revisionNumber)` pairs. */
  create: (revision: PromptRevision) => Promise<PromptRevision>;
  deleteByPrompt: (promptId: string) => Promise<void>;
  countByPrompt: (promptId: string) => Promise<number>;
}

export interface ActivityRepository {
  append: (event: ActivityEvent) => Promise<void>;
  /** Newest first; `limit` returns the most recent entries. */
  list: (limit?: number) => Promise<ActivityEvent[]>;
  /** Keeps the newest `limit` events and returns how many were removed. */
  prune: (limit: number) => Promise<number>;
  clear: () => Promise<void>;
}

export interface SettingsRepository {
  /** `null` before first run; the store applies documented defaults. */
  get: () => Promise<Settings | null>;
  save: (settings: Settings) => Promise<Settings>;
}

/** Bookkeeping row from the `meta` store. */
export interface DatabaseMeta {
  readonly dbSchemaVersion: number;
  readonly seedVersion: number;
}

export interface MetaRepository {
  get: () => Promise<DatabaseMeta | null>;
  /** `0` when no seed has been applied yet. */
  getSeedVersion: () => Promise<number>;
  setSeedVersion: (version: number) => Promise<void>;
}

/** Every repository the app can ask for, plus a connection lifecycle hook. */
export interface Repositories {
  readonly prompts: PromptRepository;
  readonly revisions: RevisionRepository;
  readonly folders: EntityRepository<Folder>;
  readonly collections: EntityRepository<Collection>;
  readonly templates: EntityRepository<PromptTemplate>;
  readonly testCases: EntityRepository<TestCase>;
  readonly schemas: EntityRepository<PromptSchema>;
  readonly snippets: EntityRepository<Snippet>;
  readonly activity: ActivityRepository;
  readonly settings: SettingsRepository;
  readonly meta: MetaRepository;
  /** Releases the connection (no-op for in-memory). Safe to call twice. */
  readonly close: () => Promise<void>;
}
