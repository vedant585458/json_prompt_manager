import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/app/providers/ThemeProvider';
import {
  createCommandRegistry,
  createCommandRunner,
  type CommandRegistry,
  type CommandRunner,
} from '@/lib/commands/registry';
import type { CommandContext } from '@/lib/commands/types';
import { useCommand } from '@/lib/commands/useCommand';

function Harness({
  id,
  registry,
  runner,
  onResult,
}: {
  id: string;
  registry: CommandRegistry;
  runner: CommandRunner;
  onResult: (value: boolean) => void;
}) {
  const run = useCommand(id, registry, runner);
  return (
    <button type="button" onClick={() => void run().then(onResult)}>
      run
    </button>
  );
}

function setup(options: {
  id: string;
  path?: string;
  run?: (context: CommandContext) => void;
  when?: (context: CommandContext) => boolean;
}) {
  const registry = createCommandRegistry();
  const runner = createCommandRunner();
  const run = options.run ?? vi.fn();

  registry.register({
    id: options.id,
    title: options.id,
    group: 'General',
    ...(options.when ? { when: options.when } : {}),
    run,
  });

  const results: boolean[] = [];
  const user = userEvent.setup();

  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[options.path ?? '/library']}>
        <Harness
          id={options.id}
          registry={registry}
          runner={runner}
          onResult={(value) => results.push(value)}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );

  return { user, run, results, runner };
}

describe('useCommand', () => {
  it('runs a registered command with a context built from the current route', async () => {
    const seen: string[] = [];
    const { user, results } = setup({
      id: 'test.hook',
      path: '/library',
      run: (context) => seen.push(context.pathname),
    });

    await user.click(screen.getByRole('button', { name: 'run' }));

    expect(seen).toEqual(['/library']);
    expect(results).toEqual([true]);
  });

  it('returns false for unknown commands without running anything', async () => {
    const registry = createCommandRegistry();
    const runner = createCommandRunner();
    const results: boolean[] = [];
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <MemoryRouter>
          <Harness
            id="does.not.exist"
            registry={registry}
            runner={runner}
            onResult={(value) => results.push(value)}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'run' }));
    expect(results).toEqual([false]);
  });

  it('returns false and skips the run when the command is unavailable', async () => {
    const { user, run, results } = setup({ id: 'test.hidden', when: () => false });

    await user.click(screen.getByRole('button', { name: 'run' }));

    expect(run).not.toHaveBeenCalled();
    expect(results).toEqual([false]);
  });
});
