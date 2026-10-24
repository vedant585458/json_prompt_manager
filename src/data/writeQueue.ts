/**
 * Serialized write queue (TASK-006, `tasks.md` §6.5.7).
 *
 * Autosave, explicit saves, and revision creation for the same prompt must not
 * interleave: a slow write could otherwise land after a fast later one and
 * resurrect older content. This queue runs tasks for the same key one at a
 * time, in submission order, while different keys proceed independently.
 */

export interface WriteQueue {
  /** Queues `task` behind earlier work for `key` and resolves with its result. */
  run: <T>(key: string, task: () => Promise<T>) => Promise<T>;
  /** True while a task for `key` is queued or running. */
  isBusy: (key: string) => boolean;
  /** Number of queued or running tasks for `key`. */
  size: (key: string) => number;
  /** Resolves once every queued task has settled. */
  drain: () => Promise<void>;
}

export function createWriteQueue(): WriteQueue {
  /** Tail of the chain per key; removed once the key is idle again. */
  const chains = new Map<string, Promise<unknown>>();
  const pending = new Map<string, number>();

  function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    pending.set(key, (pending.get(key) ?? 0) + 1);

    const previous = chains.get(key) ?? Promise.resolve();

    const execute = async (): Promise<T> => {
      try {
        return await task();
      } finally {
        const remaining = (pending.get(key) ?? 1) - 1;
        if (remaining <= 0) pending.delete(key);
        else pending.set(key, remaining);
      }
    };

    // Run even if the previous task rejected: a failed save must not wedge the
    // queue for that prompt.
    const result = previous.then(execute, execute);
    // `idle` never rejects, so one failed task cannot produce an unhandled
    // rejection through the bookkeeping chain.
    const idle = result.then(
      () => undefined,
      () => undefined,
    );

    chains.set(key, idle);
    void idle.then(() => {
      // Only the most recent task for this key clears the entry.
      if (chains.get(key) === idle) chains.delete(key);
    });

    return result;
  }

  return {
    run,
    isBusy: (key) => pending.has(key),
    size: (key) => pending.get(key) ?? 0,
    drain: async () => {
      // Tasks can queue more work while draining, so repeat until idle.
      while (chains.size > 0) {
        await Promise.all([...chains.values()]);
      }
    },
  };
}
