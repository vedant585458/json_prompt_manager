/**
 * Transfer envelope tests (TASK-026).
 *
 * The serializer and the reader are tested against each other, because the one
 * property that matters is that a file PromptForge writes is a file PromptForge
 * reads back with the same records.
 */

import { describe, expect, it } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import {
  BUNDLE_FORMAT,
  PROMPT_FILE_FORMAT,
  TRANSFER_VERSION,
  countBundleRecords,
  describeImportIssues,
  detectTransferFormat,
  readBundle,
  serializeBundle,
  type PromptForgeBundle,
} from '@/domain/transfer/bundle';
import { buildBundle, exportLibrary } from '@/domain/transfer/export';
import { FIXTURE_NOW, createTransferFixture } from '@/test/transferFixture';

const fixture = createTransferFixture();

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

function exported(): PromptForgeBundle {
  return exportLibrary(library(), {
    appVersion: '0.1.0',
    exportedAt: FIXTURE_NOW.toISOString(),
  }).bundle;
}

describe('serializeBundle', () => {
  it('writes the marker, version, and manifest counts', () => {
    const bundle = exported();
    const json = JSON.parse(serializeBundle(bundle)) as Record<string, unknown>;

    expect(json['format']).toBe(BUNDLE_FORMAT);
    expect(json['version']).toBe(TRANSFER_VERSION);
    expect(json['manifest']).toMatchObject({
      app: 'PromptForge',
      appVersion: '0.1.0',
      exportedAt: FIXTURE_NOW.toISOString(),
      scope: 'library',
      counts: {
        prompts: 2,
        revisions: 2,
        folders: 3,
        collections: 1,
        schemas: 1,
        snippets: 1,
        templates: 1,
        testCases: 1,
      },
    });
  });

  it('is deterministic: the same bundle serializes to the same text', () => {
    const bundle = exported();
    expect(serializeBundle(bundle)).toBe(serializeBundle(bundle));
  });

  it('carries the fidelity note so the file explains itself', () => {
    const json = JSON.parse(serializeBundle(exported())) as {
      manifest: { fidelity: string[] };
    };

    expect(json.manifest.fidelity.join(' ')).toContain('Preserved:');
    expect(json.manifest.fidelity.join(' ')).toContain('Not included: activity log');
  });

  it('never writes preferences, activity, or drafts', () => {
    const text = serializeBundle(exported());

    expect(text).not.toContain('"activity"');
    expect(text).not.toContain('settings');
    expect(text).not.toContain('recoveryDraft');
    expect(text).not.toContain('healthThresholds');
  });

  it('uses the prompt-file marker for a single prompt export', () => {
    const bundle = buildBundle(
      library(),
      [fixture.prompts[0]!.id],
      { appVersion: '0.1.0', exportedAt: FIXTURE_NOW.toISOString(), scope: 'prompt' },
      false,
    );

    const json = JSON.parse(serializeBundle(bundle)) as Record<string, unknown>;
    expect(json['format']).toBe(PROMPT_FILE_FORMAT);
    expect(json['manifest']).toMatchObject({ scope: 'prompt' });
  });
});

