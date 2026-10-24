/**
 * Blueprint derivation (TASK-023).
 *
 * A blueprint is a deterministic, read-only picture of how one prompt document
 * is assembled: which inputs feed it, which sections it has, and what it
 * outputs. It is derived from the document and the records it names — never
 * stored, never edited, and never guessed at.
 *
 * Everything here is pure: no React, no storage, no clock, no randomness. The
 * same document and the same records always produce byte-identical geometry,
 * which is what makes the layout testable and the screen stable across renders.
 */

import type {
  JsonValue,
  PromptDocument,
  PromptSchema,
  PromptTemplate,
  Snippet,
  VariableDefinition,
} from '@/domain/types';
import { extractVariableReferences, reconcileVariables } from '@/domain/variables';

export const BLUEPRINT_LIMITS = {
  /** Nodes beyond this are dropped (unresolved ones are kept first). */
  maxNodes: 60,
  /** Edges beyond this are dropped; the count is reported, not hidden. */
  maxEdges: 120,
  nodeWidth: 168,
  nodeHeight: 44,
  /** Reserved above the first row for the column titles. */
  headerHeight: 26,
  columnGap: 56,
  rowGap: 12,
  padding: 16,
  /** Below this many nodes a graph adds noise, so the panel offers prose. */
  minNodes: 3,
} as const;

export const BLUEPRINT_COLUMNS = [
  { id: 'inputs', title: 'Inputs', subtitle: 'Variables, snippets, and where this came from' },
  { id: 'structure', title: 'Structure', subtitle: 'The sections the document actually has' },
  { id: 'output', title: 'Output', subtitle: 'The format and schemas it declares' },
] as const;

export type BlueprintColumnId = (typeof BLUEPRINT_COLUMNS)[number]['id'];

export type BlueprintNodeKind =
  'variable' | 'snippet' | 'reference' | 'section' | 'format' | 'schema' | 'origin';

/** Where a node's "Open source" action goes. Only the UI turns these into links. */
export type BlueprintTarget =
  | { readonly kind: 'section'; readonly path: string }
  | { readonly kind: 'playground'; readonly promptId: string }
  | { readonly kind: 'snippets'; readonly promptId: string }
  | { readonly kind: 'validation' }
  | { readonly kind: 'templates' };

export interface BlueprintMeta {
  readonly label: string;
  readonly value: string;
}

export interface BlueprintNode {
  /** Stable across renders and across unrelated edits. */
  readonly id: string;
  readonly kind: BlueprintNodeKind;
  readonly column: BlueprintColumnId;
  readonly row: number;
  readonly label: string;
  /** One line shown under the label in both the graph and the list. */
  readonly detail: string;
  /** True when this node describes something the document needs but lacks. */
  readonly unresolved: boolean;
  /** Inspector rows, derived from the same data the node was derived from. */
  readonly meta: readonly BlueprintMeta[];
  readonly target: BlueprintTarget | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type BlueprintEdgeKind = 'reference' | 'contains';

export interface BlueprintEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: BlueprintEdgeKind;
  /** Right-centre of the source node. */
  readonly x1: number;
  readonly y1: number;
  /** Left-centre of the destination node. */
  readonly x2: number;
  readonly y2: number;
}

export interface BlueprintGraph {
  readonly nodes: readonly BlueprintNode[];
  readonly edges: readonly BlueprintEdge[];
  readonly width: number;
  readonly height: number;
  /** Unresolved references, missing snippets, and unusable placeholders. */
  readonly unresolvedCount: number;
  /** True when a node or edge cap dropped something. */
  readonly truncated: boolean;
  readonly droppedNodes: number;
  readonly droppedEdges: number;
}

