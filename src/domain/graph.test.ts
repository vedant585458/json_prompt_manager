import { describe, expect, it } from 'vitest';

import { SNIPPET_TARGETS } from '@/domain/composer';
import { createPromptSchema, createSnippet, createTemplate } from '@/domain/factories';
import {
  BLUEPRINT_COLUMNS,
  BLUEPRINT_LEGEND,
  BLUEPRINT_LIMITS,
  SNIPPET_TARGET_SECTIONS,
  buildBlueprint,
  describeBlueprint,
  describeNodeKind,
  hasEnoughStructure,
  sectionIdForPath,
  type BlueprintGraph,
  type BlueprintNode,
} from '@/domain/graph';
import { createBlankDocument } from '@/domain/promptDocument';
import type { PromptDocument, PromptSchema, Snippet } from '@/domain/types';

const NOW = new Date('2026-10-24T09:00:00.000Z');
const PROMPT_ID = 'p-1';

function deps(prefix = 'id') {
  let counter = 0;
  return { now: () => NOW, newId: () => `${prefix}-${++counter}` };
}

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective: 'Queue the {{ticket}} for {{team}}.',
    instructions: ['Read the ticket.', 'Return the queue for {{team}}.'],
    constraints: ['Never invent a value.'],
    variables: [
      { name: 'ticket', type: 'string', required: true },
      { name: 'team', type: 'string', required: true, defaultValue: 'general' },
    ],
    output: { format: 'json' },
    ...overrides,
  });
}

function snippet(overrides: { name?: string; targetPath?: string } = {}): Snippet {
  return createSnippet(
    {
      name: overrides.name ?? 'Tone rules',
      description: 'How to sound.',
      targetPath: overrides.targetPath ?? 'instructions',
      value: ['Be brief.'],
    },
    deps('snippet'),
  );
}

function build(overrides: Partial<Parameters<typeof buildBlueprint>[0]> = {}): BlueprintGraph {
  return buildBlueprint({
    document: documentWith(),
    promptId: PROMPT_ID,
    attachedSchema: null,
    snippets: [],
    ...overrides,
  });
}

function node(graph: BlueprintGraph, id: string): BlueprintNode {
  const found = graph.nodes.find((candidate) => candidate.id === id);
  if (!found)
    throw new Error(`Missing node ${id}; have ${graph.nodes.map((n) => n.id).join(', ')}`);
  return found;
}

function ids(graph: BlueprintGraph): string[] {
  return graph.nodes.map((entry) => entry.id);
}