describe('readBundle', () => {
  it('round-trips every record list', () => {
    const original = exported();
    const parsed = JSON.parse(serializeBundle(original)) as unknown;
    const read = readBundle(parsed);

    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(read.value.prompts).toEqual(original.prompts);
    expect(read.value.revisions).toEqual(original.revisions);
    expect(read.value.folders).toEqual(original.folders);
    expect(read.value.collections).toEqual(original.collections);
    expect(read.value.schemas).toEqual(original.schemas);
    expect(read.value.snippets).toEqual(original.snippets);
    expect(read.value.templates).toEqual(original.templates);
    expect(read.value.testCases).toEqual(original.testCases);
    expect(read.value.manifest.counts).toEqual(countBundleRecords(original));
  });

  it('rejects a file that is not an export', () => {
    const read = readBundle({ hello: 'world' });
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(describeImportIssues(read.issues)).toContain('does not look like a PromptForge export');
  });

  it('rejects a future version with an actionable message', () => {
    const read = readBundle({ format: BUNDLE_FORMAT, version: 99, manifest: {} });
    expect(read.ok).toBe(false);
    if (read.ok) return;

    const message = describeImportIssues(read.issues);
    expect(message).toContain('Unsupported transfer version 99');
    expect(message).toContain('version 1');
  });

  it('rejects duplicate identifiers inside one file', () => {
    const original = exported();
    const duplicated = {
      ...JSON.parse(serializeBundle(original)),
      folders: [...original.folders, original.folders[0]],
    } as unknown;

    const read = readBundle(duplicated);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(describeImportIssues(read.issues)).toContain('Duplicate id');
  });

  it('rejects a prompt whose folder is missing from the file', () => {
    const original = exported();
    const withoutFolders = {
      ...JSON.parse(serializeBundle(original)),
      folders: [],
    } as unknown;

    const read = readBundle(withoutFolders);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(describeImportIssues(read.issues)).toContain('is not included in this file');
  });

  it('rejects a document that does not parse, and says where', () => {
    const original = exported();
    const broken = JSON.parse(serializeBundle(original)) as {
      prompts: { content: Record<string, unknown> }[];
    };
    broken.prompts[0]!.content = { schemaVersion: '1.0', name: '', role: '', objective: '' };

    const read = readBundle(broken);
    expect(read.ok).toBe(false);
    if (read.ok) return;

    const message = describeImportIssues(read.issues);
    expect(message).toContain('prompts[0].content');
  });

  it('rejects two revisions with the same number on one prompt', () => {
    const original = exported();
    const broken = JSON.parse(serializeBundle(original)) as {
      revisions: { revisionNumber: number }[];
    };
    broken.revisions[1]!.revisionNumber = 1;

    const read = readBundle(broken);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(describeImportIssues(read.issues)).toContain('appears twice');
  });

  it('rejects a test case pointing at a prompt outside the file', () => {
    const original = exported();
    const broken = JSON.parse(serializeBundle(original)) as {
      testCases: { promptId: string }[];
    };
    broken.testCases[0]!.promptId = 'missing-prompt';

    const read = readBundle(broken);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(describeImportIssues(read.issues)).toContain('is not included in this file');
  });

  it('accepts a file without optional lists', () => {
    const read = readBundle({
      format: PROMPT_FILE_FORMAT,
      version: 1,
      manifest: {
        app: 'PromptForge',
        appVersion: '0.1.0',
        exportedAt: '2026-10-25T09:30:00.000Z',
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
      prompts: [
        {
          id: 'p1',
          title: 'Bare prompt',
          description: '',
          content: createBlankDocument({ name: 'Bare prompt' }),
          format: 'json',
          folderId: null,
          collectionIds: [],
          tags: [],
          favorite: false,
          pinned: false,
          archived: false,
          status: 'draft',
          createdAt: '2026-10-20T09:00:00.000Z',
          updatedAt: '2026-10-20T09:00:00.000Z',
          schemaId: null,
          variables: [],
          metadata: {},
          version: 1,
        },
      ],
    });

    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.folders).toEqual([]);
    expect(read.value.templates).toEqual([]);
  });

  it('warns, but still reads, when the manifest counts are wrong', () => {
    const original = exported();
    const wrong = JSON.parse(serializeBundle(original)) as {
      manifest: { counts: { prompts: number } };
    };
    wrong.manifest.counts.prompts = 42;

    const read = readBundle(wrong);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.prompts).toHaveLength(2);

    const warnings = read.issues.filter((issue) => issue.severity === 'warning');
    expect(warnings.map((issue) => issue.message).join(' ')).toContain('the file holds 2');
  });

  it('rebuilds records from known fields only, dropping unknown keys', () => {
    const original = exported();
    const tampered = JSON.parse(serializeBundle(original)) as {
      prompts: Record<string, unknown>[];
    };
    tampered.prompts[0]!['__proto__'] = { polluted: true };
    tampered.prompts[0]!['unexpected'] = 'ignored';

    const read = readBundle(tampered);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(Object.keys(read.value.prompts[0]!)).not.toContain('unexpected');
  });

  it('never accepts an imported template as built in', () => {
    const original = exported();
    const tampered = JSON.parse(serializeBundle(original)) as {
      templates: Record<string, unknown>[];
    };
    tampered.templates[0]!['isBuiltIn'] = true;

    const read = readBundle(tampered);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.templates[0]?.isBuiltIn).toBe(false);
  });
});

describe('detectTransferFormat', () => {
  it('recognises both export markers', () => {
    expect(detectTransferFormat({ format: BUNDLE_FORMAT })).toBe('bundle');
    expect(detectTransferFormat({ format: PROMPT_FILE_FORMAT })).toBe('prompt-file');
  });

  it('recognises a raw document, with or without a schema version', () => {
    expect(detectTransferFormat(createBlankDocument())).toBe('document');
    expect(detectTransferFormat({ name: 'Loose', instructions: [] })).toBe('document');
  });

  it('returns null for anything else', () => {
    expect(detectTransferFormat(null)).toBeNull();
    expect(detectTransferFormat([1, 2, 3])).toBeNull();
    expect(detectTransferFormat({ name: 'Only a name' })).toBeNull();
  });
});

