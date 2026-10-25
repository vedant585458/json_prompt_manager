/**
 * Transfer format (TASK-026).
 *
 * Two exported documents share one shape, because an importer that has to
 * understand three shapes has three chances to be wrong:
 *
 * - `promptforge.bundle` / version 1 — a collection of records: prompts with
 *   their metadata, revisions, folders, collections, schemas, snippets,
 *   templates, and test cases, plus a manifest of counts.
 * - `promptforge.prompt` / version 1 — the same envelope holding exactly one
 *   prompt and the records it references. Exporting a single prompt is
 *   therefore the same code path as exporting the library, and importing either
 *   file is the same parser.
 *
 * Everything here is pure: shapes, validation, and serialization. Reading a
 * file, choosing records, and writing to storage live in `export.ts`,
 * `import.ts`, and the data store.
 *
 * Validation is deliberately strict and *record-local*: every field that the
 * importer will copy is checked and reconstructed, so a hand-edited file cannot
 * smuggle extra keys into storage, and a malformed record produces an issue with
 * a path instead of an exception.
 */

import { parseDocument } from '@/domain/serialization';
import type {
  Collection,
  DomainIssue,
  DomainResult,
  Folder,
  IsoTimestamp,
  JsonValue,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
  PromptStatus,
  PromptTemplate,
  RevisionKind,
  Snippet,
  TestCase,
  VariableDefinition,
  VariableType,
} from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Marker on a multi-record export. */
export const BUNDLE_FORMAT = 'promptforge.bundle';

/** Marker on a single-prompt export. Same shape, different intent. */
export const PROMPT_FILE_FORMAT = 'promptforge.prompt';

/** The only transfer version this build writes and reads. */
export const TRANSFER_VERSION = 1;

/** What the manifest says the file is. */
export type TransferScope = 'library' | 'selection' | 'prompt';

export type TransferFormat = 'bundle' | 'prompt-file' | 'document';

export const TRANSFER_FORMATS: Readonly<Record<TransferFormat, string>> = {
  bundle: 'PromptForge bundle',
  'prompt-file': 'PromptForge prompt file',
  document: 'Prompt document (JSON)',
};

/**
 * What a round trip keeps and what it cannot.
 *
 * Written into every export so the file explains itself to whoever opens it in
 * six months, and asserted by the round-trip test so the note cannot drift away
 * from the behaviour.
 */
export const FIDELITY_NOTES: readonly string[] = [
  'Preserved: prompt metadata, documents, variables, custom metadata, folder and collection membership, attached schema, included snippets, tags, favorite/pinned/archived flags, status, creation and update timestamps, snapshot history, saved test cases, templates, schemas, and snippets.',
  'Regenerated: record identifiers when they collide with an existing record, revision numbers that collide on an overwrite, test-case names that collide within their prompt, and template names that already exist.',
  'Not included: activity log, preferences (theme, density, autosave, health thresholds), recovery drafts, playground inputs, quality dismissals, and onboarding state.',
  'Import remaps references as it writes, so folder, collection, schema, snippet, and prompt links survive a re-import into a library that already holds records.',
];

/** The label a bundle gives the app that wrote it. */
export const TRANSFER_APP_NAME = 'PromptForge';

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface BundleCounts {
  readonly prompts: number;
  readonly revisions: number;
  readonly folders: number;
  readonly collections: number;
  readonly schemas: number;
  readonly snippets: number;
  readonly templates: number;
  readonly testCases: number;
}

export interface BundleManifest {
  readonly app: string;
  readonly appVersion: string;
  readonly exportedAt: IsoTimestamp;
  readonly scope: TransferScope;
  readonly counts: BundleCounts;
  /** The notes above, copied into the file. */
  readonly fidelity: readonly string[];
}

/**
 * One exportable document.
 *
 * Both markers carry the same lists. `format` and `manifest.scope` are what
 * distinguish them, and the reader turns either into a bundle shape.
 */