describe('blueprint sections', () => {
  it('lists only the sections the document actually fills, in document order', () => {
    const graph = build();

    expect(
      graph.nodes.filter((entry) => entry.column === 'structure').map((entry) => entry.id),
    ).toEqual([
      'section:role',
      'section:objective',
      'section:instructions',
      'section:constraints',
      'section:output',
    ]);
  });

  it('omits empty sections instead of drawing placeholders for them', () => {
    const graph = build({ document: documentWith({ role: '', constraints: [], objective: '' }) });

    expect(ids(graph)).not.toContain('section:role');
    expect(ids(graph)).not.toContain('section:objective');
    expect(ids(graph)).not.toContain('section:constraints');
    expect(ids(graph)).toContain('section:instructions');
  });

  it('describes a section by what it holds', () => {
    const graph = build();

    expect(node(graph, 'section:instructions')).toMatchObject({
      kind: 'section',
      label: 'Instructions',
      detail: '2 steps',
      unresolved: false,
      target: { kind: 'section', path: 'instructions' },
    });
    expect(node(graph, 'section:objective').detail).toBe(
      `${'Queue the {{ticket}} for {{team}}.'.length} characters`,
    );
  });

  it('describes every kind of section content in words', () => {
    const graph = build({
      document: documentWith({
        context: {
          description: 'Ticket history.',
          references: ['Policy doc'],
          data: { region: 'eu' },
        },
        examples: [{ input: 'A', output: 'B' }],
        metadata: { author: 'Ada', tags: ['support', 'triage'], notes: 'Draft' },
        extras: { experimental: true },
      }),
    });

    expect(node(graph, 'section:context').detail).toBe(
      'description · 1 reference · structured data',
    );
    expect(node(graph, 'section:examples').detail).toBe('1 example');
    expect(node(graph, 'section:metadata').detail).toBe('author · 2 tags · notes');
    expect(node(graph, 'section:extras').detail).toBe('1 unknown field');
  });

  it('keeps the format node about the format and gives the schemaRef its own node', () => {
    const graph = build({
      document: documentWith({ output: { format: 'markdown', schemaRef: 'schema-9' } }),
    });

    expect(node(graph, 'output:format').detail).toBe('markdown');
    expect(node(graph, 'output:schema-ref')).toMatchObject({
      kind: 'schema',
      column: 'output',
      detail: 'declared in the document',
      unresolved: false,
    });
  });

  it('summarises a variable default to fit a node', () => {
    const graph = build({
      document: documentWith({
        variables: [
          { name: 'a', type: 'string', required: false, defaultValue: '  hello  world ' },
          { name: 'b', type: 'string', required: false, defaultValue: '' },
          { name: 'c', type: 'json', required: false, defaultValue: [1, 2, 3] },
          { name: 'd', type: 'json', required: false, defaultValue: { k: 1 } },
          { name: 'e', type: 'string', required: false, defaultValue: null },
          { name: 'f', type: 'number', required: false, defaultValue: 7 },
        ],
      }),
    });

    expect(node(graph, 'variable:a').meta).toContainEqual({
      label: 'Default',
      value: 'hello world',
    });
    expect(node(graph, 'variable:b').meta).toContainEqual({ label: 'Default', value: '(empty)' });
    expect(node(graph, 'variable:c').meta).toContainEqual({ label: 'Default', value: '3 items' });
    expect(node(graph, 'variable:d').meta).toContainEqual({ label: 'Default', value: '1 keys' });
    expect(node(graph, 'variable:e').meta).toContainEqual({ label: 'Default', value: 'null' });
    expect(node(graph, 'variable:f').meta).toContainEqual({ label: 'Default', value: '7' });
  });

  it('carries a variable description into the inspector details', () => {
    const graph = build({
      document: documentWith({
        variables: [{ name: 'ticket', type: 'string', required: true, description: 'Ticket id' }],
      }),
    });

    expect(node(graph, 'variable:ticket').meta).toContainEqual({
      label: 'Description',
      value: 'Ticket id',
    });
  });

  it('names the variables each section uses', () => {
    const graph = build();

    expect(node(graph, 'section:objective').meta).toContainEqual({
      label: 'Uses',
      value: 'ticket, team',
    });
    expect(node(graph, 'section:constraints').meta).toContainEqual({
      label: 'Uses',
      value: 'no variables',
    });
  });

  it('maps a document path to the section that owns it', () => {
    expect(sectionIdForPath('objective')).toBe('objective');
    expect(sectionIdForPath('instructions[2]')).toBe('instructions');
    expect(sectionIdForPath('context.description')).toBe('context');
    expect(sectionIdForPath('metadata.notes')).toBe('metadata');
    expect(sectionIdForPath('something.else')).toBe('extras');
  });
});

