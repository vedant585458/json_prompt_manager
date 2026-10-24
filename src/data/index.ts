/**
 * The data layer's public surface (TASK-006).
 *
 * Everything outside `src/data` imports from here. Concrete adapters
 * (`indexedDb`, `inMemory`) and the raw database modules stay internal so the
 * choice between durable and ephemeral storage lives in exactly one place —
 * the bootstrap written in TASK-007. ESLint enforces this boundary.
 */

export type {
  ActivityRepository,
  DatabaseMeta,
  EntityRepository,
  MetaRepository,
  PromptQuery,
  PromptRepository,
  Repositories,
  RevisionRepository,
  SettingsRepository,
} from '@/data/repositories/contracts';

export {
  CorruptDataError,
  DuplicateRecordError,
  InvalidWriteError,
  MigrationError,
  QuotaExceededError,
  RecordNotFoundError,
  StaleWriteError,
  StorageError,
  StorageUnavailableError,
  mapStorageError,
  withStorageErrors,
  type MigrationErrorReason,
  type StorageErrorCode,
} from '@/data/db/errors';

export { DB_SCHEMA_VERSION, STORE, STORE_NAMES, type StoreName } from '@/data/db/schema';

/**
 * The in-memory adapter is part of the public surface on purpose: it backs the
 * ephemeral mode and the store-level test suites. The IndexedDB adapter stays
 * internal so only `openStorage` decides when a real database is opened.
 */
export { createInMemoryRepositories, type InMemorySeed } from '@/data/adapters/inMemory';
export { isIndexedDbAvailable, probeStorage, type StorageProbeResult } from '@/data/db/indexedDb';

export { SEED_IDS, SEED_VERSION, seedDatabase, type SeedResult } from '@/data/db/seed';
/** The built-in template catalogue (TASK-018): shipped data, not an adapter. */
export {
  BUILT_IN_TEMPLATES,
  BUILT_IN_TEMPLATE_IDS,
  type BuiltInTemplate,
} from '@/data/db/templates';
export {
  openStorage,
  type OpenStorageOptions,
  type StorageBootResult,
  type StorageMode,
} from '@/data/storage';

export { createWriteQueue, type WriteQueue } from '@/data/writeQueue';
export {
  BROADCAST_CHANNEL_NAME,
  createWriteBroadcaster,
  isWriteAnnouncement,
  type BroadcastChannelLike,
  type WriteAnnouncement,
  type WriteBroadcaster,
} from '@/data/broadcast';
