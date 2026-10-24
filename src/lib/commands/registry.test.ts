import { describe, expect, it, vi } from 'vitest';

import {
  createCommandRegistry,
  createCommandRunner,
  isCommandAvailable,
} from '@/lib/commands/registry';
import type { CommandDefinition } from '@/lib/commands/types';
import { createTestContext } from '@/test/commandContext';

function command(overrides: Partial<CommandDefinition> & { id: string }): CommandDefinition {
  return {
    title: overrides.id,
    group: 'General',
    run: () => undefined,
    ...overrides,
  };
}

describe('command registry', () => {
  it('registers commands and returns a stable ordered snapshot', () => {
    const registry = createCommandRegistry();
    const late = command({ id: 'navigation.zulu', title: 'Zulu', group: 'Navigation' });
    const early = command({ id: 'appearance.alpha', title: 'Alpha', group: 'Appearance' });

    registry.register(late);
    const first = registry.list();
    registry.register(early);

    expect(first).toHaveLength(1);
    // Declared group order (General → Navigation → … → Development), then title.
    expect(registry.list().map((item) => item.id)).toEqual(['navigation.zulu', 'appearance.alpha']);
    expect(registry.get('navigation.zulu')).toBe(late);
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('rejects duplicate ids', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'palette.open' }));

    expect(() => registry.register(command({ id: 'palette.open', shortcut: 'Mod+J' }))).toThrow(
      /Duplicate command id/,
    );
  });

  it('rejects two commands bound to the same shortcut', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'one', shortcut: 'Mod+K' }));

    expect(() => registry.register(command({ id: 'two', shortcut: 'Cmd+K' }))).toThrow(
      /already bound/,
    );
  });

  it('validates ids, titles, and shortcut syntax at registration', () => {
    const registry = createCommandRegistry();

    expect(() => registry.register(command({ id: '' }))).toThrow(/non-empty id/);
    expect(() => registry.register(command({ id: 'has space' }))).toThrow(/whitespace/);
    expect(() => registry.register(command({ id: 'no-title', title: '' }))).toThrow(
      /needs a title/,
    );
    expect(() => registry.register(command({ id: 'bad-key', shortcut: 'Hyper+K' }))).toThrow(
      /Unknown modifier/,
    );
  });

  it('unregisters exactly once and keeps a re-registered replacement', () => {
    const registry = createCommandRegistry();
    const original = command({ id: 'dupe' });
    const dispose = registry.register(original);

    dispose();
    expect(registry.list()).toHaveLength(0);
    dispose();
    expect(registry.list()).toHaveLength(0);

    const replacement = command({ id: 'dupe', title: 'Replacement' });
    registry.register(replacement);
    dispose();
    expect(registry.get('dupe')).toBe(replacement);
  });

  it('rolls a failed batch back', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'existing' }));

    expect(() =>
      registry.registerAll([
        command({ id: 'fresh' }),
        command({ id: 'existing', shortcut: 'Mod+Y' }),
      ]),
    ).toThrow(/Duplicate command id/);

    expect(registry.get('fresh')).toBeUndefined();
    expect(registry.list().map((item) => item.id)).toEqual(['existing']);
  });

  it('notifies subscribers until they unsubscribe', () => {
    const registry = createCommandRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.register(command({ id: 'a' }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    registry.register(command({ id: 'b' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears every registration', () => {
    const registry = createCommandRegistry();
    registry.register(command({ id: 'a' }));
    registry.register(command({ id: 'b' }));

    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });

  it('evaluates availability from the live context', () => {
    const availability = command({ id: 'dev-only', when: (context) => context.dev });

    expect(isCommandAvailable(availability, createTestContext({ dev: true }))).toBe(true);
    expect(isCommandAvailable(availability, createTestContext({ dev: false }))).toBe(false);
    expect(isCommandAvailable(command({ id: 'always' }), createTestContext())).toBe(true);
  });
});

describe('command runner', () => {
  it('runs a command once and reports while it is in flight', async () => {
    const runner = createCommandRunner();
    let resolve: (() => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const slow = command({ id: 'slow', run });

    const first = runner.run(slow, createTestContext());
    expect(runner.isRunning('slow')).toBe(true);

    await expect(runner.run(slow, createTestContext())).resolves.toBe(false);
    expect(run).toHaveBeenCalledTimes(1);

    resolve?.();
    await expect(first).resolves.toBe(true);
    expect(runner.isRunning('slow')).toBe(false);
  });

  it('clears the in-flight flag when a command throws', async () => {
    const runner = createCommandRunner();
    const failing = command({
      id: 'failing',
      run: () => {
        throw new Error('boom');
      },
    });

    await expect(runner.run(failing, createTestContext())).rejects.toThrow('boom');
    expect(runner.isRunning('failing')).toBe(false);
  });
});
