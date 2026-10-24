/**
 * Template catalogue rules (TASK-018).
 *
 * A template is a stored `PromptDocument` plus a name, a description, and a
 * category. Nothing here touches storage or React: the module answers three
 * questions and nothing else.
 *
 * 1. What does a template contain? (`summariseTemplate`, `templateTags`)
 * 2. Can it be used as-is? (`templateIssues`, `checkTemplateName`)
 * 3. What exactly becomes a prompt when it is used? (`instantiateTemplate`)
 *
 * Two rules keep a template from lying about what it will produce:
 *
 * - **Templates never carry `includes`.** `includes` holds ids of snippets that
 *   were merged into *this* document. A template is a blueprint for a document
 *   that does not exist yet, so carrying snippet ids across would claim a merge
 *   that never happened. The values live in the sections; the ids do not travel.
 * - **A schema reference travels only when the schema exists.** `output.schemaRef`
 *   is a local id. When the caller tells us which schemas this browser holds, a
 *   dangling reference is dropped and reported, so the new prompt does not start
 *   life pointing at nothing (ADR-95).
 *
 * The literal built-in catalogue lives in `src/data/db/templates.ts`; this module
 * is pure and has no catalogue of its own, so tests can build templates freely.
 */

import { normalizeTags } from '@/domain/invariants';
import { documentStats, validatePromptDocument } from '@/domain/promptDocument';
import { documentHash } from '@/domain/serialization';
import type {
  DomainIssue,
  Prompt,
  PromptDocument,
  PromptTemplate,
  VariableDefinition,
} from '@/domain/types';

/** Category a template falls back to when none is supplied. */
export const DEFAULT_TEMPLATE_CATEGORY = 'General';

/** Longest template name this app stores, matching the document name limit. */
export const MAX_TEMPLATE_NAME_LENGTH = 120;

/** Message shown wherever a built-in is protected (list, dialog, store error). */
export const BUILT_IN_LOCKED_MESSAGE =
  'Built-in templates cannot be edited or deleted. Duplicate one to customise it.';

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tags a template advertises.
 *
 * They are the document's own `metadata.tags`: `PromptTemplate` stores no second
 * tag list, so the tags a template shows are exactly the tags a prompt created
 * from it will carry.
 */
export function templateTags(template: PromptTemplate): readonly string[] {
  return template.content.metadata.tags ?? [];
}

/** Everything the card grid and the preview sheet show about one template. */
export interface TemplateSummary {
  readonly template: PromptTemplate;
  readonly tags: readonly string[];
  readonly variables: readonly VariableDefinition[];
  readonly requiredVariables: number;
  readonly optionalVariables: number;
  readonly instructions: number;
  readonly constraints: number;
  readonly examples: number;
  /** Characters of pretty-printed JSON; the preview's "size" figure. */
  readonly jsonCharacters: number;
  /** Content hash of the document; equal hashes mean identical documents. */
  readonly hash: string;
}

export function summariseTemplate(template: PromptTemplate): TemplateSummary {
  const stats = documentStats(template.content);
  const variables = template.content.variables;

  return {
    template,
    tags: templateTags(template),
    variables,
    requiredVariables: stats.requiredVariables,
    optionalVariables: variables.length - stats.requiredVariables,
    instructions: stats.instructions,
    constraints: stats.constraints,
    examples: stats.examples,
    jsonCharacters: JSON.stringify(template.content).length,
    hash: documentHash(template.content),
  };
}

/* -------------------------------------------------------------------------- */
/* Ordering and filtering                                                     */
/* -------------------------------------------------------------------------- */

export type TemplateKind = 'all' | 'built-in' | 'custom';

export interface TemplateFilter {
  /** Case-insensitive substring over name, description, category, tags, objective. */
  readonly query?: string;
  /** Exact category; `null`, `undefined`, and `''` mean every category. */
  readonly category?: string | null;
  readonly kind?: TemplateKind;
}

/** Built-ins first, then by name, with id as the stable tie-breaker. */
export function sortTemplates(templates: readonly PromptTemplate[]): PromptTemplate[] {
  const collator = new Intl.Collator('en', { sensitivity: 'base' });

  return [...templates].sort((left, right) => {
    if (left.isBuiltIn !== right.isBuiltIn) return left.isBuiltIn ? -1 : 1;
    const byName = collator.compare(left.name, right.name);
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });
}

