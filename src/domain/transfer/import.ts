/**
 * Import reading, conflict detection, and planning (TASK-026).
 *
 * The import runs in two pure passes:
 *
 * 1. **Preview** — `readImportFile` decodes the text, decides which format it
 *    is, validates every record, and compares the prompts against the current
 *    library to find conflicts. Nothing is written, and the caller gets enough
 *    detail to ask the user what to do.
 * 2. **Plan** — `buildImportPlan` takes those decisions and produces the exact
 *    records to write, with every identifier resolved, every reference remapped,
 *    and every collision reported. The store writes the plan; it never decides
 *    anything.
 *
 * Splitting the passes is what makes "conflicts are detected before writing"
 * true rather than aspirational: the preview happens before a single write, and
 * the plan is a value the UI can show a summary of before confirming it.
 *
 * Errors are values with a category, never exceptions. Every category has its
 * own wording so the user learns whether to fix the file, shrink it, or pick a
 * different one.
 */

import { createPrompt, type DomainDependencies } from '@/domain/factories';
// One formatter for byte counts in the whole app: the storage card on the health
// screen and an import limit must not disagree about how big "2 MB" is.
import { formatBytes } from '@/domain/health';
import { titleKey } from '@/domain/invariants';
import { documentHash, parseDocument, parseJson } from '@/domain/serialization';
import {
  BUNDLE_FORMAT,
  detectTransferFormat,
  emptyLibrary,
  readBundle,
  type BundleCounts,
  type LibrarySnapshot,
  type PromptForgeBundle,
  type TransferFormat,
} from '@/domain/transfer/bundle';
import { promptContentHash } from '@/domain/transfer/export';
import type {
  Collection,
  DomainIssue,
  Folder,
  IsoTimestamp,
  Prompt,
  PromptDocument,
  PromptRevision,
  PromptSchema,
  PromptTemplate,
  Snippet,
  TestCase,
} from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Limits and categories                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The largest file this build will read, in bytes.
 *
 * 2 MB (decimal, matching how every size in the app is printed) holds a few
 * thousand prompts with their history; anything bigger is more likely to be the
 * wrong file than a library someone means to import in a browser tab.
 */
export const MAX_IMPORT_BYTES = 2_000_000;

/** Files above this size are worth a progress indicator before the download. */
export const LARGE_IMPORT_BYTES = 500_000;

/** How an import can fail, before any record is written. */
export type ImportErrorKind =
  'empty' | 'too-large' | 'not-json' | 'unrecognised' | 'unsupported-version' | 'invalid-records';

/** A failure the dialog can render as a title plus details. */
export interface ImportFailure {
  readonly reason: ImportErrorKind;
  readonly message: string;
  readonly issues: readonly DomainIssue[];
}

export type ImportReadResult<T> =
  | { readonly ok: true; readonly value: T; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly failure: ImportFailure };

/* -------------------------------------------------------------------------- */
/* Preview shapes                                                             */
/* -------------------------------------------------------------------------- */

export type ConflictKind = 'same-id' | 'same-title' | 'same-content';

/** What each decision means when the plan is built. */
export type ImportDecision = 'import' | 'copy' | 'skip' | 'overwrite';

export const IMPORT_DECISIONS: readonly ImportDecision[] = ['import', 'copy', 'skip', 'overwrite'];

/** A stored prompt that resembles an incoming one. */
export interface ImportConflict {
  readonly kind: ConflictKind;
  readonly promptId: string;
  readonly title: string;
  /** One sentence naming the resemblance, for the row's second line. */
  readonly detail: string;
}

/** One prompt in the preview list. */
export interface PreviewItem {
  readonly sourceId: string;
  readonly title: string;
  readonly description: string;
  readonly contentHash: string;
  readonly revisionCount: number;
  readonly testCaseCount: number;
  readonly folderName: string | null;
  readonly collectionNames: readonly string[];
  readonly schemaName: string | null;
  readonly conflict: ImportConflict | null;
  readonly defaultDecision: ImportDecision;
  readonly allowedDecisions: readonly ImportDecision[];
}

/** Everything the preview screen needs, and everything the plan needs too. */
export interface TransferPreview {
  readonly format: TransferFormat;
  readonly bundle: PromptForgeBundle;
  readonly appVersion: string;
  readonly exportedAt: IsoTimestamp;
  readonly scope: PromptForgeBundle['manifest']['scope'];
  readonly items: readonly PreviewItem[];
  readonly counts: BundleCounts;
  /** Records that arrive with the prompts but are not prompts themselves. */
  readonly supporting: {
    readonly folders: number;
    readonly collections: number;
    readonly schemas: number;
    readonly snippets: number;
    readonly templates: number;
    readonly revisions: number;
    readonly testCases: number;
  };
  /** Preview-level notes; the plan adds its own once decisions are known. */
  readonly warnings: readonly string[];
  /** Defaults, keyed by source prompt id. */
  readonly decisions: Readonly<Record<string, ImportDecision>>;
}