export interface PromptForgeBundle {
  readonly format: typeof BUNDLE_FORMAT | typeof PROMPT_FILE_FORMAT;
  readonly version: number;
  readonly manifest: BundleManifest;
  readonly prompts: readonly Prompt[];
  readonly revisions: readonly PromptRevision[];
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly schemas: readonly PromptSchema[];
  readonly snippets: readonly Snippet[];
  readonly templates: readonly PromptTemplate[];
  readonly testCases: readonly TestCase[];
}

/** Every record list a bundle carries, in manifest order. */
export const BUNDLE_COLLECTIONS = [
  'prompts',
  'revisions',
  'folders',
  'collections',
  'schemas',
  'snippets',
  'templates',
  'testCases',
] as const;

export type BundleCollection = (typeof BUNDLE_COLLECTIONS)[number];

/* -------------------------------------------------------------------------- */
/* Serialization                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Canonical key order for an exported file.
 *
 * Field order is stable so two exports of the same library differ only in the
 * manifest timestamp, which keeps diffing backups meaningful.
 */
function promptToJson(prompt: Prompt): Record<string, JsonValue> {
  return {
    id: prompt.id,
    title: prompt.title,
    description: prompt.description,
    content: prompt.content as unknown as JsonValue,
    format: prompt.format,
    folderId: prompt.folderId,
    collectionIds: [...prompt.collectionIds],
    tags: [...prompt.tags],
    favorite: prompt.favorite,
    pinned: prompt.pinned,
    archived: prompt.archived,
    status: prompt.status,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    schemaId: prompt.schemaId,
    variables: prompt.variables as unknown as JsonValue,
    metadata: prompt.metadata as unknown as JsonValue,
    version: prompt.version,
  };
}

/** Deterministic JSON text for a bundle: two-space indent, stable key order. */
export function serializeBundle(bundle: PromptForgeBundle): string {
  return JSON.stringify(
    {
      format: bundle.format,
      version: bundle.version,
      manifest: {
        app: bundle.manifest.app,
        appVersion: bundle.manifest.appVersion,
        exportedAt: bundle.manifest.exportedAt,
        scope: bundle.manifest.scope,
        counts: {
          prompts: bundle.manifest.counts.prompts,
          revisions: bundle.manifest.counts.revisions,
          folders: bundle.manifest.counts.folders,
          collections: bundle.manifest.counts.collections,
          schemas: bundle.manifest.counts.schemas,
          snippets: bundle.manifest.counts.snippets,
          templates: bundle.manifest.counts.templates,
          testCases: bundle.manifest.counts.testCases,
        },
        fidelity: [...bundle.manifest.fidelity],
      },
      prompts: bundle.prompts.map(promptToJson),
      revisions: bundle.revisions.map((revision) => ({
        id: revision.id,
        promptId: revision.promptId,
        revisionNumber: revision.revisionNumber,
        contentSnapshot: revision.contentSnapshot as unknown as JsonValue,
        titleSnapshot: revision.titleSnapshot,
        descriptionSnapshot: revision.descriptionSnapshot,
        tagsSnapshot: [...revision.tagsSnapshot],
        variablesSnapshot: revision.variablesSnapshot as unknown as JsonValue,
        label: revision.label,
        kind: revision.kind,
        createdAt: revision.createdAt,
      })),
      folders: bundle.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })),
      collections: bundle.collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      })),
      schemas: bundle.schemas.map((schema) => ({
        id: schema.id,
        name: schema.name,
        description: schema.description,
        schemaContent: schema.schemaContent as unknown as JsonValue,
        createdAt: schema.createdAt,
        updatedAt: schema.updatedAt,
      })),
      snippets: bundle.snippets.map((snippet) => ({
        id: snippet.id,
        name: snippet.name,
        description: snippet.description,
        targetPath: snippet.targetPath,
        value: snippet.value,
        createdAt: snippet.createdAt,
        updatedAt: snippet.updatedAt,
      })),
      templates: bundle.templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        content: template.content as unknown as JsonValue,
        isBuiltIn: template.isBuiltIn,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
      testCases: bundle.testCases.map((testCase) => ({
        id: testCase.id,
        promptId: testCase.promptId,
        name: testCase.name,
        inputValues: testCase.inputValues as unknown as JsonValue,
        expectedStructure: testCase.expectedStructure,
        createdAt: testCase.createdAt,
        updatedAt: testCase.updatedAt,
      })),
    },
    null,
    2,
  );
}

