/**
 * Export selection and file naming (TASK-026).
 *
 * An export is a *selection problem*, not a serialization problem: given a set
 * of prompts, which folders, collections, schemas, snippets, revisions, and test
 * cases must travel with them so the file re-imports faithfully? That question
 * is answered here, in one pass, with no storage access.
 *
 * The rules:
 *
 * - A prompt brings its folder **chain** (its folder and every ancestor), its
 *   collections, its attached schema, the snippets its document merges, all of
 *   its revisions, and all of its test cases.
 * - Templates travel only in a full library backup: they are standalone records
 *   with no link to a prompt, so a selection cannot imply them.
 * - A full backup carries every record. A library backup that silently dropped
 *   an unreferenced snippet would be a backup that is not one.
 *
 * Nothing here reads recovery drafts, preferences, the activity log, playground
 * inputs, or quality dismissals. Those are not records a bundle has a list for.
 */

import { documentHash } from '@/domain/serialization';
import {
  BUNDLE_FORMAT,
  FIDELITY_NOTES,
  PROMPT_FILE_FORMAT,
  TRANSFER_APP_NAME,
  TRANSFER_VERSION,
  countBundleRecords,
  serializeBundle,
  type BundleCounts,
  type LibrarySnapshot,
  type PromptForgeBundle,
  type TransferScope,
} from '@/domain/transfer/bundle';
import type { Folder, IsoTimestamp, Prompt, PromptRevision } from '@/domain/types';

/** Options every export needs; both values are injected so tests can pin them. */
export interface ExportOptions {
  /** The application version written into the manifest. */
  readonly appVersion: string;
  readonly exportedAt: IsoTimestamp;
}

/** Everything needed to describe an export before the user downloads it. */
export interface ExportResult {
  readonly bundle: PromptForgeBundle;
  readonly json: string;
  readonly fileName: string;
  readonly counts: BundleCounts;
  /** Size of the serialized JSON in bytes (UTF-8). */
  readonly bytes: number;
}

const MAX_FOLDER_CHAIN = 32;

/**
 * The folder a prompt lives in, plus every ancestor.
 *
 * `checked` guards against a corrupt parent cycle: a folder tree is validated on
 * write, but an export must not loop forever if storage disagrees.
 */
export function folderChain(
  folderId: string | null,
  folders: readonly Folder[],
): readonly Folder[] {
  if (folderId === null) return [];

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: Folder[] = [];
  const checked = new Set<string>();

  let current: string | null = folderId;
  while (current !== null && chain.length < MAX_FOLDER_CHAIN) {
    if (checked.has(current)) break;
    checked.add(current);

    const folder: Folder | undefined = byId.get(current);
    if (!folder) break;

    chain.push(folder);
    current = folder.parentId;
  }

  return chain;
}

/** Prompt ids that exist in the library, in stored order. */
function selectPrompts(library: LibrarySnapshot, promptIds: readonly string[]): readonly Prompt[] {
  const wanted = new Set(promptIds);
  return library.prompts.filter((prompt) => wanted.has(prompt.id));
}

/**
 * Builds a bundle from the library.
 *
 * `promptIds` narrows the prompts (`null` means every prompt); folders,
 * collections, schemas, snippets, revisions, and test cases follow from the
 * selection. `includeStandalone` adds templates and every unreferenced record,
 * and is set by the full backup.
 */
export function buildBundle(
  library: LibrarySnapshot,
  promptIds: readonly string[] | null,
  options: ExportOptions & { readonly scope: TransferScope },
  includeStandalone: boolean,
): PromptForgeBundle {
  const prompts = promptIds === null ? [...library.prompts] : selectPrompts(library, promptIds);
  const promptIdSet = new Set(prompts.map((prompt) => prompt.id));

  const folderIds = new Set<string>();
  const collectionIds = new Set<string>();
  const schemaIds = new Set<string>();
  const snippetIds = new Set<string>();

  for (const prompt of prompts) {
    for (const folder of folderChain(prompt.folderId, library.folders)) {
      folderIds.add(folder.id);
    }
    for (const collectionId of prompt.collectionIds) collectionIds.add(collectionId);
    if (prompt.schemaId !== null) schemaIds.add(prompt.schemaId);
    for (const snippetId of prompt.content.includes) snippetIds.add(snippetId);
  }

  const testCases = library.testCases.filter((testCase) => promptIdSet.has(testCase.promptId));
  for (const testCase of testCases) {
    if (testCase.expectedStructure !== null) schemaIds.add(testCase.expectedStructure);
  }

  // A full backup carries everything, referenced or not.
  if (includeStandalone) {
    for (const folder of library.folders) folderIds.add(folder.id);
    for (const collection of library.collections) collectionIds.add(collection.id);
    for (const schema of library.schemas) schemaIds.add(schema.id);
    for (const snippet of library.snippets) snippetIds.add(snippet.id);
  }

  const bundle: PromptForgeBundle = {
    format: options.scope === 'prompt' ? PROMPT_FILE_FORMAT : BUNDLE_FORMAT,
    version: TRANSFER_VERSION,
    manifest: {
      app: TRANSFER_APP_NAME,
      appVersion: options.appVersion,
      exportedAt: options.exportedAt,
      scope: options.scope,
      counts: {
        prompts: 0,
        revisions: 0,
        folders: 0,
        collections: 0,
        schemas: 0,
        snippets: 0,
        templates: 0,
        testCases: 0,
      },
      fidelity: [...FIDELITY_NOTES],
    },
    prompts,
    revisions: library.revisions.filter((revision) => promptIdSet.has(revision.promptId)),
    folders: library.folders.filter((folder) => folderIds.has(folder.id)),
    collections: library.collections.filter((collection) => collectionIds.has(collection.id)),
    schemas: library.schemas.filter((schema) => schemaIds.has(schema.id)),
    snippets: library.snippets.filter((snippet) => snippetIds.has(snippet.id)),
    templates: includeStandalone ? [...library.templates] : [],
    testCases,
  };

  return { ...bundle, manifest: { ...bundle.manifest, counts: countBundleRecords(bundle) } };
}

