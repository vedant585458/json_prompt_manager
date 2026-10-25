/**
 * Entity factories (TASK-005).
 *
 * Every factory takes its clock and ID generator from `DomainDependencies`, so
 * tests (and, later, seed data) are deterministic: the same dependencies in,
 * the same entities out. Nothing here reads `Date.now()` or
 * `crypto.randomUUID()` implicitly except through `systemDependencies`.
 */

import {
  AUTOSAVE_DELAY,
  clampAutosaveDelay,
  normalizeTags,
  normalizeTitle,
} from '@/domain/invariants';
import { DEFAULT_HEALTH_THRESHOLDS } from '@/domain/health';
import { createBlankDocument, normalizeDocument } from '@/domain/promptDocument';
import { documentToJson } from '@/domain/serialization';
import type {
  ActivityEvent,
  ActivityType,
  Collection,
  EditorDensity,
  EntityId,
  Folder,
  HealthThresholds,
  IndentSize,
  IsoTimestamp,
  JsonObject,
  JsonValue,
  Prompt,
  PromptDocument,
  PromptFormat,
  PromptRevision,
  PromptSchema,
  PromptStatus,
  PromptTemplate,
  RevisionKind,
  Settings,
  Snippet,
  TestCase,
  ThemeSetting,
  VariableDefinition,
} from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Injectable dependencies                                                    */
/* -------------------------------------------------------------------------- */

/** The only two sources of non-determinism in the domain. */
export interface DomainDependencies {
  readonly now: () => Date;
  readonly newId: () => string;
}

/**
 * Default dependencies for the running app.
 *
 * `crypto.randomUUID` exists in every supported browser and in Node 22, so no
 * browser-only API is imported; the fallback keeps exotic environments (and
 * older test doubles) working.
 */
export const systemDependencies: DomainDependencies = {
  now: () => new Date(),
  newId: () => {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

    const random = Math.random().toString(16).slice(2, 10);
    return `id-${Date.now().toString(36)}-${random}`;
  },
};

function timestamp(deps: DomainDependencies): IsoTimestamp {
  return deps.now().toISOString();
}

/* -------------------------------------------------------------------------- */
/* Prompt                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreatePromptInput {
  readonly title?: string;
  readonly description?: string;
  /** Defaults to a blank document named after the prompt. */
  readonly content?: PromptDocument;
  readonly format?: PromptFormat;
  readonly folderId?: EntityId | null;
  readonly collectionIds?: readonly EntityId[];
  readonly tags?: readonly string[];
  readonly favorite?: boolean;
  readonly pinned?: boolean;
  readonly archived?: boolean;
  readonly status?: PromptStatus;
  readonly schemaId?: EntityId | null;
  /** Defaults to the document's declared variables. */
  readonly variables?: readonly VariableDefinition[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly version?: number;
}

/** Creates a prompt with defaults for every flag and counter. */
export function createPrompt(
  input: CreatePromptInput = {},
  deps: DomainDependencies = systemDependencies,
): Prompt {
  const trimmedTitle = normalizeTitle(input.title ?? 'Untitled prompt');
  const title = trimmedTitle.length > 0 ? trimmedTitle : 'Untitled prompt';
  const content = input.content
    ? normalizeDocument(input.content)
    : createBlankDocument({ name: title });
  const createdAt = timestamp(deps);

  return {
    id: deps.newId(),
    title,
    description: (input.description ?? '').trim(),
    content,
    format: input.format ?? 'json',
    folderId: input.folderId ?? null,
    collectionIds: [...(input.collectionIds ?? [])],
    tags: normalizeTags(input.tags ?? []),
    favorite: input.favorite ?? false,
    pinned: input.pinned ?? false,
    archived: input.archived ?? false,
    status: input.status ?? 'draft',
    createdAt,
    updatedAt: createdAt,
    schemaId: input.schemaId ?? null,
    variables: [...(input.variables ?? content.variables)],
    metadata: { ...(input.metadata ?? {}) },
    version: input.version ?? 1,
  };
}

/* -------------------------------------------------------------------------- */
/* Organisation                                                               */
/* -------------------------------------------------------------------------- */

export interface CreateFolderInput {
  readonly name: string;
  readonly parentId?: EntityId | null;
}

export function createFolder(
  input: CreateFolderInput,
  deps: DomainDependencies = systemDependencies,
): Folder {
  const createdAt = timestamp(deps);
  return {
    id: deps.newId(),
    name: normalizeTitle(input.name),
    parentId: input.parentId ?? null,
    createdAt,
    updatedAt: createdAt,
  };
}

export interface CreateCollectionInput {
  readonly name: string;
  readonly description?: string;
}