/** True when the text is JSON that the transfer reader could look at. */
export function countBundleRecords(bundle: PromptForgeBundle): BundleCounts {
  return {
    prompts: bundle.prompts.length,
    revisions: bundle.revisions.length,
    folders: bundle.folders.length,
    collections: bundle.collections.length,
    schemas: bundle.schemas.length,
    snippets: bundle.snippets.length,
    templates: bundle.templates.length,
    testCases: bundle.testCases.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Detection                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Guesses what a parsed JSON value is, without validating it.
 *
 * Only the envelope is inspected: a `promptforge.*` marker decides the format,
 * and a document is recognised by the fields that make it one. Validation is a
 * separate step, so "this looks like a bundle" and "this bundle is usable" stay
 * distinguishable in the errors the user sees.
 */
export function detectTransferFormat(value: unknown): TransferFormat | null {
  if (!isRecord(value)) return null;

  const format = value['format'];
  if (format === BUNDLE_FORMAT) return 'bundle';
  if (format === PROMPT_FILE_FORMAT) return 'prompt-file';

  // A raw document is the JSON people already have: a PromptForge document, or
  // a close-enough object that `parseDocument` can normalize.
  if (
    'schemaVersion' in value ||
    ('name' in value && ('role' in value || 'objective' in value || 'instructions' in value))
  ) {
    return 'document';
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(path: string, message: string): DomainIssue {
  return { path, message, severity: 'error' };
}

function warning(path: string, message: string): DomainIssue {
  return { path, message, severity: 'warning' };
}

function readString(value: unknown, path: string, issues: DomainIssue[]): string {
  if (typeof value === 'string') return value;
  issues.push(error(path, 'Expected a string.'));
  return '';
}

/** Reads a string field, but tolerates a missing one by falling back. */
function readOptionalString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readIso(value: unknown, path: string, issues: DomainIssue[], fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    // Stored timestamps are ISO-8601; an unparseable one is a broken record, not
    // something to silently replace with "now".
    if (!Number.isNaN(new Date(value).getTime())) return value;
    issues.push(error(path, 'Expected an ISO-8601 timestamp.'));
    return fallback;
  }
  issues.push(error(path, 'Expected a timestamp.'));
  return fallback;
}

function readBoolean(
  value: unknown,
  path: string,
  issues: DomainIssue[],
  fallback = false,
): boolean {
  if (typeof value === 'boolean') return value;
  issues.push(error(path, 'Expected true or false.'));
  return fallback;
}

function readStringArray(value: unknown, path: string, issues: DomainIssue[]): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push(error(path, 'Expected an array of strings.'));
    return [];
  }
  const out: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry === 'string') out.push(entry);
    else issues.push(error(`${path}[${index}]`, 'Expected a string.'));
  });
  return out;
}

function readIdOrNull(value: unknown, path: string, issues: DomainIssue[]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length > 0 ? value : null;
  issues.push(error(path, 'Expected an id or null.'));
  return null;
}

const VARIABLE_TYPES: readonly VariableType[] = ['string', 'number', 'boolean', 'json'];
const PROMPT_STATUSES: readonly PromptStatus[] = ['draft', 'active', 'deprecated'];
const REVISION_KINDS: readonly RevisionKind[] = ['manual', 'restore-safety', 'import'];

function readVariables(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): readonly VariableDefinition[] {
  if (!Array.isArray(value)) {
    issues.push(error(path, 'Expected an array of variables.'));
    return [];
  }

  const out: VariableDefinition[] = [];
  value.forEach((entry, index) => {
    const at = `${path}[${index}]`;
    if (!isRecord(entry)) {
      issues.push(error(at, 'Expected a variable object.'));
      return;
    }
    const name = readString(entry['name'], `${at}.name`, issues);
    const type = entry['type'];
    if (typeof type !== 'string' || !VARIABLE_TYPES.includes(type as VariableType)) {
      issues.push(error(`${at}.type`, `Expected one of ${VARIABLE_TYPES.join(', ')}.`));
      return;
    }
    if (typeof entry['required'] !== 'boolean') {
      issues.push(error(`${at}.required`, 'Expected true or false.'));
      return;
    }

    const variable: VariableDefinition = {
      name,
      type: type as VariableType,
      required: entry['required'],
      ...('defaultValue' in entry ? { defaultValue: entry['defaultValue'] as JsonValue } : {}),
      ...(typeof entry['description'] === 'string' ? { description: entry['description'] } : {}),
    };
    out.push(variable);
  });

  return out;
}

