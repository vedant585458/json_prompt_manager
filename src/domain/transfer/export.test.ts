/**
 * Export selection and filename tests (TASK-026).
 *
 * What travels with a prompt is the part of an export people notice only when
 * it is missing, so each rule has a test: the folder chain, collections, the
 * attached schema, merged snippets, history, test cases — and the deliberate
 * silences (no templates in a selection, no preferences anywhere).
 */

import { describe, expect, it } from 'vitest';

import { formatBytes } from '@/domain/health';
import {
  buildBundle,
  exportFileName,
  exportLibrary,
  exportPrompt,
  exportSelection,
  folderChain,
  promptContentHash,
  revisionsOf,
  safeSlug,
} from '@/domain/transfer/export';
import { FIXTURE_IDS, FIXTURE_NOW, createTransferFixture } from '@/test/transferFixture';

const fixture = createTransferFixture();
const exportedAt = FIXTURE_NOW.toISOString();

function library() {
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

const options = { appVersion: '0.1.0', exportedAt };

describe('folderChain', () => {
  it('returns the folder and every ancestor, nearest first', () => {
    const chain = folderChain(FIXTURE_IDS.folderChild, fixture.folders);
    expect(chain.map((folder) => folder.name)).toEqual(['Billing', 'Support']);
  });

  it('returns nothing for an unfiled prompt', () => {
    expect(folderChain(null, fixture.folders)).toEqual([]);
  });

  it('stops instead of looping on a broken parent chain', () => {
    const cyclic = [
      { id: 'a', name: 'A', parentId: 'b', createdAt: '', updatedAt: '' },
      { id: 'b', name: 'B', parentId: 'a', createdAt: '', updatedAt: '' },
    ];
    expect(folderChain('a', cyclic).map((folder) => folder.id)).toEqual(['a', 'b']);
  });

  it('ignores a parent that is not stored', () => {
    const orphans = [{ id: 'a', name: 'A', parentId: 'gone', createdAt: '', updatedAt: '' }];
    expect(folderChain('a', orphans)).toHaveLength(1);
  });
});

describe('exportPrompt', () => {
  const result = exportPrompt(library(), FIXTURE_IDS.promptA, options);

  it('holds one prompt and only the records it references', () => {
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.bundle.prompts).toHaveLength(1);
    expect(result.bundle.prompts[0]?.id).toBe(FIXTURE_IDS.promptA);
    // The folder chain comes along, the unrelated folder does not.
    expect(result.bundle.folders.map((folder) => folder.id).sort()).toEqual([
      FIXTURE_IDS.folderChild,
      FIXTURE_IDS.folderRoot,
    ]);
    expect(result.bundle.collections.map((collection) => collection.id)).toEqual([
      FIXTURE_IDS.collection,
    ]);
    expect(result.bundle.schemas.map((schema) => schema.id)).toEqual([FIXTURE_IDS.schema]);
    expect(result.bundle.snippets.map((snippet) => snippet.id)).toEqual([FIXTURE_IDS.snippet]);
    expect(result.bundle.revisions.map((revision) => revision.id).sort()).toEqual([
      FIXTURE_IDS.revisionA1,
      FIXTURE_IDS.revisionA2,
    ]);
    expect(result.bundle.testCases.map((testCase) => testCase.id)).toEqual([FIXTURE_IDS.testCaseA]);
  });

  it('leaves templates out: a selection cannot imply a standalone record', () => {
    expect(result?.bundle.templates).toEqual([]);
  });

  it('uses a slug filename with a date stamp', () => {
    expect(result?.fileName).toBe('promptforge-prompt-invoice-extractor-2026-10-25.json');
  });

  it('reports the real byte size of the file it will write', () => {
    expect(result?.bytes).toBe(new TextEncoder().encode(result?.json ?? '').length);
    expect(result?.bytes).toBeGreaterThan(0);
  });

  it('returns null for a prompt that is not stored', () => {
    expect(exportPrompt(library(), 'missing', options)).toBeNull();
  });
});

