import { describe, expect, it } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import {
  QUALITY_LIMITS,
  QUALITY_RULES,
  QUALITY_THRESHOLDS,
  addDismissal,
  applyDismissals,
  countQuality,
  createDismissal,
  describeQualityRule,
  findingToText,
  findDuplicateJsonKeys,
  inspectQuality,
  isQualityDismissal,
  parseDismissals,
  qualityEvidence,
  qualityFingerprint,
  removeDismissal,
  summarizeQuality,
  type QualityDismissal,
  type QualityFinding,
} from '@/domain/quality';
import type { PromptDocument } from '@/domain/types';

const DISMISSED_AT = '2026-10-25T09:00:00.000Z';

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective: 'Classify each ticket.',
    instructions: ['Read the ticket.', 'Return the queue.'],
    constraints: ['Never invent a value.'],
    examples: [{ input: 'Ticket', output: 'Queue' }],
    variables: [{ name: 'ticket', type: 'string', required: true }],
    metadata: { notes: 'Draft' },
    ...overrides,
  });
}

/** A document with a role, instructions, an example, and a used variable. */
function healthy(): PromptDocument {
  return documentWith({ objective: 'Classify the {{ticket}}.' });
}

function inspect(overrides: Partial<Parameters<typeof inspectQuality>[0]> = {}) {
  const document = overrides.document ?? healthy();

  return inspectQuality({
    document,
    record: { description: 'Sorts tickets into queues.' },
    snippetIds: [],
    schemaIds: [],
    // Serializing the document gives the raw-text rule real input with no
    // repeated keys, so a clean document really produces no skips.
    rawText: JSON.stringify(document),
    ...overrides,
  });
}

function ruleIds(
  document: PromptDocument,
  overrides: Partial<Parameters<typeof inspectQuality>[0]> = {},
) {
  return inspect({ document, ...overrides }).findings.map((finding) => finding.ruleId);
}

function findingFor(document: PromptDocument, ruleId: string): QualityFinding {
  const found = inspect({ document }).findings.find((finding) => finding.ruleId === ruleId);
  if (!found) {
    throw new Error(
      `No ${ruleId} finding; have ${inspect({ document })
        .findings.map((finding) => finding.ruleId)
        .join(', ')}`,
    );
  }
  return found;
}

describe('quality rule catalogue', () => {
  it('declares every rule with its severity, classification, and caveat', () => {
    expect(QUALITY_RULES).toHaveLength(15);
    expect(new Set(QUALITY_RULES.map((rule) => rule.id)).size).toBe(QUALITY_RULES.length);

    for (const rule of QUALITY_RULES) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.checks.length).toBeGreaterThan(0);
      expect(rule.why.length).toBeGreaterThan(0);
      expect(rule.caveat.length).toBeGreaterThan(0);
      expect(['error', 'warning', 'info']).toContain(rule.severity);
      expect(describeQualityRule(rule.id)).toBe(rule.title);
    }
  });

  it('separates facts about the document from rules of thumb', () => {
    const heuristic = QUALITY_RULES.filter((rule) => rule.classification === 'heuristic');
    expect(heuristic.map((rule) => rule.id).sort()).toEqual([
      'examples-missing',
      'oversized-content',
      'role-missing',
    ]);
    // A heuristic is never an error: a rule of thumb cannot block anything.
    for (const rule of heuristic) expect(rule.severity).not.toBe('error');
  });

  it('states the thresholds it uses', () => {
    expect(QUALITY_THRESHOLDS).toEqual({
      objective: 800,
      instruction: 400,
      contextDescription: 1_000,
      notes: 800,
      document: 8_000,
    });
    expect(QUALITY_RULES.find((rule) => rule.id === 'oversized-content')?.checks).toContain('800');
  });

  it('finds nothing in a document that is complete', () => {
    const report = inspect();

    expect(report.findings).toEqual([]);
    expect(report.counts.total).toBe(0);
    // Every rule ran: none needed an input that was missing.
    expect(report.skipped).toEqual([]);
    expect(report.ran).toHaveLength(QUALITY_RULES.length);
    expect(summarizeQuality(report.findings)).toBe('No structural findings');
  });
});