describe('describeImportIssues', () => {
  it('caps the detail so the message stays readable', () => {
    const issues = Array.from({ length: 20 }, (_, index) => ({
      path: `prompts[${index}]`,
      message: 'Broken.',
      severity: 'error' as const,
    }));

    const message = describeImportIssues(issues);
    expect(message).toContain('and 8 more');
  });

  it('is empty when there are no issues', () => {
    expect(describeImportIssues([])).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* Record validation (TASK-026)                                               */
/* -------------------------------------------------------------------------- */

/**
 * One parsed export, ready to be broken one field at a time.
 *
 * The reader has to survive anything a person can put in a file: a wrong type, a
 * missing key, a record that is not an object at all. Each test below breaks one
 * record and asserts the reader names the exact field instead of throwing or
 * silently inventing a value.
 */
function jsonBundle() {
  return JSON.parse(serializeBundle(exported())) as {
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

function errorPaths(value: unknown): string[] {
  const read = readBundle(value);
  expect(read.ok).toBe(false);
  if (read.ok) return [];
  return read.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.path);
}

describe('readBundle — record validation (TASK-026)', () => {
  it('rejects a prompt whose fields are the wrong type', () => {
    const broken = jsonBundle();
    const prompt = broken.prompts[0]!;
    prompt['title'] = 7;
    prompt['createdAt'] = 'yesterday';
    prompt['updatedAt'] = '';
    prompt['favorite'] = 'yes';
    prompt['pinned'] = 1;
    prompt['archived'] = null;
    prompt['folderId'] = 42;
    prompt['collectionIds'] = 'billing';
    prompt['tags'] = ['ok', 9];
    prompt['metadata'] = { owner: 'ops', score: 3 };
    prompt['variables'] = 'nope';

    expect(errorPaths(broken)).toEqual(
      expect.arrayContaining([
        'prompts[0].title',
        'prompts[0].createdAt',
        'prompts[0].updatedAt',
        'prompts[0].favorite',
        'prompts[0].pinned',
        'prompts[0].archived',
        'prompts[0].folderId',
        'prompts[0].collectionIds',
        'prompts[0].tags[1]',
        'prompts[0].metadata.score',
        'prompts[0].variables',
      ]),
    );
  });

  it('rejects a prompt whose status, format, or version cannot be stored', () => {
    const broken = jsonBundle();
    const prompt = broken.prompts[0]!;
    prompt['status'] = 'live';
    prompt['format'] = 'yaml';
    prompt['version'] = 0;

    expect(errorPaths(broken)).toEqual(
      expect.arrayContaining(['prompts[0].status', 'prompts[0].format', 'prompts[0].version']),
    );

    const fractional = jsonBundle();
    fractional.prompts[0]!['version'] = 1.5;
    expect(errorPaths(fractional)).toContain('prompts[0].version');
  });

  it('rejects variables it cannot describe, and keeps the ones it can', () => {
    const broken = jsonBundle();
    broken.prompts[0]!['variables'] = [
      'tone',
      { name: 'tone', type: 'date', required: true },
      { name: 'count', type: 'number', required: 'yes' },
      { name: 7, type: 'string', required: false },
    ];

    expect(errorPaths(broken)).toEqual(
      expect.arrayContaining([
        'prompts[0].variables[0]',
        'prompts[0].variables[1].type',
        'prompts[0].variables[2].required',
        'prompts[0].variables[3].name',
      ]),
    );
  });

  it('keeps a variable default and description when they are there', () => {
    const bundle = jsonBundle();
    bundle.prompts[0]!['variables'] = [
      { name: 'tone', type: 'string', required: false, defaultValue: 'calm', description: 'Voice' },
      { name: 'count', type: 'number', required: true },
    ];

    const read = readBundle(bundle);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(read.value.prompts[0]!.variables).toEqual([
      { name: 'tone', type: 'string', required: false, defaultValue: 'calm', description: 'Voice' },
      { name: 'count', type: 'number', required: true },
    ]);
  });

  it('rejects a revision it cannot read', () => {
    const broken = jsonBundle();
    const revision = broken.revisions[0]!;
    revision['revisionNumber'] = 0;
    revision['kind'] = 'auto';
    revision['tagsSnapshot'] = 'tags';
    revision['id'] = 5;
    revision['promptId'] = null;
    revision['createdAt'] = 'later';

    expect(errorPaths(broken)).toEqual(
      expect.arrayContaining([
        'revisions[0].revisionNumber',
        'revisions[0].kind',
        'revisions[0].tagsSnapshot',
        'revisions[0].id',
        'revisions[0].promptId',
        'revisions[0].createdAt',
      ]),
    );
  });

  it('rejects records that are not objects', () => {
    const broken = jsonBundle();
    const loose = broken as unknown as Record<string, unknown[]>;
    loose['prompts'] = ['a prompt'];
    loose['revisions'] = [[]];
    loose['folders'] = [null];
    loose['collections'] = [1];
    loose['schemas'] = ['schema'];
    loose['snippets'] = [true];
    loose['templates'] = [3];
    loose['testCases'] = [[]];

    expect(errorPaths(broken)).toEqual(
      expect.arrayContaining([
        'prompts[0]',
        'revisions[0]',
        'folders[0]',
        'collections[0]',
        'schemas[0]',
        'snippets[0]',
        'templates[0]',
        'testCases[0]',
      ]),
    );
  });

  it('rejects a snippet with no value and a schema whose content is not an object', () => {
    const broken = jsonBundle();
    delete broken.snippets[0]!['value'];
    broken.schemas[0]!['schemaContent'] = [];

    expect(errorPaths(broken)).toEqual(
      expect.arrayContaining(['snippets[0].value', 'schemas[0].schemaContent']),
    );
  });

  it('rejects a folder whose parent is not in the file', () => {
    const broken = jsonBundle();
    broken.folders[1]!['parentId'] = 'missing-parent';

    expect(errorPaths(broken)).toContain('folders[1].parentId');
  });

  it('rejects references to collections, schemas, and snippets the file omits', () => {
    const broken = jsonBundle();
    const prompt = broken.prompts[0]!;
    prompt['collectionIds'] = ['missing-collection'];
    prompt['schemaId'] = 'missing-schema';
    prompt['content'] = createBlankDocument({ name: 'Invoice extractor', includes: ['gone'] });

    expect(errorPaths(broken)).toEqual(
      expect.arrayContaining([
        'prompts[0].collectionIds',
        'prompts[0].schemaId',
        'prompts[0].content.includes',
      ]),
    );
  });

  it('rejects a test case expecting a schema the file does not carry', () => {
    const broken = jsonBundle();
    broken.testCases[0]!['expectedStructure'] = 'missing-schema';

    expect(errorPaths(broken)).toContain('testCases[0].expectedStructure');
  });

  it('rejects an envelope without a manifest, counts, or scope', () => {
    expect(errorPaths({ format: BUNDLE_FORMAT, version: TRANSFER_VERSION })).toContain('manifest');

    expect(errorPaths({ format: BUNDLE_FORMAT, version: TRANSFER_VERSION, manifest: {} })).toEqual(
      expect.arrayContaining(['manifest.counts', 'manifest.scope', 'manifest.exportedAt']),
    );

    expect(
      errorPaths({
        format: BUNDLE_FORMAT,
        version: TRANSFER_VERSION,
        manifest: {
          counts: { prompts: -1, revisions: 0.5 },
          scope: 'everything',
          exportedAt: FIXTURE_NOW.toISOString(),
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'manifest.counts.prompts',
        'manifest.counts.revisions',
        'manifest.counts.folders',
        'manifest.scope',
      ]),
    );
  });

  it('rejects a record list that is not an array', () => {
    const broken = jsonBundle() as unknown as Record<string, unknown>;
    broken['prompts'] = { 0: 'not a list' };
    broken['revisions'] = 'none';

    expect(errorPaths(broken)).toEqual(expect.arrayContaining(['prompts', 'revisions']));
  });

  it('rejects a top-level value that is not a JSON object', () => {
    for (const value of ['a file', [], null, 42]) {
      expect(errorPaths(value)).toEqual(['']);
    }
  });

  it('fills in the optional manifest fields instead of failing', () => {
    const bare = {
      format: BUNDLE_FORMAT,
      version: TRANSFER_VERSION,
      manifest: {
        app: '',
        scope: 'library',
        exportedAt: FIXTURE_NOW.toISOString(),
        counts: countBundleRecords(exported()),
      },
    };

    const read = readBundle(bare);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(read.value.manifest.app).toBe('PromptForge');
    expect(read.value.manifest.appVersion).toBe('unknown');
    expect(read.value.manifest.fidelity).toEqual([]);
    expect(read.value.prompts).toEqual([]);
  });

  it('tolerates prompt fields that are simply absent', () => {
    const bundle = jsonBundle();
    const prompt = bundle.prompts[0]!;
    for (const key of [
      'description',
      'favorite',
      'pinned',
      'archived',
      'folderId',
      'collectionIds',
      'tags',
      'variables',
      'metadata',
    ]) {
      delete prompt[key];
    }
    prompt['schemaId'] = '';

    const read = readBundle(bundle);
    expect(read.ok).toBe(true);
    if (!read.ok) return;

    expect(read.value.prompts[0]).toMatchObject({
      description: '',
      favorite: false,
      pinned: false,
      archived: false,
      folderId: null,
      collectionIds: [],
      tags: [],
      variables: [],
      metadata: {},
      schemaId: null,
    });
  });
});
