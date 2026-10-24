import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createActivityEvent,
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
  createPromptSchema,
  createRevision,
  createSnippet,
  createTestCase,
  createTemplate,
  systemDependencies,
  type DomainDependencies,
} from '@/domain/factories';
import { createSampleDocument } from '@/domain/promptDocument';
import { AUTOSAVE_DELAY } from '@/domain/invariants';
import type { PromptDocument } from '@/domain/types';

/** Deterministic clock + id generator: the whole point of the injection. */
function fixedDependencies(
  iso = '2026-10-24T09:41:07.123Z',
): DomainDependencies & { calls: () => number } {
  let counter = 0;
  return {
    now: () => new Date(iso),
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
    calls: () => counter,
  };
}

describe('createPrompt', () => {
  it('is deterministic under injected dependencies', () => {
    const first = createPrompt({ title: 'Summarizer' }, fixedDependencies());
    const second = createPrompt({ title: 'Summarizer' }, fixedDependencies());

    expect(first).toEqual(second);
    expect(first.id).toBe('id-1');
    expect(first.createdAt).toBe('2026-10-24T09:41:07.123Z');
    expect(first.updatedAt).toBe(first.createdAt);
  });

  it('applies documented defaults', () => {
    const prompt = createPrompt({}, fixedDependencies());

    expect(prompt).toMatchObject({
      title: 'Untitled prompt',
      description: '',
      format: 'json',
      folderId: null,
      collectionIds: [],
      tags: [],
      favorite: false,
      pinned: false,
      archived: false,
      status: 'draft',
      schemaId: null,
      metadata: {},
      version: 1,
    });
  });

  it('names the blank document after the prompt title', () => {
    const prompt = createPrompt({ title: '  Release   notes  ' }, fixedDependencies());

    expect(prompt.title).toBe('Release notes');
    expect(prompt.content.name).toBe('Release notes');
    expect(prompt.content.schemaVersion).toBe('1.0');
  });

  it('falls back to a placeholder for a blank title', () => {
    const prompt = createPrompt({ title: '   ' }, fixedDependencies());
    expect(prompt.title).toBe('Untitled prompt');
    expect(prompt.content.name).toBe('Untitled prompt');
  });

  it('normalizes tags and copies collections and metadata', () => {
    const prompt = createPrompt(
      {
        title: 'Tagged',
        tags: [' Release Notes ', 'release-notes', 'Docs'],
        collectionIds: ['c1', 'c2'],
        metadata: { team: 'docs' },
        folderId: 'f1',
        favorite: true,
        pinned: true,
        archived: true,
        status: 'active',
        schemaId: 's1',
        version: 4,
      },
      fixedDependencies(),
    );

    expect(prompt.tags).toEqual(['release-notes', 'docs']);
    expect(prompt.collectionIds).toEqual(['c1', 'c2']);
    expect(prompt.metadata).toEqual({ team: 'docs' });
    expect(prompt.folderId).toBe('f1');
    expect(prompt.schemaId).toBe('s1');
    expect(prompt.favorite).toBe(true);
    expect(prompt.pinned).toBe(true);
    expect(prompt.archived).toBe(true);
    expect(prompt.status).toBe('active');
    expect(prompt.version).toBe(4);
  });

  it('takes variables from the content unless overridden', () => {
    const content = createSampleDocument();
    const fromContent = createPrompt({ content }, fixedDependencies());
    expect(fromContent.variables).toEqual(content.variables);

    const overridden = createPrompt(
      { content, variables: [{ name: 'only', type: 'string', required: false }] },
      fixedDependencies(),
    );
    expect(overridden.variables.map((variable) => variable.name)).toEqual(['only']);
  });

  it('normalizes supplied content and does not mutate it', () => {
    const content: PromptDocument = {
      ...createSampleDocument(),
      name: '  Padded  ',
      constraints: [' Rule ', 'Rule'],
    };
    const prompt = createPrompt({ content }, fixedDependencies());

    expect(prompt.content.name).toBe('Padded');
    expect(prompt.content.constraints).toEqual(['Rule']);
    expect(content.name).toBe('  Padded  ');
  });
});

describe('organisation factories', () => {
  it('creates folders at the root or under a parent', () => {
    const deps = fixedDependencies();
    const root = createFolder({ name: '  Work  ' }, deps);
    const child = createFolder({ name: 'Drafts', parentId: root.id }, deps);

    expect(root).toEqual({
      id: 'id-1',
      name: 'Work',
      parentId: null,
      createdAt: '2026-10-24T09:41:07.123Z',
      updatedAt: '2026-10-24T09:41:07.123Z',
    });
    expect(child.parentId).toBe('id-1');
  });

  it('creates collections with a trimmed description', () => {
    const collection = createCollection(
      { name: ' Writing ', description: '  Tone of voice prompts ' },
      fixedDependencies(),
    );

    expect(collection.name).toBe('Writing');
    expect(collection.description).toBe('Tone of voice prompts');
    expect(collection.id).toBe('id-1');
  });
});