export interface BlueprintInput {
  readonly document: PromptDocument;
  readonly promptId: string;
  /** The schema attached to the prompt record, already resolved. */
  readonly attachedSchema: PromptSchema | null;
  /** The schema id the prompt record points at, for a missing-schema node. */
  readonly attachedSchemaId?: string | null;
  readonly snippets: readonly Snippet[];
  readonly templates?: readonly PromptTemplate[];
  /** Custom prompt metadata; template origin is read from it when present. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

interface SectionDefinition {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly filled: (document: PromptDocument) => boolean;
  readonly detail: (document: PromptDocument) => string;
}

function nonEmpty(text: string | undefined): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

function listDetail(label: string, items: readonly string[]): string {
  return `${items.length} ${label}${items.length === 1 ? '' : 's'}`;
}

const SECTIONS: readonly SectionDefinition[] = [
  {
    id: 'role',
    title: 'Role',
    path: 'role',
    filled: (document) => nonEmpty(document.role),
    detail: (document) => `${document.role.trim().length.toLocaleString()} characters`,
  },
  {
    id: 'objective',
    title: 'Objective',
    path: 'objective',
    filled: (document) => nonEmpty(document.objective),
    detail: (document) => `${document.objective.trim().length.toLocaleString()} characters`,
  },
  {
    id: 'instructions',
    title: 'Instructions',
    path: 'instructions',
    filled: (document) => document.instructions.length > 0,
    detail: (document) => listDetail('step', document.instructions),
  },
  {
    id: 'context',
    title: 'Context',
    path: 'context',
    filled: (document) =>
      nonEmpty(document.context?.description) ||
      (document.context?.references?.length ?? 0) > 0 ||
      document.context?.data !== undefined,
    detail: (document) => {
      const parts: string[] = [];
      if (nonEmpty(document.context?.description)) parts.push('description');
      if ((document.context?.references?.length ?? 0) > 0) {
        parts.push(listDetail('reference', document.context.references ?? []));
      }
      if (document.context?.data !== undefined) parts.push('structured data');
      return parts.length > 0 ? parts.join(' · ') : 'empty';
    },
  },
  {
    id: 'constraints',
    title: 'Constraints',
    path: 'constraints',
    filled: (document) => document.constraints.length > 0,
    detail: (document) => listDetail('rule', document.constraints),
  },
  {
    id: 'output',
    title: 'Output',
    path: 'output',
    filled: () => true,
    detail: (document) =>
      `${document.output.format}${document.output.schemaRef ? ' · schema reference' : ''}`,
  },
  {
    id: 'examples',
    title: 'Examples',
    path: 'examples',
    filled: (document) => document.examples.length > 0,
    detail: (document) =>
      `${document.examples.length} example${document.examples.length === 1 ? '' : 's'}`,
  },
  {
    id: 'metadata',
    title: 'Metadata',
    path: 'metadata',
    filled: (document) =>
      nonEmpty(document.metadata?.author) ||
      nonEmpty(document.metadata?.notes) ||
      (document.metadata?.tags?.length ?? 0) > 0,
    detail: (document) => {
      const parts: string[] = [];
      if (nonEmpty(document.metadata?.author)) parts.push('author');
      if ((document.metadata?.tags?.length ?? 0) > 0) {
        parts.push(listDetail('tag', document.metadata.tags ?? []));
      }
      if (nonEmpty(document.metadata?.notes)) parts.push('notes');
      return parts.length > 0 ? parts.join(' · ') : 'empty';
    },
  },
  {
    id: 'extras',
    title: 'Extras',
    path: 'extras',
    filled: (document) => Object.keys(document.extras ?? {}).length > 0,
    detail: (document) => listDetail('unknown field', Object.keys(document.extras ?? {})),
  },
];

/**
 * Which section a snippet's target writes to.
 *
 * Kept in step with `SNIPPET_TARGETS` by a test: adding a target to the composer
 * without mapping it here would otherwise leave a snippet with no edge and no
 * explanation.
 */
export const SNIPPET_TARGET_SECTIONS: Readonly<Record<string, string>> = {
  role: 'role',
  objective: 'objective',
  'context.description': 'context',
  'context.references': 'context',
  instructions: 'instructions',
  constraints: 'constraints',
  'metadata.notes': 'metadata',
};

/** The section a document path belongs to, e.g. `context.description` → `context`. */
export function sectionIdForPath(path: string): string {
  const root = path.split(/[.[]/)[0] ?? '';
  return SECTIONS.some((section) => section.id === root) ? root : 'extras';
}

/* -------------------------------------------------------------------------- */
/* Derivation                                                                 */
/* -------------------------------------------------------------------------- */

interface NodeDraft {
  readonly id: string;
  readonly kind: BlueprintNodeKind;
  readonly column: BlueprintColumnId;
  readonly label: string;
  readonly detail: string;
  readonly unresolved: boolean;
  readonly meta: readonly BlueprintMeta[];
  readonly target: BlueprintTarget | null;
}

function summarizeContent(value: JsonValue): string {
  if (typeof value === 'string') {
    const text = value.replace(/\s+/g, ' ').trim();
    return text.length > 0 ? text : '(empty)';
  }
  if (Array.isArray(value)) return `${value.length} items`;
  if (value === null) return 'null';
  if (typeof value === 'object') return `${Object.keys(value).length} keys`;
  return String(value);
}

function variableNode(
  variable: VariableDefinition,
  sectionIds: readonly string[],
  promptId: string,
): NodeDraft {
  const meta: BlueprintMeta[] = [
    { label: 'Type', value: variable.type },
    { label: 'Required', value: variable.required ? 'yes' : 'no' },
  ];

  if (variable.defaultValue !== undefined) {
    meta.push({ label: 'Default', value: summarizeContent(variable.defaultValue) });
  }
  if (variable.description) meta.push({ label: 'Description', value: variable.description });

  meta.push({
    label: 'Used in',
    value: sectionIds.length > 0 ? sectionIds.join(', ') : 'nowhere yet',
  });

  return {
    id: `variable:${variable.name}`,
    kind: 'variable',
    column: 'inputs',
    label: `{{${variable.name}}}`,
    detail: `${variable.type}${variable.required ? ' · required' : ' · optional'}${
      sectionIds.length === 0 ? ' · unused' : ''
    }`,
    unresolved: false,
    meta,
    target: { kind: 'playground', promptId },
  };
}

function undeclaredNode(name: string, paths: readonly string[], promptId: string): NodeDraft {
  return {
    id: `undeclared:${name}`,
    kind: 'reference',
    column: 'inputs',
    label: `{{${name}}}`,
    detail: 'not declared',
    unresolved: true,
    meta: [
      { label: 'Problem', value: 'This placeholder has no declaration, so nothing can fill it.' },
      { label: 'Used in', value: paths.join(', ') },
    ],
    target: { kind: 'playground', promptId },
  };
}

function snippetPathLabel(targetPath: string): string {
  const known = SNIPPET_TARGET_SECTIONS[targetPath];
  if (!known) return targetPath || 'no target';
  const section = SECTIONS.find((candidate) => candidate.id === known);
  return section ? section.title : targetPath;
}

/**
 * Builds the blueprint for one document.
 *
 * Ordering is fixed: inputs (declared variables in declaration order, then
 * snippets by name, then unresolved references, then unusable placeholders,
 * then the template origin), sections in document order, and output last.
 */
export function buildBlueprint(input: BlueprintInput): BlueprintGraph {
  const { document, promptId, attachedSchema, attachedSchemaId, snippets } = input;
  const scan = extractVariableReferences(document);
  const reconciliation = reconcileVariables(document.variables, scan.references);

  const sectionDrafts: NodeDraft[] = [];
  const sectionIds = new Set<string>();

  for (const section of SECTIONS) {
    if (!section.filled(document)) continue;

    sectionIds.add(section.id);
    const uses = reconciliation.used
      .filter((usage) => usage.paths.some((path) => sectionIdForPath(path) === section.id))
      .map((usage) => usage.name);

    sectionDrafts.push({
      id: `section:${section.id}`,
      kind: 'section',
      column: 'structure',
      label: section.title,
      detail: section.detail(document),
      unresolved: false,
      meta: [
        { label: 'Field', value: section.path },
        { label: 'Content', value: section.detail(document) },
        { label: 'Uses', value: uses.length > 0 ? uses.join(', ') : 'no variables' },
      ],
      target: { kind: 'section', path: section.path },
    });
  }

  // Sections come first so the node cap can never drop the document's own
  // structure in favour of a long tail of placeholders.
  const sections = sectionDrafts;

  const snippetsById = new Map(snippets.map((snippet) => [snippet.id, snippet]));
  const referencedSnippetIds = [...new Set(document.includes)].sort((left, right) => {
    const a = snippetsById.get(left)?.name ?? left;
    const b = snippetsById.get(right)?.name ?? right;
    return a.localeCompare(b);
  });

  const inputDrafts: NodeDraft[] = [];

  for (const variable of document.variables) {
    const usage = reconciliation.used.find((entry) => entry.name === variable.name);
    const usedIn = usage
      ? [
          ...new Set(
            usage.paths
              .map((path) => sectionIdForPath(path))
              .filter((id) => sectionIds.has(id))
              .map((id) => SECTIONS.find((section) => section.id === id)?.title ?? id),
          ),
        ]
      : [];

    inputDrafts.push(variableNode(variable, usedIn, promptId));
  }

  for (const id of referencedSnippetIds) {
    const snippet = snippetsById.get(id);
    if (!snippet) {
      inputDrafts.push({
        id: `missing-snippet:${id}`,
        kind: 'snippet',
        column: 'inputs',
        label: 'Missing snippet',
        detail: id,
        unresolved: true,
        meta: [
          { label: 'Problem', value: 'This document includes a snippet that no longer exists.' },
          { label: 'Snippet id', value: id },
        ],
        target: { kind: 'snippets', promptId },
      });
      continue;
    }

    const targetSection = SNIPPET_TARGET_SECTIONS[snippet.targetPath] ?? null;
    inputDrafts.push({
      id: `snippet:${snippet.id}`,
      kind: 'snippet',
      column: 'inputs',
      label: snippet.name,
      detail: `snippet · writes ${snippetPathLabel(snippet.targetPath)}`,
      unresolved: targetSection === null,
      meta: [
        { label: 'Target', value: snippetPathLabel(snippet.targetPath) },
        { label: 'Description', value: snippet.description || '(none)' },
        {
          label: 'Status',
          value:
            targetSection === null
              ? 'This snippet targets a field the blueprint does not know about.'
              : 'Included by this document.',
        },
      ],
      target: { kind: 'snippets', promptId },
    });
  }

  for (const undeclared of reconciliation.undeclared) {
    inputDrafts.push(undeclaredNode(undeclared.name, undeclared.paths, promptId));
  }

  const problems = [...scan.problems].sort(
    (left, right) => left.path.localeCompare(right.path) || left.token.start - right.token.start,
  );
  problems.forEach((problem, index) => {
    inputDrafts.push({
      id: `problem:${index}`,
      kind: 'reference',
      column: 'inputs',
      label: problem.token.raw || '{{',
      detail: `unusable placeholder · ${problem.token.problem ?? 'invalid'}`,
      unresolved: true,
      meta: [
        {
          label: 'Problem',
          value:
            problem.token.problem === 'unclosed'
              ? 'This placeholder is never closed with }}.'
              : problem.token.problem === 'empty-name'
                ? 'This placeholder names nothing.'
                : 'This placeholder is not a valid variable name.',
        },
        { label: 'Field', value: problem.path },
      ],
      target: { kind: 'section', path: problem.path },
    });
  });

  const origin = templateOriginNode(input);
  if (origin) inputDrafts.push(origin);

  const outputDrafts: NodeDraft[] = [
    {
      id: 'output:format',
      kind: 'format',
      column: 'output',
      label: 'Output format',
      detail: document.output.format,
      unresolved: false,
      meta: [
        { label: 'Format', value: document.output.format },
        {
          label: 'Example',
          value:
            document.output.example === undefined
              ? 'none'
              : summarizeContent(document.output.example),
        },
      ],
      target: { kind: 'section', path: 'output' },
    },
  ];

  if (attachedSchema) {
    outputDrafts.push({
      id: 'output:schema',
      kind: 'schema',
      column: 'output',
      label: attachedSchema.name,
      detail: 'attached schema',
      unresolved: false,
      meta: [
        { label: 'Schema', value: attachedSchema.name },
        { label: 'Usage', value: 'Attached to this prompt and checked by validation.' },
      ],
      target: { kind: 'validation' },
    });
  } else if (attachedSchemaId) {
    outputDrafts.push({
      id: 'output:schema',
      kind: 'schema',
      column: 'output',
      label: 'Missing schema',
      detail: attachedSchemaId,
      unresolved: true,
      meta: [
        { label: 'Problem', value: 'This prompt points at a schema that no longer exists.' },
        { label: 'Schema id', value: attachedSchemaId },
      ],
      target: { kind: 'validation' },
    });
  }

  const schemaRef = document.output?.schemaRef;
  if (schemaRef) {
    outputDrafts.push({
      id: 'output:schema-ref',
      kind: 'schema',
      column: 'output',
      label: 'Document schemaRef',
      detail:
        schemaRef === attachedSchemaId ? 'matches the attachment' : 'declared in the document',
      unresolved:
        attachedSchemaId !== null &&
        attachedSchemaId !== undefined &&
        schemaRef !== attachedSchemaId,
      meta: [
        { label: 'Schema reference', value: schemaRef },
        {
          label: 'Compared with the attachment',
          value:
            attachedSchemaId === null || attachedSchemaId === undefined
              ? 'No schema is attached to the prompt record.'
              : schemaRef === attachedSchemaId
                ? 'Same schema id.'
                : 'The document and the prompt record name different schemas.',
        },
      ],
      target: { kind: 'validation' },
    });
  }

  const all = [...sections, ...inputDrafts, ...outputDrafts];
  const unresolved = all.filter((node) => node.unresolved);
  let kept = all;

  let droppedNodes = 0;
  if (all.length > BLUEPRINT_LIMITS.maxNodes) {
    // Keep unresolved references first: those are the ones a reader must fix.
    const mandatory = unresolved.slice(0, BLUEPRINT_LIMITS.maxNodes);
    const rest = all
      .filter((node) => !unresolved.includes(node))
      .slice(0, BLUEPRINT_LIMITS.maxNodes - mandatory.length);
    kept = [...mandatory, ...rest];
    droppedNodes = all.length - kept.length;
  }

  const laidOut = layout(kept);
  const byId = new Map(laidOut.map((node) => [node.id, node]));
  const edgeDrafts = buildEdges({
    document,
    reconciliation,
    snippetsById,
    referencedSnippetIds,
    nodeIds: new Set(kept.map((node) => node.id)),
    sectionIds,
    promptId,
  });

  const edges: BlueprintEdge[] = [];
  for (const edge of edgeDrafts) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to || edges.length >= BLUEPRINT_LIMITS.maxEdges) continue;

    edges.push({
      id: `${edge.from}->${edge.to}`,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      x1: from.x + from.width,
      y1: from.y + from.height / 2,
      x2: to.x,
      y2: to.y + to.height / 2,
    });
  }