describe('blueprint inputs', () => {
  it('lists declared variables in declaration order with their declaration', () => {
    const graph = build();

    expect(ids(graph).filter((id) => id.startsWith('variable:'))).toEqual([
      'variable:ticket',
      'variable:team',
    ]);
    expect(node(graph, 'variable:team')).toMatchObject({
      kind: 'variable',
      column: 'inputs',
      label: '{{team}}',
      detail: 'string · required',
      target: { kind: 'playground', promptId: PROMPT_ID },
    });
    expect(node(graph, 'variable:team').meta).toEqual(
      expect.arrayContaining([
        { label: 'Type', value: 'string' },
        { label: 'Required', value: 'yes' },
        { label: 'Default', value: 'general' },
      ]),
    );
  });

  it('says so when a declared variable is never used, and draws no edges for it', () => {
    const graph = build({
      document: documentWith({
        objective: 'Queue the {{ticket}}.',
        instructions: ['Return the queue.'],
        variables: [
          { name: 'ticket', type: 'string', required: true },
          { name: 'spare', type: 'string', required: false },
        ],
      }),
    });

    expect(node(graph, 'variable:spare').detail).toBe('string · optional · unused');
    expect(node(graph, 'variable:spare').meta).toContainEqual({
      label: 'Used in',
      value: 'nowhere yet',
    });
    expect(graph.edges.filter((edge) => edge.from === 'variable:spare')).toEqual([]);
  });

  it('marks a placeholder that was never declared as unresolved', () => {
    const graph = build({
      document: documentWith({ objective: 'Queue the {{ticket}} for {{ghost}}.' }),
    });

    expect(node(graph, 'undeclared:ghost')).toMatchObject({
      kind: 'reference',
      label: '{{ghost}}',
      detail: 'not declared',
      unresolved: true,
    });
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        from: 'undeclared:ghost',
        to: 'section:objective',
        kind: 'reference',
      }),
    );
  });

  it('marks an unusable placeholder with the reason and its field', () => {
    const graph = build({
      document: documentWith({ objective: 'Queue {{ticket} now.' }),
    });

    const problem = graph.nodes.find((entry) => entry.kind === 'reference' && entry.unresolved);
    expect(problem).toBeDefined();
    expect(problem?.detail).toContain('unusable placeholder');
    expect(problem?.meta).toContainEqual({ label: 'Field', value: 'objective' });
    expect(problem?.target).toEqual({ kind: 'section', path: 'objective' });
  });

  it('links an included snippet to the section it writes to', () => {
    const tone = snippet({ name: 'Tone rules', targetPath: 'instructions' });
    const graph = build({
      document: documentWith({ includes: [tone.id] }),
      snippets: [tone],
    });

    expect(node(graph, `snippet:${tone.id}`)).toMatchObject({
      kind: 'snippet',
      label: 'Tone rules',
      detail: 'snippet · writes Instructions',
      unresolved: false,
      target: { kind: 'snippets', promptId: PROMPT_ID },
    });
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        from: `snippet:${tone.id}`,
        to: 'section:instructions',
        kind: 'reference',
      }),
    );
  });

  it('flags an included snippet that no longer exists', () => {
    const graph = build({ document: documentWith({ includes: ['gone'] }) });

    expect(node(graph, 'missing-snippet:gone')).toMatchObject({
      label: 'Missing snippet',
      detail: 'gone',
      unresolved: true,
    });
    expect(graph.edges.filter((edge) => edge.from === 'missing-snippet:gone')).toEqual([]);
  });

  it('flags a snippet whose target the blueprint does not recognise', () => {
    const odd = snippet({ name: 'Odd', targetPath: 'not-a-field' });
    const graph = build({ document: documentWith({ includes: [odd.id] }), snippets: [odd] });

    expect(node(graph, `snippet:${odd.id}`).unresolved).toBe(true);
    expect(node(graph, `snippet:${odd.id}`).detail).toBe('snippet · writes not-a-field');
  });

  it('maps every composer snippet target to a section', () => {
    for (const target of SNIPPET_TARGETS) {
      expect(
        SNIPPET_TARGET_SECTIONS[target.id],
        `${target.id} needs a blueprint section`,
      ).toBeDefined();
    }
  });

  it('records a template origin only when the metadata names one that exists', () => {
    const template = createTemplate(
      { name: 'Support blueprint', content: documentWith(), category: 'Support' },
      deps('template'),
    );

    const known = build({ templates: [template], metadata: { templateId: template.id } });
    expect(node(known, 'origin:template')).toMatchObject({
      kind: 'origin',
      label: 'Support blueprint',
      unresolved: false,
      target: { kind: 'templates' },
    });

    const unknown = build({ templates: [], metadata: { template: 'Retired blueprint' } });
    expect(node(unknown, 'origin:template')).toMatchObject({
      label: 'Unknown template',
      unresolved: true,
    });

    const absent = build();
    expect(ids(absent)).not.toContain('origin:template');
  });
});