/** What one row of the summary report says happened. */
export type ImportOutcome = 'created' | 'overwritten' | 'skipped';

export interface ImportPlanEntry {
  readonly sourceId: string;
  readonly title: string;
  readonly decision: ImportDecision;
  readonly outcome: ImportOutcome;
  /** The record's id after import; `null` when it was skipped. */
  readonly targetId: string | null;
}

/** A record whose identifier changed, so the import can report it. */
export interface IdRemap {
  readonly kind:
    | 'prompt'
    | 'folder'
    | 'collection'
    | 'schema'
    | 'snippet'
    | 'template'
    | 'testCase'
    | 'revision';
  readonly from: string;
  readonly to: string;
  readonly reason: 'id-taken' | 'copy' | 'renumbered';
}

/** The full write the store performs, with nothing left to decide. */
export interface ImportPlan {
  readonly preview: TransferPreview;
  readonly folders: readonly Folder[];
  readonly collections: readonly Collection[];
  readonly schemas: readonly PromptSchema[];
  readonly snippets: readonly Snippet[];
  readonly templates: readonly PromptTemplate[];
  readonly promptsToCreate: readonly Prompt[];
  readonly promptsToUpdate: readonly Prompt[];
  readonly revisions: readonly PromptRevision[];
  readonly testCases: readonly TestCase[];
  readonly entries: readonly ImportPlanEntry[];
  readonly remaps: readonly IdRemap[];
  readonly warnings: readonly string[];
  readonly counts: {
    readonly create: number;
    readonly overwrite: number;
    readonly skip: number;
    readonly folders: number;
    readonly collections: number;
    readonly schemas: number;
    readonly snippets: number;
    readonly templates: number;
    readonly revisions: number;
    readonly testCases: number;
  };
}

/* -------------------------------------------------------------------------- */
/* Reading a file                                                             */
/* -------------------------------------------------------------------------- */

function failure(
  reason: ImportErrorKind,
  message: string,
  issues: readonly DomainIssue[] = [],
): { ok: false; failure: ImportFailure } {
  return { ok: false, failure: { reason, message, issues } };
}

/** UTF-8 byte length of a string, without allocating a blob. */
export function byteLength(input: string): number {
  return new TextEncoder().encode(input).length;
}

/**
 * One sentence for a file whose records failed validation.
 *
 * The details live in the issues (and in `describeImportIssues` when a caller
 * needs them as text), so the sentence stays a summary instead of repeating the
 * first problem twice on screen.
 */
function problemSentence(issues: readonly DomainIssue[]): string {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return `This file has ${errors} ${errors === 1 ? 'problem' : 'problems'} that must be fixed before it can be imported. Nothing was written.`;
}

/** A document on its own, wrapped in a one-prompt bundle. */
function bundleFromDocument(
  document: PromptDocument,
  deps: DomainDependencies,
): { bundle: PromptForgeBundle; warnings: string[] } {
  // The synthetic prompt gets a real id and real timestamps so the rest of the
  // pipeline (conflicts, planning, writing) needs no special case.
  const parsed = createPrompt({ content: document, title: fallbackTitle(document) }, deps);

  const bundle: PromptForgeBundle = {
    format: BUNDLE_FORMAT,
    version: 1,
    manifest: {
      app: 'PromptForge',
      appVersion: 'unknown',
      exportedAt: deps.now().toISOString(),
      scope: 'prompt',
      counts: {
        prompts: 1,
        revisions: 0,
        folders: 0,
        collections: 0,
        schemas: 0,
        snippets: 0,
        templates: 0,
        testCases: 0,
      },
      fidelity: [],
    },
    prompts: [parsed],
    revisions: [],
    folders: [],
    collections: [],
    schemas: [],
    snippets: [],
    templates: [],
    testCases: [],
  };

  return {
    bundle,
    warnings: [
      'This file is a prompt document, not a PromptForge export. It was wrapped as a single prompt with no history, folder, or collection.',
    ],
  };
}

/**
 * Title for a raw document.
 *
 * A document validates only with a name, so the fallback is defensive: it keeps
 * a broken caller from producing a nameless prompt rather than being a path the
 * UI can reach.
 */
function fallbackTitle(document: PromptDocument): string {
  const name = document.name.trim();
  return name.length > 0 ? name : 'Imported prompt';
}