function readMetadataRecord(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected an object of string values.'));
    return {};
  }

  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry;
    else issues.push(error(`${path}.${key}`, 'Expected a string.'));
  }
  return out;
}

function readJsonObject(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): Record<string, JsonValue> {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a JSON object.'));
    return {};
  }
  return value as Record<string, JsonValue>;
}

/**
 * Validates a document and reports every parser issue under `path`.
 *
 * The document is the one field an import cannot normalise around: a prompt
 * whose content does not parse cannot become a stored prompt, so this is an
 * error rather than a warning.
 */
function readDocument(value: unknown, path: string, issues: DomainIssue[]): PromptDocument | null {
  const parsed = parseDocument(value);
  if (parsed.ok) return parsed.value;

  for (const issue of parsed.issues) {
    if (issue.severity === 'error') {
      issues.push(error(issue.path ? `${path}.${issue.path}` : path, issue.message));
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Record validators                                                          */
/* -------------------------------------------------------------------------- */

export function readPromptRecord(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): Prompt | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a prompt object.'));
    return null;
  }

  const id = readString(value['id'], `${path}.id`, issues);
  const title = readString(value['title'], `${path}.title`, issues);
  const content = readDocument(value['content'], `${path}.content`, issues);
  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');
  const updatedAt = readIso(value['updatedAt'], `${path}.updatedAt`, issues, createdAt);

  const status = value['status'];
  if (typeof status !== 'string' || !PROMPT_STATUSES.includes(status as PromptStatus)) {
    issues.push(error(`${path}.status`, `Expected one of ${PROMPT_STATUSES.join(', ')}.`));
  }

  if (value['format'] !== undefined && value['format'] !== 'json') {
    issues.push(error(`${path}.format`, 'Only JSON documents are supported.'));
  }

  const version = value['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    issues.push(error(`${path}.version`, 'Expected a positive integer.'));
  }

  if (!content) return null;

  return {
    id,
    title,
    description: readOptionalString(value['description']),
    content,
    format: 'json',
    folderId: readIdOrNull(value['folderId'], `${path}.folderId`, issues),
    collectionIds: readStringArray(value['collectionIds'], `${path}.collectionIds`, issues),
    tags: readStringArray(value['tags'], `${path}.tags`, issues),
    favorite:
      value['favorite'] === undefined
        ? false
        : readBoolean(value['favorite'], `${path}.favorite`, issues),
    pinned:
      value['pinned'] === undefined
        ? false
        : readBoolean(value['pinned'], `${path}.pinned`, issues),
    archived:
      value['archived'] === undefined
        ? false
        : readBoolean(value['archived'], `${path}.archived`, issues),
    status: PROMPT_STATUSES.includes(status as PromptStatus) ? (status as PromptStatus) : 'draft',
    createdAt,
    updatedAt,
    schemaId: readIdOrNull(value['schemaId'], `${path}.schemaId`, issues),
    variables: readVariables(value['variables'] ?? [], `${path}.variables`, issues),
    metadata: readMetadataRecord(value['metadata'], `${path}.metadata`, issues),
    version: typeof version === 'number' && Number.isInteger(version) && version >= 1 ? version : 1,
  };
}

function readRevisionRecord(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): PromptRevision | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a revision object.'));
    return null;
  }

  const snapshot = readDocument(value['contentSnapshot'], `${path}.contentSnapshot`, issues);
  const revisionNumber = value['revisionNumber'];
  if (
    typeof revisionNumber !== 'number' ||
    !Number.isInteger(revisionNumber) ||
    revisionNumber < 1
  ) {
    issues.push(error(`${path}.revisionNumber`, 'Expected a positive integer.'));
  }

  const kind = value['kind'];
  if (typeof kind !== 'string' || !REVISION_KINDS.includes(kind as RevisionKind)) {
    issues.push(error(`${path}.kind`, `Expected one of ${REVISION_KINDS.join(', ')}.`));
  }

  if (!snapshot) return null;

  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');

  return {
    id: readString(value['id'], `${path}.id`, issues),
    promptId: readString(value['promptId'], `${path}.promptId`, issues),
    revisionNumber:
      typeof revisionNumber === 'number' && Number.isInteger(revisionNumber) && revisionNumber >= 1
        ? revisionNumber
        : 1,
    contentSnapshot: snapshot,
    titleSnapshot: readOptionalString(value['titleSnapshot']),
    descriptionSnapshot: readOptionalString(value['descriptionSnapshot']),
    tagsSnapshot: readStringArray(value['tagsSnapshot'], `${path}.tagsSnapshot`, issues),
    variablesSnapshot: readVariables(
      value['variablesSnapshot'] ?? [],
      `${path}.variablesSnapshot`,
      issues,
    ),
    label: typeof value['label'] === 'string' ? value['label'] : null,
    kind: REVISION_KINDS.includes(kind as RevisionKind) ? (kind as RevisionKind) : 'manual',
    createdAt,
  };
}

