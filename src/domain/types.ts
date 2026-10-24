/**
 * PromptForge domain types (TASK-005).
 *
 * This module is pure TypeScript: no React, no storage, no browser-only APIs.
 * Every entity is a plain, JSON-serializable object so it can move between the
 * domain, the repositories, and the UI without translation layers.
 *
 * Structural rules:
 * - All timestamps are ISO-8601 strings produced by an injected clock.
 * - All identifiers are opaque strings produced by an injected generator.
 * - Collections are `readonly` arrays, and mutation is expressed by returning a
 *   new object (see `promptDocument.ts` and `invariants.ts`).
 */

/** ISO-8601 timestamp, e.g. `2026-10-24T09:41:07.123Z`. */
export type IsoTimestamp = string;

/** Opaque entity identifier (UUID in the application). */
export type EntityId = string;

/* -------------------------------------------------------------------------- */
/* JSON values                                                                */
/* -------------------------------------------------------------------------- */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/* -------------------------------------------------------------------------- */
/* Issues and results                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Severity of a domain issue.
 *
 * `error` blocks persistence and import. `warning` is advisory: the value is
 * accepted and normalized, but the user should know that something was dropped,
 * trimmed, or is incomplete.
 */
export type IssueSeverity = 'error' | 'warning';

/** A single structured problem, addressable by JSON path. */
export interface DomainIssue {
  /** JSON path from the validated root, e.g. `variables[2].name`. */
  readonly path: string;
  /** Human-readable, actionable message. */
  readonly message: string;
  readonly severity: IssueSeverity;
}

/**
 * Result of an operation that can fail on user data.
 *
 * Failures are values, never exceptions: the UI can render `issues` directly
 * and callers must narrow on `ok` before reading `value`.
 */
export type DomainResult<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly DomainIssue[] }
  | { readonly ok: false; readonly issues: readonly DomainIssue[] };

/* -------------------------------------------------------------------------- */
/* Prompt document                                                            */
/* -------------------------------------------------------------------------- */

export const PROMPT_DOCUMENT_SCHEMA_VERSION = '1.0';

/** Supported schema versions. Parsing anything else is an error. */
export type PromptDocumentSchemaVersion = typeof PROMPT_DOCUMENT_SCHEMA_VERSION;

export type VariableType = 'string' | 'number' | 'boolean' | 'json';

/** A value the prompt expects the caller to supply. */
export interface VariableDefinition {
  /** Mustache-friendly identifier: `^[A-Za-z_][A-Za-z0-9_]*$`. */
  readonly name: string;
  readonly type: VariableType;
  readonly required: boolean;
  readonly defaultValue?: JsonValue;
  readonly description?: string;
}

export type OutputFormat = 'json' | 'text' | 'markdown';

/** What the prompt asks the model to return. */
export interface PromptOutput {
  readonly format: OutputFormat;
  /** Identifier of a stored `PromptSchema` the output must satisfy. */
  readonly schemaRef?: string;
  /** Illustrative output value; never treated as a guarantee. */
  readonly example?: JsonValue;
}

/** Background material supplied alongside the instructions. */
export interface PromptContext {
  readonly description?: string;
  readonly references?: readonly string[];
  readonly data?: JsonValue;
}

/** One worked example. Either side may be omitted while drafting. */
export interface PromptExample {
  readonly input?: JsonValue;
  readonly output?: JsonValue;
}

/** Document-level authorship and annotation fields. */
export interface PromptDocumentMetadata {
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly notes?: string;
}

/**
 * The canonical PromptForge prompt document stored in `Prompt.content`.
 *
 * `extras` holds unknown top-level fields that were present in imported JSON.
 * They are preserved verbatim on round-trip and never interpreted by the app.
 */
export interface PromptDocument {
  readonly schemaVersion: PromptDocumentSchemaVersion;
  readonly name: string;
  readonly role: string;
  readonly objective: string;
  readonly instructions: readonly string[];
  readonly context: PromptContext;
  readonly constraints: readonly string[];
  readonly variables: readonly VariableDefinition[];
  readonly output: PromptOutput;
  readonly examples: readonly PromptExample[];
  readonly metadata: PromptDocumentMetadata;
  /** IDs of `Snippet` records merged into this document. */
  readonly includes: readonly string[];
  readonly extras?: Readonly<Record<string, JsonValue>>;
}

/* -------------------------------------------------------------------------- */
/* Prompt                                                                     */
/* -------------------------------------------------------------------------- */

/** Reserved for future prompt formats; v1 only stores JSON documents. */
export type PromptFormat = 'json';

export type PromptStatus = 'draft' | 'active' | 'deprecated';

/** A prompt and its metadata. `content` is the canonical document. */
export interface Prompt {
  readonly id: EntityId;
  readonly title: string;
  readonly description: string;
  readonly content: PromptDocument;
  readonly format: PromptFormat;
  readonly folderId: EntityId | null;
  readonly collectionIds: readonly EntityId[];
  readonly tags: readonly string[];
  readonly favorite: boolean;
  readonly pinned: boolean;
  readonly archived: boolean;
  readonly status: PromptStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly schemaId: EntityId | null;
  /** Variable declarations surfaced in the editor and the playground. */
  readonly variables: readonly VariableDefinition[];
  /** User-defined custom metadata; string values only, for now. */
  readonly metadata: Readonly<Record<string, string>>;
  /** Optimistic concurrency counter; incremented on every persisted write. */
  readonly version: number;
}

