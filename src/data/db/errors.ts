/**
 * Typed storage failures (TASK-006).
 *
 * The data layer never lets a raw `DOMException` escape: every failure becomes
 * one of these classes so the UI can decide between "retry", "free the space",
 * "reload the record", and "stop writing to this database".
 */

export type StorageErrorCode =
  | 'unavailable'
  | 'quota-exceeded'
  | 'stale-write'
  | 'migration'
  | 'corrupt-data'
  | 'duplicate-record'
  | 'not-found'
  | 'invalid-write'
  | 'unknown';

/** Base class for every storage failure. `code` never changes across releases. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;
  /** The underlying platform error, kept for diagnostics (never shown raw). */
  override readonly cause?: unknown;

  constructor(code: StorageErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * IndexedDB is missing, blocked, or closed. Writes must stop; the app switches
 * to its ephemeral mode rather than pretending to save (TASK-007).
 */
export class StorageUnavailableError extends StorageError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super('unavailable', message, options);
    this.name = 'StorageUnavailableError';
  }
}

/** The browser refused a write because the origin is out of space. */
export class QuotaExceededError extends StorageError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super('quota-exceeded', message, options);
    this.name = 'QuotaExceededError';
  }
}

/** A write carried an outdated base version; nothing was changed. */
export class StaleWriteError extends StorageError {
  readonly promptId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(
    promptId: string,
    expectedVersion: number,
    actualVersion: number,
    options: { cause?: unknown } = {},
  ) {
    super(
      'stale-write',
      `Prompt ${promptId} changed elsewhere (expected version ${expectedVersion}, found ${actualVersion}).`,
      options,
    );
    this.name = 'StaleWriteError';
    this.promptId = promptId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export type MigrationErrorReason = 'failed' | 'newer-database';

/** Schema setup or upgrade failed, or this build is older than the database. */
export class MigrationError extends StorageError {
  readonly reason: MigrationErrorReason;

  constructor(reason: MigrationErrorReason, message: string, options: { cause?: unknown } = {}) {
    super('migration', message, options);
    this.name = 'MigrationError';
    this.reason = reason;
  }
}

/** A stored record (or the database layout) is not what this build expects. */
export class CorruptDataError extends StorageError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super('corrupt-data', message, options);
    this.name = 'CorruptDataError';
  }
}

/** A record with the same key already exists. */
export class DuplicateRecordError extends StorageError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super('duplicate-record', message, options);
    this.name = 'DuplicateRecordError';
  }
}

/** A write violated the persistence contract (for example a version that did not advance). */
export class InvalidWriteError extends StorageError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super('invalid-write', message, options);
    this.name = 'InvalidWriteError';
  }
}

/** The requested record does not exist. */
export class RecordNotFoundError extends StorageError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super('not-found', message, options);
    this.name = 'RecordNotFoundError';
  }
}

function isDomException(error: unknown): error is DOMException {
  return typeof DOMException !== 'undefined' && error instanceof DOMException;
}

/**
 * Translates a platform failure into the typed hierarchy.
 *
 * `context` is a short operation description ("prompts.create") used in the
 * message so a log line is actionable without a stack trace.
 */
export function mapStorageError(error: unknown, context: string): StorageError {
  if (error instanceof StorageError) return error;

  const name = isDomException(error) ? error.name : undefined;
  const detail = error instanceof Error ? error.message : String(error);

  switch (name) {
    case 'QuotaExceededError':
      return new QuotaExceededError(
        `Storage is full while running ${context}. Export your work and prune revisions or activity.`,
        { cause: error },
      );
    case 'VersionError':
      return new MigrationError(
        'newer-database',
        `This database was created by a newer PromptForge build. Writes are blocked to protect your data (${context}).`,
        { cause: error },
      );
    case 'DataError':
    case 'DataCloneError':
      return new CorruptDataError(`Invalid data while running ${context}: ${detail}`, {
        cause: error,
      });
    case 'NotFoundError':
      return new CorruptDataError(
        `The stored database is missing an expected object store (${context}).`,
        { cause: error },
      );
    case 'ConstraintError':
      return new DuplicateRecordError(`A record with that key already exists (${context}).`, {
        cause: error,
      });
    case 'InvalidStateError':
    case 'AbortError':
    case 'UnknownError':
      return new StorageUnavailableError(
        `Storage is unavailable while running ${context}: ${detail}`,
        { cause: error },
      );
    default:
      return new StorageError('unknown', `Storage failed while running ${context}: ${detail}`, {
        cause: error,
      });
  }
}

/** Runs an operation, converting any failure into a typed `StorageError`. */
export async function withStorageErrors<T>(
  context: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapStorageError(error, context);
  }
}