/* -------------------------------------------------------------------------- */
/* Filenames                                                                  */
/* -------------------------------------------------------------------------- */

/** Everything a filesystem, a download name, and a header all accept. */
const UNSAFE_FILENAME = /[^a-z0-9]+/gi;
const MAX_SLUG_LENGTH = 48;

/**
 * A safe slug for a downloaded file.
 *
 * Lower-case ASCII letters, digits, and single dashes only: no path separators,
 * no quotes, no control characters, nothing a browser or a shell would
 * reinterpret. An empty or entirely non-ASCII name falls back to `prompt`.
 */
export function safeSlug(input: string, fallback = 'prompt'): string {
  const slug = input
    .normalize('NFKD')
    .replace(UNSAFE_FILENAME, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  return slug.length > 0 ? slug : fallback;
}

/** `2026-10-25`, from an ISO timestamp, without a timezone shuffle. */
export function fileStamp(exportedAt: IsoTimestamp): string {
  return exportedAt.slice(0, 10);
}

/**
 * `promptforge-backup-2026-10-25.json`
 * `promptforge-selection-3-prompts-2026-10-25.json`
 * `promptforge-prompt-billing-classifier-2026-10-25.json`
 */
export function exportFileName(input: {
  readonly scope: TransferScope;
  readonly count: number;
  readonly title?: string;
  readonly exportedAt: IsoTimestamp;
}): string {
  const stamp = fileStamp(input.exportedAt);

  if (input.scope === 'prompt') {
    return `promptforge-prompt-${safeSlug(input.title ?? 'prompt')}-${stamp}.json`;
  }
  if (input.scope === 'selection') {
    const noun = input.count === 1 ? 'prompt' : 'prompts';
    return `promptforge-selection-${input.count}-${noun}-${stamp}.json`;
  }
  return `promptforge-backup-${stamp}.json`;
}

/* -------------------------------------------------------------------------- */
/* Export kinds                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Single prompt: the envelope holds one prompt and only what it references.
 *
 * Returns `null` when the prompt is not in the library, so callers cannot
 * download an empty file for a prompt that was deleted in another tab.
 */
export function exportPrompt(
  library: LibrarySnapshot,
  promptId: string,
  options: ExportOptions,
): ExportResult | null {
  const prompt = library.prompts.find((candidate) => candidate.id === promptId);
  if (!prompt) return null;

  const bundle = buildBundle(library, [prompt.id], { ...options, scope: 'prompt' }, false);

  return describe(
    bundle,
    exportFileName({
      scope: 'prompt',
      count: 1,
      title: prompt.title,
      exportedAt: options.exportedAt,
    }),
  );
}

/** Selected prompts: a bundle whose prompts come from one library view. */
export function exportSelection(
  library: LibrarySnapshot,
  promptIds: readonly string[],
  options: ExportOptions,
): ExportResult {
  const bundle = buildBundle(library, promptIds, { ...options, scope: 'selection' }, false);

  return describe(
    bundle,
    exportFileName({
      scope: 'selection',
      count: bundle.prompts.length,
      exportedAt: options.exportedAt,
    }),
  );
}

/** Full library backup: every record the bundle format knows about. */
export function exportLibrary(library: LibrarySnapshot, options: ExportOptions): ExportResult {
  const bundle = buildBundle(library, null, { ...options, scope: 'library' }, true);

  return describe(
    bundle,
    exportFileName({
      scope: 'library',
      count: bundle.prompts.length,
      exportedAt: options.exportedAt,
    }),
  );
}

/**
 * Packages a bundle for download.
 *
 * `bytes` is measured after serialization, so the size a screen shows is the
 * size of the file the browser will write, not an estimate from record counts.
 */
function describe(bundle: PromptForgeBundle, fileName: string): ExportResult {
  const json = serializeBundle(bundle);

  return {
    bundle,
    json,
    fileName,
    counts: countBundleRecords(bundle),
    bytes: new TextEncoder().encode(json).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Content fingerprints                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The hash two prompts share when their documents are the same.
 *
 * The stored document hash, so formatting and key order never change the
 * result: conflict detection and the editor's diff share one notion of "same
 * document".
 */
export function promptContentHash(prompt: Prompt): string {
  return documentHash(prompt.content);
}

/** Revisions of one prompt, oldest first. */
export function revisionsOf(
  revisions: readonly PromptRevision[],
  promptId: string,
): readonly PromptRevision[] {
  return revisions
    .filter((revision) => revision.promptId === promptId)
    .sort((left, right) => left.revisionNumber - right.revisionNumber);
}