function readFolderRecord(value: unknown, path: string, issues: DomainIssue[]): Folder | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a folder object.'));
    return null;
  }
  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');
  return {
    id: readString(value['id'], `${path}.id`, issues),
    name: readString(value['name'], `${path}.name`, issues),
    parentId: readIdOrNull(value['parentId'], `${path}.parentId`, issues),
    createdAt,
    updatedAt: readIso(value['updatedAt'], `${path}.updatedAt`, issues, createdAt),
  };
}

function readCollectionRecord(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): Collection | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a collection object.'));
    return null;
  }
  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');
  return {
    id: readString(value['id'], `${path}.id`, issues),
    name: readString(value['name'], `${path}.name`, issues),
    description: readOptionalString(value['description']),
    createdAt,
    updatedAt: readIso(value['updatedAt'], `${path}.updatedAt`, issues, createdAt),
  };
}

function readSchemaRecord(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): PromptSchema | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a schema object.'));
    return null;
  }
  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');
  return {
    id: readString(value['id'], `${path}.id`, issues),
    name: readString(value['name'], `${path}.name`, issues),
    description: readOptionalString(value['description']),
    schemaContent: readJsonObject(value['schemaContent'], `${path}.schemaContent`, issues),
    createdAt,
    updatedAt: readIso(value['updatedAt'], `${path}.updatedAt`, issues, createdAt),
  };
}

function readSnippetRecord(value: unknown, path: string, issues: DomainIssue[]): Snippet | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a snippet object.'));
    return null;
  }
  if (!('value' in value)) {
    issues.push(error(`${path}.value`, 'Expected a JSON value.'));
    return null;
  }
  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');
  return {
    id: readString(value['id'], `${path}.id`, issues),
    name: readString(value['name'], `${path}.name`, issues),
    description: readOptionalString(value['description']),
    targetPath: readOptionalString(value['targetPath']),
    value: value['value'] as JsonValue,
    createdAt,
    updatedAt: readIso(value['updatedAt'], `${path}.updatedAt`, issues, createdAt),
  };
}

function readTemplateRecord(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): PromptTemplate | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a template object.'));
    return null;
  }
  const content = readDocument(value['content'], `${path}.content`, issues);
  if (!content) return null;

  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');
  return {
    id: readString(value['id'], `${path}.id`, issues),
    name: readString(value['name'], `${path}.name`, issues),
    description: readOptionalString(value['description']),
    category: readOptionalString(value['category'], 'General') || 'General',
    content,
    // Nothing imported is built in: built-ins belong to the build, not to a file.
    isBuiltIn: false,
    createdAt,
    updatedAt: readIso(value['updatedAt'], `${path}.updatedAt`, issues, createdAt),
  };
}

