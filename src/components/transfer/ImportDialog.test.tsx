/**
 * Import dialog tests (TASK-026).
 *
 * These exercise the whole flow against real storage and a real store: choose a
 * file, preview it, decide, write, report. The important assertions are the
 * negative ones — a rejected file must leave the library exactly as it was.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { exportLibrary } from '@/domain/transfer/export';
import { createTransferFixture } from '@/test/transferFixture';
import { renderAppWithData } from '@/test/renderAppWithData';

const fixture = createTransferFixture();
const exportedAt = '2026-10-25T09:30:00.000Z';

const bundleJson = exportLibrary(
  {
    prompts: fixture.prompts,
    folders: fixture.folders,
    collections: fixture.collections,
    schemas: fixture.schemas,
    snippets: fixture.snippets,
    templates: fixture.templates,
    testCases: fixture.testCases,
    revisions: fixture.revisions,
  },
  { appVersion: '0.1.0', exportedAt },
).json;

function jsonFile(text: string, name = 'backup.json'): File {
  return new File([text], name, { type: 'application/json' });
}

interface SetupOptions {
  readonly seed?: {
    prompts?: typeof fixture.prompts;
    revisions?: typeof fixture.revisions;
    testCases?: typeof fixture.testCases;
    folders?: typeof fixture.folders;
    collections?: typeof fixture.collections;
    schemas?: typeof fixture.schemas;
    snippets?: typeof fixture.snippets;
    templates?: typeof fixture.templates;
  };
}

async function openImportDialog({ seed = {} }: SetupOptions = {}) {
  const repositories = await createInMemoryRepositories(seed);
  const view = renderAppWithData({ repositories, path: '/settings', mode: 'durable' });
  const user = userEvent.setup();

  await screen.findByRole('heading', { name: 'Your data' });
  await user.click(screen.getByRole('button', { name: 'Import from file' }));

  return { ...view, user, input: await screen.findByLabelText(/^File/) };
}

describe('import dialog — accepted files', () => {
  it('previews every prompt and writes nothing until confirm', async () => {
    const { user, input, store } = await openImportDialog();

    await user.upload(input, jsonFile(bundleJson));

    expect(await screen.findByRole('heading', { name: 'Import from a file' })).toBeInTheDocument();
    expect(await screen.findByText('Invoice extractor')).toBeInTheDocument();
    expect(screen.getByText('Escalation summary')).toBeInTheDocument();
    expect(screen.getByText(/2 prompts · 3 folders · 1 collections/)).toBeInTheDocument();

    // Still nothing written, and the button states the exact count.
    expect(store.getState().prompts).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Import 2 prompts' })).toBeEnabled();
  });

  it('writes the bundle and reports what it did', async () => {
    const { user, input, store } = await openImportDialog();

    await user.upload(input, jsonFile(bundleJson));
    await user.click(await screen.findByRole('button', { name: 'Import 2 prompts' }));

    expect(await screen.findByRole('heading', { name: 'Import finished' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Import summary' })).toBeInTheDocument();

    await waitFor(() => expect(store.getState().prompts).toHaveLength(2));
    expect(store.getState().folders).toHaveLength(3);
    expect(store.getState().revisions).toHaveLength(2);
    expect(store.getState().activity[0]?.type).toBe('imported');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Import finished' })).not.toBeInTheDocument(),
    );
  });

  it('detects a conflict and can import the prompt as a copy instead', async () => {
    const { user, input, store } = await openImportDialog({
      seed: { prompts: [fixture.prompts[0]!], revisions: fixture.revisions },
    });

    await user.upload(input, jsonFile(bundleJson));

    expect(await screen.findByText(/same id/i)).toBeInTheDocument();
    // The stored prompt matches, so it starts skipped: only prompt B is added.
    const confirm = screen.getByRole('button', { name: 'Import 1 prompt' });
    expect(confirm).toBeEnabled();

    await user.selectOptions(screen.getByLabelText('Resolution for Invoice extractor'), 'copy');
    await user.click(screen.getByRole('button', { name: 'Import 2 prompts' }));

    await waitFor(() => expect(store.getState().prompts).toHaveLength(3));
    expect(store.getState().prompts.map((prompt) => prompt.title)).toContain(
      'Invoice extractor (copy)',
    );
  });

  it('skips everything when every prompt is left as skip', async () => {
    const { user, input, store } = await openImportDialog({
      seed: { prompts: [fixture.prompts[0]!], revisions: fixture.revisions },
    });

    await user.upload(input, jsonFile(bundleJson));
    await user.selectOptions(screen.getByLabelText('Resolution for Escalation summary'), 'skip');

    expect(await screen.findByRole('button', { name: 'Nothing selected' })).toBeDisabled();
    expect(store.getState().prompts).toHaveLength(1);
  });
});

describe('import dialog — rejected files', () => {
  it('rejects malformed JSON and leaves the library untouched', async () => {
    const { user, input, store } = await openImportDialog({
      seed: { prompts: [fixture.prompts[0]!] },
    });

    await user.upload(input, jsonFile('{"format": ', 'broken.json'));

    expect(await screen.findByText('That file is not JSON')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
    expect(store.getState().prompts).toHaveLength(1);
  });

  it('rejects JSON that is not an export', async () => {
    const { user, input, store } = await openImportDialog();

    await user.upload(input, jsonFile('{"hello":"world"}', 'notes.json'));

    expect(await screen.findByText('That file is not a PromptForge export')).toBeInTheDocument();
    expect(store.getState().prompts).toHaveLength(0);
  });

  it('rejects a file over the size limit before reading it', async () => {
    const { user, input, store } = await openImportDialog();

    await user.upload(input, new File([new Uint8Array(2_000_001)], 'huge.json'));

    expect(await screen.findByText('That file is too large')).toBeInTheDocument();
    expect(screen.getByText(/The limit is 2\.0 MB/)).toBeInTheDocument();
    expect(store.getState().prompts).toHaveLength(0);
  });

  it('rejects an unsupported export version', async () => {
    const parsed = JSON.parse(bundleJson) as Record<string, unknown>;
    parsed['version'] = 7;

    const { user, input, store } = await openImportDialog();
    await user.upload(input, jsonFile(JSON.stringify(parsed)));

    expect(await screen.findByText('That export version is not supported')).toBeInTheDocument();
    expect(screen.getByText(/version 7/)).toBeInTheDocument();
    expect(store.getState().prompts).toHaveLength(0);
  });

  it('lists the broken records of a partially invalid bundle', async () => {
    const parsed = JSON.parse(bundleJson) as { prompts: { title: unknown }[] };
    parsed.prompts[1]!.title = 5;

    const { user, input } = await openImportDialog();
    await user.upload(input, jsonFile(JSON.stringify(parsed)));

    expect(
      await screen.findByText('That file contains records this build cannot read'),
    ).toBeInTheDocument();
    expect(screen.getByText(/prompts\[1\]\.title/)).toBeInTheDocument();
  });

  it('can retry with another file after a rejection', async () => {
    const { user, input, store } = await openImportDialog();

    await user.upload(input, jsonFile('nope', 'broken.json'));
    await user.click(await screen.findByRole('button', { name: 'Choose another file' }));

    await user.upload(screen.getByLabelText(/^File/), jsonFile(bundleJson));
    await user.click(await screen.findByRole('button', { name: 'Import 2 prompts' }));

    await waitFor(() => expect(store.getState().prompts).toHaveLength(2));
  });
});

describe('import from the command palette', () => {
  it('opens the same dialog as the settings card', async () => {
    const repositories = await createInMemoryRepositories();
    renderAppWithData({ repositories, path: '/library', mode: 'durable' });
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Library' });
    await user.keyboard('{Control>}k{/Control}');

    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    const search = within(dialog).getByRole('combobox', { name: 'Search commands' });
    await user.type(search, 'import file');

    expect(within(dialog).getByText('Import from a file')).toBeInTheDocument();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Import from a file' })).toBeVisible();
  });

  it('offers the export command only on a prompt screen', async () => {
    // On the library there is no open prompt, so the export command is absent.
    const repositories = await createInMemoryRepositories();
    renderAppWithData({ repositories, path: '/library', mode: 'durable' });
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Library' });
    await user.keyboard('{Control>}k{/Control}');

    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    const search = within(dialog).getByRole('combobox', { name: 'Search commands' });
    await user.type(search, 'export');

    expect(within(dialog).queryByText('Export the open prompt')).toBeNull();
  });
});
