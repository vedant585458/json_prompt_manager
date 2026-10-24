import { describe, expect, it, vi } from 'vitest';

import { createWriteQueue } from '@/data/writeQueue';

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('createWriteQueue', () => {
  it('runs tasks for one key in submission order, never overlapping', async () => {
    const queue = createWriteQueue();
    const events: string[] = [];
    const first = deferred<string>();
    const second = deferred<string>();

    const runFirst = queue.run('prompt-1', async () => {
      events.push('start-1');
      const value = await first.promise;
      events.push('end-1');
      return value;
    });
    const runSecond = queue.run('prompt-1', async () => {
      events.push('start-2');
      const value = await second.promise;
      events.push('end-2');
      return value;
    });

    await tick();
    expect(events).toEqual(['start-1']);

    first.resolve('one');
    await tick();
    expect(events).toEqual(['start-1', 'end-1', 'start-2']);

    second.resolve('two');
    await expect(runFirst).resolves.toBe('one');
    await expect(runSecond).resolves.toBe('two');
    expect(events).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('runs different keys concurrently', async () => {
    const queue = createWriteQueue();
    const gate = deferred<void>();
    const events: string[] = [];

    const slow = queue.run('a', async () => {
      events.push('a-start');
      await gate.promise;
      events.push('a-end');
    });
    const fast = queue.run('b', async () => {
      events.push('b-start');
      events.push('b-end');
    });

    await fast;
    expect(events).toEqual(['a-start', 'b-start', 'b-end']);

    gate.resolve();
    await slow;
    expect(events).toEqual(['a-start', 'b-start', 'b-end', 'a-end']);
  });

  it('keeps the chain alive after a rejected task', async () => {
    const queue = createWriteQueue();
    const failure = new Error('disk full');

    const failed = queue.run('prompt-1', async () => {
      throw failure;
    });
    const recovered = queue.run('prompt-1', async () => 'saved');

    await expect(failed).rejects.toBe(failure);
    await expect(recovered).resolves.toBe('saved');
    expect(queue.isBusy('prompt-1')).toBe(false);
  });

  it('reports queue depth per key', async () => {
    const queue = createWriteQueue();
    const gate = deferred<void>();

    expect(queue.isBusy('prompt-1')).toBe(false);
    expect(queue.size('prompt-1')).toBe(0);

    const first = queue.run('prompt-1', async () => {
      await gate.promise;
      return 1;
    });
    const second = queue.run('prompt-1', async () => 2);

    expect(queue.isBusy('prompt-1')).toBe(true);
    expect(queue.size('prompt-1')).toBe(2);
    expect(queue.size('other')).toBe(0);

    gate.resolve();
    await Promise.all([first, second]);

    expect(queue.isBusy('prompt-1')).toBe(false);
    expect(queue.size('prompt-1')).toBe(0);
  });

  it('drain resolves once everything has settled, including work queued meanwhile', async () => {
    const queue = createWriteQueue();
    const done: number[] = [];

    queue.run('a', async () => {
      done.push(1);
      // Queueing from inside a task is how chained autosaves behave.
      queue.run('b', async () => {
        done.push(2);
      });
      return 1;
    });

    await queue.drain();
    expect(done).toEqual([1, 2]);
    expect(queue.isBusy('a')).toBe(false);
    expect(queue.isBusy('b')).toBe(false);
  });

  it('drain is safe with failures and on an idle queue', async () => {
    const queue = createWriteQueue();
    await expect(queue.drain()).resolves.toBeUndefined();

    const spy = vi.fn();
    void queue.run('a', async () => {
      spy();
      throw new Error('nope');
    });

    await expect(queue.drain()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(queue.drain()).resolves.toBeUndefined();
  });

  it('adds no unhandled rejections of its own while draining failures', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const queue = createWriteQueue();
      // The caller handles its own failure; the bookkeeping chain must not
      // produce a second, unhandled one.
      queue
        .run('a', async () => {
          throw new Error('expected failure');
        })
        .catch(() => undefined);

      await queue.drain();
      await tick();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