describe('exportSelection', () => {
  it('names the file after the number of prompts it holds', () => {
    const both = exportSelection(library(), [FIXTURE_IDS.promptA, FIXTURE_IDS.promptB], options);
    expect(both.fileName).toBe('promptforge-selection-2-prompts-2026-10-25.json');

    const one = exportSelection(library(), [FIXTURE_IDS.promptB], options);
    expect(one.fileName).toBe('promptforge-selection-1-prompt-2026-10-25.json');
    expect(one.bundle.prompts.map((prompt) => prompt.id)).toEqual([FIXTURE_IDS.promptB]);
  });

  it('drops records only the unselected prompt needed', () => {
    const onlyB = exportSelection(library(), [FIXTURE_IDS.promptB], options);

    // Prompt B shares the folder but has no schema, snippet, or test case.
    expect(onlyB.bundle.schemas).toEqual([]);
    expect(onlyB.bundle.snippets).toEqual([]);
    expect(onlyB.bundle.testCases).toEqual([]);
    expect(onlyB.bundle.folders.map((folder) => folder.id)).toEqual([
      FIXTURE_IDS.folderRoot,
      FIXTURE_IDS.folderChild,
    ]);
  });

  it('ignores ids that are not in the library', () => {
    const result = exportSelection(library(), ['missing'], options);
    expect(result.bundle.prompts).toEqual([]);
    expect(result.counts.prompts).toBe(0);
  });
});

describe('exportLibrary', () => {
  const result = exportLibrary(library(), options);

  it('carries every record, including ones no prompt references', () => {
    expect(result.counts).toEqual({
      prompts: 2,
      revisions: 2,
      folders: 3,
      collections: 1,
      schemas: 1,
      snippets: 1,
      templates: 1,
      testCases: 1,
    });
    // The unused folder is exactly the record a selection would drop.
    expect(result.bundle.folders.map((folder) => folder.id)).toContain(FIXTURE_IDS.folderUnused);
  });

  it('keeps the manifest counts equal to the lists', () => {
    expect(result.bundle.manifest.counts).toEqual(result.counts);
  });

  it('writes a plain backup filename', () => {
    expect(result.fileName).toBe('promptforge-backup-2026-10-25.json');
  });
});

describe('buildBundle', () => {
  it('includes a schema referenced only by a test case expectation', () => {
    const testCaseOnly = {
      ...library(),
      prompts: fixture.prompts.map((prompt) => ({ ...prompt, schemaId: null })),
    };

    const bundle = buildBundle(testCaseOnly, null, { ...options, scope: 'library' }, false);
    expect(bundle.schemas.map((schema) => schema.id)).toEqual([FIXTURE_IDS.schema]);
  });
});

describe('safeSlug', () => {
  it('keeps letters, digits, and single dashes', () => {
    expect(safeSlug('Invoice Extractor v2')).toBe('invoice-extractor-v2');
  });

  it('strips separators, quotes, and control characters', () => {
    expect(safeSlug('../../etc/passwd')).toBe('etc-passwd');
    expect(safeSlug('a "quoted" name\nwith newline')).toBe('a-quoted-name-with-newline');
  });

  it('falls back when nothing usable is left', () => {
    expect(safeSlug('日本語')).toBe('prompt');
    expect(safeSlug('---')).toBe('prompt');
  });

  it('caps the length without leaving a trailing dash', () => {
    const slug = safeSlug(`${'a'.repeat(47)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('exportFileName', () => {
  it('names a prompt file after its title', () => {
    expect(
      exportFileName({
        scope: 'prompt',
        count: 1,
        title: 'Refund triage',
        exportedAt: '2026-01-02T03:04:05.000Z',
      }),
    ).toBe('promptforge-prompt-refund-triage-2026-01-02.json');
  });

  it('falls back to a safe default title', () => {
    expect(exportFileName({ scope: 'prompt', count: 1, exportedAt: exportedAt })).toBe(
      'promptforge-prompt-prompt-2026-10-25.json',
    );
  });
});

describe('formatBytes', () => {
  it('is the same formatter the storage card uses', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 kB');
    expect(formatBytes(65_536)).toBe('66 kB');
    expect(formatBytes(2_000_000)).toBe('2.0 MB');
  });
});

describe('fingerprints', () => {
  it('is stable for the same document and differs for an edit', () => {
    const prompt = fixture.prompts[0]!;
    expect(promptContentHash(prompt)).toBe(promptContentHash(structuredClone(prompt)));

    const edited = {
      ...prompt,
      content: { ...prompt.content, objective: `${prompt.content.objective} More.` },
    };
    expect(promptContentHash(edited)).not.toBe(promptContentHash(prompt));
  });

  it('orders revisions oldest first', () => {
    const reversed = [...fixture.revisions].reverse();
    expect(
      revisionsOf(reversed, FIXTURE_IDS.promptA).map((revision) => revision.revisionNumber),
    ).toEqual([1, 2]);
  });
});