function readTestCaseRecord(value: unknown, path: string, issues: DomainIssue[]): TestCase | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected a test case object.'));
    return null;
  }
  const createdAt = readIso(value['createdAt'], `${path}.createdAt`, issues, '');
  return {
    id: readString(value['id'], `${path}.id`, issues),
    promptId: readString(value['promptId'], `${path}.promptId`, issues),
    name: readString(value['name'], `${path}.name`, issues),
    inputValues: (value['inputValues'] ?? {}) as Readonly<Record<string, JsonValue>>,
    expectedStructure:
      typeof value['expectedStructure'] === 'string' ? value['expectedStructure'] : null,
    createdAt,
    updatedAt: readIso(value['updatedAt'], `${path}.updatedAt`, issues, createdAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Envelope validation                                                        */
/* -------------------------------------------------------------------------- */

/** How many issues an error message lists before it says "and N more". */
export const ISSUE_DETAIL_LIMIT = 12;

/** Renders issues as one actionable sentence, capped so it stays readable. */
export function describeImportIssues(issues: readonly DomainIssue[]): string {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const listed = errors.slice(0, ISSUE_DETAIL_LIMIT).map((issue) => {
    const where = issue.path.length > 0 ? `${issue.path}: ` : '';
    return `${where}${issue.message}`;
  });

  const extra = errors.length - listed.length;
  return extra > 0 ? `${listed.join(' ')} (and ${extra} more.)` : listed.join(' ');
}

function readManifest(
  value: unknown,
  path: string,
  issues: DomainIssue[],
): { manifest: BundleManifest; format: TransferFormat } | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Expected an object.'));
    return null;
  }

  // The envelope sits at the top of the file, so its paths should read
  // "manifest.counts.prompts" rather than ".manifest.counts.prompts".
  const field = (key: string): string => (path.length > 0 ? `${path}.${key}` : key);

  const format = value['format'];
  const version = value['version'];

  if (format !== BUNDLE_FORMAT && format !== PROMPT_FILE_FORMAT) {
    issues.push(
      error(
        field('format'),
        `Expected "${BUNDLE_FORMAT}" or "${PROMPT_FILE_FORMAT}". This file does not look like a PromptForge export.`,
      ),
    );
    return null;
  }

  if (version !== TRANSFER_VERSION) {
    issues.push(
      error(
        field('version'),
        `Unsupported transfer version ${String(version)}; this build reads version ${TRANSFER_VERSION}. Export again from a matching version of PromptForge.`,
      ),
    );
    return null;
  }

  if (!isRecord(value['manifest'])) {
    issues.push(error(field('manifest'), 'Expected a manifest object.'));
    return null;
  }

  const manifest = value['manifest'];
  const countsValue = manifest['counts'];
  const counts: BundleCounts = {
    prompts: 0,
    revisions: 0,
    folders: 0,
    collections: 0,
    schemas: 0,
    snippets: 0,
    templates: 0,
    testCases: 0,
  };

  if (!isRecord(countsValue)) {
    issues.push(error(field('manifest.counts'), 'Expected a counts object.'));
  } else {
    for (const key of BUNDLE_COLLECTIONS) {
      const count = countsValue[key];
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
        issues.push(error(field(`manifest.counts.${key}`), 'Expected a non-negative integer.'));
      }
    }
  }

  const scope = manifest['scope'];
  if (scope !== 'library' && scope !== 'selection' && scope !== 'prompt') {
    issues.push(error(field('manifest.scope'), 'Expected "library", "selection", or "prompt".'));
  }

  return {
    manifest: {
      app: readOptionalString(manifest['app'], TRANSFER_APP_NAME) || TRANSFER_APP_NAME,
      appVersion: readOptionalString(manifest['appVersion'], 'unknown'),
      exportedAt: readIso(manifest['exportedAt'], field('manifest.exportedAt'), issues, ''),
      scope: scope === 'library' || scope === 'selection' || scope === 'prompt' ? scope : 'library',
      counts,
      fidelity: readStringArray(manifest['fidelity'], field('manifest.fidelity'), issues),
    },
    format: format === BUNDLE_FORMAT ? 'bundle' : 'prompt-file',
  };
}