describe('identity rules', () => {
  it('flags an empty name', () => {
    const finding = findingFor(documentWith({ name: '   ' }), 'name-missing');

    expect(finding).toMatchObject({
      severity: 'error',
      classification: 'deterministic',
      path: 'name',
      inDocument: true,
      evidence: '',
    });
    expect(finding.explanation).toContain('blank');
  });

  it('flags an empty objective and accepts a filled one', () => {
    expect(ruleIds(documentWith({ objective: '' }))).toContain('objective-missing');
    expect(ruleIds(documentWith({ objective: 'Classify the {{ticket}}.' }))).not.toContain(
      'objective-missing',
    );
  });

  it('flags missing instructions and accepts a single instruction', () => {
    expect(ruleIds(documentWith({ instructions: [] }))).toContain('instructions-empty');
    expect(ruleIds(documentWith({ instructions: ['Read it.'] }))).not.toContain(
      'instructions-empty',
    );
  });

  it('checks the record description only when the record is supplied', () => {
    const missing = inspect({
      document: healthy(),
      record: { description: '  ' },
    });
    expect(missing.findings.map((finding) => finding.ruleId)).toContain('description-missing');
    expect(
      missing.findings.find((finding) => finding.ruleId === 'description-missing'),
    ).toMatchObject({ path: 'description', inDocument: false, severity: 'warning' });

    const skipped = inspectQuality({ document: healthy(), snippetIds: [], schemaIds: [] });
    expect(skipped.findings.map((finding) => finding.ruleId)).not.toContain('description-missing');
    expect(skipped.skipped).toContainEqual({
      ruleId: 'description-missing',
      reason: 'The prompt record was not supplied, so the description was not read.',
    });
  });
});

describe('variable rules', () => {
  it('flags a placeholder that was never declared, naming where it appears', () => {
    const document = documentWith({
      objective: 'Classify the {{ticket}} as {{queue}}.',
      variables: [{ name: 'ticket', type: 'string', required: true }],
    });
    const finding = findingFor(document, 'undefined-variable');

    expect(finding.title).toBe('“queue” is used but never declared');
    expect(finding.path).toBe('objective');
    expect(finding.evidence).toBe('{{queue}}');
    expect(finding.severity).toBe('error');
    expect(finding.explanation).toContain('{{queue}}');
  });

  it('flags a declared variable the text never uses', () => {
    const document = documentWith({
      objective: 'Classify the {{ticket}}.',
      variables: [
        { name: 'ticket', type: 'string', required: true },
        { name: 'unused', type: 'number', required: false },
      ],
    });
    const finding = findingFor(document, 'unused-variable');

    expect(finding.title).toBe('“unused” is declared but never used');
    expect(finding.path).toBe('variables[1].name');
    expect(finding.severity).toBe('warning');
  });

  it('does not flag the same variable twice when it is used and declared', () => {
    const ids = ruleIds(documentWith({ objective: 'Use {{ticket}} twice: {{ticket}}.' }));
    expect(ids).not.toContain('undefined-variable');
    expect(ids).not.toContain('unused-variable');
  });

  it('reports each undeclared name once, not once per mention', () => {
    const report = inspect({
      document: documentWith({ objective: '{{ghost}} and {{ghost}} again in {{other}}.' }),
    });
    const undeclared = report.findings.filter((finding) => finding.ruleId === 'undefined-variable');

    expect(undeclared.map((finding) => finding.title).sort()).toEqual([
      '“ghost” is used but never declared',
      '“other” is used but never declared',
    ]);
  });
});