/** The version a `promptforge.*` file declares, when it declares one. */
function declaredVersion(value: unknown): unknown {
  return typeof value === 'object' && value !== null
    ? (value as { version?: unknown }).version
    : undefined;
}

/**
 * Reads a file's text into a validated preview.
 *
 * The text is the only input: the file's name is never consulted, so a
 * misleading extension cannot change how the bytes are interpreted.
 */
export function readImportFile(
  text: string,
  options: {
    readonly maxBytes?: number;
    readonly deps: DomainDependencies;
    readonly library?: LibrarySnapshot;
  },
): ImportReadResult<TransferPreview> {
  const maxBytes = options.maxBytes ?? MAX_IMPORT_BYTES;

  if (text.trim().length === 0) {
    return failure(
      'empty',
      'That file is empty. Choose a PromptForge export or a prompt document.',
    );
  }

  const bytes = byteLength(text);
  if (bytes > maxBytes) {
    return failure(
      'too-large',
      `That file is ${formatBytes(bytes)}. The limit is ${formatBytes(maxBytes)} — export a selection instead of the whole library.`,
    );
  }

  const parsed = parseJson(text);
  if (!parsed.ok) {
    // The parser's message already names the line and column, so it is the whole
    // message rather than one of several details.
    return failure(
      'not-json',
      `That file is not valid JSON. ${parsed.issues[0]?.message ?? ''}`.trim(),
    );
  }

  const format = detectTransferFormat(parsed.value);
  if (!format) {
    return failure(
      'unrecognised',
      'That JSON is neither a PromptForge export nor a prompt document. Expected a "format" marker or a document with "schemaVersion" and "name".',
    );
  }

  if (format !== 'document') {
    const version = declaredVersion(parsed.value);
    if (version !== 1) {
      return failure(
        'unsupported-version',
        `This export declares version ${String(version)}; this build reads version 1. Update PromptForge or export again from a matching version.`,
      );
    }
  }

  const warnings: string[] = [];
  let bundle: PromptForgeBundle;

  if (format === 'document') {
    // A raw document is validated exactly like a bundled one, so a hand-written
    // file with the wrong shape is refused instead of being silently normalised
    // into a blank prompt.
    const document = parseDocument(parsed.value);
    if (!document.ok) {
      return failure('invalid-records', problemSentence(document.issues), document.issues);
    }
    const wrapped = bundleFromDocument(document.value, options.deps);
    bundle = wrapped.bundle;
    warnings.push(...wrapped.warnings);
  } else {
    const read = readBundle(parsed.value);
    if (!read.ok) {
      return failure('invalid-records', problemSentence(read.issues), read.issues);
    }
    bundle = read.value;
    warnings.push(
      ...read.issues
        .filter((issue) => issue.severity === 'warning')
        .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message)),
    );
  }

  return {
    ok: true,
    value: buildPreview(format, bundle, warnings, options.library ?? emptyLibrary()),
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Preview                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Compares one incoming prompt against the library.
 *
 * Order matters: a matching identifier is the strongest signal (the same record
 * came back), then identical content (the same document under another name),
 * then the same title (a likely duplicate that a person must judge).
 */
export function detectConflict(prompt: Prompt, library: LibrarySnapshot): ImportConflict | null {
  const byId = library.prompts.find((candidate) => candidate.id === prompt.id);
  if (byId) {
    return {
      kind: 'same-id',
      promptId: byId.id,
      title: byId.title,
      detail: 'A prompt with this identifier is already stored.',
    };
  }

  const hash = promptContentHash(prompt);
  const byContent = library.prompts.find((candidate) => promptContentHash(candidate) === hash);
  if (byContent) {
    return {
      kind: 'same-content',
      promptId: byContent.id,
      title: byContent.title,
      detail: 'An identical document is already stored.',
    };
  }

  const key = titleKey(prompt.title);
  const byTitle = library.prompts.find((candidate) => titleKey(candidate.title) === key);
  if (byTitle) {
    return {
      kind: 'same-title',
      promptId: byTitle.id,
      title: byTitle.title,
      detail: 'A prompt with this title is already stored.',
    };
  }

  return null;
}

/** The choice a new import starts with, per conflict kind. */
export function defaultDecision(conflict: ImportConflict | null): ImportDecision {
  if (!conflict) return 'import';
  // Same-title prompts are allowed (titles are not unique), so the default adds
  // the incoming prompt instead of hiding it. Identical content or an occupied
  // id is a duplicate until the user says otherwise.
  return conflict.kind === 'same-title' ? 'import' : 'skip';
}

/** Which decisions make sense for one item. */
export function allowedDecisions(conflict: ImportConflict | null): readonly ImportDecision[] {
  return conflict ? ['import', 'copy', 'skip', 'overwrite'] : ['import', 'copy', 'skip'];
}

/**
 * Builds the preview: one row per prompt, its conflict, and its defaults.
 *
 * Folder, collection, and schema names are resolved here so the row can say
 * "folder: Support" instead of an opaque id.
 */
export function buildPreview(
  format: TransferFormat,
  bundle: PromptForgeBundle,
  warnings: readonly string[],
  library: LibrarySnapshot = emptyLibrary(),
): TransferPreview {
  const folderNames = new Map(bundle.folders.map((folder) => [folder.id, folder.name]));
  const collectionNames = new Map(
    bundle.collections.map((collection) => [collection.id, collection.name]),
  );
  const schemaNames = new Map(bundle.schemas.map((schema) => [schema.id, schema.name]));

  const items: PreviewItem[] = bundle.prompts.map((prompt) => {
    const conflict = detectConflict(prompt, library);
    const revisions = bundle.revisions.filter((revision) => revision.promptId === prompt.id);
    const testCases = bundle.testCases.filter((testCase) => testCase.promptId === prompt.id);

    return {
      sourceId: prompt.id,
      title: prompt.title,
      description: prompt.description,
      contentHash: documentHash(prompt.content),
      revisionCount: revisions.length,
      testCaseCount: testCases.length,
      folderName: prompt.folderId === null ? null : (folderNames.get(prompt.folderId) ?? null),
      collectionNames: prompt.collectionIds
        .map((id) => collectionNames.get(id))
        .filter((name): name is string => typeof name === 'string'),
      schemaName: prompt.schemaId === null ? null : (schemaNames.get(prompt.schemaId) ?? null),
      conflict,
      defaultDecision: defaultDecision(conflict),
      allowedDecisions: allowedDecisions(conflict),
    };
  });

  const decisions: Record<string, ImportDecision> = {};
  for (const item of items) decisions[item.sourceId] = item.defaultDecision;

  return {
    format,
    bundle,
    appVersion: bundle.manifest.appVersion,
    exportedAt: bundle.manifest.exportedAt,
    scope: bundle.manifest.scope,
    items,
    counts: {
      prompts: bundle.prompts.length,
      revisions: bundle.revisions.length,
      folders: bundle.folders.length,
      collections: bundle.collections.length,
      schemas: bundle.schemas.length,
      snippets: bundle.snippets.length,
      templates: bundle.templates.length,
      testCases: bundle.testCases.length,
    },
    supporting: {
      folders: bundle.folders.length,
      collections: bundle.collections.length,
      schemas: bundle.schemas.length,
      snippets: bundle.snippets.length,
      templates: bundle.templates.length,
      revisions: bundle.revisions.length,
      testCases: bundle.testCases.length,
    },
    warnings: [...warnings],
    decisions,
  };
}

/* -------------------------------------------------------------------------- */
/* Planning                                                                   */
/* -------------------------------------------------------------------------- */

/** Allocates identifiers that cannot collide with the library or each other. */
function createIdAllocator(library: LibrarySnapshot, deps: DomainDependencies) {
  const used = new Set<string>([
    ...library.prompts.map((record) => record.id),
    ...library.folders.map((record) => record.id),
    ...library.collections.map((record) => record.id),
    ...library.schemas.map((record) => record.id),
    ...library.snippets.map((record) => record.id),
    ...library.templates.map((record) => record.id),
    ...library.testCases.map((record) => record.id),
    ...library.revisions.map((record) => record.id),
  ]);

  /**
   * A generated, unused id.
   *
   * A generator that keeps returning an id already in use cannot be allowed to
   * spin: after 100 attempts the id is suffixed instead, so a broken UUID source
   * makes an import ugly rather than impossible.
   */
  function generate(): string {
    let candidate = deps.newId();
    for (let attempt = 0; used.has(candidate) && attempt < 100; attempt += 1) {
      candidate = deps.newId();
    }
    if (used.has(candidate)) {
      let suffix = used.size + 1;
      while (used.has(`${candidate}-${suffix}`)) suffix += 1;
      candidate = `${candidate}-${suffix}`;
    }
    used.add(candidate);
    return candidate;
  }

  return {
    /** Keeps the preferred id when it is free, otherwise generates a new one. */
    take(preferred: string): { id: string; remapped: boolean } {
      if (preferred.length > 0 && !used.has(preferred)) {
        used.add(preferred);
        return { id: preferred, remapped: false };
      }
      return { id: generate(), remapped: true };
    },

    /** Always generates a new id; used by "import as copy". */
    fresh: generate,
  };
}

/** `Title (copy)`, then `Title (copy 2)`, … against titles already present. */
export function copyTitle(title: string, taken: readonly string[]): string {
  const keys = new Set(taken.map((candidate) => titleKey(candidate)));
  if (!keys.has(titleKey(`${title} (copy)`))) return `${title} (copy)`;

  let index = 2;
  while (keys.has(titleKey(`${title} (copy ${index})`))) index += 1;
  return `${title} (copy ${index})`;
}

/**
 * Turns preview decisions into the records to write.
 *
 * The plan is complete and ordered: folders before their children, collections,
 * schemas, and snippets before prompts, prompts before their revisions and test
 * cases. The store writes it top to bottom and rolls back on failure.
 */
export function buildImportPlan(
  preview: TransferPreview,
  requested: Readonly<Record<string, ImportDecision>>,
  library: LibrarySnapshot,
  deps: DomainDependencies,
): ImportPlan {
  const ids = createIdAllocator(library, deps);
  const remaps: IdRemap[] = [];
  const warnings: string[] = [];
  const entries: ImportPlanEntry[] = [];

  const bundle = preview.bundle;
  const now = deps.now().toISOString();

  /* ---- 1. Per-prompt decisions ------------------------------------------ */

  const decisions = new Map<string, ImportDecision>();
  for (const item of preview.items) {
    const requestedDecision = requested[item.sourceId] ?? item.defaultDecision;
    const decision = item.allowedDecisions.includes(requestedDecision)
      ? requestedDecision
      : item.defaultDecision;
    decisions.set(item.sourceId, decision);
  }

  const accepted = preview.items.filter((item) => decisions.get(item.sourceId) !== 'skip');
  const overwriting = new Map<string, Prompt>();
  for (const item of preview.items) {
    if (decisions.get(item.sourceId) !== 'overwrite') continue;
    const target = item.conflict
      ? library.prompts.find((candidate) => candidate.id === item.conflict?.promptId)
      : undefined;
    if (target) overwriting.set(item.sourceId, target);
  }

  const everythingImported = accepted.length === preview.items.length;

  /* ---- 2. Supporting records -------------------------------------------- */

  const acceptedSources = new Map(
    accepted.map((item) => [item.sourceId, bundle.prompts.find((p) => p.id === item.sourceId)]),
  );

  const neededFolderIds = new Set<string>();
  const neededCollectionIds = new Set<string>();
  const neededSchemaIds = new Set<string>();
  const neededSnippetIds = new Set<string>();

  for (const [, prompt] of acceptedSources) {
    if (!prompt) continue;
    for (const folderId of folderPathIds(prompt.folderId, bundle.folders)) {
      neededFolderIds.add(folderId);
    }
    for (const collectionId of prompt.collectionIds) neededCollectionIds.add(collectionId);
    if (prompt.schemaId !== null) neededSchemaIds.add(prompt.schemaId);
    for (const snippetId of prompt.content.includes) neededSnippetIds.add(snippetId);
  }

  if (everythingImported) {
    // A complete import reproduces the file, including records no prompt points
    // at (an unused snippet, an empty folder, a schema nothing references).
    for (const folder of bundle.folders) neededFolderIds.add(folder.id);
    for (const collection of bundle.collections) neededCollectionIds.add(collection.id);
    for (const schema of bundle.schemas) neededSchemaIds.add(schema.id);
    for (const snippet of bundle.snippets) neededSnippetIds.add(snippet.id);
  } else {
    const skipped = {
      folders: bundle.folders.filter((folder) => !neededFolderIds.has(folder.id)).length,
      collections: bundle.collections.filter(
        (collection) => !neededCollectionIds.has(collection.id),
      ).length,
      schemas: bundle.schemas.filter((schema) => !neededSchemaIds.has(schema.id)).length,
      snippets: bundle.snippets.filter((snippet) => !neededSnippetIds.has(snippet.id)).length,
    };

    const parts = Object.entries(skipped)
      .filter(([, count]) => count > 0)
      .map(([kind, count]) => `${count} ${kind}`);
    if (parts.length > 0) {
      warnings.push(
        `${parts.join(', ')} left out because no imported prompt references them. Import every prompt in the file to bring all of it.`,
      );
    }
  }

  /* ---- 3. Folders (parents first) --------------------------------------- */

  const folderIdMap = new Map<string, string>();
  const foldersToCreate: Folder[] = [];
  const workingFolders = [...library.folders];

  const orderedFolders = orderFolders(bundle.folders, neededFolderIds);
  for (const folder of orderedFolders) {
    const existing = library.folders.find((candidate) => candidate.id === folder.id);
    if (existing) {
      folderIdMap.set(folder.id, existing.id);
      continue;
    }

    const mappedParent =
      folder.parentId === null
        ? null
        : (folderIdMap.get(folder.parentId) ?? folder.parentId ?? null);

    // Reuse a folder that already has this name under the same parent rather
    // than creating a second "Support"; folder names are unique per parent.
    const twin = workingFolders.find(
      (candidate) =>
        candidate.parentId === mappedParent && titleKey(candidate.name) === titleKey(folder.name),
    );
    if (twin) {
      folderIdMap.set(folder.id, twin.id);
      if (twin.id !== folder.id) {
        remaps.push({ kind: 'folder', from: folder.id, to: twin.id, reason: 'id-taken' });
      }
      continue;
    }

    // A folder of this name under this parent was reused above, so a new one is
    // guaranteed to be unique without inventing a name.
    const taken = ids.take(folder.id);
    const created: Folder = { ...folder, id: taken.id, parentId: mappedParent };
    if (taken.remapped) {
      remaps.push({ kind: 'folder', from: folder.id, to: taken.id, reason: 'id-taken' });
    }

    folderIdMap.set(folder.id, created.id);
    foldersToCreate.push(created);
    workingFolders.push(created);
  }

  /* ---- 4. Collections, schemas, snippets -------------------------------- */

  const collectionIdMap = new Map<string, string>();
  const collectionsToCreate: Collection[] = [];
  for (const collection of bundle.collections) {
    if (!neededCollectionIds.has(collection.id)) continue;

    const existing = library.collections.find((candidate) => candidate.id === collection.id);
    if (existing) {
      collectionIdMap.set(collection.id, existing.id);
      continue;
    }

    // Collections are flat, and their names are unique across the library.
    const twin = library.collections.find(
      (candidate) => titleKey(candidate.name) === titleKey(collection.name),
    );
    if (twin) {
      collectionIdMap.set(collection.id, twin.id);
      if (twin.id !== collection.id) {
        remaps.push({ kind: 'collection', from: collection.id, to: twin.id, reason: 'id-taken' });
      }
      continue;
    }

    const taken = ids.take(collection.id);
    if (taken.remapped) {
      remaps.push({ kind: 'collection', from: collection.id, to: taken.id, reason: 'id-taken' });
    }
    collectionIdMap.set(collection.id, taken.id);
    collectionsToCreate.push({ ...collection, id: taken.id });
  }

  const schemaIdMap = new Map<string, string>();
  const schemasToCreate: PromptSchema[] = [];
  for (const schema of bundle.schemas) {
    if (!neededSchemaIds.has(schema.id)) continue;

    const existing = library.schemas.find((candidate) => candidate.id === schema.id);
    if (existing) {
      schemaIdMap.set(schema.id, existing.id);
      continue;
    }

    const taken = ids.take(schema.id);
    if (taken.remapped) {
      remaps.push({ kind: 'schema', from: schema.id, to: taken.id, reason: 'id-taken' });
    }
    schemaIdMap.set(schema.id, taken.id);
    schemasToCreate.push({ ...schema, id: taken.id });
  }

  const snippetIdMap = new Map<string, string>();
  const snippetsToCreate: Snippet[] = [];
  for (const snippet of bundle.snippets) {
    if (!neededSnippetIds.has(snippet.id)) continue;

    const existing = library.snippets.find((candidate) => candidate.id === snippet.id);
    if (existing) {
      snippetIdMap.set(snippet.id, existing.id);
      continue;
    }

    const taken = ids.take(snippet.id);
    if (taken.remapped) {
      remaps.push({ kind: 'snippet', from: snippet.id, to: taken.id, reason: 'id-taken' });
    }
    snippetIdMap.set(snippet.id, taken.id);
    snippetsToCreate.push({ ...snippet, id: taken.id });
  }

  /* ---- 5. Prompts ------------------------------------------------------- */

  const promptIdMap = new Map<string, string>();
  const promptsToCreate: Prompt[] = [];
  const promptsToUpdate: Prompt[] = [];
  const existingTitles = library.prompts.map((prompt) => prompt.title);

  for (const item of preview.items) {
    const decision = decisions.get(item.sourceId) ?? 'skip';
    const source = bundle.prompts.find((prompt) => prompt.id === item.sourceId);
    if (!source || decision === 'skip') {
      entries.push({
        sourceId: item.sourceId,
        title: item.title,
        decision,
        outcome: 'skipped',
        targetId: null,
      });
      continue;
    }

    const mappedFolderId =
      source.folderId === null ? null : (folderIdMap.get(source.folderId) ?? null);
    const mappedCollectionIds = source.collectionIds
      .map((id) => collectionIdMap.get(id))
      .filter((id): id is string => typeof id === 'string');
    const mappedSchemaId =
      source.schemaId === null ? null : (schemaIdMap.get(source.schemaId) ?? null);

    if (decision === 'overwrite') {
      const target = overwriting.get(item.sourceId);
      if (!target) {
        // The conflicting prompt vanished between preview and confirm; a create
        // is the honest fallback, and the summary says so.
        warnings.push(`“${item.title}” could no longer be overwritten and was added instead.`);
      } else {
        promptIdMap.set(source.id, target.id);
        promptsToUpdate.push({
          ...target,
          title: source.title,
          description: source.description,
          content: source.content,
          folderId: mappedFolderId,
          collectionIds: mappedCollectionIds,
          tags: [...source.tags],
          favorite: source.favorite,
          pinned: source.pinned,
          archived: source.archived,
          status: source.status,
          schemaId: mappedSchemaId,
          variables: [...source.variables],
          metadata: { ...source.metadata },
          updatedAt: now,
          version: target.version + 1,
        });
        entries.push({
          sourceId: item.sourceId,
          title: item.title,
          decision,
          outcome: 'overwritten',
          targetId: target.id,
        });
        continue;
      }
    }

    const copy = decision === 'copy';
    const taken = copy ? { id: ids.fresh(), remapped: true } : ids.take(source.id);
    if (taken.remapped) {
      remaps.push({
        kind: 'prompt',
        from: source.id,
        to: taken.id,
        reason: copy ? 'copy' : 'id-taken',
      });
    }

    const title = copy ? copyTitle(source.title, existingTitles) : source.title;
    existingTitles.push(title);

    promptIdMap.set(source.id, taken.id);
    promptsToCreate.push({
      ...source,
      id: taken.id,
      title,
      folderId: mappedFolderId,
      collectionIds: mappedCollectionIds,
      schemaId: mappedSchemaId,
    });
    entries.push({
      sourceId: item.sourceId,
      title,
      decision,
      outcome: 'created',
      targetId: taken.id,
    });
  }

  /* ---- 6. Revisions and test cases -------------------------------------- */

  const revisions: PromptRevision[] = [];
  const nextRevisionNumber = new Map<string, number>();
  for (const targetId of promptIdMap.values()) {
    const stored = library.revisions
      .filter((revision) => revision.promptId === targetId)
      .reduce((max, revision) => Math.max(max, revision.revisionNumber), 0);
    nextRevisionNumber.set(targetId, stored);
  }

  // Oldest first, so a renumbered prompt keeps its history in order.
  const orderedRevisions = [...bundle.revisions].sort((left, right) => {
    if (left.promptId !== right.promptId) return left.promptId.localeCompare(right.promptId);
    return left.revisionNumber - right.revisionNumber;
  });

  for (const revision of orderedRevisions) {
    const targetId = promptIdMap.get(revision.promptId);
    if (!targetId) continue;

    const overwritten = promptsToUpdate.some((prompt) => prompt.id === targetId);
    let revisionNumber = revision.revisionNumber;

    if (overwritten) {
      // The target already holds history: append rather than collide.
      const next = (nextRevisionNumber.get(targetId) ?? 0) + 1;
      nextRevisionNumber.set(targetId, next);
      revisionNumber = next;
    } else {
      nextRevisionNumber.set(
        targetId,
        Math.max(nextRevisionNumber.get(targetId) ?? 0, revisionNumber),
      );
    }

    if (revisionNumber !== revision.revisionNumber) {
      remaps.push({
        kind: 'revision',
        from: revision.id,
        to: revision.id,
        reason: 'renumbered',
      });
    }

    const taken = ids.take(revision.id);
    if (taken.remapped) {
      remaps.push({ kind: 'revision', from: revision.id, to: taken.id, reason: 'id-taken' });
    }

    revisions.push({ ...revision, id: taken.id, promptId: targetId, revisionNumber });
  }

  const testCases: TestCase[] = [];
  const caseNamesByPrompt = new Map<string, string[]>();
  for (const targetId of promptIdMap.values()) {
    caseNamesByPrompt.set(
      targetId,
      library.testCases
        .filter((testCase) => testCase.promptId === targetId)
        .map((testCase) => testCase.name),
    );
  }

  for (const testCase of bundle.testCases) {
    const targetId = promptIdMap.get(testCase.promptId);
    if (!targetId) continue;

    const names = caseNamesByPrompt.get(targetId) ?? [];
    const name = names.some((existing) => titleKey(existing) === titleKey(testCase.name))
      ? copyTitle(testCase.name, names)
      : testCase.name;
    names.push(name);
    caseNamesByPrompt.set(targetId, names);

    const taken = ids.take(testCase.id);
    if (taken.remapped) {
      remaps.push({ kind: 'testCase', from: testCase.id, to: taken.id, reason: 'id-taken' });
    }

    testCases.push({
      ...testCase,
      id: taken.id,
      promptId: targetId,
      name,
      expectedStructure:
        testCase.expectedStructure === null
          ? null
          : (schemaIdMap.get(testCase.expectedStructure) ?? null),
    });
  }

  /* ---- 7. Templates ----------------------------------------------------- */

  const templatesToCreate: PromptTemplate[] = [];
  const templateNames = new Set(library.templates.map((template) => titleKey(template.name)));
  for (const template of bundle.templates) {
    if (templateNames.has(titleKey(template.name))) {
      warnings.push(`Template “${template.name}” already exists here and was not imported.`);
      continue;
    }

    const taken = ids.take(template.id);
    if (taken.remapped) {
      remaps.push({ kind: 'template', from: template.id, to: taken.id, reason: 'id-taken' });
    }
    templateNames.add(titleKey(template.name));
    templatesToCreate.push({ ...template, id: taken.id, isBuiltIn: false });
  }

  /* ---- 8. Summary ------------------------------------------------------- */

  const counts = {
    create: entries.filter((entry) => entry.outcome === 'created').length,
    overwrite: entries.filter((entry) => entry.outcome === 'overwritten').length,
    skip: entries.filter((entry) => entry.outcome === 'skipped').length,
    folders: foldersToCreate.length,
    collections: collectionsToCreate.length,
    schemas: schemasToCreate.length,
    snippets: snippetsToCreate.length,
    templates: templatesToCreate.length,
    revisions: revisions.length,
    testCases: testCases.length,
  };

  return {
    preview,
    folders: foldersToCreate,
    collections: collectionsToCreate,
    schemas: schemasToCreate,
    snippets: snippetsToCreate,
    templates: templatesToCreate,
    promptsToCreate,
    promptsToUpdate,
    revisions,
    testCases,
    entries,
    remaps,
    warnings,
    counts,
  };
}

/** Every folder id a prompt depends on: its folder and each ancestor. */
function folderPathIds(folderId: string | null, folders: readonly Folder[]): readonly string[] {
  if (folderId === null) return [];

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const out: string[] = [];
  const checked = new Set<string>();

  let current: string | null = folderId;
  while (current !== null && out.length < 32) {
    if (checked.has(current)) break;
    checked.add(current);
    out.push(current);
    current = byId.get(current)?.parentId ?? null;
  }

  return out;
}

/** Parents before children, so a create can name a parent that already exists. */
function orderFolders(folders: readonly Folder[], needed: ReadonlySet<string>): readonly Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const depth = (folder: Folder): number => {
    let levels = 0;
    let current = folder.parentId;
    const checked = new Set<string>([folder.id]);
    while (current !== null && levels < 32) {
      if (checked.has(current)) break;
      checked.add(current);
      levels += 1;
      current = byId.get(current)?.parentId ?? null;
    }
    return levels;
  };

  return folders
    .filter((folder) => needed.has(folder.id))
    .sort((left, right) => {
      const byDepth = depth(left) - depth(right);
      return byDepth !== 0 ? byDepth : left.name.localeCompare(right.name);
    });
}

/** One line the dialog and the toast share after a plan is written. */
export function describePlanSummary(plan: ImportPlan): string {
  const parts: string[] = [];
  if (plan.counts.create > 0) {
    parts.push(`${plan.counts.create} ${plan.counts.create === 1 ? 'prompt' : 'prompts'} added`);
  }
  if (plan.counts.overwrite > 0) parts.push(`${plan.counts.overwrite} overwritten`);
  if (plan.counts.skip > 0) parts.push(`${plan.counts.skip} skipped`);

  const extras: string[] = [];
  if (plan.counts.revisions > 0) extras.push(`${plan.counts.revisions} revisions`);
  if (plan.counts.testCases > 0) extras.push(`${plan.counts.testCases} test cases`);
  if (plan.counts.schemas > 0) extras.push(`${plan.counts.schemas} schemas`);
  if (plan.counts.folders > 0) extras.push(`${plan.counts.folders} folders`);

  const base = parts.length > 0 ? parts.join(', ') : 'Nothing to import';
  return extras.length > 0 ? `${base} (with ${extras.join(', ')})` : base;
}