  const size = measure(laidOut);

  return {
    nodes: laidOut,
    edges,
    width: size.width,
    height: size.height,
    unresolvedCount: laidOut.filter((node) => node.unresolved).length,
    truncated: droppedNodes > 0 || edgeDrafts.length > edges.length,
    droppedNodes,
    droppedEdges: Math.max(0, edgeDrafts.length - edges.length),
  };
}

function templateOriginNode(input: BlueprintInput): NodeDraft | null {
  const metadata = input.metadata ?? {};
  const declared = metadata.templateId ?? metadata.template;
  if (!declared) return null;

  const template = (input.templates ?? []).find(
    (candidate) =>
      candidate.id === declared || candidate.name.toLowerCase() === declared.toLowerCase(),
  );

  return {
    id: 'origin:template',
    kind: 'origin',
    column: 'inputs',
    label: template ? template.name : 'Unknown template',
    detail: 'template origin',
    unresolved: !template,
    meta: [
      { label: 'Template', value: template ? template.name : declared },
      {
        label: 'Status',
        value: template
          ? 'The document metadata records this template as its origin.'
          : 'The metadata names a template that no longer exists.',
      },
    ],
    target: { kind: 'templates' },
  };
}

interface EdgeDraft {
  readonly from: string;
  readonly to: string;
  readonly kind: BlueprintEdgeKind;
}