describe('list rules', () => {
  it('flags an instruction repeated with different case or spacing', () => {
    const document = documentWith({
      instructions: ['Read the ticket.', '  read   the TICKET. ', 'Return the queue.'],
    });
    const finding = findingFor(document, 'duplicate-instruction');

    expect(finding.path).toBe('instructions[1]');
    expect(finding.evidence).toBe('read the TICKET.');
    expect(finding.explanation).toContain('instructions[0]');
  });

  it('accepts instructions that merely look similar', () => {
    const document = documentWith({ instructions: ['Read the ticket.', 'Read the thread.'] });
    expect(ruleIds(document)).not.toContain('duplicate-instruction');
  });

  it('flags an unexpected top-level field for each key, alphabetically', () => {
    const report = inspect({
      document: documentWith({ extras: { zebra: true, alpha: 'x' } }),
    });
    const extras = report.findings.filter((finding) => finding.ruleId === 'unexpected-property');

    expect(extras.map((finding) => finding.path)).toEqual(['alpha', 'zebra']);
    expect(extras[0]?.severity).toBe('info');
    expect(extras[0]?.evidence).toBe('x');
  });
});

describe('repeated JSON keys', () => {
  it('finds a key repeated inside one object, with its path', () => {
    const text = '{\n  "metadata": { "notes": "a", "notes": "b" },\n  "name": "x"\n}';

    expect(findDuplicateJsonKeys(text)).toEqual([{ path: 'metadata.notes', key: 'notes' }]);
  });

  it('finds duplicates at the root, inside arrays, and at depth', () => {
    const text =
      '{"name":"a","name":"b","examples":[{"input":1,"input":2}],"context":{"data":{"k":1,"k":2}}}';

    expect(findDuplicateJsonKeys(text)).toEqual([
      { path: 'name', key: 'name' },
      { path: 'examples[0].input', key: 'input' },
      { path: 'context.data.k', key: 'k' },
    ]);
  });

  it('does not confuse the same key in different objects', () => {
    const text = '{"a":{"x":1},"b":{"x":2},"examples":[{"input":1},{"input":2}]}';

    expect(findDuplicateJsonKeys(text)).toEqual([]);
  });

  it('handles escapes, unicode escapes, and nested strings that look like keys', () => {
    const text = '{"a":{"k\\u0041y":1,"kAy":2},"b":"{\\"c\\":1,\\"c\\":2}","c":"","c":""}';

    expect(findDuplicateJsonKeys(text)).toEqual([
      { path: 'a.kAy', key: 'kAy' },
      { path: 'c', key: 'c' },
    ]);
  });

  it('reports a duplicate key as a warning finding from the raw text', () => {
    const report = inspect({
      rawText: '{"name":"Support triage","metadata":{"notes":"a","notes":"b"}}',
    });
    const finding = report.findings.find((entry) => entry.ruleId === 'duplicate-json-key');

    expect(finding).toMatchObject({
      path: 'metadata.notes',
      severity: 'warning',
      classification: 'deterministic',
    });
    expect(finding?.explanation).toContain('silently discarded');
  });

  it('skips the raw-text rule when no text is supplied, and says so', () => {
    const report = inspectQuality({ document: healthy(), snippetIds: [], schemaIds: [] });

    expect(report.findings.map((finding) => finding.ruleId)).not.toContain('duplicate-json-key');
    expect(report.skipped).toContainEqual({
      ruleId: 'duplicate-json-key',
      reason: 'The raw draft text was not supplied, so repeated keys could not be seen.',
    });
  });

  it('ignores text that is not valid JSON instead of guessing', () => {
    const report = inspect({ rawText: '{"name": ' });
    expect(report.findings.map((finding) => finding.ruleId)).not.toContain('duplicate-json-key');
  });
});