/* -------------------------------------------------------------------------- */
/* Revisions                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Why a revision exists.
 * - `manual` — the user saved a snapshot.
 * - `restore-safety` — automatic snapshot taken before restoring an older one.
 * - `import` — the prompt arrived from an import bundle.
 */
export type RevisionKind = 'manual' | 'restore-safety' | 'import';

/** Immutable snapshot of a prompt at a point in time. */
export interface PromptRevision {
  readonly id: EntityId;
  readonly promptId: EntityId;
  /** Monotonic per prompt, starting at 1; `(promptId, revisionNumber)` is unique. */
  readonly revisionNumber: number;
  readonly contentSnapshot: PromptDocument;
  readonly titleSnapshot: string;
  readonly descriptionSnapshot: string;
  readonly tagsSnapshot: readonly string[];
  readonly variablesSnapshot: readonly VariableDefinition[];
  readonly label: string | null;
  readonly kind: RevisionKind;
  readonly createdAt: IsoTimestamp;
}

/* -------------------------------------------------------------------------- */
/* Organisation                                                               */
/* -------------------------------------------------------------------------- */

/** Folder node in a tree of at most `MAX_FOLDER_DEPTH` levels. */
export interface Folder {
  readonly id: EntityId;
  readonly name: string;
  readonly parentId: EntityId | null;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/** Flat grouping; prompts belong to any number of collections. */
export interface Collection {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/* -------------------------------------------------------------------------- */
/* Templates, test cases, schemas, snippets                                   */
/* -------------------------------------------------------------------------- */

/** Reusable blueprint. Built-in templates are immutable. */
export interface PromptTemplate {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly content: PromptDocument;
  readonly isBuiltIn: boolean;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/** Named variable inputs used by the prompt laboratory. */
export interface TestCase {
  readonly id: EntityId;
  readonly promptId: EntityId;
  readonly name: string;
  readonly inputValues: Readonly<Record<string, JsonValue>>;
  /** Identifier of a schema used for structural expectations, when present. */
  readonly expectedStructure: string | null;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/** Stored JSON Schema used by the validation studio. */
export interface PromptSchema {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string;
  readonly schemaContent: JsonObject;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/**
 * Reusable field fragment.
 *
 * Inserted into a document by the composer at `targetPath` (a dot path such as
 * `context.description`) and referenced by `PromptDocument.includes`.
 */
export interface Snippet {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string;
  readonly targetPath: string;
  readonly value: JsonValue;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

export type ActivityType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'archived'
  | 'imported'
  | 'exported'
  | 'snapshot'
  | 'validation'
  | 'template'
  | 'settings';

/**
 * One entry in the capped activity log.
 *
 * `promptId` is detached when the prompt is deleted, so `promptTitle` is a
 * snapshot: the timeline stays readable after the prompt is gone.
 */
export interface ActivityEvent {
  readonly id: EntityId;
  readonly type: ActivityType;
  readonly promptId?: EntityId;
  readonly promptTitle?: string;
  readonly summary: string;
  readonly createdAt: IsoTimestamp;
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** Theme preference as stored by the settings record. */
export type ThemeSetting = 'dark' | 'light' | 'system';

/** Editor density. `comfortable` is the default; `compact` fits more rows. */
export type EditorDensity = 'comfortable' | 'compact';

/** Allowed indentation widths for the JSON editor. */
export type IndentSize = 2 | 4;

/** Singleton settings record. */
export interface Settings {
  readonly theme: ThemeSetting;
  readonly reducedMotion: boolean;
  readonly indentSize: IndentSize;
  readonly autosaveEnabled: boolean;
  /** Debounce window after the last edit, in milliseconds. */
  readonly autosaveDelayMs: number;
  readonly density: EditorDensity;
  /** ISO timestamp of onboarding completion, or `null` while it is pending. */
  readonly onboardedAt: IsoTimestamp | null;
  /** Applied seed-data version; see the migration rules in `docs/DATA-MODEL.md`. */
  readonly seedVersion: number;
}

/* -------------------------------------------------------------------------- */
/* Document sections                                                          */
/* -------------------------------------------------------------------------- */

/** Keys of the document that hold authored content. */
export type DocumentSectionKey =
  | 'name'
  | 'role'
  | 'objective'
  | 'instructions'
  | 'context'
  | 'constraints'
  | 'variables'
  | 'output'
  | 'examples'
  | 'metadata'
  | 'includes';

/** Shape of a section, used by the blueprint graph and the outline. */
export type DocumentSectionKind = 'text' | 'list' | 'variables' | 'object' | 'examples';

/** Static description of one canonical document section. */
export interface DocumentSectionDefinition {
  readonly key: DocumentSectionKey;
  readonly label: string;
  readonly kind: DocumentSectionKind;
  readonly description: string;
}
