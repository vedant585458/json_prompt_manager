/**
 * First-run seed data (TASK-007).
 *
 * Seeding is **versioned and resumable**:
 * - the stored `meta.seedVersion` gates whether anything runs at all;
 * - every record is created only if its fixed id is still missing, so an
 *   interrupted seed can be re-run without duplicating rows or overwriting
 *   user edits;
 * - user-visible settings are preserved, only their `seedVersion` moves.
 *
 * The seed deliberately writes no activity events: the activity log reflects
 * what the user did, not what shipped with the app.
 */

import { systemDependencies, type DomainDependencies } from '@/domain/factories';
import { createCollection, createFolder, createPrompt, createTemplate } from '@/domain/factories';
import { createDefaultSettings } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { PromptDocument } from '@/domain/types';
import type { EntityRepository, Repositories } from '@/data/repositories/contracts';

/** Bump when the starter set changes; existing installations re-run the seed. */
export const SEED_VERSION = 1;

/**
 * Fixed identifiers for every seeded row.
 *
 * Stability matters twice: it makes seeding idempotent, and it lets later
 * migrations or tours refer to the welcome prompt without a lookup.
 */
export const SEED_IDS = {
  folderGettingStarted: 'seed-folder-getting-started',
  collectionStarterKit: 'seed-collection-starter-kit',
  welcomePrompt: 'seed-prompt-welcome',
  templateStructuredExtraction: 'seed-template-structured-extraction',
  templateReviewResponse: 'seed-template-review-response',
} as const;

export interface SeedResult {
  /** True when this call ran the seed rather than short-circuiting. */
  readonly seeded: boolean;
  /** Version this build seeds. */
  readonly version: number;
  /** Version found in the database before this call. */
  readonly previousVersion: number;
  /** Rows actually created by this call (0 for an up-to-date database). */
  readonly created: {
    readonly folders: number;
    readonly collections: number;
    readonly prompts: number;
    readonly templates: number;
  };
}

/** Dependencies that emit one fixed id, so a seeded row keeps its identity. */
function withId(dependencies: DomainDependencies, id: string): DomainDependencies {
  return { now: dependencies.now, newId: () => id };
}

/**
 * Creates a record only when its id is absent.
 *
 * Returns whether the row was created. Using `get` before `create` — rather
 * than relying on the duplicate check — keeps a partially applied seed
 * resumable, which matters because seeding spans several stores and therefore
 * cannot be one IndexedDB transaction through the repository interface.
 */
async function ensure<T extends { id: string }>(
  repository: Pick<EntityRepository<T>, 'get' | 'create'>,
  id: string,
  build: () => T,
): Promise<boolean> {
  const existing = await repository.get(id);
  if (existing) return false;
  await repository.create(build());
  return true;
}

/* -------------------------------------------------------------------------- */
/* Starter documents                                                          */
/* -------------------------------------------------------------------------- */

/** The welcome prompt's document: explains the product and the storage model. */
function welcomeDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Welcome to PromptForge',
    role: 'Onboarding guide',
    objective:
      'Explain how PromptForge stores structured prompts on this device and what the user can do first.',
    instructions: [
      'Describe PromptForge as a local-first studio for structured JSON prompts.',
      'State clearly that prompts, revisions, and settings stay in this browser.',
      'Name the main surfaces: library, JSON editor, validation, history, and laboratory.',
      'Finish with one concrete next step for a first-time user.',
    ],
    context: {
      description:
        'PromptForge keeps each prompt as a canonical JSON document with named sections, variables, and a declared output format. Everything is stored locally in IndexedDB; nothing is sent anywhere.',
      references: ['docs/DATA-MODEL.md', 'docs/PERSISTENCE.md'],
    },
    constraints: [
      'Never claim that prompt content leaves the device.',
      'Stay under 200 words.',
      'Avoid marketing language and superlatives.',
    ],
    variables: [
      {
        name: 'audience',
        type: 'string',
        required: true,
        description: 'Who is reading the introduction, for example "first-time user".',
      },
    ],
    output: { format: 'markdown' },
    examples: [
      {
        input: { audience: 'first-time user' },
        output:
          '## Your prompts stay here\n\nPromptForge keeps every prompt, revision, and setting in this browser. Start by opening the welcome prompt in the editor, then validate it.',
      },
    ],
    metadata: {
      tags: ['onboarding', 'welcome'],
      author: 'PromptForge',
      notes: 'Seeded on first run. Edit or delete it freely; it is ordinary local data.',
    },
  });
}

/** Starter document 1: structured field extraction (full catalog is TASK-018). */
function structuredExtractionDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Structured field extraction',
    role: 'Information extractor',
    objective:
      'Convert unstructured source text into a JSON object that matches the requested field list.',
    instructions: [
      'Read the source text and ignore boilerplate.',
      'Return one JSON object using exactly the requested field names.',
      'Use null for a field the text does not answer; never invent values.',
      'Preserve original spelling for names and identifiers.',
    ],
    context: {
      description: 'The caller supplies the source text and the field list to extract.',
    },
    constraints: [
      'Output must be valid JSON with no prose around it.',
      'Do not add fields that were not requested.',
    ],
    variables: [
      {
        name: 'source_text',
        type: 'string',
        required: true,
        description: 'Text to extract from.',
      },
      {
        name: 'fields',
        type: 'json',
        required: true,
        description: 'Array of field names to return.',
      },
    ],
    output: { format: 'json' },
    examples: [
      {
        input: {
          source_text: 'Acme shipped v2.1 on 3 May. Contact: ops@acme.test',
          fields: ['company', 'version', 'released_on', 'contact'],
        },
        output: {
          company: 'Acme',
          version: 'v2.1',
          released_on: '3 May',
          contact: 'ops@acme.test',
        },
      },
    ],
    metadata: { tags: ['extraction', 'starter'] },
  });
}