describe('output rules', () => {
  it('flags a string example under a JSON format', () => {
    const finding = findingFor(
      documentWith({ output: { format: 'json', example: 'not json' } }),
      'output-example-mismatch',
    );

    expect(finding.path).toBe('output.example');
    expect(finding.explanation).toContain('a string');
    expect(finding.suggestion).toContain('JSON object');
  });

  it('flags an object example under a text format', () => {
    const finding = findingFor(
      documentWith({ output: { format: 'text', example: { a: 1 } } }),
      'output-example-mismatch',
    );
    expect(finding.explanation).toContain('an object');
  });

  it('accepts an example that matches the format', () => {
    expect(ruleIds(documentWith({ output: { format: 'json', example: { a: 1 } } }))).not.toContain(
      'output-example-mismatch',
    );
    expect(
      ruleIds(documentWith({ output: { format: 'markdown', example: '# Title' } })),
    ).not.toContain('output-example-mismatch');
    expect(ruleIds(documentWith({ output: { format: 'json' } }))).not.toContain(
      'output-example-mismatch',
    );
  });

  it('flags a schema reference that is not stored', () => {
    const report = inspect({
      document: documentWith({ output: { format: 'json', schemaRef: 'schema-9' } }),
      schemaIds: ['schema-1'],
    });
    const finding = report.findings.find((entry) => entry.ruleId === 'missing-schema-reference');

    expect(finding).toMatchObject({ path: 'output.schemaRef', severity: 'error' });
    expect(finding?.evidence).toBe('schema-9');

    expect(
      inspect({
        document: documentWith({ output: { format: 'json', schemaRef: 'schema-1' } }),
        schemaIds: ['schema-1'],
      }).findings.map((entry) => entry.ruleId),
    ).not.toContain('missing-schema-reference');
  });

  it('skips the schema rule when the stored ids are unknown', () => {
    const report = inspectQuality({
      document: documentWith({ output: { format: 'json', schemaRef: 'x' } }),
    });
    expect(report.skipped.map((skip) => skip.ruleId)).toContain('missing-schema-reference');
  });
});

describe('snippet rules', () => {
  it('flags an included snippet that no longer exists', () => {
    const report = inspect({
      document: documentWith({ includes: ['snippet-gone'] }),
      snippetIds: ['snippet-kept'],
    });
    const finding = report.findings.find((entry) => entry.ruleId === 'missing-snippet');

    expect(finding).toMatchObject({
      path: 'includes',
      severity: 'error',
      evidence: 'snippet-gone',
    });
  });

  it('accepts includes that resolve, and skips the rule without the library', () => {
    expect(
      inspect({
        document: documentWith({ includes: ['snippet-kept'] }),
        snippetIds: ['snippet-kept'],
      }).findings.map((entry) => entry.ruleId),
    ).not.toContain('missing-snippet');

    expect(
      inspectQuality({ document: documentWith({ includes: ['anything'] }) }).skipped.map(
        (skip) => skip.ruleId,
      ),
    ).toContain('missing-snippet');
  });
});

describe('heuristic rules', () => {
  it('suggests a role and an example without calling them errors', () => {
    const report = inspect({ document: documentWith({ role: '', examples: [] }) });
    const suggestions = report.findings.filter((finding) => finding.classification === 'heuristic');

    expect(suggestions.map((finding) => finding.ruleId).sort()).toEqual([
      'examples-missing',
      'role-missing',
    ]);
    for (const finding of suggestions) expect(finding.severity).toBe('info');
  });

  it('flags a field past its threshold and quotes the size and the limit', () => {
    const long = 'a'.repeat(QUALITY_THRESHOLDS.instruction + 5);
    const finding = findingFor(
      documentWith({ instructions: ['Short one.', long] }),
      'oversized-content',
    );

    expect(finding.path).toBe('instructions[1]');
    expect(finding.title).toBe('Instruction 2 is past 400 characters');
    expect(finding.explanation).toContain('405 characters');
    expect(finding.severity).toBe('warning');
    expect(finding.classification).toBe('heuristic');
  });

  it('flags an oversized document by size rather than by text', () => {
    const document = documentWith({
      context: { data: { blob: 'x'.repeat(QUALITY_THRESHOLDS.document) } },
    });
    const oversized = inspect({ document }).findings.filter(
      (finding) => finding.ruleId === 'oversized-content',
    );

    expect(oversized.map((finding) => finding.path)).toContain('');
    expect(oversized.find((finding) => finding.path === '')?.evidence).toContain(
      'characters of JSON',
    );
  });

  it('accepts content that is under every threshold', () => {
    expect(
      ruleIds(documentWith({ instructions: ['a'.repeat(QUALITY_THRESHOLDS.instruction)] })),
    ).not.toContain('oversized-content');
  });
});

