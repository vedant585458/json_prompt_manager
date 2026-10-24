import { describe, expect, it } from 'vitest';

import {
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
  type StorageErrorCode,
} from '@/data/db/errors';

const domError = (name: string, message = 'raw platform message') =>
  new DOMException(message, name);

describe('storage error hierarchy', () => {
  it('gives every subclass a stable code and its own name', () => {
    const cases: Array<[StorageError, StorageErrorCode, string]> = [
      [new StorageUnavailableError('gone'), 'unavailable', 'StorageUnavailableError'],
      [new QuotaExceededError('full'), 'quota-exceeded', 'QuotaExceededError'],
      [new StaleWriteError('p1', 2, 5), 'stale-write', 'StaleWriteError'],
      [new MigrationError('failed', 'broke'), 'migration', 'MigrationError'],
      [new CorruptDataError('bad row'), 'corrupt-data', 'CorruptDataError'],
      [new DuplicateRecordError('twice'), 'duplicate-record', 'DuplicateRecordError'],
      [new InvalidWriteError('bad version'), 'invalid-write', 'InvalidWriteError'],
      [new RecordNotFoundError('missing'), 'not-found', 'RecordNotFoundError'],
    ];

    for (const [error, code, name] of cases) {
      expect(error).toBeInstanceOf(StorageError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
      expect(error.name).toBe(name);
    }
  });

  it('carries the details a recovery UI needs on a stale write', () => {
    const cause = new Error('race');
    const error = new StaleWriteError('prompt-7', 3, 6, { cause });

    expect(error.promptId).toBe('prompt-7');
    expect(error.expectedVersion).toBe(3);
    expect(error.actualVersion).toBe(6);
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('prompt-7');
    expect(error.message).toContain('3');
    expect(error.message).toContain('6');
  });

  it('distinguishes the two migration reasons', () => {
    expect(new MigrationError('failed', 'x').reason).toBe('failed');
    expect(new MigrationError('newer-database', 'y').reason).toBe('newer-database');
  });

  it('leaves the cause undefined when none was supplied', () => {
    expect(new StorageUnavailableError('no cause').cause).toBeUndefined();
    expect(new CorruptDataError('with cause', { cause: 42 }).cause).toBe(42);
  });
});

describe('mapStorageError', () => {
  it('maps browser failures onto the typed hierarchy', () => {
    const table: Array<[string, new (...args: never[]) => StorageError]> = [
      ['QuotaExceededError', QuotaExceededError],
      ['VersionError', MigrationError],
      ['DataError', CorruptDataError],
      ['DataCloneError', CorruptDataError],
      ['NotFoundError', CorruptDataError],
      ['ConstraintError', DuplicateRecordError],
      ['InvalidStateError', StorageUnavailableError],
      ['AbortError', StorageUnavailableError],
      ['UnknownError', StorageUnavailableError],
    ];

    for (const [name, expected] of table) {
      const mapped = mapStorageError(domError(name), 'prompts.create');
      expect(mapped, name).toBeInstanceOf(expected);
      expect(mapped.message).toContain('prompts.create');
      expect(mapped.cause).toBeInstanceOf(DOMException);
    }
  });

  it('marks a version failure as the newer-database case', () => {
    const mapped = mapStorageError(domError('VersionError'), 'database.open');
    expect(mapped).toBeInstanceOf(MigrationError);
    expect((mapped as MigrationError).reason).toBe('newer-database');
    expect(mapped.message).toMatch(/newer PromptForge build/);
  });

  it('explains what to do when storage is full', () => {
    const mapped = mapStorageError(domError('QuotaExceededError'), 'revisions.create');
    expect(mapped).toBeInstanceOf(QuotaExceededError);
    expect(mapped.message).toMatch(/Export your work/);
  });

  it('falls back to the unknown code for anything unexpected', () => {
    const mapped = mapStorageError(new TypeError('boom'), 'prompts.list');
    expect(mapped).toBeInstanceOf(StorageError);
    expect(mapped.code).toBe('unknown');
    expect(mapped.constructor).toBe(StorageError);
    expect(mapped.message).toContain('boom');

    const notAnError = mapStorageError('just a string', 'activity.append');
    expect(notAnError.code).toBe('unknown');
    expect(notAnError.message).toContain('just a string');
  });

  it('passes already-typed errors through unchanged', () => {
    const original = new StaleWriteError('p1', 1, 2);
    expect(mapStorageError(original, 'prompts.update')).toBe(original);
  });
});

describe('withStorageErrors', () => {
  it('returns the operation result untouched', async () => {
    await expect(withStorageErrors('prompts.get', async () => 'value')).resolves.toBe('value');
  });

  it('converts rejections into typed errors with the operation context', async () => {
    const failure = await withStorageErrors('prompts.create', async () => {
      throw domError('QuotaExceededError');
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(QuotaExceededError);
    expect((failure as StorageError).message).toContain('prompts.create');
  });

  it('keeps typed errors and never wraps them twice', async () => {
    const original = new CorruptDataError('malformed record');
    const failure = await withStorageErrors('prompts.get', async () => {
      throw original;
    }).catch((error: unknown) => error);

    expect(failure).toBe(original);
  });

  it('converts synchronous throws from the operation too', async () => {
    const failure = await withStorageErrors('prompts.list', () => {
      throw domError('InvalidStateError');
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StorageUnavailableError);
  });
});