/** Starter document 2: response drafting with an explicit structure. */
function reviewResponseDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Review response',
    role: 'Customer support writer',
    objective:
      'Draft a short, specific reply to a customer review that acknowledges the issue and states the next step.',
    instructions: [
      'Open with a direct acknowledgement of the specific complaint.',
      'State what will change, without promising dates that are not supplied.',
      'Close with one clear next step for the customer.',
    ],
    context: { description: 'The caller supplies the review text and the product area.' },
    constraints: [
      'Use plain language and no more than 120 words.',
      'Never promise compensation or timelines.',
      'Do not quote the review back verbatim.',
    ],
    variables: [
      { name: 'review_text', type: 'string', required: true, description: 'The review to answer.' },
      {
        name: 'product_area',
        type: 'string',
        required: false,
        description: 'Area of the product the review concerns.',
      },
    ],
    output: { format: 'text' },
    metadata: { tags: ['writing', 'support', 'starter'] },
  });
}

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

function emptyResult(previousVersion: number): SeedResult {
  return {
    seeded: false,
    version: SEED_VERSION,
    previousVersion,
    created: { folders: 0, collections: 0, prompts: 0, templates: 0 },
  };
}

/**
 * Applies the starter set when the database has not seen it yet.
 *
 * Call once per boot, after the repositories are ready and before the stores
 * hydrate. Never throws for an up-to-date database, and every failure it does
 * throw is an already-typed `StorageError` from the repository layer.
 */
export async function seedDatabase(
  repositories: Repositories,
  dependencies: DomainDependencies = systemDependencies,
): Promise<SeedResult> {
  const previousVersion = await repositories.meta.getSeedVersion();
  if (previousVersion >= SEED_VERSION) return emptyResult(previousVersion);

  const result = emptyResult(previousVersion);
  const created = {
    folders: 0,
    collections: 0,
    prompts: 0,
    templates: 0,
  };

  /* Settings: created on first run, otherwise only the seed version moves. */
  const existingSettings = await repositories.settings.get();
  if (!existingSettings) {
    await repositories.settings.save(createDefaultSettings({ seedVersion: SEED_VERSION }));
  } else if (existingSettings.seedVersion < SEED_VERSION) {
    await repositories.settings.save({ ...existingSettings, seedVersion: SEED_VERSION });
  }

  if (
    await ensure(repositories.folders, SEED_IDS.folderGettingStarted, () =>
      createFolder(
        { name: 'Getting started' },
        withId(dependencies, SEED_IDS.folderGettingStarted),
      ),
    )
  ) {
    created.folders += 1;
  }

  if (
    await ensure(repositories.collections, SEED_IDS.collectionStarterKit, () =>
      createCollection(
        {
          name: 'Starter kit',
          description: 'The prompts PromptForge ships with, kept together for reference.',
        },
        withId(dependencies, SEED_IDS.collectionStarterKit),
      ),
    )
  ) {
    created.collections += 1;
  }

  if (
    await ensure(repositories.prompts, SEED_IDS.welcomePrompt, () =>
      createPrompt(
        {
          title: 'Welcome to PromptForge',
          description: 'How structured prompts, local storage, and versioning work in this studio.',
          content: welcomeDocument(),
          folderId: SEED_IDS.folderGettingStarted,
          collectionIds: [SEED_IDS.collectionStarterKit],
          tags: ['welcome', 'guide'],
          status: 'active',
          pinned: true,
        },
        withId(dependencies, SEED_IDS.welcomePrompt),
      ),
    )
  ) {
    created.prompts += 1;
  }

  const templates = [
    {
      id: SEED_IDS.templateStructuredExtraction,
      name: 'Structured field extraction',
      description: 'Turn unstructured text into a JSON object with a fixed field list.',
      category: 'Extraction',
      content: structuredExtractionDocument,
    },
    {
      id: SEED_IDS.templateReviewResponse,
      name: 'Review response',
      description: 'Draft a short, specific reply to a customer review.',
      category: 'Writing',
      content: reviewResponseDocument,
    },
  ] as const;

  for (const template of templates) {
    const wasCreated = await ensure(repositories.templates, template.id, () =>
      createTemplate(
        {
          name: template.name,
          description: template.description,
          category: template.category,
          content: template.content(),
          isBuiltIn: true,
        },
        withId(dependencies, template.id),
      ),
    );
    if (wasCreated) created.templates += 1;
  }

  // Written last: an interrupted seed leaves the version untouched and is
  // therefore retried on the next boot (the per-row `ensure` makes that safe).
  await repositories.meta.setSeedVersion(SEED_VERSION);

  return { ...result, seeded: true, created };
}