describe('threshold boundaries', () => {
  it('measures the objective, the context description, and the notes separately', () => {
    const document = documentWith({
      objective: `${'o'.repeat(QUALITY_THRESHOLDS.objective)} x`,
      context: { description: `${'c'.repeat(QUALITY_THRESHOLDS.contextDescription)} x` },
      metadata: { notes: `${'n'.repeat(QUALITY_THRESHOLDS.notes)} x` },
    });
    const paths = inspect({ document })
      .findings.filter((finding) => finding.ruleId === 'oversized-content')
      .map((finding) => finding.path);

    // Same rule, so the report's path ordering decides.
    expect(paths).toEqual(['context.description', 'metadata.notes', 'objective']);
  });

  it('leaves a field exactly at its threshold alone', () => {
    const document = documentWith({
      objective: `${'o'.repeat(QUALITY_THRESHOLDS.objective - '{{ticket}}'.length)}{{ticket}}`,
    });
    expect(ruleIds(document)).not.toContain('oversized-content');
  });
});

describe('repeated keys are read only as far as the text goes', () => {
  it('handles escaped quotes inside keys and values', () => {
    const text = '{"a":{"k\\"q":1,"k\\"q":2},"b":"a \\"quoted\\" value"}';
    expect(findDuplicateJsonKeys(text)).toEqual([{ path: 'a.k"q', key: 'k"q' }]);
  });

  it('reports a key repeated more than twice once', () => {
    expect(findDuplicateJsonKeys('{"a":1,"a":2,"a":3}')).toEqual([{ path: 'a', key: 'a' }]);
  });

  it('stops at truncated or malformed text instead of throwing', () => {
    expect(findDuplicateJsonKeys('{"a": "unterminated')).toEqual([]);
    expect(findDuplicateJsonKeys('{"a" 1}')).toEqual([]);
    expect(findDuplicateJsonKeys('{"a":1,"a":2')).toEqual([{ path: 'a', key: 'a' }]);
    expect(findDuplicateJsonKeys('')).toEqual([]);
  });

  it('knows a rule title falls back to its id', () => {
    expect(describeQualityRule('not-a-rule' as never)).toBe('not-a-rule');
  });
});

