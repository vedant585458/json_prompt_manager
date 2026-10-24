import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { draftStorageKey } from '@/features/editor/draftStorage';

import { createInMemoryRepositories } from '@/data';
import {
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
  createPromptSchema,
  createRevision,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { formatDocument } from '@/domain/serialization';
import type { Prompt } from '@/domain/types';
import { renderAppWithData } from '@/test/renderAppWithData';
import { usePreferencesStore } from '@/store/preferences';
import { useUiStore } from '@/store/uiStore';

const COMPLETED_ONBOARDING = '2026-01-02T09:00:00.000Z';
const BASE_TIME = '2026-10-24T09:00:00.000Z';

interface Seed {
  readonly prompts?: readonly Prompt[];
  readonly path?: string;
  readonly mode?: 'durable' | 'ephemeral';
}

function makePrompt(overrides: Partial<Prompt> & { id: string; title: string }): Prompt {
  const base = createPrompt(
    {
      title: overrides.title,
      description: overrides.description ?? 'Summarises a support thread.',
      tags: overrides.tags ?? ['support'],
      folderId: overrides.folderId ?? null,
      collectionIds: overrides.collectionIds ?? [],
      favorite: overrides.favorite ?? false,
      pinned: overrides.pinned ?? false,
      archived: overrides.archived ?? false,
      content: createBlankDocument({ name: overrides.title }),
    },
    { now: () => new Date(BASE_TIME), newId: () => overrides.id },
  );

  return { ...base, ...overrides };
}

function renderEditor(seed: Seed = {}) {
  const repositories = createInMemoryRepositories({
    prompts: seed.prompts ?? [],
    folders: [
      createFolder(
        { name: 'Client work', parentId: null },
        {
          now: () => new Date(BASE_TIME),
          newId: () => 'work',
        },
      ),
    ],
    collections: [
      createCollection(
        { name: 'Starter kit', description: '' },
        {
          now: () => new Date(BASE_TIME),
          newId: () => 'kit',
        },
      ),
    ],
    settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
  });

  return {
    ...renderAppWithData({
      repositories,
      path: seed.path ?? '/prompts/alpha',
      mode: seed.mode ?? 'ephemeral',
    }),
    repositories,
  };
}

async function openEditor(seed: Seed = {}) {
  const harness = renderEditor(seed);
  await waitFor(() => expect(harness.store.getState().status).toBe('ready'));
  return harness;
}

beforeEach(() => {
  useUiStore.setState({
    sidebarOpen: true,
    paletteOpen: false,
    helpOpen: false,
    selectedPromptIds: [],
    selectedPromptId: null,
  });
});

describe('prompt workspace header (TASK-013)', () => {
  const prompt = makePrompt({
    id: 'alpha',
    title: 'Invoice parser',
    tags: ['finance', 'extraction'],
    folderId: 'work',
    collectionIds: ['kit'],
  });

  it('names the prompt, its filing, and what the screen does not do yet', async () => {
    await openEditor({ prompts: [prompt] });

    expect(await screen.findByRole('heading', { level: 1, name: 'Invoice parser' })).toBeVisible();
    const section = screen.getByRole('region', { name: 'Invoice parser' });
    expect(within(section).getByText('#finance')).toBeVisible();
    expect(within(section).getByText('Client work')).toBeVisible();
    expect(within(section).getByText('Starter kit')).toBeVisible();
    expect(within(section).getByText(/Validation arrives in TASK-016/)).toBeVisible();
    expect(within(section).getByRole('button', { name: 'Favorite' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('favorites and pins from the header with write-through state', async () => {
    const user = userEvent.setup();
    const { store } = await openEditor({ prompts: [prompt] });

    await user.click(await screen.findByRole('button', { name: 'Favorite' }));

    expect(await screen.findByText('Added to favorites')).toBeVisible();
    const favoriteButton = screen.getByRole('button', { name: 'Favorited' });
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Pin' }));

    await waitFor(() => expect(store.getState().prompts[0]?.pinned).toBe(true));
    expect(screen.getByRole('button', { name: 'Pinned' })).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().prompts[0]).toMatchObject({ favorite: true, pinned: true });
  });

  it('archives and restores with an undo action', async () => {
    const user = userEvent.setup();
    const { store } = await openEditor({ prompts: [prompt] });

    await user.click(await screen.findByRole('button', { name: 'Archive' }));

    expect(await screen.findByText('Prompt archived')).toBeVisible();
    expect(store.getState().prompts[0]?.archived).toBe(true);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(store.getState().prompts[0]?.archived).toBe(false));
    expect(screen.getByRole('button', { name: 'Archive' })).toBeVisible();
  });

  it('explains when the id is not in the library', async () => {
    await openEditor({ prompts: [], path: '/prompts/missing' });

    expect(await screen.findByText('This prompt is not in your library')).toBeVisible();
    expect(screen.getByText(/missing/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to the library' })).toHaveAttribute(
      'href',
      '/library',
    );
  });
});

describe('JSON workspace (TASK-014)', () => {
  const prompt = makePrompt({ id: 'alpha', title: 'Invoice parser' });

  async function openWithDraft(text: string, promptId = 'alpha') {
    window.localStorage.setItem(
      draftStorageKey(promptId),
      JSON.stringify({
        promptId,
        text,
        savedAt: '2026-10-24T10:00:00.000Z',
        baseUpdatedAt: BASE_TIME,
      }),
    );
    return openEditor({ prompts: [prompt] });
  }

  it('renders the stored document and reports that saving is off when storage is ephemeral', async () => {
    await openEditor({ prompts: [prompt] });

    const editor = await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    expect(editor.textContent).toContain('"schemaVersion"');
    expect(editor.textContent).toContain('"Invoice parser"');

    expect(await screen.findByText('Valid JSON')).toBeVisible();
    expect(screen.getByText('Saving is off')).toBeVisible();
    expect(screen.getByText(/Ephemeral mode — saving is disabled/)).toBeVisible();
    expect(screen.queryByText(/^Saved/)).not.toBeInTheDocument();
  });

  it('reports a syntax error from typing, keeps the text, and jumps to the line', async () => {
    const user = userEvent.setup();
    await openEditor({ prompts: [prompt] });

    const editor = await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(editor);
    await user.keyboard('x');

    const panel = await screen.findByText(/This is not valid JSON — line 1, column 1/);
    expect(panel).toBeVisible();
    expect(screen.getByText('Syntax error')).toBeVisible();
    // The text the person typed is still there, with the stray character first.
    expect(
      screen.getByRole('textbox', { name: 'JSON document for Invoice parser' }).textContent,
    ).toMatch(/^x\{/);

    await user.click(screen.getByRole('button', { name: 'Go to line 1' }));
    expect(screen.getByLabelText(/Caret at line 1/)).toBeVisible();
  });

  it('formats and minifies the draft from the toolbar, idempotently', async () => {
    const user = userEvent.setup();
    await openWithDraft('{"name":"Compact","tags":["a","b"]}');

    await user.click(await screen.findByRole('button', { name: 'Restore the draft' }));
    // The parse is debounced; the toolbar reports that instead of accepting a click.
    await screen.findByText('Valid JSON');

    await user.click(screen.getByRole('button', { name: 'Format JSON' }));

    expect(await screen.findByText('Formatted')).toBeVisible();
    const formatted = screen.getByRole('textbox', {
      name: 'JSON document for Invoice parser',
    }).textContent;
    expect(formatted).toContain('"name": "Compact"');
    expect(formatted).toContain('"tags": [');
    // CodeMirror renders one element per line, so line breaks are DOM structure.
    expect(document.querySelectorAll('.cm-line').length).toBeGreaterThan(3);

    await user.click(screen.getByRole('button', { name: 'Format JSON' }));
    expect(await screen.findByText('Already formatted')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Minify JSON' }));
    expect(await screen.findByText('Minified')).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'JSON document for Invoice parser' }).textContent,
    ).toBe('{"name":"Compact","tags":["a","b"]}');
  });

  it('shows the tree view of the parsed document and moves through it with the keyboard', async () => {
    const user = userEvent.setup();
    await openEditor({ prompts: [prompt] });

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('tab', { name: 'Tree view' }));

    const tree = await screen.findByRole('tree', { name: 'Document tree' });
    expect(within(tree).getByText('$')).toBeVisible();
    expect(within(tree).getByText('schemaVersion')).toBeVisible();

    const initial = tree.getAttribute('aria-activedescendant');
    expect(initial).not.toBeNull();

    tree.focus();
    await user.keyboard('{ArrowDown}');
    expect(tree.getAttribute('aria-activedescendant')).not.toBe(initial);

    await user.keyboard('{ArrowRight}');
    expect(within(tree).getByText('instructions')).toBeVisible();
  });

  it('explains an invalid document instead of drawing a partial tree', async () => {
    const user = userEvent.setup();
    await openWithDraft('{"name": }');

    await user.click(await screen.findByRole('button', { name: 'Restore the draft' }));
    await user.click(screen.getByRole('tab', { name: 'Tree view' }));

    expect(await screen.findByText(/The tree needs valid JSON/)).toBeVisible();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('asks before leaving a dirty draft and stays when asked to', async () => {
    const user = userEvent.setup();
    const { store } = await openEditor({ prompts: [prompt] });

    const editor = await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(editor);
    await user.keyboard('x');

    await user.click(
      within(screen.getByRole('navigation', { name: 'Prompt location' })).getByRole('link', {
        name: 'Library',
      }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'Leave with unsaved changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(store.getState().prompts[0]?.id).toBe('alpha');
    expect(
      screen.getByRole('textbox', { name: 'JSON document for Invoice parser' }).textContent,
    ).toMatch(/^x\{/);
  });

  it('copies the whole document and reports the real clipboard result', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await openEditor({ prompts: [prompt] });
    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });

    await user.click(screen.getByRole('button', { name: 'Copy the whole document' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(String(writeText.mock.calls[0]?.[0])).toContain('"schemaVersion"');
    expect(await screen.findByText('Document copied')).toBeVisible();
  });

  it('writes a recovery draft to this browser without touching storage', async () => {
    const user = userEvent.setup();
    const { repositories } = await openEditor({ prompts: [prompt] });

    const editor = await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(editor);
    await user.keyboard('x');

    await waitFor(() =>
      expect(window.localStorage.getItem(draftStorageKey('alpha'))).toContain('"text"'),
    );
    // The database still holds the original document.
    await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({
      title: 'Invoice parser',
    });
    expect(screen.getByText('Unsaved changes — this text is not in storage yet.')).toBeVisible();
  });
});

describe('save pipeline (TASK-015)', () => {
  const prompt = makePrompt({ id: 'alpha', title: 'Invoice parser' });

  function draftWithObjective(objective: string): string {
    const document = JSON.parse(formatDocument(prompt.content, 2)) as Record<string, unknown>;
    document.objective = objective;
    return JSON.stringify(document, null, 2);
  }

  async function openDurable(seed: Seed = {}) {
    return openEditor({ prompts: [prompt], mode: 'durable', ...seed });
  }

  beforeEach(() => {
    usePreferencesStore.setState({ autosaveEnabled: false });
    window.localStorage.clear();
  });

  it('saves on Mod+S and only claims success once the write lands', async () => {
    const user = userEvent.setup();
    const { repositories } = await openDurable();

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('button', { name: 'Minify JSON' }));

    expect(await screen.findByText('Unsaved changes')).toBeVisible();

    await user.keyboard('{Control>}s{/Control}');

    expect(await screen.findByText(/^Saved at /)).toBeVisible();
    await waitFor(async () => {
      await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ version: 2 });
    });
  });

  it('autosaves after the configured delay', async () => {
    usePreferencesStore.setState({ autosaveEnabled: true, autosaveDelayMs: 300 });
    const user = userEvent.setup();
    const { repositories } = await openDurable();

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('button', { name: 'Minify JSON' }));

    expect(await screen.findByText(/^Saved at /, undefined, { timeout: 3000 })).toBeVisible();
    await waitFor(async () => {
      await expect(repositories.prompts.get('alpha')).resolves.toMatchObject({ version: 2 });
    });
  });

  it('offers a conflict instead of overwriting a newer version, and keeps the draft on request', async () => {
    const user = userEvent.setup();
    const mine = draftWithObjective('Mine, typed earlier.');
    window.localStorage.setItem(
      draftStorageKey('alpha'),
      JSON.stringify({
        promptId: 'alpha',
        text: mine,
        savedAt: '2026-10-24T10:00:00.000Z',
        baseUpdatedAt: BASE_TIME,
        baseVersion: 1,
      }),
    );

    const { repositories } = await openDurable();
    await user.click(await screen.findByRole('button', { name: 'Restore the draft' }));

    // Another tab writes first.
    const stored = await repositories.prompts.get('alpha');
    if (!stored) throw new Error('seed prompt missing');
    const theirs = JSON.parse(formatDocument(stored.content, 2)) as Record<string, unknown>;
    theirs.objective = 'Written elsewhere.';
    await repositories.prompts.update(
      {
        ...stored,
        content: theirs as unknown as Prompt['content'],
        version: stored.version + 1,
        updatedAt: '2026-10-24T11:00:00.000Z',
      },
      { expectedVersion: stored.version },
    );

    await user.keyboard('{Control>}s{/Control}');

    const dialog = await screen.findByRole('dialog', { name: 'This prompt changed in storage' });
    expect(within(dialog).getByText('version 2')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'View the stored version' }));
    expect(within(dialog).getByText(/Written elsewhere\./)).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Keep my draft as new content' }));

    await waitFor(async () => {
      const saved = await repositories.prompts.get('alpha');
      expect(saved?.content.objective).toBe('Mine, typed earlier.');
      expect(saved?.version).toBe(3);
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'This prompt changed in storage' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('reloads the stored version on request and drops the draft', async () => {
    const user = userEvent.setup();
    const mine = draftWithObjective('Mine, typed earlier.');
    window.localStorage.setItem(
      draftStorageKey('alpha'),
      JSON.stringify({
        promptId: 'alpha',
        text: mine,
        savedAt: '2026-10-24T10:00:00.000Z',
        baseUpdatedAt: BASE_TIME,
        baseVersion: 1,
      }),
    );

    const { repositories } = await openDurable();
    await user.click(await screen.findByRole('button', { name: 'Restore the draft' }));

    const stored = await repositories.prompts.get('alpha');
    if (!stored) throw new Error('seed prompt missing');
    const theirs = JSON.parse(formatDocument(stored.content, 2)) as Record<string, unknown>;
    theirs.objective = 'Written elsewhere.';
    await repositories.prompts.update(
      {
        ...stored,
        content: theirs as unknown as Prompt['content'],
        version: stored.version + 1,
      },
      { expectedVersion: stored.version },
    );

    await user.keyboard('{Control>}s{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'This prompt changed in storage' });
    await user.click(within(dialog).getByRole('button', { name: 'Reload the stored version' }));

    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'JSON document for Invoice parser' }).textContent,
      ).toContain('Written elsewhere.'),
    );
    expect(screen.getByText('No unsaved changes')).toBeVisible();
    expect(window.localStorage.getItem(draftStorageKey('alpha'))).toBeNull();
  });

  it('describes how a recovery draft differs from the stored prompt', async () => {
    const user = userEvent.setup();
    const mine = draftWithObjective('A different objective.');
    window.localStorage.setItem(
      draftStorageKey('alpha'),
      JSON.stringify({
        promptId: 'alpha',
        text: mine,
        savedAt: '2026-10-24T10:00:00.000Z',
        baseUpdatedAt: BASE_TIME,
        baseVersion: 1,
      }),
    );

    await openDurable();

    expect(await screen.findByText(/Differs from the stored document at line/)).toBeVisible();
    expect(screen.getByText(/typed over an older version|written/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Restore the draft' }));
    expect(
      screen.getByRole('textbox', { name: 'JSON document for Invoice parser' }).textContent,
    ).toContain('A different objective.');
  });
});

describe('validation in the workspace (TASK-016)', () => {
  const schema = createPromptSchema(
    {
      name: 'Team shape',
      schemaContent: {
        type: 'object',
        required: ['objective'],
        properties: { objective: { type: 'string', minLength: 12 } },
      },
    },
    { now: () => new Date(BASE_TIME), newId: () => 'schema-1' },
  );

  function renderWithSchema(promptOverrides: Partial<Prompt> = {}, path = '/prompts/alpha') {
    const prompt = makePrompt({ id: 'alpha', title: 'Invoice parser', ...promptOverrides });
    const repositories = createInMemoryRepositories({
      prompts: [prompt],
      schemas: [schema],
      settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
    });

    return renderAppWithData({ repositories, path });
  }

  it('reports the draft in the inspector without leaving the workspace', async () => {
    const user = userEvent.setup();
    renderWithSchema({ schemaId: schema.id });

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('tab', { name: 'Validation' }));

    expect(await screen.findByText('Does not meet the schema')).toBeVisible();
    expect(screen.getByText(/Must be at least 12 characters/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open the studio' })).toHaveAttribute(
      'href',
      '/validation?prompt=alpha',
    );
  });

  it('says what validation does not claim', async () => {
    const user = userEvent.setup();
    renderWithSchema();

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('tab', { name: 'Validation' }));

    expect(await screen.findByText(/not a judgement of prompt quality/i)).toBeVisible();
  });

  it('moves the caret to a schema finding’s path', async () => {
    const user = userEvent.setup();
    renderWithSchema({ schemaId: schema.id });

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('tab', { name: 'Validation' }));
    await user.click(await screen.findByRole('button', { name: 'Find $.objective in the editor' }));

    // `objective` is the fifth line of the canonical document; the caret follows it.
    await waitFor(() => expect(screen.getByLabelText(/^Caret at line 5/)).toBeVisible());
  });

  it('honours a line link from the validation studio', async () => {
    renderWithSchema({}, '/prompts/alpha?line=3');

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await waitFor(() => expect(screen.getByLabelText(/^Caret at line 3/)).toBeVisible());
  });
});

describe('composer handoff (TASK-017)', () => {
  it('links from the workspace to the composer for this prompt', async () => {
    renderEditor({ prompts: [makePrompt({ id: 'alpha', title: 'Invoice parser' })] });

    expect(
      await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Compose' })).toHaveAttribute(
      'href',
      '/prompts/alpha/compose',
    );
  });
});

describe('revision history entry points (TASK-019)', () => {
  const prompt = makePrompt({ id: 'alpha', title: 'Invoice parser' });

  beforeEach(() => {
    usePreferencesStore.setState({ autosaveEnabled: false });
    window.localStorage.clear();
  });

  it('links to the history and says when there is none', async () => {
    await openEditor({ prompts: [prompt], mode: 'durable' });

    const link = await screen.findByRole('link', { name: /History/ });
    expect(link).toHaveAttribute('href', '/prompts/alpha/history');
    expect(link).toHaveTextContent('none');
  });

  it('links to the diff explorer from the header', async () => {
    await openEditor({ prompts: [prompt], mode: 'durable' });

    expect(await screen.findByRole('link', { name: /Compare/ })).toHaveAttribute(
      'href',
      '/diff?prompt=alpha',
    );
  });

  it('counts the stored snapshots in the header', async () => {
    const revision = createRevision(prompt, { revisionNumber: 1, kind: 'manual', label: 'First' });
    const repositories = createInMemoryRepositories({
      prompts: [prompt],
      revisions: [revision],
      settings: { ...createDefaultSettings(), onboardedAt: COMPLETED_ONBOARDING },
    });
    const harness = renderAppWithData({
      repositories,
      path: '/prompts/alpha',
      mode: 'durable',
    });
    await waitFor(() => expect(harness.store.getState().status).toBe('ready'));

    expect(await screen.findByRole('link', { name: /History/ })).toHaveTextContent('1');
  });

  it('saves a snapshot from the header and toasts its number', async () => {
    usePreferencesStore.setState({ autosaveEnabled: false });
    const user = userEvent.setup();
    const { repositories } = await openEditor({ prompts: [prompt], mode: 'durable' });

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('button', { name: 'Save snapshot' }));

    const dialog = await screen.findByRole('dialog', { name: 'Save a snapshot' });
    await user.click(within(dialog).getByRole('button', { name: 'Save snapshot' }));

    expect(await screen.findByText('Snapshot v1 saved')).toBeInTheDocument();
    await waitFor(async () => {
      await expect(repositories.revisions.countByPrompt('alpha')).resolves.toBe(1);
    });
  });
});

describe('preview tab (TASK-021)', () => {
  function promptWithVariables(): Prompt {
    return makePrompt({
      id: 'alpha',
      title: 'Invoice parser',
      content: createBlankDocument({
        name: 'Invoice parser',
        role: 'Bookkeeper',
        objective: 'Extract {{customer}} from the invoice.',
        instructions: ['Read the invoice.', 'Return JSON.'],
        variables: [
          { name: 'customer', type: 'string', required: true },
          { name: 'threshold', type: 'number', required: false, defaultValue: 100 },
        ],
      }),
    });
  }

  beforeEach(() => {
    usePreferencesStore.setState({ autosaveEnabled: false });
    window.localStorage.clear();
    sessionStorage.clear();
  });

  it('renders the stored document in a Preview tab and fills its variables', async () => {
    const user = userEvent.setup();
    await openEditor({ prompts: [promptWithVariables()] });

    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(screen.getByText(/This preview follows the draft/)).toBeVisible();
    // The required customer has no value, so there is nothing to copy yet.
    expect(screen.getByText('Rendering is paused')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Copy rendered text/ })).not.toBeInTheDocument();

    await user.type(await screen.findByRole('textbox', { name: 'customer' }), 'Acme Ltd');

    const output = await screen.findByRole('region', { name: 'Rendered prompt text' });
    await waitFor(() => expect(output).toHaveTextContent('Extract Acme Ltd from the invoice.'));
    expect(screen.getByRole('button', { name: /Copy rendered text/ })).toBeVisible();
    // The number default is filled in from the declaration, not typed.
    expect(screen.getByRole('textbox', { name: 'threshold' })).toHaveValue('100');
  });

  it('waits for a valid draft rather than previewing stale text', async () => {
    const user = userEvent.setup();
    await openEditor({ prompts: [promptWithVariables()] });

    const editor = await screen.findByRole('textbox', {
      name: 'JSON document for Invoice parser',
    });
    await user.click(editor);
    await user.keyboard('x');
    await screen.findByText(/This is not valid JSON/);

    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(await screen.findByText('There is nothing to preview yet')).toBeVisible();
    expect(screen.getByText(/The preview needs valid JSON/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Rendered prompt text' })).not.toBeInTheDocument();
  });

  it('links to the standalone playground for this prompt', async () => {
    await openEditor({ prompts: [promptWithVariables()] });

    const user = userEvent.setup();
    await screen.findByRole('textbox', { name: 'JSON document for Invoice parser' });
    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(await screen.findByRole('link', { name: 'Open the playground' })).toHaveAttribute(
      'href',
      '/prompts/alpha/playground',
    );
  });
});
