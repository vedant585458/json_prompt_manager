/**
 * Seeded library fixtures for integration tests (TASK-029).
 *
 * `createTransferFixture` (TASK-026) exists for the transfer round-trip and is a
 * single hand-written library. Integration tests need something different: a
 * library they can size and vary — "three prompts, one archived, two in a folder,
 * all with history" — with ids and timestamps that do not move between runs.
 *
 * Everything here is built through the real factories with a `fakeClock`, so a
 * fixture cannot drift from the shapes the app actually writes.
 */

import {
  createActivityEvent,
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
  createPromptSchema,
  createRevision,
  createSnippet,
  createTemplate,
  createTestCase,
  type DomainDependencies,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type {
  ActivityEvent,
  Collection,
  Folder,
  Prompt,
  PromptRevision,
  PromptSchema,
  PromptTemplate,
  Settings,
  Snippet,
  TestCase,
} from '@/domain/types';
import { fakeClock, type FakeClock } from '@/test/clock';
import type { InMemorySeed } from '@/data';

export interface LibraryFixture extends InMemorySeed {
  readonly prompts: readonly Prompt[];
  readonly revisions: readonly PromptRevision[];
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly schemas: readonly PromptSchema[];
  readonly snippets: readonly Snippet[];
  readonly templates: readonly PromptTemplate[];
  readonly testCases: readonly TestCase[];
  readonly activity: readonly ActivityEvent[];
  readonly settings: Settings;
  /** The clock the fixture was built with, for assertions about timestamps. */
  readonly clock: FakeClock;
}

export interface LibraryOptions {
  /** How many prompts to build. Default 3. */
  readonly prompts?: number;
  /** Build one folder per prompt instead of leaving them unfiled. */
  readonly folders?: boolean;
  /** Build a collection that every prompt joins. */
  readonly collection?: boolean;
  /** Give each prompt `revisions` snapshots (default 1) and one test case. */
  readonly history?: boolean;
  /** Archive the last prompt. */
  readonly archiveLast?: boolean;
  /** Start instant; defaults to the shared fixed start. */
  readonly start?: string;
  /** Whether the settings record counts as onboarded. Default true. */
  readonly onboarded?: boolean;
}

/**
 * A library sized for a test, with fixed ids (`prompt-1`, `folder-1`, …).
 *
 * Prompt *titles* are stable and human-readable ("Prompt 1"), because assertions
 * read them; ids are stable too, because a test that wants `prompt-2` should not
 * have to search for it.
 */
export function buildLibrary(options: LibraryOptions = {}): LibraryFixture {
  const {
    prompts: promptCount = 3,
    folders: withFolders = false,
    collection: withCollection = false,
    history: withHistory = true,
    archiveLast = false,
    start,
    onboarded = true,
  } = options;

  const clock = fakeClock({ start, prefix: 'record' });

  const folders: Folder[] = [];
  for (let index = 0; index < promptCount && withFolders; index += 1) {
    clock.tick();
    folders.push(
      createFolder(
        { name: `Folder ${index + 1}`, parentId: null },
        { ...clock.deps, newId: () => `folder-${index + 1}` },
      ),
    );
  }

  const collections: Collection[] = [];
  if (withCollection) {
    clock.tick();
    collections.push(
      createCollection(
        { name: 'Everything', description: 'Every prompt in the fixture.' },
        { ...clock.deps, newId: () => 'collection-1' },
      ),
    );
  }

  const schemas: PromptSchema[] = [];
  const snippets: Snippet[] = [];
  if (withHistory) {
    clock.tick();
    schemas.push(
      createPromptSchema(
        {
          name: 'Object output',
          description: 'The smallest useful schema.',
          schemaContent: { type: 'object', required: ['summary'] },
        },
        { ...clock.deps, newId: () => 'schema-1' },
      ),
    );

    clock.tick();
    snippets.push(
      createSnippet(
        {
          name: 'House tone',
          description: 'Never cheerful about failure.',
          targetPath: 'context.references',
          value: ['Never blame the customer.'],
        },
        { ...clock.deps, newId: () => 'snippet-1' },
      ),
    );
  }

  const prompts: Prompt[] = [];
  const revisions: PromptRevision[] = [];
  const testCases: TestCase[] = [];

  for (let index = 0; index < promptCount; index += 1) {
    const promptId = `prompt-${index + 1}`;
    const title = `Prompt ${index + 1}`;
    clock.tick();

    const prompt: Prompt = {
      ...createPrompt(
        {
          title,
          description: `${title} description.`,
          tags: index === 0 ? ['support', 'billing'] : ['support'],
          folderId: withFolders ? `folder-${index + 1}` : null,
          collectionIds: withCollection ? ['collection-1'] : [],
          favorite: index === 0,
          pinned: false,
          archived: archiveLast && index === promptCount - 1,
          content: createBlankDocument({
            name: title,
            role: 'Analyst',
            objective: `Objective for ${title}.`,
            instructions: ['Be precise.'],
            includes: withHistory && index === 0 ? ['snippet-1'] : [],
          }),
          schemaId: withHistory && index === 0 ? 'schema-1' : null,
        },
        { ...clock.deps, newId: () => promptId },
      ),
      id: promptId,
    };

    prompts.push(prompt);

    if (withHistory) {
      clock.tick();
      revisions.push(
        createRevision(
          prompt,
          { revisionNumber: 1, kind: 'manual', label: 'First snapshot' },
          { ...clock.deps, newId: () => `${promptId}-revision-1` },
        ),
      );

      clock.tick();
      testCases.push(
        createTestCase(
          { promptId, name: `${title} case`, inputValues: { input: title } },
          { ...clock.deps, newId: () => `${promptId}-case-1` },
        ),
      );
    }
  }

  const activity: ActivityEvent[] = [];
  clock.tick();
  activity.push(
    createActivityEvent(
      {
        type: 'created',
        promptId: prompts[0]?.id ?? 'prompt-1',
        promptTitle: prompts[0]?.title ?? 'Prompt 1',
        summary: 'Created the first prompt',
      },
      clock.deps,
    ),
  );

  clock.tick();
  const settings: Settings = {
    ...createDefaultSettings(),
    onboardedAt: onboarded ? clock.iso() : null,
  };

  return {
    prompts,
    revisions,
    folders,
    collections,
    schemas,
    snippets,
    templates: [] as PromptTemplate[],
    testCases,
    activity,
    settings,
    clock,
  };
}

/** A library with a single user template, for template-screen tests. */
export function buildTemplateFixture(
  deps: DomainDependencies = fakeClock({ prefix: 'template' }).deps,
): PromptTemplate {
  return createTemplate(
    {
      name: 'Support reply',
      description: 'States the fix first.',
      category: 'Support',
      content: createBlankDocument({ name: 'Support reply' }),
    },
    deps,
  );
}

/** Strips the fixture's helper fields so it can seed a repository adapter. */
export function asSeed(fixture: LibraryFixture): InMemorySeed {
  const { clock: _clock, ...seed } = fixture;
  return seed;
}
