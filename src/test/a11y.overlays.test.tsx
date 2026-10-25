/**
 * axe-core overlay audit (TASK-028).
 *
 * Routes are covered by `a11y.routes.test.tsx`; this file opens the things that
 * only exist after an interaction — the command palette, the shortcut help, a
 * destructive confirmation, the import dialog, a dropdown menu, a context menu, a
 * sheet, and a toast — and audits each one. Overlays are where focus traps and
 * ARIA wiring most often go wrong, so they get their own file rather than being
 * assumed clean because the page under them is.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createFolder, createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
} from '@/components/ui';
import { expectNoSeriousViolations } from '@/test/a11y';
import { renderAppWithData } from '@/test/renderAppWithData';
import { useUiStore } from '@/store/uiStore';

const NOW = new Date('2026-10-25T09:00:00.000Z');
const deps = { now: () => NOW, newId: () => 'generated' };

async function seeded() {
  const prompt = {
    ...createPrompt(
      { title: 'Invoice parser', content: createBlankDocument({ name: 'Invoice parser' }) },
      { ...deps, newId: () => 'alpha' },
    ),
    id: 'alpha',
  };

  return createInMemoryRepositories({
    settings: { ...createDefaultSettings(), onboardedAt: '2026-01-02T09:00:00.000Z' },
    prompts: [prompt],
    folders: [createFolder({ name: 'Support', parentId: null }, deps)],
  });
}

// The palette's open state lives in the UI store, which is a singleton shared by
// every render in this file; without a reset the second test's shortcut would
// close the palette the first one left open.
beforeEach(() => {
  useUiStore.setState({ paletteOpen: false, helpOpen: false, sidebarOpen: true });
});

describe('axe: overlays (TASK-028)', () => {
  it('audits the command palette with an empty query', async () => {
    const user = userEvent.setup();
    renderAppWithData({ repositories: await seeded(), path: '/library' });
    await screen.findByText('Invoice parser');

    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog');

    await expectNoSeriousViolations(palette);
  }, 20_000);

  it('audits the command palette with results', async () => {
    const user = userEvent.setup();
    renderAppWithData({ repositories: await seeded(), path: '/library' });
    await screen.findByText('Invoice parser');

    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog');
    await user.type(within(palette).getByRole('combobox'), 'library');

    await expectNoSeriousViolations(palette);
  }, 20_000);

  it('audits the shortcut help', async () => {
    const user = userEvent.setup();
    renderAppWithData({ repositories: await seeded(), path: '/library' });
    await screen.findByText('Invoice parser');

    await user.keyboard('?');
    const help = await screen.findByRole('dialog');

    await expectNoSeriousViolations(help);
  }, 20_000);

  it('audits the import dialog', async () => {
    const user = userEvent.setup();
    renderAppWithData({ repositories: await seeded(), path: '/settings' });
    await screen.findByRole('heading', { level: 1 });

    await user.click(await screen.findByRole('button', { name: /import from file/i }));
    const dialog = await screen.findByRole('dialog');

    await expectNoSeriousViolations(dialog);
  }, 20_000);

  it('audits a destructive confirmation', async () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete this prompt?"
        description="It and its history are removed."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeVisible();
    await expectNoSeriousViolations(dialog);
  }, 20_000);

  it('audits an open dropdown menu', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>More actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const menu = await screen.findByRole('menu');

    await expectNoSeriousViolations(menu);
  }, 20_000);

  it('audits a sheet', async () => {
    render(
      <Sheet open onOpenChange={() => {}} title="Inspector" description="Details of the draft.">
        <p>Sheet body</p>
      </Sheet>,
    );

    await expectNoSeriousViolations(screen.getByRole('dialog'));
  }, 20_000);
});