function buildEdges(options: {
  readonly document: PromptDocument;
  readonly reconciliation: ReturnType<typeof reconcileVariables>;
  readonly snippetsById: ReadonlyMap<string, Snippet>;
  readonly referencedSnippetIds: readonly string[];
  readonly nodeIds: ReadonlySet<string>;
  readonly sectionIds: ReadonlySet<string>;
  readonly promptId: string;
}): EdgeDraft[] {
  const { reconciliation, snippetsById, referencedSnippetIds, nodeIds, sectionIds } = options;
  const edges: EdgeDraft[] = [];
  const seen = new Set<string>();

  const push = (from: string, to: string, kind: BlueprintEdgeKind) => {
    const key = `${from}->${to}`;
    if (seen.has(key) || !nodeIds.has(from) || !nodeIds.has(to)) return;
    seen.add(key);
    edges.push({ from, to, kind });
  };

  // Variable → every section it appears in.
  for (const usage of reconciliation.used) {
    const id = `variable:${usage.name}`;
    for (const path of usage.paths) {
      push(id, `section:${sectionIdForPath(path)}`, 'reference');
    }
  }

  // Undeclared reference → the same sections, so the gap is visible in place.
  for (const undeclared of reconciliation.undeclared) {
    const id = `undeclared:${undeclared.name}`;
    for (const path of undeclared.paths) {
      push(id, `section:${sectionIdForPath(path)}`, 'reference');
    }
  }

  // Snippet → the section its target writes to.
  for (const id of referencedSnippetIds) {
    const snippet = snippetsById.get(id);
    const targetSection = snippet ? (SNIPPET_TARGET_SECTIONS[snippet.targetPath] ?? null) : null;
    if (!snippet || !targetSection || !sectionIds.has(targetSection)) continue;
    push(`snippet:${snippet.id}`, `section:${targetSection}`, 'reference');
  }

  // The output section declares the format and schemas it mentions.
  for (const to of ['output:format', 'output:schema', 'output:schema-ref']) {
    push('section:output', to, 'contains');
  }

  return edges;
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

function columnIndexOf(column: BlueprintColumnId): number {
  return BLUEPRINT_COLUMNS.findIndex((candidate) => candidate.id === column);
}

/**
 * Places nodes on a fixed three-column grid and centres each column vertically.
 *
 * No force simulation, no measurement, no randomness: column and row come from
 * derivation order, and the arithmetic below is the whole layout algorithm.
 */
function layout(drafts: readonly NodeDraft[]): BlueprintNode[] {
  const { nodeWidth, nodeHeight, headerHeight, columnGap, rowGap, padding } = BLUEPRINT_LIMITS;

  const rowsInColumn = new Map<BlueprintColumnId, number>();
  for (const draft of drafts) {
    rowsInColumn.set(draft.column, (rowsInColumn.get(draft.column) ?? 0) + 1);
  }
  const maxRows = Math.max(1, ...rowsInColumn.values());

  const nextRow = new Map<BlueprintColumnId, number>();

  return drafts.map((draft) => {
    const column = columnIndexOf(draft.column);
    const row = nextRow.get(draft.column) ?? 0;
    nextRow.set(draft.column, row + 1);

    const rows = rowsInColumn.get(draft.column) ?? 0;
    const verticalOffset = Math.round(((maxRows - rows) * (nodeHeight + rowGap)) / 2);

    return {
      id: draft.id,
      kind: draft.kind,
      column: draft.column,
      row,
      label: draft.label,
      detail: draft.detail,
      unresolved: draft.unresolved,
      meta: draft.meta,
      target: draft.target,
      x: padding + column * (nodeWidth + columnGap),
      y: padding + headerHeight + verticalOffset + row * (nodeHeight + rowGap),
      width: nodeWidth,
      height: nodeHeight,
    };
  });
}

function measure(nodes: readonly BlueprintNode[]): { width: number; height: number } {
  const { nodeWidth, nodeHeight, headerHeight, columnGap, padding } = BLUEPRINT_LIMITS;
  const columns = BLUEPRINT_COLUMNS.length;
  const bottom = nodes.reduce((max, node) => Math.max(max, node.y + node.height), 0);

  return {
    width: padding * 2 + columns * nodeWidth + (columns - 1) * columnGap,
    height: Math.max(bottom + padding, padding * 2 + headerHeight + nodeHeight),
  };
}

/* -------------------------------------------------------------------------- */
/* Reading the result                                                         */
/* -------------------------------------------------------------------------- */

/** True when a graph is worth drawing; below `minNodes` the panel says so. */
export function hasEnoughStructure(graph: BlueprintGraph): boolean {
  return graph.nodes.length >= BLUEPRINT_LIMITS.minNodes;
}

/** `3 inputs, 4 sections, 2 output nodes · 1 unresolved reference` */
export function describeBlueprint(graph: BlueprintGraph): string {
  const count = (column: BlueprintColumnId) =>
    graph.nodes.filter((node) => node.column === column).length;

  const parts = [
    `${count('inputs')} input${count('inputs') === 1 ? '' : 's'}`,
    `${count('structure')} section${count('structure') === 1 ? '' : 's'}`,
    `${count('output')} output node${count('output') === 1 ? '' : 's'}`,
  ];

  const unresolved =
    graph.unresolvedCount === 0
      ? ''
      : ` · ${graph.unresolvedCount} unresolved reference${graph.unresolvedCount === 1 ? '' : 's'}`;

  return `${parts.join(', ')}${unresolved}.`;
}

const KIND_LABELS: Readonly<Record<BlueprintNodeKind, string>> = {
  variable: 'Variable',
  snippet: 'Snippet',
  reference: 'Unresolved',
  section: 'Section',
  format: 'Output',
  schema: 'Schema',
  origin: 'Origin',
};

export function describeNodeKind(kind: BlueprintNodeKind): string {
  return KIND_LABELS[kind];
}

/** Node kinds in legend order: inputs, structure, output, then problems. */
export const BLUEPRINT_LEGEND: readonly {
  readonly kind: BlueprintNodeKind;
  readonly label: string;
  readonly description: string;
}[] = [
  { kind: 'variable', label: 'Variable', description: 'A declared value the prompt expects.' },
  { kind: 'snippet', label: 'Snippet', description: 'Stored text this document includes.' },
  { kind: 'section', label: 'Section', description: 'A part of the document that renders.' },
  { kind: 'format', label: 'Output', description: 'The declared response format.' },
  { kind: 'schema', label: 'Schema', description: 'A JSON Schema the prompt or document names.' },
  { kind: 'origin', label: 'Origin', description: 'The template the metadata records.' },
  {
    kind: 'reference',
    label: 'Unresolved',
    description: 'A placeholder or reference that cannot be satisfied.',
  },
];