function readList<T>(
  value: unknown,
  path: string,
  issues: DomainIssue[],
  reader: (entry: unknown, at: string, issues: DomainIssue[]) => T | null,
): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push(error(path, 'Expected an array.'));
    return [];
  }

  const out: T[] = [];
  value.forEach((entry, index) => {
    const record = reader(entry, `${path}[${index}]`, issues);
    if (record) out.push(record);
  });
  return out;
}

/**
 * Reads an export envelope from an already-parsed JSON value.
 *
 * Every list is optional (a prompt file need not carry folders), every record is
 * validated, and references are checked afterwards: a bundle that points at a
 * folder it does not contain is rejected, because importing it would silently
 * move the prompt to the root.
 */
export function readBundle(value: unknown): DomainResult<PromptForgeBundle> {
  const issues: DomainIssue[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [error('', 'Expected a JSON object at the top of the file.')],
    };
  }

  const envelope = readManifest(value, '', issues);

  const prompts = readList(value['prompts'], 'prompts', issues, readPromptRecord);
  const revisions = readList(value['revisions'], 'revisions', issues, readRevisionRecord);
  const folders = readList(value['folders'], 'folders', issues, readFolderRecord);
  const collections = readList(value['collections'], 'collections', issues, readCollectionRecord);
  const schemas = readList(value['schemas'], 'schemas', issues, readSchemaRecord);
  const snippets = readList(value['snippets'], 'snippets', issues, readSnippetRecord);
  const templates = readList(value['templates'], 'templates', issues, readTemplateRecord);
  const testCases = readList(value['testCases'], 'testCases', issues, readTestCaseRecord);

  if (!envelope) {
    return {
      ok: false,
      issues: issues.length > 0 ? issues : [error('', 'Unrecognised export file.')],
    };
  }

  // Duplicate identifiers inside one file: the records would overwrite each
  // other on write, so this is an error rather than a last-one-wins merge.
  const checkDuplicates = (ids: readonly { id: string }[], path: string): void => {
    const seen = new Set<string>();
    for (const [index, record] of ids.entries()) {
      if (seen.has(record.id)) {
        issues.push(error(`${path}[${index}].id`, `Duplicate id "${record.id}" in this file.`));
      }
      seen.add(record.id);
    }
  };

  checkDuplicates(prompts, 'prompts');
  checkDuplicates(revisions, 'revisions');
  checkDuplicates(folders, 'folders');
  checkDuplicates(collections, 'collections');
  checkDuplicates(schemas, 'schemas');
  checkDuplicates(snippets, 'snippets');
  checkDuplicates(templates, 'templates');
  checkDuplicates(testCases, 'testCases');

  // `(promptId, revisionNumber)` is unique in storage; a file that breaks it
  // could not be written faithfully.
  const revisionKeys = new Set<string>();
  revisions.forEach((revision, index) => {
    const key = `${revision.promptId}#${revision.revisionNumber}`;
    if (revisionKeys.has(key)) {
      issues.push(
        error(
          `revisions[${index}]`,
          `Revision ${revision.revisionNumber} of prompt "${revision.promptId}" appears twice.`,
        ),
      );
    }
    revisionKeys.add(key);
  });

  // References must resolve inside the file, or the imported library would hold
  // pointers to records that were never there.
  const promptIds = new Set(prompts.map((prompt) => prompt.id));
  const folderIds = new Set(folders.map((folder) => folder.id));
  const collectionIds = new Set(collections.map((collection) => collection.id));
  const schemaIds = new Set(schemas.map((schema) => schema.id));
  const snippetIds = new Set(snippets.map((snippet) => snippet.id));

  prompts.forEach((prompt, index) => {
    if (prompt.folderId !== null && !folderIds.has(prompt.folderId)) {
      issues.push(
        error(
          `prompts[${index}].folderId`,
          `Folder "${prompt.folderId}" is not included in this file.`,
        ),
      );
    }
    for (const collectionId of prompt.collectionIds) {
      if (!collectionIds.has(collectionId)) {
        issues.push(
          error(
            `prompts[${index}].collectionIds`,
            `Collection "${collectionId}" is not included in this file.`,
          ),
        );
      }
    }
    if (prompt.schemaId !== null && !schemaIds.has(prompt.schemaId)) {
      issues.push(
        error(
          `prompts[${index}].schemaId`,
          `Schema "${prompt.schemaId}" is not included in this file.`,
        ),
      );
    }
    for (const snippetId of prompt.content.includes) {
      if (!snippetIds.has(snippetId)) {
        issues.push(
          error(
            `prompts[${index}].content.includes`,
            `Snippet "${snippetId}" is merged into this document but is not included in this file.`,
          ),
        );
      }
    }
  });

  revisions.forEach((revision, index) => {
    if (!promptIds.has(revision.promptId)) {
      issues.push(
        error(
          `revisions[${index}].promptId`,
          `Prompt "${revision.promptId}" is not included in this file.`,
        ),
      );
    }
  });

  testCases.forEach((testCase, index) => {
    if (!promptIds.has(testCase.promptId)) {
      issues.push(
        error(
          `testCases[${index}].promptId`,
          `Prompt "${testCase.promptId}" is not included in this file.`,
        ),
      );
    }
    if (testCase.expectedStructure !== null && !schemaIds.has(testCase.expectedStructure)) {
      issues.push(
        error(
          `testCases[${index}].expectedStructure`,
          `Schema "${testCase.expectedStructure}" is not included in this file.`,
        ),
      );
    }
  });

  folders.forEach((folder, index) => {
    if (folder.parentId !== null && !folderIds.has(folder.parentId)) {
      issues.push(
        error(`folders[${index}].parentId`, `Parent folder "${folder.parentId}" is missing.`),
      );
    }
  });

  // The manifest is a convenience for humans; a mismatch is worth saying out
  // loud but does not block the import, because the lists are the truth.
  const actual = countBundleRecords({
    format: BUNDLE_FORMAT,
    version: TRANSFER_VERSION,
    manifest: envelope.manifest,
    prompts,
    revisions,
    folders,
    collections,
    schemas,
    snippets,
    templates,
    testCases,
  });
  for (const key of BUNDLE_COLLECTIONS) {
    const declared = envelope.manifest.counts[key];
    if (declared !== actual[key]) {
      issues.push(
        warning(
          `manifest.counts.${key}`,
          `The manifest says ${declared}, the file holds ${actual[key]}. The records were used.`,
        ),
      );
    }
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, issues };
  }

  const bundle: PromptForgeBundle = {
    format: envelope.format === 'bundle' ? BUNDLE_FORMAT : PROMPT_FILE_FORMAT,
    version: TRANSFER_VERSION,
    // The lists are the truth: a manifest that disagreed is reported above as a
    // warning, and the value the rest of the app sees is the real one.
    manifest: { ...envelope.manifest, counts: actual },
    prompts,
    revisions,
    folders,
    collections,
    schemas,
    snippets,
    templates,
    testCases,
  };

  return { ok: true, value: bundle, issues };
}