export function createCollection(
  input: CreateCollectionInput,
  deps: DomainDependencies = systemDependencies,
): Collection {
  const createdAt = timestamp(deps);
  return {
    id: deps.newId(),
    name: normalizeTitle(input.name),
    description: (input.description ?? '').trim(),
    createdAt,
    updatedAt: createdAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Revisions                                                                  */
/* -------------------------------------------------------------------------- */

export interface CreateRevisionInput {
  /** Monotonic per prompt; obtain with `nextRevisionNumber(revisions)`. */
  readonly revisionNumber: number;
  readonly kind: RevisionKind;
  readonly label?: string | null;
}

/**
 * Deep-copies a document so later edits cannot mutate the snapshot.
 * Documents are JSON by definition, so a JSON round-trip is exact.
 */
function snapshotDocument(document: PromptDocument): PromptDocument {
  return JSON.parse(JSON.stringify(documentToJson(document))) as PromptDocument;
}

/** Immutable snapshot of a prompt's user-visible fields. */
export function createRevision(
  prompt: Prompt,
  input: CreateRevisionInput,
  deps: DomainDependencies = systemDependencies,
): PromptRevision {
  return {
    id: deps.newId(),
    promptId: prompt.id,
    revisionNumber: input.revisionNumber,
    contentSnapshot: snapshotDocument(prompt.content),
    titleSnapshot: prompt.title,
    descriptionSnapshot: prompt.description,
    tagsSnapshot: [...prompt.tags],
    variablesSnapshot: [...prompt.variables],
    label: input.label?.trim() ? input.label.trim() : null,
    kind: input.kind,
    createdAt: timestamp(deps),
  };
}

/* -------------------------------------------------------------------------- */
/* Templates, test cases, schemas, snippets                                   */
/* -------------------------------------------------------------------------- */

export interface CreateTemplateInput {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly content: PromptDocument;
  readonly isBuiltIn?: boolean;
}

export function createTemplate(
  input: CreateTemplateInput,
  deps: DomainDependencies = systemDependencies,
): PromptTemplate {
  const createdAt = timestamp(deps);
  return {
    id: deps.newId(),
    name: normalizeTitle(input.name),
    description: (input.description ?? '').trim(),
    category: normalizeTitle(input.category ?? 'General') || 'General',
    content: normalizeDocument(input.content),
    isBuiltIn: input.isBuiltIn ?? false,
    createdAt,
    updatedAt: createdAt,
  };
}

export interface CreateTestCaseInput {
  readonly promptId: EntityId;
  readonly name: string;
  readonly inputValues?: Readonly<Record<string, JsonValue>>;
  readonly expectedStructure?: EntityId | null;
}

export function createTestCase(
  input: CreateTestCaseInput,
  deps: DomainDependencies = systemDependencies,
): TestCase {
  const createdAt = timestamp(deps);
  return {
    id: deps.newId(),
    promptId: input.promptId,
    name: normalizeTitle(input.name),
    inputValues: { ...(input.inputValues ?? {}) },
    expectedStructure: input.expectedStructure ?? null,
    createdAt,
    updatedAt: createdAt,
  };
}

export interface CreateSchemaInput {
  readonly name: string;
  readonly description?: string;
  readonly schemaContent: JsonObject;
}

export function createPromptSchema(
  input: CreateSchemaInput,
  deps: DomainDependencies = systemDependencies,
): PromptSchema {
  const createdAt = timestamp(deps);
  return {
    id: deps.newId(),
    name: normalizeTitle(input.name),
    description: (input.description ?? '').trim(),
    schemaContent: { ...input.schemaContent },
    createdAt,
    updatedAt: createdAt,
  };
}

export interface CreateSnippetInput {
  readonly name: string;
  readonly targetPath: string;
  readonly value: JsonValue;
  readonly description?: string;
}

export function createSnippet(
  input: CreateSnippetInput,
  deps: DomainDependencies = systemDependencies,
): Snippet {
  const createdAt = timestamp(deps);
  return {
    id: deps.newId(),
    name: normalizeTitle(input.name),
    description: (input.description ?? '').trim(),
    targetPath: input.targetPath.trim(),
    value: input.value,
    createdAt,
    updatedAt: createdAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateActivityEventInput {
  readonly type: ActivityType;
  readonly summary: string;
  readonly promptId?: EntityId;
  readonly promptTitle?: string;
}

export function createActivityEvent(
  input: CreateActivityEventInput,
  deps: DomainDependencies = systemDependencies,
): ActivityEvent {
  return {
    id: deps.newId(),
    type: input.type,
    summary: normalizeTitle(input.summary),
    ...(input.promptId ? { promptId: input.promptId } : {}),
    ...(input.promptTitle ? { promptTitle: input.promptTitle } : {}),
    createdAt: timestamp(deps),
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateSettingsInput {
  readonly theme?: ThemeSetting;
  readonly reducedMotion?: boolean;
  readonly indentSize?: IndentSize;
  readonly autosaveEnabled?: boolean;
  readonly autosaveDelayMs?: number;
  readonly density?: EditorDensity;
  readonly healthThresholds?: HealthThresholds;
  readonly onboardedAt?: IsoTimestamp | null;
  readonly seedVersion?: number;
}

/** Default settings record. Theme defaults to `system` (dark-first rendering). */
export function createDefaultSettings(input: CreateSettingsInput = {}): Settings {
  return {
    theme: input.theme ?? 'system',
    reducedMotion: input.reducedMotion ?? false,
    indentSize: input.indentSize ?? 2,
    autosaveEnabled: input.autosaveEnabled ?? true,
    autosaveDelayMs: clampAutosaveDelay(input.autosaveDelayMs ?? AUTOSAVE_DELAY.defaultValue),
    density: input.density ?? 'comfortable',
    healthThresholds: input.healthThresholds ?? DEFAULT_HEALTH_THRESHOLDS,
    onboardedAt: input.onboardedAt ?? null,
    seedVersion: input.seedVersion ?? 0,
  };
}
