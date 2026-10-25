/**
 * Import tests (TASK-026).
 *
 * Three groups, in the order the import happens: reading a file (categories,
 * limits, format detection), previewing it (conflicts and defaults), and
 * planning it (identifier remapping, overwrite semantics, and the promises the
 * summary makes).
 */

import { describe, expect, it } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import { describeImportIssues, serializeBundle } from '@/domain/transfer/bundle';
import { exportLibrary, exportPrompt, exportSelection } from '@/domain/transfer/export';
import {
  MAX_IMPORT_BYTES,
  buildImportPlan,
  buildPreview,
  copyTitle,
  defaultDecision,
  describePlanSummary,
  detectConflict,
  readImportFile,
  type ImportDecision,
  type TransferPreview,
} from '@/domain/transfer/import';
import {
  FIXTURE_IDS,
  FIXTURE_NOW,
  createTransferFixture,
  sequenceIds,
} from '@/test/transferFixture';
import { formatBytes } from '@/domain/health';
import { emptyLibrary, type LibrarySnapshot } from '@/domain/transfer/bundle';
import type { Prompt } from '@/domain/types';

const fixture = createTransferFixture();
const exportedAt = FIXTURE_NOW.toISOString();
const deps = { now: () => FIXTURE_NOW, newId: sequenceIds('generated') };

function library(): LibrarySnapshot {
  return {
    prompts: fixture.prompts,
    folders: fixture.folders,
    collections: fixture.collections,
    schemas: fixture.schemas,
    snippets: fixture.snippets,
    templates: fixture.templates,
    testCases: fixture.testCases,
    revisions: fixture.revisions,
  };
}

function backupJson(): string {
  return exportLibrary(library(), { appVersion: '0.1.0', exportedAt }).json;
}

function readText(text: string, target: LibrarySnapshot = emptyLibrary()): TransferPreview {
  const result = readImportFile(text, { deps, library: target });
  if (!result.ok) throw new Error(`expected a preview, got ${result.failure.message}`);
  return result.value;
}

function plan(preview: TransferPreview, decisions: Record<string, ImportDecision> = {}) {
  return buildImportPlan(preview, decisions, emptyLibrary(), deps);
}

/** Applies a plan the way the store does, so a round trip can be compared. */
function applyPlan(
  target: LibrarySnapshot,
  preview: TransferPreview,
  decisions: Record<string, ImportDecision> = {},
  targetLibrary: LibrarySnapshot = target,
): LibrarySnapshot {
  const built = buildImportPlan(preview, decisions, targetLibrary, deps);
  return {
    prompts: [
      ...targetLibrary.prompts.filter((p) => !built.promptsToUpdate.some((u) => u.id === p.id)),
      ...built.promptsToCreate,
      ...built.promptsToUpdate,
    ],
    folders: [...targetLibrary.folders, ...built.folders],
    collections: [...targetLibrary.collections, ...built.collections],
    schemas: [...targetLibrary.schemas, ...built.schemas],
    snippets: [...targetLibrary.snippets, ...built.snippets],
    templates: [...targetLibrary.templates, ...built.templates],
    testCases: [...targetLibrary.testCases, ...built.testCases],
    revisions: [...targetLibrary.revisions, ...built.revisions],
  };
}