/** Newest first; used for "your templates" so a fresh save is visible. */
export function sortUserTemplatesByRecency(templates: readonly PromptTemplate[]): PromptTemplate[] {
  return [...templates].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
    return left.id.localeCompare(right.id);
  });
}

/** Every category present, deduped and sorted; empty categories are never shown. */
export function templateCategories(templates: readonly PromptTemplate[]): readonly string[] {
  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  const seen = new Map<string, string>();

  for (const template of templates) {
    const category = template.category.trim();
    if (category.length === 0) continue;
    const key = category.toLowerCase();
    if (!seen.has(key)) seen.set(key, category);
  }

  return [...seen.values()].sort(collator.compare);
}

function matchesQuery(template: PromptTemplate, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;

  const haystack = [
    template.name,
    template.description,
    template.category,
    template.content.objective,
    template.content.role,
    ...templateTags(template),
    ...template.content.variables.map((variable) => variable.name),
  ]
    .join(' ')
    .toLowerCase();

  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

export function filterTemplates(
  templates: readonly PromptTemplate[],
  filter: TemplateFilter = {},
): PromptTemplate[] {
  const kind = filter.kind ?? 'all';
  const category = (filter.category ?? '').trim().toLowerCase();
  const query = filter.query ?? '';

  return sortTemplates(
    templates.filter((template) => {
      if (kind === 'built-in' && !template.isBuiltIn) return false;
      if (kind === 'custom' && template.isBuiltIn) return false;
      if (category.length > 0 && template.category.trim().toLowerCase() !== category) return false;
      return matchesQuery(template, query);
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/** Prefixes a document-level issue so it reads as part of the template. */
function asContentIssue(issue: DomainIssue): DomainIssue {
  if (issue.path.length === 0) return { ...issue, path: 'content' };
  return { ...issue, path: `content.${issue.path}` };
}

/**
 * Checks a template against the rules that matter before it can be stored or
 * used: its document must parse, and its name must be usable.
 *
 * Duplicate names are checked separately (`checkTemplateName`) because only the
 * caller knows which other templates are visible in the same operation.
 */
export function templateIssues(template: PromptTemplate): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const validation = validatePromptDocument(template.content);
  issues.push(...validation.issues.map(asContentIssue));

  const name = template.name.trim();
  if (name.length === 0) {
    issues.push({ path: 'name', message: 'A template needs a name.', severity: 'error' });
  } else if (name.length > MAX_TEMPLATE_NAME_LENGTH) {
    issues.push({
      path: 'name',
      message: `Keep the name under ${MAX_TEMPLATE_NAME_LENGTH} characters.`,
      severity: 'error',
    });
  }

  if (template.description.trim().length === 0) {
    issues.push({
      path: 'description',
      message: 'A one-line description tells the next person what this template is for.',
      severity: 'warning',
    });
  }

  if (template.content.variables.length === 0) {
    issues.push({
      path: 'content.variables',
      message: 'This template has no variables, so every prompt made from it is fixed text.',
      severity: 'warning',
    });
  }

  return issues;
}

export interface TemplateNameOptions {
  /** Template being renamed; it does not conflict with itself. */
  readonly excludeId?: string;
}

/**
 * Name and description rules for the create, rename, and duplicate dialogs.
 *
 * Comparison is case-insensitive and whitespace-trimmed, so "Code review" and
 * " code review " cannot both exist — the list would otherwise show two rows
 * that read identically.
 */
export function checkTemplateName(
  name: string,
  templates: readonly PromptTemplate[],
  options: TemplateNameOptions = {},
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    issues.push({ path: 'name', message: 'A template needs a name.', severity: 'error' });
    return issues;
  }

  if (trimmed.length > MAX_TEMPLATE_NAME_LENGTH) {
    issues.push({
      path: 'name',
      message: `Keep the name under ${MAX_TEMPLATE_NAME_LENGTH} characters.`,
      severity: 'error',
    });
  }

  const taken = templates.some(
    (template) =>
      template.id !== options.excludeId &&
      template.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  if (taken) {
    issues.push({
      path: 'name',
      message: `A template named “${trimmed}” already exists.`,
      severity: 'error',
    });
  }

  return issues;
}

/** "Title (copy)", then "Title (copy 2)" — never the same name twice. */
export function nextTemplateName(base: string, templates: readonly PromptTemplate[]): string {
  const taken = new Set(templates.map((template) => template.name.trim().toLowerCase()));
  const root = base.trim().length > 0 ? base.trim() : 'Template';
  let candidate = `${root} (copy)`;
  let attempt = 2;

  while (taken.has(candidate.toLowerCase())) {
    candidate = `${root} (copy ${attempt})`;
    attempt += 1;
  }

  return candidate;
}

/** True when the template may be renamed or deleted. */
export function templateIsEditable(template: PromptTemplate): boolean {
  return !template.isBuiltIn;
}

/** The error thrown by the store when a built-in is edited or deleted. */
export function builtInTemplateIssue(action: 'edit' | 'delete'): DomainIssue {
  return {
    path: 'isBuiltIn',
    message:
      action === 'delete'
        ? `Built-in templates cannot be deleted. ${BUILT_IN_LOCKED_MESSAGE}`
        : BUILT_IN_LOCKED_MESSAGE,
    severity: 'error',
  };
}

/* -------------------------------------------------------------------------- */
/* Materialisation                                                            */
/* -------------------------------------------------------------------------- */

/** Deep copy of a document; documents are JSON, so a round-trip is exact. */
function cloneDocument(document: PromptDocument): PromptDocument {
  return JSON.parse(JSON.stringify(document)) as PromptDocument;
}

export interface InstantiateOptions {
  /** Title for the new prompt; defaults to the template name. */
  readonly title?: string;
  /**
   * Ids of the schemas this browser stores. When supplied, an `output.schemaRef`
   * that is not in the set is dropped and reported. Omit it when the caller
   * cannot answer, in which case the reference is kept verbatim.
   */
  readonly knownSchemaIds?: ReadonlySet<string>;
}

/** The exact fields a new prompt takes from a template. */
export interface TemplateInstantiation {
  readonly title: string;
  readonly description: string;
  /** Document tags, already normalized, for the new prompt's `tags`. */
  readonly tags: readonly string[];
  readonly content: PromptDocument;
  readonly variables: readonly VariableDefinition[];
  /** Snippet ids removed from `includes` (always all of them). */
  readonly droppedIncludes: readonly string[];
  /** Schema id removed from `output.schemaRef`, or `null` when it was kept. */
  readonly droppedSchemaRef: string | null;
}

/**
 * Builds the prompt fields for one template.
 *
 * The result shares no object with the template: editing the new prompt cannot
 * touch the stored blueprint, and two prompts made from the same template are
 * independent (ADR-94).
 */
export function instantiateTemplate(
  template: PromptTemplate,
  options: InstantiateOptions = {},
): TemplateInstantiation {
  const content = cloneDocument(template.content);
  const droppedIncludes = [...content.includes];
  const declaredSchema = content.output.schemaRef;
  const droppedSchemaRef =
    declaredSchema !== undefined &&
    options.knownSchemaIds !== undefined &&
    !options.knownSchemaIds.has(declaredSchema)
      ? declaredSchema
      : null;

  const output = droppedSchemaRef === null ? content.output : stripSchemaRef(content.output);
  const cleaned: PromptDocument = { ...content, output, includes: [] };
  const title = (options.title ?? template.name).trim();

  return {
    title: title.length > 0 ? title : template.name,
    description: template.description,
    tags: normalizeTags(content.metadata.tags ?? []),
    content: cleaned,
    variables: [...cleaned.variables],
    droppedIncludes,
    droppedSchemaRef,
  };
}

function stripSchemaRef(output: PromptDocument['output']): PromptDocument['output'] {
  const { schemaRef: _removed, ...rest } = output;
  void _removed;
  return rest;
}

/* -------------------------------------------------------------------------- */
/* Writing a template from a prompt                                           */
/* -------------------------------------------------------------------------- */

export interface TemplateDraft {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly content: PromptDocument;
  /** Snippet ids left out of the template (see the module note). */
  readonly droppedIncludes: readonly string[];
}

/**
 * Defaults for "save this prompt as a template".
 *
 * The title and description come from the prompt; the category starts empty so
 * the dialog can require a deliberate choice instead of inventing one.
 */
export function templateDraftFromPrompt(
  prompt: Pick<Prompt, 'title' | 'description' | 'content'>,
): TemplateDraft {
  const content = cloneDocument(prompt.content);
  const droppedIncludes = [...content.includes];

  return {
    name: prompt.title.trim(),
    description: prompt.description.trim(),
    category: '',
    content: { ...content, includes: [] },
    droppedIncludes,
  };
}
