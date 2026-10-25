/**
 * Deterministic clock and id generator for tests (TASK-029).
 *
 * Every domain factory takes its time and identity from the caller, which is what
 * makes the domain testable; this is the one implementation tests share instead of
 * each suite hand-rolling `{ now: () => new Date('…'), newId: () => 'x' }`.
 *
 * `now()` is frozen until a test calls `advance` or `tick`, so a test that asserts
 * a timestamp is asserting the value it wrote, not the wall clock. Ids are
 * sequential and prefixed, so a generated record is obvious in a failure message.
 */

import type { DomainDependencies } from '@/domain/factories';

/** The instant most fixtures start at: a fixed Saturday in October 2026. */
export const FIXED_START = '2026-10-25T09:00:00.000Z';

export interface FakeClock {
  /** Pass straight into a factory or a store. */
  readonly deps: DomainDependencies;
  /** The current instant; never moves on its own. */
  now(): Date;
  /** The current instant as an ISO string, which is what records store. */
  iso(): string;
  /** Moves the clock forward and returns the new instant. */
  advance(milliseconds: number): Date;
  /** Moves the clock forward by one second — the usual "next edit" step. */
  tick(): Date;
  /** Every id handed out, in order, so a test can assert what was minted. */
  issuedIds(): readonly string[];
  /** The next id without consuming it. */
  peekId(): string;
}

/**
 * A clock whose time only moves when a test moves it.
 *
 * @param options.start First instant, ISO-8601. @param options.prefix Id prefix,
 * so `invoice-1`, `invoice-2` read as records from one fixture.
 */
export function fakeClock(
  options: { start?: string; prefix?: string; stepMs?: number } = {},
): FakeClock {
  const { start = FIXED_START, prefix = 'id', stepMs = 1_000 } = options;
  let current = new Date(start).getTime();
  let counter = 0;
  const issued: string[] = [];

  const nextId = (): string => {
    counter += 1;
    const id = `${prefix}-${counter}`;
    issued.push(id);
    return id;
  };

  return {
    deps: { now: () => new Date(current), newId: nextId },
    now: () => new Date(current),
    iso: () => new Date(current).toISOString(),
    advance(milliseconds) {
      current += milliseconds;
      return new Date(current);
    },
    tick() {
      current += stepMs;
      return new Date(current);
    },
    issuedIds: () => [...issued],
    peekId: () => `${prefix}-${counter + 1}`,
  };
}

/**
 * A new id on every call, in the shape of a UUID, for tests that need ids to be
 * *unique* rather than *readable* — for example when a test imports two copies of
 * the same bundle and asserts nothing collides.
 */
export function uniqueIds(prefix = 'uuid'): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${String(counter).padStart(8, '0')}`;
  };
}