describe('report shape', () => {
  it('orders findings by severity, then rule, then path', () => {
    const report = inspect({
      document: documentWith({ role: '', objective: '', instructions: [] }),
    });

    expect(report.findings.map((finding) => finding.severity)).toEqual(
      [...report.findings.map((finding) => finding.severity)].sort(
        (left, right) =>
          ['error', 'warning', 'info'].indexOf(left) - ['error', 'warning', 'info'].indexOf(right),
      ),
    );
  });

  it('counts what it found, and the counts match the list', () => {
    const report = inspect({ document: documentWith({ role: '', objective: '' }) });

    expect(report.counts.total).toBe(report.findings.length);
    expect(report.counts.errors).toBe(report.findings.filter((f) => f.severity === 'error').length);
    expect(report.counts.suggestions).toBe(
      report.findings.filter((f) => f.severity === 'info').length,
    );
    expect(summarizeQuality(report.findings)).toMatch(/findings?: /);
  });

  it('gives every finding a stable id and a fingerprint over rule, path, and evidence', () => {
    const first = inspect({ document: documentWith({ role: '' }) }).findings[0];
    const second = inspect({ document: documentWith({ role: '' }) }).findings[0];

    expect(first?.id).toBe(second?.id);
    expect(first?.fingerprint).toBe(second?.fingerprint);
    expect(first?.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(qualityFingerprint('role-missing', 'role', '')).not.toBe(
      qualityFingerprint('examples-missing', 'examples', ''),
    );
  });

  it('caps the findings per rule and counts what it did not show', () => {
    const variables = Array.from({ length: QUALITY_LIMITS.maxFindingsPerRule + 5 }, (_, index) => ({
      name: `v${index}`,
      type: 'string' as const,
      required: false,
    }));
    const report = inspect({ document: documentWith({ variables }) });
    const unused = report.findings.filter((finding) => finding.ruleId === 'unused-variable');

    expect(unused).toHaveLength(QUALITY_LIMITS.maxFindingsPerRule);
    expect(report.dropped).toBe(5);
  });

  it('copies a finding as readable text', () => {
    const finding = findingFor(documentWith({ role: '' }), 'role-missing');
    const text = findingToText(finding);

    expect(text).toContain('Suggestion · No role is given');
    expect(text).toContain('Rule: role-missing (heuristic)');
    expect(text).toContain('Path: role');
    expect(text).toContain('Suggestion: Add a role');
  });

  it('clips evidence instead of copying a whole section', () => {
    const evidence = qualityEvidence('word '.repeat(200));

    expect(evidence.length).toBeLessThanOrEqual(QUALITY_LIMITS.evidenceChars);
    expect(evidence.endsWith('…')).toBe(true);
    expect(qualityEvidence({ a: 1 })).toBe('{"a":1}');
    expect(qualityEvidence('  a \n b ')).toBe('a b');
  });

  it('does not mutate the document it inspects', () => {
    const document = documentWith({ instructions: [], role: '' });
    const before = JSON.stringify(document);

    inspect({ document, rawText: '{"name":"x","name":"y"}' });
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe('dismissals', () => {
  const findingOf = (ruleId: string, document = documentWith({ role: '' })) =>
    findingFor(document, ruleId);

  function dismissalOf(
    finding: QualityFinding,
    reason = 'We want to keep it short.',
  ): QualityDismissal {
    const result = createDismissal(finding, reason, DISMISSED_AT);
    if (!result.ok) throw new Error(result.error);
    return result.dismissal;
  }

  it('requires a reason and caps its length', () => {
    const finding = findingOf('role-missing');

    expect(createDismissal(finding, '   ', DISMISSED_AT)).toMatchObject({ ok: false });
    expect(createDismissal(finding, 'no', DISMISSED_AT)).toMatchObject({ ok: false });
    expect(createDismissal(finding, '  no  ', DISMISSED_AT)).toMatchObject({ ok: false });
    expect(
      createDismissal(finding, 'x'.repeat(QUALITY_LIMITS.reasonChars + 1), DISMISSED_AT),
    ).toMatchObject({ ok: false });
  });

  it('builds a dismissal that names the rule, the fingerprint, and the reason', () => {
    const finding = findingOf('role-missing');

    expect(dismissalOf(finding, '  Deliberately voice-neutral.  ')).toEqual({
      ruleId: 'role-missing',
      fingerprint: finding.fingerprint,
      reason: 'Deliberately voice-neutral.',
      dismissedAt: DISMISSED_AT,
    });
  });

  it('hides the dismissed finding and keeps the rest visible', () => {
    const report = inspect({
      document: documentWith({ objective: 'Classify the {{ticket}}.', role: '', examples: [] }),
    });
    const role = report.findings.find((finding) => finding.ruleId === 'role-missing');
    const examples = report.findings.find((finding) => finding.ruleId === 'examples-missing');
    if (!role || !examples) throw new Error('Missing findings');

    const result = applyDismissals(report.findings, [dismissalOf(role)]);

    expect(result.visible.map((finding) => finding.ruleId)).toEqual(['examples-missing']);
    expect(result.dismissed).toEqual([{ finding: role, dismissal: dismissalOf(role) }]);
    expect(result.orphaned).toEqual([]);
  });

  it('keeps a dismissal when unrelated content changes', () => {
    const before = inspect({
      document: documentWith({ role: '', objective: 'Classify {{ticket}}.' }),
    });
    const role = before.findings.find((finding) => finding.ruleId === 'role-missing');
    if (!role) throw new Error('Missing role finding');

    const dismissal = dismissalOf(role);
    const after = inspect({ document: documentWith({ role: '', objective: 'Sort {{ticket}}.' }) });
    const result = applyDismissals(after.findings, [dismissal]);

    // The dismissal is about `role`, which did not change, so it still applies.
    expect(result.orphaned).toEqual([]);
    expect(result.visible.map((finding) => finding.ruleId)).not.toContain('role-missing');
    expect(result.dismissed).toHaveLength(1);
  });

  it('reports a dismissal whose finding is gone as orphaned, not as silence', () => {
    const role = findingFor(documentWith({ role: '' }), 'role-missing');
    const dismissal = dismissalOf(role);

    const result = applyDismissals(inspect().findings, [dismissal]);

    expect(result.visible).toEqual([]);
    expect(result.orphaned).toEqual([dismissal]);
  });

  it('re-surfaces the finding when the text it was about is edited', () => {
    const long = 'a'.repeat(QUALITY_THRESHOLDS.instruction + 1);
    const first = inspect({ document: documentWith({ instructions: ['Short.', long] }) });
    const oversized = first.findings.find((finding) => finding.ruleId === 'oversized-content');
    if (!oversized) throw new Error('Missing oversized finding');

    const dismissal = dismissalOf(oversized, 'The spec is meant to be long.');

    const hidden = applyDismissals(first.findings, [dismissal]);
    expect(hidden.visible.map((finding) => finding.ruleId)).not.toContain('oversized-content');

    const edited = inspect({
      document: documentWith({ instructions: ['Short.', `${long} more`] }),
    });
    const result = applyDismissals(edited.findings, [dismissal]);

    expect(result.visible.map((finding) => finding.ruleId)).toContain('oversized-content');
    expect(result.orphaned).toHaveLength(1);
  });

  it('adds, replaces, and removes dismissals without duplicating them', () => {
    const role = dismissalOf(findingOf('role-missing'));
    const examples = dismissalOf(findingOf('examples-missing', documentWith({ examples: [] })));

    const one = addDismissal([], role);
    expect(one).toEqual([role]);

    const replaced = addDismissal(one, { ...role, reason: 'New reason.' });
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.reason).toBe('New reason.');

    const two = addDismissal(replaced, examples);
    expect(two.map((entry) => entry.ruleId)).toEqual(['examples-missing', 'role-missing']);
    expect(removeDismissal(two, role.fingerprint)).toEqual([examples]);
    expect(removeDismissal(two, 'deadbeef')).toEqual(two);
  });

  it('caps the stored dismissals, keeping the newest', () => {
    let dismissals: QualityDismissal[] = [];
    for (let index = 0; index < QUALITY_LIMITS.maxDismissals + 3; index += 1) {
      dismissals = addDismissal(dismissals, {
        ruleId: 'role-missing',
        fingerprint: index.toString(16).padStart(8, '0'),
        reason: `Reason ${index}`,
        dismissedAt: DISMISSED_AT,
      });
    }

    expect(dismissals).toHaveLength(QUALITY_LIMITS.maxDismissals);
    expect(dismissals[0]?.reason).toBe(`Reason ${QUALITY_LIMITS.maxDismissals + 2}`);
  });

  it('rejects anything that is not a stored dismissal', () => {
    const valid = dismissalOf(findingOf('role-missing'));

    expect(isQualityDismissal(valid)).toBe(true);
    expect(isQualityDismissal(null)).toBe(false);
    expect(isQualityDismissal({ ...valid, ruleId: 'not-a-rule' })).toBe(false);
    expect(isQualityDismissal({ ...valid, fingerprint: 'nope' })).toBe(false);
    expect(isQualityDismissal({ ...valid, reason: '  ' })).toBe(false);
    expect(isQualityDismissal({ ...valid, dismissedAt: 'yesterday' })).toBe(false);
    expect(parseDismissals([valid, { broken: true }, null])).toEqual([valid]);
    expect(parseDismissals('not an array')).toEqual([]);
  });
});

describe('counting', () => {
  it('counts severities and classifications independently', () => {
    const report = inspect({ document: documentWith({ role: '', objective: '' }) });
    const counts = countQuality(report.findings);

    expect(counts.total).toBe(report.findings.length);
    expect(counts.errors + counts.warnings + counts.suggestions).toBe(counts.total);
    expect(counts.deterministic + counts.heuristic).toBe(counts.total);
  });
});