describe('createRevision', () => {
  it('snapshots prompt fields and metadata', () => {
    const deps = fixedDependencies();
    const prompt = createPrompt({ title: 'Original', tags: ['Docs'], description: 'Desc' }, deps);
    const revision = createRevision(
      prompt,
      { revisionNumber: 3, kind: 'manual', label: '  Before rewrite  ' },
      deps,
    );

    expect(revision).toMatchObject({
      promptId: prompt.id,
      revisionNumber: 3,
      titleSnapshot: 'Original',
      descriptionSnapshot: 'Desc',
      tagsSnapshot: ['docs'],
      kind: 'manual',
      label: 'Before rewrite',
      createdAt: '2026-10-24T09:41:07.123Z',
    });
    expect(revision.contentSnapshot).toEqual(prompt.content);
  });

  it('stores a null label when the label is blank', () => {
    const deps = fixedDependencies();
    const prompt = createPrompt({}, deps);
    const revision = createRevision(prompt, { revisionNumber: 1, kind: 'import' }, deps);

    expect(revision.label).toBeNull();
    expect(revision.kind).toBe('import');
  });

  it('deep-copies the document so later edits cannot change the snapshot', () => {
    const deps = fixedDependencies();
    const prompt = createPrompt({ content: createSampleDocument() }, deps);
    const revision = createRevision(prompt, { revisionNumber: 1, kind: 'manual' }, deps);

    const edited: PromptDocument = { ...prompt.content, instructions: ['Changed'] };
    expect(revision.contentSnapshot.instructions).not.toEqual(edited.instructions);
    expect(revision.contentSnapshot.instructions).toEqual(prompt.content.instructions);
    // The snapshot is a separate object graph.
    expect(revision.contentSnapshot).not.toBe(prompt.content);
  });
});

describe('content factories', () => {
  it('creates templates with defaults and normalized content', () => {
    const template = createTemplate(
      {
        name: '  Summarizer  ',
        content: createSampleDocument(),
        description: '  Long docs  ',
      },
      fixedDependencies(),
    );

    expect(template.name).toBe('Summarizer');
    expect(template.description).toBe('Long docs');
    expect(template.category).toBe('General');
    expect(template.isBuiltIn).toBe(false);
    expect(template.content).toEqual(createSampleDocument());
  });

  it('keeps an explicit category and built-in flag', () => {
    const template = createTemplate(
      {
        name: 'Base',
        content: createSampleDocument(),
        category: 'Engineering',
        isBuiltIn: true,
      },
      fixedDependencies(),
    );

    expect(template.category).toBe('Engineering');
    expect(template.isBuiltIn).toBe(true);
  });

  it('creates test cases tied to a prompt', () => {
    const testCase = createTestCase(
      {
        promptId: 'p1',
        name: '  Short input ',
        inputValues: { topic: 'release notes' },
      },
      fixedDependencies(),
    );

    expect(testCase).toMatchObject({
      promptId: 'p1',
      name: 'Short input',
      inputValues: { topic: 'release notes' },
      expectedStructure: null,
    });
  });

  it('creates schemas and snippets', () => {
    const deps = fixedDependencies();
    const schema = createPromptSchema(
      { name: 'Notes schema', schemaContent: { type: 'object' } },
      deps,
    );
    const snippet = createSnippet(
      {
        name: 'Tone block',
        targetPath: ' context.description ',
        value: 'Professional, concise.',
        description: ' Reused tone ',
      },
      deps,
    );

    expect(schema.schemaContent).toEqual({ type: 'object' });
    expect(schema.id).toBe('id-1');
    expect(snippet.targetPath).toBe('context.description');
    expect(snippet.description).toBe('Reused tone');
    expect(snippet.value).toBe('Professional, concise.');
  });

  it('creates activity events with optional prompt references', () => {
    const deps = fixedDependencies();
    const withPrompt = createActivityEvent(
      { type: 'created', summary: '  Created   the prompt ', promptId: 'p1', promptTitle: 'Doc' },
      deps,
    );
    const withoutPrompt = createActivityEvent({ type: 'settings', summary: 'Changed theme' }, deps);

    expect(withPrompt.summary).toBe('Created the prompt');
    expect(withPrompt.promptId).toBe('p1');
    expect(withPrompt.promptTitle).toBe('Doc');
    expect('promptId' in withoutPrompt).toBe(false);
    expect('promptTitle' in withoutPrompt).toBe(false);
  });
});

describe('createDefaultSettings', () => {
  it('returns documented defaults', () => {
    expect(createDefaultSettings()).toEqual({
      theme: 'system',
      reducedMotion: false,
      indentSize: 2,
      autosaveEnabled: true,
      autosaveDelayMs: AUTOSAVE_DELAY.defaultValue,
      density: 'comfortable',
      onboardedAt: null,
      seedVersion: 0,
    });
  });

  it('clamps the autosave delay and honours overrides', () => {
    expect(createDefaultSettings({ autosaveDelayMs: 10 }).autosaveDelayMs).toBe(AUTOSAVE_DELAY.min);
    expect(createDefaultSettings({ autosaveDelayMs: 60_000 }).autosaveDelayMs).toBe(
      AUTOSAVE_DELAY.max,
    );
    expect(
      createDefaultSettings({
        theme: 'light',
        density: 'compact',
        indentSize: 4,
        reducedMotion: true,
        autosaveEnabled: false,
        onboardedAt: '2026-10-24T00:00:00.000Z',
        seedVersion: 3,
      }),
    ).toEqual({
      theme: 'light',
      reducedMotion: true,
      indentSize: 4,
      autosaveEnabled: false,
      autosaveDelayMs: AUTOSAVE_DELAY.defaultValue,
      density: 'compact',
      onboardedAt: '2026-10-24T00:00:00.000Z',
      seedVersion: 3,
    });
  });
});

describe('systemDependencies', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to a timestamp-based id when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    const id = systemDependencies.newId();
    expect(id).toMatch(/^id-[a-z0-9]+-[0-9a-f]+$/);
    expect(systemDependencies.newId()).not.toBe(id);
  });

  it('produces unique ids and real ISO timestamps', () => {
    const first = createPrompt({ title: 'One' });
    const second = createPrompt({ title: 'Two' });

    expect(first.id).not.toBe(second.id);
    expect(first.id.length).toBeGreaterThan(0);
    expect(new Date(first.createdAt).toISOString()).toBe(first.createdAt);
    expect(systemDependencies.now()).toBeInstanceOf(Date);
  });
});
