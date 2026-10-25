/**
 * Library fixture for the transfer tests (TASK-026).
 *
 * One small but complete library: two prompts, a nested folder pair, a
 * collection, a schema, a snippet merged into one document, snapshot history, a
 * saved test case, and a user template. Every record has fixed ids and
 * timestamps, so a round-trip comparison is deterministic.
 */

import { createBlankDocument } from '@/domain/promptDocument';
import type {
  ActivityEvent,
  Collection,
  Folder,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
  PromptTemplate,
  Snippet,
  TestCase,
} from '@/domain/types';

export const FIXTURE_NOW = new Date('2026-10-25T09:30:00.000Z');

/** Sequential ids so a generated record is obvious in a failure message. */
export function sequenceIds(prefix = 'new'): () => string {
  let index = 0;
  return () => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

function document(name: string, overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name,
    role: 'Analyst',
    objective: `Objective for ${name}.`,
    instructions: ['Be precise.', 'Never invent a number.'],
    output: { format: 'json' },
    ...overrides,
  });
}

export interface TransferFixture {
  readonly prompts: readonly Prompt[];
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly schemas: readonly PromptSchema[];
  readonly snippets: readonly Snippet[];
  readonly templates: readonly PromptTemplate[];
  readonly testCases: readonly TestCase[];
  readonly revisions: readonly PromptRevision[];
  readonly activity: readonly ActivityEvent[];
}

export const FIXTURE_IDS = {
  folderRoot: 'folder-root',
  folderChild: 'folder-child',
  folderUnused: 'folder-unused',
  collection: 'collection-billing',
  schema: 'schema-invoice',
  snippet: 'snippet-tone',
  template: 'template-support',
  promptA: 'prompt-a',
  promptB: 'prompt-b',
  revisionA1: 'revision-a-1',
  revisionA2: 'revision-a-2',
  testCaseA: 'testcase-a',
} as const;

export function createTransferFixture(): TransferFixture {
  const folderRoot: Folder = {
    id: FIXTURE_IDS.folderRoot,
    name: 'Support',
    parentId: null,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  };

  const folderChild: Folder = {
    id: FIXTURE_IDS.folderChild,
    name: 'Billing',
    parentId: folderRoot.id,
    createdAt: '2026-09-02T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z',
  };

  const folderUnused: Folder = {
    id: FIXTURE_IDS.folderUnused,
    name: 'Archive drafts',
    parentId: null,
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
  };

  const collection: Collection = {
    id: FIXTURE_IDS.collection,
    name: 'Billing',
    description: 'Invoices, refunds, and dunning.',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
  };

  const schema: PromptSchema = {
    id: FIXTURE_IDS.schema,
    name: 'Invoice extraction',
    description: 'Amount, currency, and due date.',
    schemaContent: {
      type: 'object',
      required: ['amount'],
      properties: { amount: { type: 'number' } },
    },
    createdAt: '2026-09-05T08:00:00.000Z',
    updatedAt: '2026-09-05T08:00:00.000Z',
  };

  const snippet: Snippet = {
    id: FIXTURE_IDS.snippet,
    name: 'House tone',
    description: 'Short, direct, never cheerful about failures.',
    targetPath: 'context.references',
    value: ['Never blame the customer.'],
    createdAt: '2026-09-06T08:00:00.000Z',
    updatedAt: '2026-09-06T08:00:00.000Z',
  };

  const template: PromptTemplate = {
    id: FIXTURE_IDS.template,
    name: 'Support reply',
    description: 'A reply that states the fix first.',
    category: 'Support',
    content: document('Support reply'),
    isBuiltIn: false,
    createdAt: '2026-09-07T08:00:00.000Z',
    updatedAt: '2026-09-07T08:00:00.000Z',
  };

  const promptA: Prompt = {
    id: FIXTURE_IDS.promptA,
    title: 'Invoice extractor',
    description: 'Pulls the amount out of a billing email.',
    content: document('Invoice extractor', { includes: [snippet.id] }),
    format: 'json',
    folderId: folderChild.id,
    collectionIds: [collection.id],
    tags: ['billing', 'extraction'],
    favorite: true,
    pinned: false,
    archived: false,
    status: 'active',
    createdAt: '2026-09-10T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
    schemaId: schema.id,
    variables: [{ name: 'email', type: 'string', required: true }],
    metadata: { owner: 'Support' },
    version: 3,
  };

  const promptB: Prompt = {
    id: FIXTURE_IDS.promptB,
    title: 'Escalation summary',
    description: 'Condenses a thread for the on-call engineer.',
    content: document('Escalation summary'),
    format: 'json',
    folderId: folderChild.id,
    collectionIds: [],
    tags: ['support'],
    favorite: false,
    pinned: true,
    archived: false,
    status: 'draft',
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-13T08:00:00.000Z',
    schemaId: null,
    variables: [],
    metadata: {},
    version: 1,
  };

  const revisionA1: PromptRevision = {
    id: FIXTURE_IDS.revisionA1,
    promptId: promptA.id,
    revisionNumber: 1,
    contentSnapshot: promptA.content,
    titleSnapshot: promptA.title,
    descriptionSnapshot: promptA.description,
    tagsSnapshot: [...promptA.tags],
    variablesSnapshot: [...promptA.variables],
    label: 'First snapshot',
    kind: 'manual',
    createdAt: '2026-09-10T09:00:00.000Z',
  };

  const revisionA2: PromptRevision = {
    id: FIXTURE_IDS.revisionA2,
    promptId: promptA.id,
    revisionNumber: 2,
    contentSnapshot: promptA.content,
    titleSnapshot: promptA.title,
    descriptionSnapshot: promptA.description,
    tagsSnapshot: [...promptA.tags],
    variablesSnapshot: [...promptA.variables],
    label: null,
    kind: 'restore-safety',
    createdAt: '2026-09-12T09:00:00.000Z',
  };

  const testCase: TestCase = {
    id: FIXTURE_IDS.testCaseA,
    promptId: promptA.id,
    name: 'Short invoice',
    inputValues: { email: 'You owe 12 EUR.' },
    expectedStructure: schema.id,
    createdAt: '2026-09-14T08:00:00.000Z',
    updatedAt: '2026-09-14T08:00:00.000Z',
  };

  const activity: ActivityEvent = {
    id: 'activity-1',
    type: 'updated',
    promptId: promptA.id,
    promptTitle: promptA.title,
    summary: `Updated "${promptA.title}"`,
    createdAt: '2026-09-12T08:00:00.000Z',
  };

  return {
    prompts: [promptA, promptB],
    folders: [folderRoot, folderChild, folderUnused],
    collections: [collection],
    schemas: [schema],
    snippets: [snippet],
    templates: [template],
    testCases: [testCase],
    revisions: [revisionA1, revisionA2],
    activity: [activity],
  };
}