describe('blueprint output', () => {
  it('always shows the declared format', () => {
    const graph = build();

    expect(node(graph, 'output:format')).toMatchObject({
      kind: 'format',
      column: 'output',
      label: 'Output format',
      detail: 'json',
    });
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ from: 'section:output', to: 'output:format', kind: 'contains' }),
    );
  });

  it('shows the attached schema by name', () => {
    const schema: PromptSchema = createPromptSchema(
      { name: 'Triage schema', schemaContent: { type: 'object' } },
      deps('schema'),
    );

    const graph = build({ attachedSchema: schema, attachedSchemaId: schema.id });

    expect(node(graph, 'output:schema')).toMatchObject({
      kind: 'schema',
      label: 'Triage schema',
      detail: 'attached schema',
      unresolved: false,
      target: { kind: 'validation' },
    });
  });

  it('flags an attachment that points at a schema that is gone', () => {
    const graph = build({ attachedSchema: null, attachedSchemaId: 'schema-gone' });

    expect(node(graph, 'output:schema')).toMatchObject({
      label: 'Missing schema',
      detail: 'schema-gone',
      unresolved: true,
    });
  });

  it('shows a document schemaRef and whether it matches the attachment', () => {
    const schema = createPromptSchema(
      { name: 'Out', schemaContent: { type: 'object' } },
      deps('schema'),
    );

    const matching = build({
      document: documentWith({ output: { format: 'json', schemaRef: schema.id } }),
      attachedSchema: schema,
      attachedSchemaId: schema.id,
    });
    expect(node(matching, 'output:schema-ref').detail).toBe('matches the attachment');
    expect(node(matching, 'output:schema-ref').unresolved).toBe(false);

    const different = build({
      document: documentWith({ output: { format: 'json', schemaRef: 'schema-other' } }),
      attachedSchema: schema,
      attachedSchemaId: schema.id,
    });
    expect(node(different, 'output:schema-ref')).toMatchObject({
      detail: 'declared in the document',
      unresolved: true,
    });
  });
});