/* -------------------------------------------------------------------------- */
/* Library context                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What the import needs to know about the current library.
 *
 * Passed in rather than read from a store so preview and planning stay pure and
 * testable; the caller builds it from hydrated state.
 */
export interface LibrarySnapshot {
  readonly prompts: readonly Prompt[];
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly schemas: readonly PromptSchema[];
  readonly snippets: readonly Snippet[];
  readonly templates: readonly PromptTemplate[];
  readonly testCases: readonly TestCase[];
  readonly revisions: readonly PromptRevision[];
}

/** An empty library, for the round-trip tests and for a first import. */
export function emptyLibrary(): LibrarySnapshot {
  return {
    prompts: [],
    folders: [],
    collections: [],
    schemas: [],
    snippets: [],
    templates: [],
    testCases: [],
    revisions: [],
  };
}

/**
 * Settings that never travel.
 *
 * Named here so `docs/IMPORT-EXPORT.md` and the code agree about what an export
 * deliberately leaves behind: preferences, activity, drafts, dismissals.
 */
export const NON_TRANSFERRED_STATE: readonly string[] = [
  'activity log',
  'settings and preferences',
  'health thresholds',
  'recovery drafts',
  'playground inputs',
  'quality dismissals',
  'onboarding state',
  'storage metadata (seed version, database schema version)',
];