describe('readImportFile — rejected input', () => {
  it('rejects an empty file', () => {
    const result = readImportFile('   \n ', { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('empty');
  });

  it('rejects a file over the size limit, and says both numbers', () => {
    const result = readImportFile('{"a":1}', { deps, maxBytes: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('too-large');
    expect(result.failure.message).toContain('7 B');
    expect(result.failure.message).toContain('3 B');
  });

  it('keeps the default limit at 2 MB', () => {
    expect(MAX_IMPORT_BYTES).toBe(2_000_000);
    const huge = `{"padding":"${'a'.repeat(MAX_IMPORT_BYTES)}"}`;
    const result = readImportFile(huge, { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('too-large');
    expect(result.failure.message).toContain('2.0 MB');
  });

  it('rejects malformed JSON with a line and column', () => {
    const result = readImportFile('{\n  "format": "promptforge.bundle",\n}', { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('not-json');
    expect(result.failure.message).toContain('line');
  });

  it('rejects JSON that is neither an export nor a document', () => {
    const result = readImportFile('{"hello":"world"}', { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('unrecognised');
    expect(result.failure.message).toContain('schemaVersion');
  });

  it('rejects an unsupported version before reading any record', () => {
    const parsed = JSON.parse(backupJson()) as Record<string, unknown>;
    parsed['version'] = 2;

    const result = readImportFile(JSON.stringify(parsed), { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('unsupported-version');
    expect(result.failure.message).toContain('version 2');
  });

  it('rejects a partially invalid bundle and names the broken record', () => {
    const parsed = JSON.parse(backupJson()) as { prompts: { title: unknown }[] };
    parsed.prompts[1]!.title = 42;

    const result = readImportFile(JSON.stringify(parsed), { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('invalid-records');
    expect(result.failure.message).toContain('This file has 1 problem');
    expect(describeImportIssues(result.failure.issues)).toContain('prompts[1].title');
  });

  it('rejects a bundle whose prompt points at a folder it does not carry', () => {
    const parsed = JSON.parse(backupJson()) as { folders: unknown[] };
    parsed.folders = [];

    const result = readImportFile(JSON.stringify(parsed), { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('invalid-records');
  });
});

describe('readImportFile — raw documents', () => {
  it('wraps a bare document as one prompt and says what it did', () => {
    const text = JSON.stringify(createBlankDocument({ name: 'Loose document' }));
    const result = readImportFile(text, { deps });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.format).toBe('document');
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0]?.title).toBe('Loose document');
    expect(result.value.warnings.join(' ')).toContain('not a PromptForge export');
  });

  it('refuses a nameless document instead of inventing a title', () => {
    const document = { ...createBlankDocument(), name: '' };
    const result = readImportFile(JSON.stringify(document), { deps });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('invalid-records');
  });

  it('rejects a document that does not validate', () => {
    const result = readImportFile('{"schemaVersion":"1.0","name":""}', { deps });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toBe('invalid-records');
    expect(result.failure.message.length).toBeGreaterThan(0);
  });
});

describe('readImportFile — accepted files', () => {
  it('reads a backup into two preview items with their supporting counts', () => {
    const preview = readText(backupJson());

    expect(preview.format).toBe('bundle');
    expect(preview.scope).toBe('library');
    expect(preview.items.map((item) => item.title)).toEqual([
      'Invoice extractor',
      'Escalation summary',
    ]);
    expect(preview.supporting).toEqual({
      folders: 3,
      collections: 1,
      schemas: 1,
      snippets: 1,
      templates: 1,
      revisions: 2,
      testCases: 1,
    });
  });

  it('describes an item with the names, not the ids', () => {
    const preview = readText(backupJson());
    const [invoice] = preview.items;

    expect(invoice?.folderName).toBe('Billing');
    expect(invoice?.collectionNames).toEqual(['Billing']);
    expect(invoice?.schemaName).toBe('Invoice extraction');
    expect(invoice?.revisionCount).toBe(2);
    expect(invoice?.testCaseCount).toBe(1);
  });

  it('recognises a single-prompt export', () => {
    const single = exportPrompt(library(), FIXTURE_IDS.promptA, {
      appVersion: '0.1.0',
      exportedAt,
    });
    const preview = readText(single?.json ?? '');

    expect(preview.format).toBe('prompt-file');
    expect(preview.scope).toBe('prompt');
    expect(preview.items).toHaveLength(1);
  });

  it('keeps manifest warnings as preview warnings', () => {
    const parsed = JSON.parse(backupJson()) as { manifest: { counts: { prompts: number } } };
    parsed.manifest.counts.prompts = 9;

    const preview = readText(JSON.stringify(parsed));
    expect(preview.warnings.join(' ')).toContain('the file holds 2');
  });
});

describe('conflict detection', () => {
  const [promptA] = fixture.prompts;

  it('finds the same identifier first', () => {
    const conflict = detectConflict(promptA!, library());
    expect(conflict?.kind).toBe('same-id');
    expect(conflict?.promptId).toBe(FIXTURE_IDS.promptA);
  });

  it('finds identical content under a new identifier', () => {
    const clone: Prompt = { ...promptA!, id: 'other-id' };
    const conflict = detectConflict(clone, library());
    expect(conflict?.kind).toBe('same-content');
  });

  it('finds the same title with different content', () => {
    const renamed: Prompt = {
      ...promptA!,
      id: 'other-id',
      content: createBlankDocument({ name: 'Different', objective: 'Other.' }),
    };
    const conflict = detectConflict(renamed, library());
    expect(conflict?.kind).toBe('same-title');
    expect(conflict?.detail).toContain('title');
  });

  it('reports no conflict for a new prompt', () => {
    const fresh: Prompt = {
      ...promptA!,
      id: 'fresh',
      title: 'Never seen',
      content: createBlankDocument({ name: 'Never seen', objective: 'Brand new.' }),
    };
    expect(detectConflict(fresh, library())).toBeNull();
  });

  it('defaults to importing on a title clash and skipping on a duplicate', () => {
    expect(defaultDecision(null)).toBe('import');
    expect(defaultDecision({ kind: 'same-title', promptId: 'x', title: 'x', detail: '' })).toBe(
      'import',
    );
    expect(defaultDecision({ kind: 'same-id', promptId: 'x', title: 'x', detail: '' })).toBe(
      'skip',
    );
    expect(defaultDecision({ kind: 'same-content', promptId: 'x', title: 'x', detail: '' })).toBe(
      'skip',
    );
  });

  it('offers overwrite only when there is something to overwrite', () => {
    const preview = buildPreview(
      'bundle',
      exportLibrary(library(), { appVersion: '0.1.0', exportedAt }).bundle,
      [],
      library(),
    );
    expect(preview.items[0]?.allowedDecisions).toContain('overwrite');

    const empty = readText(backupJson());
    expect(empty.items[0]?.allowedDecisions).not.toContain('overwrite');
    expect(empty.decisions[FIXTURE_IDS.promptA]).toBe('import');
  });
});

describe('buildImportPlan — into an empty library', () => {
  const preview = readText(backupJson());
  const built = plan(preview);

  it('keeps every identifier, because nothing is in the way', () => {
    expect(built.remaps).toEqual([]);
    expect(built.promptsToCreate.map((prompt) => prompt.id)).toEqual([
      FIXTURE_IDS.promptA,
      FIXTURE_IDS.promptB,
    ]);
  });

  it('creates the supporting records the prompts need', () => {
    expect(built.folders.map((folder) => folder.id).sort()).toEqual([
      FIXTURE_IDS.folderChild,
      FIXTURE_IDS.folderRoot,
      FIXTURE_IDS.folderUnused,
    ]);
    expect(built.collections).toHaveLength(1);
    expect(built.schemas).toHaveLength(1);
    expect(built.snippets).toHaveLength(1);
    expect(built.templates).toHaveLength(1);
    expect(built.revisions).toHaveLength(2);
    expect(built.testCases).toHaveLength(1);
  });

  it('orders folders parents first', () => {
    // Depth first, then name: a child is never created before its parent.
    expect(built.folders.map((folder) => folder.name)).toEqual([
      'Archive drafts',
      'Support',
      'Billing',
    ]);
  });

  it('summarises the plan without claiming more than it does', () => {
    expect(describePlanSummary(built)).toBe(
      '2 prompts added (with 2 revisions, 1 test cases, 1 schemas, 3 folders)',
    );
  });

  it('reports nothing skipped and nothing failed', () => {
    expect(built.counts.skip).toBe(0);
    expect(built.entries.every((entry) => entry.outcome === 'created')).toBe(true);
  });
});

describe('buildImportPlan — decisions', () => {
  it('skips a prompt and leaves its supporting records behind', () => {
    const preview = readText(backupJson(), library());
    const built = buildImportPlan(
      preview,
      { [FIXTURE_IDS.promptA]: 'skip', [FIXTURE_IDS.promptB]: 'skip' },
      library(),
      deps,
    );

    expect(built.promptsToCreate).toEqual([]);
    expect(built.revisions).toEqual([]);
    expect(built.testCases).toEqual([]);
    expect(built.counts.skip).toBe(2);
    expect(describePlanSummary(built)).toBe('2 skipped');
  });

  it('imports as a copy with a new id and a "(copy)" title', () => {
    const preview = readText(backupJson(), library());
    const built = buildImportPlan(
      preview,
      { [FIXTURE_IDS.promptA]: 'copy', [FIXTURE_IDS.promptB]: 'skip' },
      library(),
      deps,
    );

    const copy = built.promptsToCreate[0];
    expect(copy?.id).not.toBe(FIXTURE_IDS.promptA);
    expect(copy?.title).toBe('Invoice extractor (copy)');
    expect(built.remaps).toContainEqual({
      kind: 'prompt',
      from: FIXTURE_IDS.promptA,
      to: copy?.id,
      reason: 'copy',
    });

    // Revisions and test cases follow the copied prompt to its new id.
    expect(built.revisions.every((revision) => revision.promptId === copy?.id)).toBe(true);
    expect(built.testCases[0]?.promptId).toBe(copy?.id);
  });

  it('numbers repeated copies', () => {
    expect(copyTitle('Invoice', ['Invoice'])).toBe('Invoice (copy)');
    expect(copyTitle('Invoice', ['Invoice', 'Invoice (copy)'])).toBe('Invoice (copy 2)');
  });

  it('overwrites the stored prompt, keeping its identity and history', () => {
    const preview = readText(backupJson(), library());
    const built = buildImportPlan(
      preview,
      { [FIXTURE_IDS.promptA]: 'overwrite', [FIXTURE_IDS.promptB]: 'skip' },
      library(),
      deps,
    );

    const updated = built.promptsToUpdate[0];
    const stored = fixture.prompts[0]!;
    expect(updated?.id).toBe(stored.id);
    expect(updated?.createdAt).toBe(stored.createdAt);
    expect(updated?.version).toBe(stored.version + 1);
    expect(updated?.updatedAt).toBe(FIXTURE_NOW.toISOString());
    expect(built.entries[0]?.outcome).toBe('overwritten');
  });

  it('appends imported revisions after the stored history instead of colliding', () => {
    const preview = readText(backupJson(), library());
    const built = buildImportPlan(
      preview,
      { [FIXTURE_IDS.promptA]: 'overwrite', [FIXTURE_IDS.promptB]: 'skip' },
      library(),
      deps,
    );

    // The stored prompt already has revisions 1 and 2.
    expect(built.revisions.map((revision) => revision.revisionNumber)).toEqual([3, 4]);
    expect(
      built.remaps.filter((remap) => remap.kind === 'revision' && remap.reason === 'renumbered'),
    ).toHaveLength(2);
  });

  it('falls back to creating when the overwrite target has vanished', () => {
    const preview = readText(backupJson(), library());
    // Ask to overwrite a prompt the plan cannot find any more.
    const built = buildImportPlan(
      { ...preview, items: preview.items.map((item) => ({ ...item, conflict: null })) },
      { [FIXTURE_IDS.promptA]: 'import' },
      emptyLibrary(),
      deps,
    );

    expect(built.promptsToCreate.map((prompt) => prompt.id)).toContain(FIXTURE_IDS.promptA);
  });

  it('renames a test case that clashes with one already stored', () => {
    const preview = readText(backupJson(), library());
    const built = buildImportPlan(
      preview,
      { [FIXTURE_IDS.promptA]: 'overwrite', [FIXTURE_IDS.promptB]: 'skip' },
      library(),
      deps,
    );

    expect(built.testCases[0]?.name).toBe('Short invoice (copy)');
  });
});

describe('buildImportPlan — collisions and warnings', () => {
  it('remaps ids that are already taken by unrelated records', () => {
    const occupied: LibrarySnapshot = {
      ...emptyLibrary(),
      prompts: [
        {
          ...fixture.prompts[1]!,
          id: FIXTURE_IDS.promptA,
          title: 'Something else entirely',
          content: createBlankDocument({
            name: 'Something else entirely',
            objective: 'Unrelated.',
          }),
        },
      ],
    };

    const preview = readText(backupJson(), occupied);
    expect(preview.items[0]?.conflict?.kind).toBe('same-id');

    const built = buildImportPlan(preview, { [FIXTURE_IDS.promptA]: 'import' }, occupied, deps);
    const created = built.promptsToCreate.find((prompt) => prompt.title === 'Invoice extractor');

    expect(created?.id).toMatch(/^generated-\d+$/);
    expect(created?.id).not.toBe(FIXTURE_IDS.promptA);
    expect(built.remaps).toContainEqual({
      kind: 'prompt',
      from: FIXTURE_IDS.promptA,
      to: created?.id,
      reason: 'id-taken',
    });
  });

  it('reuses a folder of the same name instead of creating a second one', () => {
    const twinFolder = { ...fixture.folders[0]!, id: 'local-support', name: 'Support' };
    const target: LibrarySnapshot = { ...emptyLibrary(), folders: [twinFolder] };

    const preview = readText(backupJson(), target);
    const built = buildImportPlan(preview, {}, target, deps);

    // "Support" was reused; only its child and the unrelated folder are new.
    expect(built.folders.map((folder) => folder.name)).toEqual(['Archive drafts', 'Billing']);
    expect(built.folders.find((folder) => folder.name === 'Billing')?.parentId).toBe(
      'local-support',
    );
  });

  it('warns about records left behind by a partial import', () => {
    const preview = readText(backupJson());
    const built = buildImportPlan(
      preview,
      { [FIXTURE_IDS.promptA]: 'import', [FIXTURE_IDS.promptB]: 'skip' },
      emptyLibrary(),
      deps,
    );

    // Prompt A needs the folder chain, schema, snippet, collection, and its own
    // test case; the unused folder has no imported prompt pointing at it.
    expect(built.warnings.join(' ')).toContain('1 folders left out');
  });

  it('does not import a template whose name already exists', () => {
    const target: LibrarySnapshot = {
      ...emptyLibrary(),
      templates: [fixture.templates[0]!],
    };

    const preview = readText(backupJson(), target);
    const built = buildImportPlan(preview, {}, target, deps);

    expect(built.templates).toEqual([]);
    expect(built.warnings.join(' ')).toContain('already exists here');
  });
});

describe('round trip', () => {
  it('reproduces the library in an empty one', () => {
    const preview = readText(backupJson());
    const restored = applyPlan(emptyLibrary(), preview);

    expect(restored.prompts).toEqual(fixture.prompts);
    expect([...restored.folders].sort((left, right) => left.id.localeCompare(right.id))).toEqual(
      [...fixture.folders].sort((left, right) => left.id.localeCompare(right.id)),
    );
    expect(restored.collections).toEqual(fixture.collections);
    expect(restored.schemas).toEqual(fixture.schemas);
    expect(restored.snippets).toEqual(fixture.snippets);
    expect(restored.templates).toEqual(fixture.templates);
    expect(restored.testCases).toEqual(fixture.testCases);
    expect(restored.revisions).toEqual(fixture.revisions);
  });

  it('reproduces a selection without inventing records', () => {
    const selection = exportSelection(library(), [FIXTURE_IDS.promptB], {
      appVersion: '0.1.0',
      exportedAt,
    });

    const preview = readText(selection.json);
    const restored = applyPlan(emptyLibrary(), preview);

    expect(restored.prompts.map((prompt) => prompt.id)).toEqual([FIXTURE_IDS.promptB]);
    expect(restored.revisions).toEqual([]);
    expect(restored.testCases).toEqual([]);
    expect(restored.templates).toEqual([]);
  });

  it('reports the identifier mapping when importing into an occupied library', () => {
    const occupied: LibrarySnapshot = {
      ...emptyLibrary(),
      folders: [{ ...fixture.folders[0]!, id: 'local-support', name: 'Support' }],
    };

    const preview = readText(backupJson(), occupied);
    const restored = applyPlan(emptyLibrary(), preview, {}, occupied);

    // Prompt B's parent folder was reused, so its folder link points at the
    // local record rather than the file's id.
    expect(restored.folders.map((folder) => folder.name).sort()).toEqual([
      'Archive drafts',
      'Billing',
      'Support',
    ]);
    expect(restored.prompts.every((prompt) => prompt.folderId !== FIXTURE_IDS.folderRoot)).toBe(
      true,
    );
  });

  it('can be imported twice without duplicating anything on the second run', () => {
    const preview = readText(backupJson());
    const once = applyPlan(emptyLibrary(), preview);

    const secondPreview = readText(
      serializeBundle(exportLibrary(once, { appVersion: '0.1.0', exportedAt }).bundle),
      once,
    );
    // Every prompt now collides, so the defaults skip them all.
    expect(secondPreview.items.every((item) => item.defaultDecision === 'skip')).toBe(true);

    const second = buildImportPlan(secondPreview, secondPreview.decisions, once, deps);
    expect(second.promptsToCreate).toEqual([]);
    expect(second.counts.skip).toBe(2);
  });
});

describe('formatBytes', () => {
  it('describes the sizes a file dialog shows', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(4096)).toBe('4.1 kB');
    expect(formatBytes(3_000_000)).toBe('3.0 MB');
  });
});

/* -------------------------------------------------------------------------- */
/* Identifier allocation and remapping (TASK-026)                             */
/* -------------------------------------------------------------------------- */

/** A parsed backup, ready to be adjusted before it is read back as a file. */
function jsonBackup() {
  return JSON.parse(backupJson()) as {
    prompts: Record<string, unknown>[];
    revisions: Record<string, unknown>[];
    folders: Record<string, unknown>[];
    collections: Record<string, unknown>[];
    schemas: Record<string, unknown>[];
    snippets: Record<string, unknown>[];
    templates: Record<string, unknown>[];
    testCases: Record<string, unknown>[];
    manifest: Record<string, unknown>;
  };
}

function readValue(value: unknown, target: LibrarySnapshot = emptyLibrary()): TransferPreview {
  return readText(JSON.stringify(value), target);
}

function libraryWith(overrides: Partial<LibrarySnapshot>): LibrarySnapshot {
  return { ...emptyLibrary(), ...overrides };
}

describe('buildImportPlan — identifier allocation (TASK-026)', () => {
  it('steps past a generated id that is already taken', () => {
    const generated = ['generated-1', 'generated-2', 'generated-3'];
    let index = 0;
    const takenDeps = {
      now: () => FIXTURE_NOW,
      newId: () => generated[Math.min(index++, generated.length - 1)]!,
    };

    const occupied = libraryWith({
      prompts: [{ ...fixture.prompts[0]!, id: 'generated-1', title: 'Stored copy' }],
    });

    const built = buildImportPlan(
      readValue(jsonBackup()),
      { [FIXTURE_IDS.promptA]: 'copy' },
      occupied,
      takenDeps,
    );

    expect(built.promptsToCreate).toHaveLength(2);
    // The first candidate was occupied, so the allocator asked again.
    expect(built.promptsToCreate[0]!.id).toBe('generated-2');
    expect(built.promptsToCreate[0]!.title).toBe('Invoice extractor (copy)');
  });

  it('suffixes an id instead of spinning when the generator repeats itself', () => {
    const stuckDeps = { now: () => FIXTURE_NOW, newId: () => 'generated-1' };

    const built = buildImportPlan(
      readValue(jsonBackup()),
      { [FIXTURE_IDS.promptA]: 'copy', [FIXTURE_IDS.promptB]: 'copy' },
      emptyLibrary(),
      stuckDeps,
    );

    const ids = built.promptsToCreate.map((prompt) => prompt.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe('generated-1');
    expect(ids[1]).toMatch(/^generated-1-\d+$/);
  });

  it('reuses a stored folder of the same name and remaps the reference', () => {
    const stored = libraryWith({
      folders: [
        {
          id: 'folder-support-stored',
          name: 'Support',
          parentId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const built = buildImportPlan(readValue(jsonBackup(), stored), {}, stored, deps);

    expect(built.folders.map((folder) => folder.name)).not.toContain('Support');
    expect(built.remaps).toContainEqual(
      expect.objectContaining({
        kind: 'folder',
        from: FIXTURE_IDS.folderRoot,
        to: 'folder-support-stored',
        reason: 'id-taken',
      }),
    );

    // The child folder keeps the stored parent, not the one from the file.
    const child = built.folders.find((folder) => folder.id === FIXTURE_IDS.folderChild);
    expect(child?.parentId).toBe('folder-support-stored');

    const invoice = built.promptsToCreate.find((prompt) => prompt.title === 'Invoice extractor');
    expect(invoice?.folderId).toBe(FIXTURE_IDS.folderChild);
  });

  it('reuses stored folders, collections, schemas, and snippets by identifier', () => {
    const stored = libraryWith({
      folders: [...fixture.folders],
      collections: [...fixture.collections],
      schemas: [...fixture.schemas],
      snippets: [...fixture.snippets],
    });

    const built = buildImportPlan(readValue(jsonBackup(), stored), {}, stored, deps);

    expect(built.folders).toEqual([]);
    expect(built.collections).toEqual([]);
    expect(built.schemas).toEqual([]);
    expect(built.snippets).toEqual([]);
    expect(built.remaps).toEqual([]);
  });

  it('reuses a stored collection of the same name and remaps the membership', () => {
    const stored = libraryWith({
      collections: [
        {
          id: 'collection-stored',
          name: 'billing',
          description: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const built = buildImportPlan(readValue(jsonBackup(), stored), {}, stored, deps);

    expect(built.collections).toEqual([]);
    expect(built.remaps).toContainEqual(
      expect.objectContaining({
        kind: 'collection',
        from: FIXTURE_IDS.collection,
        to: 'collection-stored',
        reason: 'id-taken',
      }),
    );

    const invoice = built.promptsToCreate.find((prompt) => prompt.title === 'Invoice extractor');
    expect(invoice?.collectionIds).toEqual(['collection-stored']);
  });

  it('gives a template a new id when its identifier is taken by another template', () => {
    const stored = libraryWith({
      templates: [{ ...fixture.templates[0]!, id: FIXTURE_IDS.template, name: 'Different' }],
    });

    const built = buildImportPlan(readValue(jsonBackup(), stored), {}, stored, deps);

    expect(built.templates).toHaveLength(1);
    expect(built.templates[0]!.id).not.toBe(FIXTURE_IDS.template);
    expect(built.remaps).toContainEqual(
      expect.objectContaining({ kind: 'template', from: FIXTURE_IDS.template, reason: 'id-taken' }),
    );
  });

  it('gives a revision a new id when its identifier is taken', () => {
    const stored = libraryWith({
      revisions: [
        {
          ...fixture.revisions[0]!,
          id: FIXTURE_IDS.revisionA1,
          promptId: 'elsewhere',
          revisionNumber: 9,
        },
      ],
    });

    const built = buildImportPlan(
      readValue(jsonBackup(), stored),
      { [FIXTURE_IDS.promptA]: 'skip' },
      stored,
      deps,
    );

    // The prompt is skipped, so its history is not imported at all.
    expect(built.revisions).toEqual([]);
  });
});

describe('buildImportPlan — defensive paths (TASK-026)', () => {
  it('falls back to the default when a decision is not offered', () => {
    const built = buildImportPlan(
      readValue(jsonBackup()),
      { [FIXTURE_IDS.promptA]: 'overwrite' },
      emptyLibrary(),
      deps,
    );

    // Nothing to overwrite, so overwrite is not offered: the default applies.
    expect(built.entries.find((entry) => entry.sourceId === FIXTURE_IDS.promptA)).toMatchObject({
      decision: 'import',
      outcome: 'created',
    });
    expect(built.warnings.join(' ')).not.toContain('could no longer be overwritten');
  });

  it('appends to a target that has no stored history yet', () => {
    const stored = libraryWith({
      prompts: [{ ...fixture.prompts[0]!, id: FIXTURE_IDS.promptA, version: 5 }],
    });
    const bundle = jsonBackup();
    bundle.revisions[0]!['revisionNumber'] = 9;

    const built = buildImportPlan(
      readValue(bundle, stored),
      { [FIXTURE_IDS.promptA]: 'overwrite' },
      stored,
      deps,
    );

    expect(built.promptsToUpdate[0]!.version).toBe(6);
    // Stored history was empty, so the file's revision 9 becomes 1.
    expect(built.revisions[0]!.revisionNumber).toBe(1);
    expect(built.remaps).toContainEqual(
      expect.objectContaining({ kind: 'revision', reason: 'renumbered' }),
    );
    expect(describePlanSummary(built)).toContain('1 overwritten');
  });

  it('orders revisions belonging to two different prompts', () => {
    const bundle = jsonBackup();
    bundle.revisions[0]!['promptId'] = FIXTURE_IDS.promptB;
    bundle.revisions[0]!['revisionNumber'] = 2;
    bundle.revisions[1]!['promptId'] = FIXTURE_IDS.promptA;
    bundle.revisions[1]!['revisionNumber'] = 1;

    const built = buildImportPlan(readValue(bundle), {}, emptyLibrary(), deps);

    expect(built.revisions).toHaveLength(2);
    expect(built.revisions.map((revision) => revision.promptId)).toEqual([
      FIXTURE_IDS.promptA,
      FIXTURE_IDS.promptB,
    ]);
  });

  it('drops a test case expectation whose schema was not imported', () => {
    const bundle = jsonBackup();
    // Prompt A stops pointing at the schema, and prompt B is left out, so the
    // schema is not part of this import. The saved expectation must not keep a
    // dangling reference to it.
    bundle.prompts[0]!['schemaId'] = null;

    const built = buildImportPlan(
      readValue(bundle),
      { [FIXTURE_IDS.promptB]: 'skip' },
      emptyLibrary(),
      deps,
    );

    expect(built.schemas).toEqual([]);
    expect(built.testCases[0]!.expectedStructure).toBeNull();
  });

  it('breaks a folder cycle instead of recursing forever', () => {
    const bundle = jsonBackup();
    bundle.folders[0]!['parentId'] = FIXTURE_IDS.folderChild;

    const built = buildImportPlan(readValue(bundle), {}, emptyLibrary(), deps);

    expect(built.folders.map((folder) => folder.name).sort()).toEqual([
      'Archive drafts',
      'Billing',
      'Support',
    ]);
  });

  it('describes a file with no prompts as nothing to import', () => {
    const bundle = jsonBackup();
    bundle.prompts = [];
    bundle.revisions = [];
    bundle.testCases = [];

    const built = buildImportPlan(readValue(bundle), {}, emptyLibrary(), deps);

    expect(built.counts.create).toBe(0);
    // Nothing to import as a prompt, but the supporting records still come over,
    // and the summary says so instead of pretending the file was empty.
    expect(describePlanSummary(built)).toBe('Nothing to import (with 1 schemas, 3 folders)');
    // A file with no prompts still reproduces its supporting records.
    expect(built.folders).toHaveLength(3);
  });

  it('reports a prompt with no folder or schema as such', () => {
    const bundle = jsonBackup();
    bundle.prompts[0]!['folderId'] = null;
    bundle.prompts[0]!['schemaId'] = null;
    bundle.prompts[0]!['collectionIds'] = [];

    const preview = readValue(bundle);
    const item = preview.items.find((candidate) => candidate.sourceId === FIXTURE_IDS.promptA);

    expect(item).toMatchObject({ folderName: null, schemaName: null, collectionNames: [] });
  });
});