describe('blueprint layout', () => {
  it('produces identical geometry for identical input', () => {
    const first = build();
    const second = build();

    expect(second).toEqual(first);
  });

  it('places one column per stage at a fixed x', () => {
    const graph = build();
    const { nodeWidth, nodeHeight, columnGap, padding } = BLUEPRINT_LIMITS;

    for (const entry of graph.nodes) {
      const index = BLUEPRINT_COLUMNS.findIndex((column) => column.id === entry.column);
      expect(entry.x).toBe(padding + index * (nodeWidth + columnGap));
      expect(entry.width).toBe(nodeWidth);
      expect(entry.height).toBe(nodeHeight);
    }
  });

  it('stacks rows downward without overlaps and centres each column', () => {
    const graph = build();

    for (const column of BLUEPRINT_COLUMNS) {
      const entries = graph.nodes.filter((entry) => entry.column === column.id);
      for (let index = 1; index < entries.length; index += 1) {
        const previous = entries[index - 1]!;
        const current = entries[index]!;
        expect(current.row).toBe(previous.row + 1);
        expect(current.y).toBeGreaterThan(previous.y + previous.height - 1);
      }
    }

    // The output column has two nodes, the structure column five: the shorter
    // column starts lower so both are centred in the canvas.
    expect(node(graph, 'output:format').y).toBeGreaterThan(node(graph, 'section:role').y);
  });

  it('sizes the canvas from the grid rather than from the content', () => {
    const graph = build();
    const { nodeWidth, columnGap, padding } = BLUEPRINT_LIMITS;
    const expectedWidth =
      padding * 2 +
      BLUEPRINT_COLUMNS.length * nodeWidth +
      (BLUEPRINT_COLUMNS.length - 1) * columnGap;

    expect(graph.width).toBe(expectedWidth);

    const bottom = Math.max(...graph.nodes.map((entry) => entry.y + entry.height));
    expect(graph.height).toBe(bottom + padding);
  });

  it('draws each edge from the right edge of its source to the left edge of its target', () => {
    const graph = build();
    expect(graph.edges.length).toBeGreaterThan(0);

    for (const edge of graph.edges) {
      const from = node(graph, edge.from);
      const to = node(graph, edge.to);

      expect(edge.x1).toBe(from.x + from.width);
      expect(edge.y1).toBe(from.y + from.height / 2);
      expect(edge.x2).toBe(to.x);
      expect(edge.y2).toBe(to.y + to.height / 2);
      expect(edge.x1).toBeLessThanOrEqual(edge.x2);
    }
  });

  it('never repeats an edge and never points at a node that is not drawn', () => {
    const graph = build({ document: documentWith({ objective: '{{ticket}} and {{ticket}}' }) });
    const keys = graph.edges.map((edge) => `${edge.from}->${edge.to}`);
    const nodeIds = new Set(graph.nodes.map((entry) => entry.id));

    expect(new Set(keys).size).toBe(keys.length);
    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });
});

describe('blueprint limits and summary', () => {
  it('suppresses a graph that is too simple to be worth drawing', () => {
    const simple = build({
      document: documentWith({
        role: '',
        objective: '',
        instructions: [],
        constraints: [],
        variables: [],
      }),
    });

    // An empty document still has an output section and its format: two nodes,
    // below the threshold, so the panel offers prose instead of a picture.
    expect(simple.nodes.map((entry) => entry.id)).toEqual(['section:output', 'output:format']);
    expect(hasEnoughStructure(simple)).toBe(false);

    const full = build();
    expect(hasEnoughStructure(full)).toBe(true);
  });

  it('keeps unresolved nodes when the node cap bites, and says what it dropped', () => {
    const variables = Array.from({ length: 80 }, (_, index) => ({
      name: `v${index}`,
      type: 'string' as const,
      required: false,
    }));
    const graph = build({
      document: documentWith({
        variables,
        objective: `${variables.map((variable) => `{{${variable.name}}}`).join(' ')} {{missing}}`,
      }),
    });

    expect(graph.nodes.length).toBeLessThanOrEqual(BLUEPRINT_LIMITS.maxNodes);
    expect(graph.truncated).toBe(true);
    expect(graph.droppedNodes).toBeGreaterThan(0);
    expect(ids(graph)).toContain('undeclared:missing');
  });

  it('describes what the blueprint contains in one line', () => {
    expect(describeBlueprint(build())).toBe('2 inputs, 5 sections, 1 output node.');

    const unresolved = build({
      document: documentWith({ objective: 'Queue the {{ticket}} for {{ghost}}.' }),
    });
    expect(describeBlueprint(unresolved)).toContain('1 unresolved reference');
  });

  it('names every node kind in both the legend and the kind labels', () => {
    const kinds = [
      'variable',
      'snippet',
      'reference',
      'section',
      'format',
      'schema',
      'origin',
    ] as const;

    expect(BLUEPRINT_LEGEND.map((entry) => entry.kind).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      expect(describeNodeKind(kind)).toBe(
        BLUEPRINT_LEGEND.find((entry) => entry.kind === kind)?.label,
      );
    }
  });
});
