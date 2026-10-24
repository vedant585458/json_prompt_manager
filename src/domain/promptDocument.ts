/**
 * Canonical PromptForge prompt document (TASK-005).
 *
 * Everything here is pure: no React, no storage, no browser-only APIs. The
 * module owns one contract — *the* JSON shape a prompt's `content` must have —
 * and expresses every failure as a value (`DomainResult`), never as a thrown
 * exception, so the UI can render issues directly.
 */

import { isValidVariableName, normalizeTags } from '@/domain/invariants';
import {
  PROMPT_DOCUMENT_SCHEMA_VERSION,
  type DocumentSectionDefinition,
  type DocumentSectionKey,
  type DomainIssue,
  type DomainResult,
  type JsonValue,
  type OutputFormat,
  type PromptContext,
  type PromptDocument,
  type PromptDocumentMetadata,
  type PromptExample,
  type PromptOutput,
  type VariableDefinition,
  type VariableType,
} from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Value guards                                                               */
/* -------------------------------------------------------------------------- */

const VARIABLE_TYPES: readonly VariableType[] = ['string', 'number', 'boolean', 'json'];
const OUTPUT_FORMATS: readonly OutputFormat[] = ['json', 'text', 'markdown'];

/**
 * True for `{}`-style objects: never arrays, never `null`, and never class
 * instances such as `Date`, `Map`, or a `PromptDocument`-like prototype.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

/**
 * True when `value` is representable as JSON: no functions, symbols,
 * `undefined`, `NaN`/`Infinity`, class instances, or cycles.
 */
export function isJsonValue(value: unknown, seen = new Set<unknown>()): value is JsonValue {
  if (value === null) return true;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      break;
    default:
      return false;
  }

  if (seen.has(value)) return false;
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.every((item) => item === null || isJsonValue(item, seen));
    }
    if (isPlainObject(value)) {
      return Object.values(value).every((item) => isJsonValue(item, seen));
    }
    // Dates, Maps, class instances, and other exotica do not survive JSON.
    return false;
  } finally {
    seen.delete(value);
  }
}

function asJsonValue(value: unknown): JsonValue | undefined {
  return isJsonValue(value) ? value : undefined;
}

function normalizeList(value: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const trimmed = item.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Variable definitions                                                       */
/* -------------------------------------------------------------------------- */

/** Normalizes one declaration: trims, applies the type default, drops bad defaults. */
export function normalizeVariable(variable: VariableDefinition): VariableDefinition {
  const name = variable.name.trim();
  const description = variable.description?.trim();
  const defaultValue = asJsonValue(variable.defaultValue);

  return {
    name,
    type: VARIABLE_TYPES.includes(variable.type) ? variable.type : 'string',
    required: variable.required,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(description ? { description } : {}),
  };
}

/** Collects duplicate variable names, keeping the first declaration. */
export function dedupeVariables(variables: readonly VariableDefinition[]): {
  variables: VariableDefinition[];
  duplicates: string[];
} {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const result: VariableDefinition[] = [];

  for (const variable of variables) {
    if (seen.has(variable.name)) {
      duplicates.push(variable.name);
      continue;
    }
    seen.add(variable.name);
    result.push(variable);
  }

  return { variables: result, duplicates };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

interface ValidationContext {
  readonly issues: DomainIssue[];
}

function addIssue(
  context: ValidationContext,
  severity: DomainIssue['severity'],
  path: string,
  message: string,
): void {
  context.issues.push({ path, message, severity });
}

function readRequiredString(
  context: ValidationContext,
  source: Record<string, unknown>,
  key: string,
  path: string,
  { allowEmpty = false, maxLength = 4000 }: { allowEmpty?: boolean; maxLength?: number } = {},
): string {
  const value = source[key];
  if (value === undefined || value === null) {
    addIssue(context, 'error', path, `"${key}" is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    addIssue(context, 'error', path, `"${key}" must be a string.`);
    return '';
  }
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    addIssue(context, 'error', path, `"${key}" cannot be empty.`);
  } else if (trimmed.length === 0) {
    addIssue(context, 'warning', path, `"${key}" is empty; prompts are clearer with one.`);
  }
  if (trimmed.length > maxLength) {
    addIssue(context, 'error', path, `"${key}" must be at most ${maxLength} characters.`);
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function readOptionalString(
  context: ValidationContext,
  source: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    addIssue(context, 'error', path, `"${key}" must be a string when present.`);
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readStringList(
  context: ValidationContext,
  source: Record<string, unknown>,
  key: string,
  path: string,
  { dedupe = true }: { dedupe?: boolean } = {},
): string[] {
  const value = source[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    addIssue(context, 'error', path, `"${key}" must be an array of strings.`);
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();

  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (typeof item !== 'string') {
      addIssue(context, 'error', itemPath, 'Each entry must be a string.');
      return;
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      addIssue(context, 'warning', itemPath, 'Empty entry removed.');
      return;
    }
    if (dedupe && seen.has(trimmed)) {
      addIssue(context, 'warning', itemPath, 'Duplicate entry removed.');
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });

  return result;
}

function readJson(
  context: ValidationContext,
  source: Record<string, unknown>,
  key: string,
  path: string,
): JsonValue | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (!isJsonValue(value)) {
    addIssue(context, 'error', path, `"${key}" must be JSON-serializable data.`);
    return undefined;
  }
  return value;
}

function isDefaultCompatible(type: VariableType, value: JsonValue): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'json':
      return true;
  }
}

function readVariables(context: ValidationContext, value: unknown): VariableDefinition[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    addIssue(context, 'error', 'variables', '"variables" must be an array.');
    return [];
  }

  const parsed: VariableDefinition[] = [];

  value.forEach((entry, index) => {
    const path = `variables[${index}]`;
    if (!isPlainObject(entry)) {
      addIssue(context, 'error', path, 'Each variable must be an object.');
      return;
    }

    const rawName = entry.name;
    if (typeof rawName !== 'string' || rawName.trim().length === 0) {
      addIssue(context, 'error', `${path}.name`, 'Variable name is required.');
      return;
    }
    const name = rawName.trim();
    if (!isValidVariableName(name)) {
      addIssue(
        context,
        'error',
        `${path}.name`,
        'Variable names must start with a letter or underscore and contain only letters, digits, and underscores.',
      );
    }

    const rawType = entry.type;
    let type: VariableType = 'string';
    if (rawType === undefined) {
      addIssue(context, 'warning', `${path}.type`, 'Missing type; defaulted to "string".');
    } else if (typeof rawType !== 'string' || !VARIABLE_TYPES.includes(rawType as VariableType)) {
      addIssue(
        context,
        'error',
        `${path}.type`,
        `Type must be one of: ${VARIABLE_TYPES.join(', ')}.`,
      );
      return;
    } else {
      type = rawType as VariableType;
    }

    const rawRequired = entry.required;
    let required = true;
    if (rawRequired === undefined) {
      addIssue(context, 'warning', `${path}.required`, 'Missing required flag; defaulted to true.');
    } else if (typeof rawRequired !== 'boolean') {
      addIssue(context, 'error', `${path}.required`, '"required" must be a boolean.');
      return;
    } else {
      required = rawRequired;
    }

    const defaultValue = asJsonValue(entry.defaultValue);
    if (entry.defaultValue !== undefined && defaultValue === undefined) {
      addIssue(context, 'error', `${path}.defaultValue`, 'Default value must be JSON data.');
    } else if (defaultValue !== undefined && !isDefaultCompatible(type, defaultValue)) {
      addIssue(
        context,
        'warning',
        `${path}.defaultValue`,
        `Default value does not match the declared "${type}" type.`,
      );
    }

    const description = readOptionalString(context, entry, 'description', `${path}.description`);

    parsed.push({
      name,
      type,
      required,
      ...(defaultValue === undefined ? {} : { defaultValue }),
      ...(description ? { description } : {}),
    });
  });

  const { variables, duplicates } = dedupeVariables(parsed);
  duplicates.forEach((name) => {
    addIssue(context, 'warning', 'variables', `Duplicate variable "${name}" removed.`);
  });

  return variables;
}

function readOutput(context: ValidationContext, value: unknown): PromptOutput {
  if (!isPlainObject(value)) {
    addIssue(context, 'error', 'output', '"output" must be an object with a "format".');
    return { format: 'json' };
  }

  const rawFormat = value.format;
  let format: OutputFormat = 'json';
  if (rawFormat === undefined) {
    addIssue(context, 'warning', 'output.format', 'Missing output format; defaulted to "json".');
  } else if (typeof rawFormat !== 'string' || !OUTPUT_FORMATS.includes(rawFormat as OutputFormat)) {
    addIssue(
      context,
      'error',
      'output.format',
      `Output format must be one of: ${OUTPUT_FORMATS.join(', ')}.`,
    );
  } else {
    format = rawFormat as OutputFormat;
  }

  const schemaRef = readOptionalString(context, value, 'schemaRef', 'output.schemaRef');
  const example = readJson(context, value, 'example', 'output.example');

  reportUnknownKeys(context, value, ['format', 'schemaRef', 'example'], 'output');

  return {
    format,
    ...(schemaRef ? { schemaRef } : {}),
    ...(example === undefined ? {} : { example }),
  };
}

function readContext(context: ValidationContext, value: unknown): PromptContext {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    addIssue(context, 'error', 'context', '"context" must be an object when present.');
    return {};
  }

  const description = readOptionalString(context, value, 'description', 'context.description');
  const references = readStringList(context, value, 'references', 'context.references');
  const data = readJson(context, value, 'data', 'context.data');

  reportUnknownKeys(context, value, ['description', 'references', 'data'], 'context');

  return {
    ...(description ? { description } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(data === undefined ? {} : { data }),
  };
}

function readExamples(context: ValidationContext, value: unknown): PromptExample[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    addIssue(context, 'error', 'examples', '"examples" must be an array.');
    return [];
  }

  const examples: PromptExample[] = [];

  value.forEach((entry, index) => {
    const path = `examples[${index}]`;
    if (!isPlainObject(entry)) {
      addIssue(context, 'error', path, 'Each example must be an object.');
      return;
    }
    const input = readJson(context, entry, 'input', `${path}.input`);
    const output = readJson(context, entry, 'output', `${path}.output`);
    reportUnknownKeys(context, entry, ['input', 'output'], path);

    if (input === undefined && output === undefined) {
      addIssue(context, 'warning', path, 'Example has neither an input nor an output.');
      return;
    }

    examples.push({
      ...(input === undefined ? {} : { input }),
      ...(output === undefined ? {} : { output }),
    });
  });

  return examples;
}

function readMetadata(context: ValidationContext, value: unknown): PromptDocumentMetadata {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    addIssue(context, 'error', 'metadata', '"metadata" must be an object when present.');
    return {};
  }

  const author = readOptionalString(context, value, 'author', 'metadata.author');
  const notes = readOptionalString(context, value, 'notes', 'metadata.notes');
  const tags = normalizeTags(readStringList(context, value, 'tags', 'metadata.tags'));

  reportUnknownKeys(context, value, ['author', 'notes', 'tags'], 'metadata');

  return {
    ...(author ? { author } : {}),
    ...(notes ? { notes } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

/**
 * Flags keys the app does not know about.
 *
 * Top-level unknown keys are preserved in `extras`; nested ones are reported as
 * warnings because the canonical sections are fixed shapes.
 */
function reportUnknownKeys(
  context: ValidationContext,
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(source)) {
    if (allowed.includes(key)) continue;
    addIssue(
      context,
      'warning',
      path === '' ? key : `${path}.${key}`,
      `Unknown field "${key}" is preserved but not interpreted.`,
    );
  }
}

function readExtras(
  context: ValidationContext,
  source: Record<string, unknown>,
): Record<string, JsonValue> | undefined {
  const extras: Record<string, JsonValue> = {};

  for (const key of Object.keys(source)) {
    if (DOCUMENT_KEYS.includes(key)) continue;
    const value = asJsonValue(source[key]);
    if (value === undefined) {
      addIssue(context, 'warning', key, `Unknown field "${key}" is not JSON data and was dropped.`);
      continue;
    }
    extras[key] = value;
    addIssue(
      context,
      'warning',
      key,
      `Unknown top-level field "${key}" is preserved on round-trip but not interpreted.`,
    );
  }

  return Object.keys(extras).length > 0 ? extras : undefined;
}

const DOCUMENT_KEYS: readonly string[] = [
  'schemaVersion',
  'name',
  'role',
  'objective',
  'instructions',
  'context',
  'constraints',
  'variables',
  'output',
  'examples',
  'metadata',
  'includes',
];

/**
 * Validates and normalizes a prompt document.
 *
 * Errors block persistence; warnings describe normalization (trimmed strings,
 * removed duplicates, defaulted types). The returned document is always the
 * normalized form of the best interpretation of the input.
 */
export function validatePromptDocument(input: unknown): DomainResult<PromptDocument> {
  const issues: DomainIssue[] = [];
  const context: ValidationContext = { issues };

  if (!isPlainObject(input)) {
    addIssue(context, 'error', '', 'A prompt document must be a JSON object.');
    return { ok: false, issues };
  }

  const schemaVersion = input.schemaVersion;
  if (schemaVersion === undefined) {
    addIssue(
      context,
      'error',
      'schemaVersion',
      `Missing schema version; expected "${PROMPT_DOCUMENT_SCHEMA_VERSION}".`,
    );
  } else if (schemaVersion !== PROMPT_DOCUMENT_SCHEMA_VERSION) {
    addIssue(
      context,
      'error',
      'schemaVersion',
      `Unsupported schema version ${JSON.stringify(schemaVersion)}; this build reads "${PROMPT_DOCUMENT_SCHEMA_VERSION}".`,
    );
  }

  const name = readRequiredString(context, input, 'name', 'name', { maxLength: 120 });
  const role = readRequiredString(context, input, 'role', 'role', { allowEmpty: true });
  const objective = readRequiredString(context, input, 'objective', 'objective', {
    allowEmpty: true,
  });
  const instructions = readStringList(context, input, 'instructions', 'instructions');
  const constraints = readStringList(context, input, 'constraints', 'constraints');
  const variables = readVariables(context, input.variables);
  const output = readOutput(context, input.output);
  const contextSection = readContext(context, input.context);
  const examples = readExamples(context, input.examples);
  const metadata = readMetadata(context, input.metadata);
  const includes = readStringList(context, input, 'includes', 'includes');
  const extras = readExtras(context, input);

  const document: PromptDocument = {
    schemaVersion: PROMPT_DOCUMENT_SCHEMA_VERSION,
    name,
    role,
    objective,
    instructions,
    context: contextSection,
    constraints,
    variables,
    output,
    examples,
    metadata,
    includes,
    ...(extras ? { extras } : {}),
  };

  const hasErrors = issues.some((issue) => issue.severity === 'error');
  return hasErrors ? { ok: false, issues } : { ok: true, value: document, issues };
}

/**
 * Normalizes an already-typed document.
 *
 * Used after programmatic edits (editor, composer) so trims and dedupes are
 * applied consistently; unknown-key warnings are not produced here.
 */
export function normalizeDocument(document: PromptDocument): PromptDocument {
  const { variables } = dedupeVariables(document.variables.map(normalizeVariable));
  const metadataTags = normalizeTags(document.metadata.tags ?? []);

  return {
    schemaVersion: PROMPT_DOCUMENT_SCHEMA_VERSION,
    name: document.name.trim(),
    role: document.role.trim(),
    objective: document.objective.trim(),
    instructions: normalizeList(document.instructions),
    context: {
      ...(document.context.description?.trim()
        ? { description: document.context.description.trim() }
        : {}),
      ...(document.context.references
        ? { references: normalizeList(document.context.references) }
        : {}),
      ...(document.context.data === undefined ? {} : { data: document.context.data }),
    },
    constraints: normalizeList(document.constraints),
    variables,
    output: { ...document.output },
    examples: document.examples,
    metadata: {
      ...(document.metadata.author?.trim() ? { author: document.metadata.author.trim() } : {}),
      ...(metadataTags.length > 0 ? { tags: metadataTags } : {}),
      ...(document.metadata.notes?.trim() ? { notes: document.metadata.notes.trim() } : {}),
    },
    includes: normalizeList(document.includes),
    ...(document.extras ? { extras: document.extras } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Factories for canonical documents                                          */
/* -------------------------------------------------------------------------- */

/** An empty but valid document. Everything optional is omitted, not `null`. */
export function createBlankDocument(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return normalizeDocument({
    schemaVersion: PROMPT_DOCUMENT_SCHEMA_VERSION,
    name: 'Untitled prompt',
    role: '',
    objective: '',
    instructions: [],
    context: {},
    constraints: [],
    variables: [],
    output: { format: 'json' },
    examples: [],
    metadata: {},
    includes: [],
    ...overrides,
  });
}

/**
 * A realistic sample document used by the gallery, tests, and the editor's
 * "load sample" affordance. It is deliberately small enough to read in full.
 */
export function createSampleDocument(): PromptDocument {
  return createBlankDocument({
    name: 'Release notes summarizer',
    role: 'Senior release manager writing for busy engineers.',
    objective:
      'Turn a changelog into release notes that a reader can skim in under a minute without losing accuracy.',
    instructions: [
      'Group changes by area, strongest user impact first.',
      'Rewrite each entry in the active voice and keep one idea per line.',
      'Keep every breaking change, deprecation, and migration step.',
      'Do not invent entries that are absent from the changelog.',
    ],
    context: {
      description: 'The changelog is supplied as JSON with a "changes" array.',
      references: ['Keep a Changelog 1.1.0', 'Semantic Versioning 2.0.0'],
    },
    constraints: [
      'Never drop a breaking change.',
      'Use plain language; expand internal codenames on first use.',
      'Stay within 250 words.',
    ],
    variables: [
      {
        name: 'version',
        type: 'string',
        required: true,
        description: 'Version being released, e.g. 2.4.0.',
      },
      {
        name: 'changes',
        type: 'json',
        required: true,
        description: 'Array of change objects from the changelog export.',
      },
      {
        name: 'audience',
        type: 'string',
        required: false,
        defaultValue: 'application developers',
        description: 'Who the notes are written for.',
      },
    ],
    output: {
      format: 'markdown',
      example: '## 2.4.0\n\n### Improved\n\n- Faster project search.',
    },
    examples: [
      {
        input: { version: '2.3.0', changes: [{ type: 'fix', summary: 'Crash on empty import' }] },
        output: '## 2.3.0\n\n### Fixed\n\n- Importing an empty file no longer crashes.',
      },
    ],
    metadata: {
      author: 'PromptForge',
      tags: ['documentation', 'release'],
      notes: 'Pair with the changelog schema before enabling validation.',
    },
    includes: [],
  });
}

/* -------------------------------------------------------------------------- */
/* Section helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Ordered outline used by the editor, the blueprint graph, and the gallery. */
export const DOCUMENT_SECTIONS: readonly DocumentSectionDefinition[] = [
  {
    key: 'name',
    label: 'Name',
    kind: 'text',
    description: 'Short identifier shown in the library.',
  },
  {
    key: 'role',
    label: 'Role',
    kind: 'text',
    description: 'The persona the model should adopt.',
  },
  {
    key: 'objective',
    label: 'Objective',
    kind: 'text',
    description: 'The single outcome the prompt exists to produce.',
  },
  {
    key: 'instructions',
    label: 'Instructions',
    kind: 'list',
    description: 'Ordered, imperative steps.',
  },
  {
    key: 'context',
    label: 'Context',
    kind: 'object',
    description: 'Background, references, and supplied data.',
  },
  {
    key: 'constraints',
    label: 'Constraints',
    kind: 'list',
    description: 'Hard rules the answer must respect.',
  },
  {
    key: 'variables',
    label: 'Variables',
    kind: 'variables',
    description: 'Values supplied at render time.',
  },
  {
    key: 'output',
    label: 'Output',
    kind: 'object',
    description: 'Required response format and schema.',
  },
  {
    key: 'examples',
    label: 'Examples',
    kind: 'examples',
    description: 'Worked input/output pairs.',
  },
  {
    key: 'metadata',
    label: 'Metadata',
    kind: 'object',
    description: 'Author, tags, and notes.',
  },
  {
    key: 'includes',
    label: 'Includes',
    kind: 'list',
    description: 'Snippet IDs merged into this document.',
  },
];

/** Reads one section by key without losing type information. */
export function getDocumentSection<K extends DocumentSectionKey>(
  document: PromptDocument,
  key: K,
): PromptDocument[K] {
  return document[key];
}

/** Returns a new document with one section replaced. */
export function setDocumentSection<K extends DocumentSectionKey>(
  document: PromptDocument,
  key: K,
  value: PromptDocument[K],
): PromptDocument {
  return { ...document, [key]: value } as PromptDocument;
}

/** True when no authored content exists yet. */
export function isDocumentEmpty(document: PromptDocument): boolean {
  return (
    document.role.trim().length === 0 &&
    document.objective.trim().length === 0 &&
    document.instructions.length === 0 &&
    document.constraints.length === 0 &&
    document.variables.length === 0 &&
    document.examples.length === 0 &&
    document.includes.length === 0 &&
    (document.context.description ?? '').trim().length === 0 &&
    (document.context.references ?? []).length === 0
  );
}

/** Counts used by the library cards and the health dashboard. */
export interface DocumentStats {
  readonly instructions: number;
  readonly constraints: number;
  readonly variables: number;
  readonly requiredVariables: number;
  readonly examples: number;
  readonly includes: number;
  readonly characterCount: number;
  readonly filledSections: number;
}

export function documentStats(document: PromptDocument): DocumentStats {
  const prose = [
    document.role,
    document.objective,
    document.context.description ?? '',
    ...document.instructions,
    ...document.constraints,
  ];

  return {
    instructions: document.instructions.length,
    constraints: document.constraints.length,
    variables: document.variables.length,
    requiredVariables: document.variables.filter((variable) => variable.required).length,
    examples: document.examples.length,
    includes: document.includes.length,
    characterCount: prose.reduce((total, part) => total + part.length, 0),
    filledSections: DOCUMENT_SECTIONS.filter((section) => isSectionFilled(document, section.key))
      .length,
  };
}

function isSectionFilled(document: PromptDocument, key: DocumentSectionKey): boolean {
  const value = document[key];
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}
