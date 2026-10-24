/**
 * Guided composer model (TASK-017).
 *
 * The composer edits **JSON**, not a normalized document. That single choice is
 * what makes the two-way sync lossless: a form edit is a patch applied to the
 * parsed object, so every key the form does not render — including unknown
 * fields nested inside a section — comes along untouched.
 *
 * Everything here is pure: no React, no storage, no browser APIs. Failures are
 * values (`ComposerIssue[]` / `SnippetInsertResult`), never exceptions, so the
 * route can render them and block a save without losing what was typed.
 */

import { createBlankDocument, createSampleDocument, isPlainObject } from '@/domain/promptDocument';
import { documentToJson } from '@/domain/serialization';
import {
  type JsonObject,
  type JsonValue,
  type OutputFormat,
  type Snippet,
  type VariableType,
} from '@/domain/types';

/* -------------------------------------------------------------------------- */
/* Fields and sections                                                        */
/* -------------------------------------------------------------------------- */

export type ComposerField =
  | 'name'
  | 'role'
  | 'objective'
  | 'instructions'
  | 'context.description'
  | 'context.references'
  | 'context.data'
  | 'constraints'
  | 'variables'
  | 'output.format'
  | 'output.schemaRef'
  | 'output.example'
  | 'examples'
  | 'metadata.author'
  | 'metadata.tags'
  | 'metadata.notes'
  | 'includes'
  | 'extras';

export interface ComposerSectionDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

/** The form's sections, in the order they are rendered and tabbed through. */
export const COMPOSER_SECTIONS: readonly ComposerSectionDefinition[] = [
  {
    id: 'identity',
    title: 'Identity',
    description: 'What this prompt is called, and who it is written as.',
  },
  {
    id: 'task',
    title: 'Task',
    description: 'The goal, steps, and limits the prompt states.',
  },
  {
    id: 'context',
    title: 'Context',
    description: 'Background material the prompt is allowed to rely on.',
  },
  {
    id: 'variables',
    title: 'Variables',
    description: 'Values the caller supplies before the prompt is used.',
  },
  {
    id: 'output',
    title: 'Output and examples',
    description: 'The shape of the answer, and worked examples of it.',
  },
  {
    id: 'metadata',
    title: 'Metadata',
    description: 'Authorship, tags, notes, and the snippets this document uses.',
  },
];

/* -------------------------------------------------------------------------- */
/* The view the form renders                                                  */
/* -------------------------------------------------------------------------- */

export interface ComposerVariable {
  readonly name: string;
  readonly type: VariableType;
  readonly required: boolean;
  readonly defaultValue?: JsonValue;
  readonly description: string;
  /** Keys this form does not edit; written back verbatim. */
  readonly extras: Readonly<Record<string, JsonValue>>;
  /** A non-object entry, carried through unchanged because the form cannot read it. */
  readonly unreadable?: JsonValue;
}

export interface ComposerExample {
  readonly input?: JsonValue;
  readonly output?: JsonValue;
  readonly extras: Readonly<Record<string, JsonValue>>;
  readonly unreadable?: JsonValue;
}

export interface ComposerView {
  readonly name: string;
  readonly role: string;
  readonly objective: string;
  readonly instructions: readonly string[];
  readonly constraints: readonly string[];
  readonly contextDescription: string;
  readonly contextReferences: readonly string[];
  readonly contextData?: JsonValue;
  readonly variables: readonly ComposerVariable[];
  readonly outputFormat: OutputFormat;
  readonly outputSchemaRef: string;
  readonly outputExample?: JsonValue;
  readonly examples: readonly ComposerExample[];
  readonly author: string;
  readonly tags: readonly string[];
  readonly notes: string;
  readonly includes: readonly string[];
  /** Top-level keys the form does not render. Preserved on every patch. */
  readonly extras: readonly string[];
}

const VARIABLE_TYPES: readonly VariableType[] = ['string', 'number', 'boolean', 'json'];
const OUTPUT_FORMATS: readonly OutputFormat[] = ['json', 'text', 'markdown'];
const VARIABLE_KEYS = ['name', 'type', 'required', 'defaultValue', 'description'] as const;
const EXAMPLE_KEYS = ['input', 'output'] as const;
const SECTION_KEYS = ['context', 'output', 'metadata'] as const;

function readObject(source: JsonObject, key: string): JsonObject {
  const value = source[key];
  return isPlainObject(value) ? (value as JsonObject) : {};
}

function readString(source: JsonObject, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

function readStringList(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readExtras(source: JsonObject, known: readonly string[]): Record<string, JsonValue> {
  const extras: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!known.includes(key)) extras[key] = value;
  }
  return extras;
}

/** True when the value is a plain JSON object (never an array or `null`). */
export function isComposerObject(value: unknown): value is JsonObject {
  return isPlainObject(value);
}

export function readComposerView(raw: JsonObject): ComposerView {
  const context = readObject(raw, 'context');
  const output = readObject(raw, 'output');
  const metadata = readObject(raw, 'metadata');

  const rawVariables = Array.isArray(raw.variables) ? raw.variables : [];
  const variables: ComposerVariable[] = rawVariables.map((entry) => {
    if (!isPlainObject(entry)) {
      return {
        name: '',
        type: 'string',
        required: false,
        description: '',
        extras: {},
        unreadable: entry as JsonValue,
      };
    }

    const source = entry as JsonObject;
    const type = source.type;
    const defaultValue = source.defaultValue;

    return {
      name: readString(source, 'name'),
      type:
        typeof type === 'string' && VARIABLE_TYPES.includes(type as VariableType)
          ? (type as VariableType)
          : 'string',
      required: source.required === true,
      ...(defaultValue === undefined ? {} : { defaultValue }),
      description: readString(source, 'description'),
      extras: readExtras(source, VARIABLE_KEYS),
    };
  });

  const rawExamples = Array.isArray(raw.examples) ? raw.examples : [];
  const examples: ComposerExample[] = rawExamples.map((entry) => {
    if (!isPlainObject(entry)) {
      return { extras: {}, unreadable: entry as JsonValue };
    }
    const source = entry as JsonObject;
    return {
      ...(source.input === undefined ? {} : { input: source.input }),
      ...(source.output === undefined ? {} : { output: source.output }),
      extras: readExtras(source, EXAMPLE_KEYS),
    };
  });

  const format = output.format;

  return {
    name: readString(raw, 'name'),
    role: readString(raw, 'role'),
    objective: readString(raw, 'objective'),
    instructions: readStringList(raw.instructions),
    constraints: readStringList(raw.constraints),
    contextDescription: readString(context, 'description'),
    contextReferences: readStringList(context.references),
    ...(context.data === undefined ? {} : { contextData: context.data }),
    variables,
    outputFormat:
      typeof format === 'string' && OUTPUT_FORMATS.includes(format as OutputFormat)
        ? (format as OutputFormat)
        : 'json',
    outputSchemaRef: readString(output, 'schemaRef'),
    ...(output.example === undefined ? {} : { outputExample: output.example }),
    examples,
    author: readString(metadata, 'author'),
    tags: readStringList(metadata.tags),
    notes: readString(metadata, 'notes'),
    includes: readStringList(raw.includes),
    extras: Object.keys(raw).filter(
      (key) =>
        !(SECTION_KEYS as readonly string[]).includes(key) && !KNOWN_DOCUMENT_KEYS.includes(key),
    ),
  };
}

const KNOWN_DOCUMENT_KEYS: readonly string[] = [
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

/* -------------------------------------------------------------------------- */
/* Patches                                                                    */
/* -------------------------------------------------------------------------- */

export type ComposerPatch =
  | {
      readonly field:
        | 'name'
        | 'role'
        | 'objective'
        | 'context.description'
        | 'output.schemaRef'
        | 'metadata.author'
        | 'metadata.notes';
      readonly value: string;
    }
  | { readonly field: 'output.format'; readonly value: OutputFormat }
  | {
      readonly field:
        'instructions' | 'constraints' | 'context.references' | 'metadata.tags' | 'includes';
      readonly value: readonly string[];
    }
  | { readonly field: 'context.data' | 'output.example'; readonly value: JsonValue | undefined }
  | { readonly field: 'variables'; readonly value: readonly ComposerVariable[] }
  | { readonly field: 'examples'; readonly value: readonly ComposerExample[] };

function withoutKey(source: JsonObject, key: string): JsonObject {
  const next = { ...source };
  delete next[key];
  return next;
}

function withSection(
  raw: JsonObject,
  key: (typeof SECTION_KEYS)[number],
  value: JsonValue,
): JsonObject {
  return { ...raw, [key]: value };
}

function writeVariable(variable: ComposerVariable): JsonValue {
  if (variable.unreadable !== undefined) return variable.unreadable;
  return {
    ...variable.extras,
    name: variable.name,
    type: variable.type,
    required: variable.required,
    ...(variable.defaultValue === undefined ? {} : { defaultValue: variable.defaultValue }),
    ...(variable.description.trim().length > 0 ? { description: variable.description } : {}),
  } as JsonObject;
}

function writeExample(example: ComposerExample): JsonValue {
  if (example.unreadable !== undefined) return example.unreadable;
  return {
    ...example.extras,
    ...(example.input === undefined ? {} : { input: example.input }),
    ...(example.output === undefined ? {} : { output: example.output }),
  } as JsonObject;
}

/**
 * Applies one form edit to the raw document and returns a new object.
 *
 * Every branch starts from the current object, so keys the form does not render
 * survive a patch. The functions never normalize: trimming, de-duplication, and
 * validation happen when the document is checked or saved, and the form shows
 * the difference before that.
 */
export function applyComposerPatch(raw: JsonObject, patch: ComposerPatch): JsonObject {
  switch (patch.field) {
    case 'name':
      return { ...raw, name: patch.value };
    case 'role':
      return { ...raw, role: patch.value };
    case 'objective':
      return { ...raw, objective: patch.value };

    case 'instructions':
      return { ...raw, instructions: [...patch.value] };
    case 'constraints':
      return { ...raw, constraints: [...patch.value] };

    case 'context.description': {
      const context = readObject(raw, 'context');
      const next =
        patch.value.trim().length > 0
          ? { ...context, description: patch.value }
          : withoutKey(context, 'description');
      return withSection(raw, 'context', next);
    }

    case 'context.references': {
      const context = readObject(raw, 'context');
      const next =
        patch.value.length > 0
          ? { ...context, references: [...patch.value] }
          : withoutKey(context, 'references');
      return withSection(raw, 'context', next);
    }

    case 'context.data': {
      const context = readObject(raw, 'context');
      const next =
        patch.value === undefined ? withoutKey(context, 'data') : { ...context, data: patch.value };
      return withSection(raw, 'context', next);
    }

    case 'variables':
      return { ...raw, variables: patch.value.map(writeVariable) };

    case 'output.format': {
      const output = readObject(raw, 'output');
      return withSection(raw, 'output', { ...output, format: patch.value });
    }

    case 'output.schemaRef': {
      const output = readObject(raw, 'output');
      const next =
        patch.value.trim().length > 0
          ? { ...output, schemaRef: patch.value }
          : withoutKey(output, 'schemaRef');
      return withSection(raw, 'output', next);
    }

    case 'output.example': {
      const output = readObject(raw, 'output');
      const next =
        patch.value === undefined
          ? withoutKey(output, 'example')
          : { ...output, example: patch.value };
      return withSection(raw, 'output', next);
    }

    case 'examples':
      return { ...raw, examples: patch.value.map(writeExample) };

    case 'metadata.author': {
      const metadata = readObject(raw, 'metadata');
      const next =
        patch.value.trim().length > 0
          ? { ...metadata, author: patch.value }
          : withoutKey(metadata, 'author');
      return withSection(raw, 'metadata', next);
    }

    case 'metadata.tags': {
      const metadata = readObject(raw, 'metadata');
      const next =
        patch.value.length > 0
          ? { ...metadata, tags: [...patch.value] }
          : withoutKey(metadata, 'tags');
      return withSection(raw, 'metadata', next);
    }

    case 'includes':
      return { ...raw, includes: [...patch.value] };

    case 'metadata.notes': {
      const metadata = readObject(raw, 'metadata');
      const next =
        patch.value.trim().length > 0
          ? { ...metadata, notes: patch.value }
          : withoutKey(metadata, 'notes');
      return withSection(raw, 'metadata', next);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* List editing                                                               */
/* -------------------------------------------------------------------------- */

/** Moves one entry by `delta` and returns a new list; out-of-range is a no-op. */
export function moveListItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];

  const next = [...list];
  const moved = next[index] as T;
  next[index] = next[target] as T;
  next[target] = moved;
  return next;
}

/* -------------------------------------------------------------------------- */
/* Issues                                                                     */
/* -------------------------------------------------------------------------- */

export interface ComposerIssue {
  readonly field: ComposerField;
  /** A document-relative path, e.g. `variables[1].name`. */
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ComposerIssueOptions {
  /** Stored schema ids, so a dangling `output.schemaRef` can be named. */
  readonly schemaIds?: readonly string[];
  /** Stored snippet ids, so a dangling include can be named. */
  readonly snippetIds?: readonly string[];
}

const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function defaultMatchesType(value: JsonValue, type: VariableType): boolean {
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

/**
 * Everything wrong or worth saying about the draft, in the form's own terms.
 *
 * `error` blocks creating/saving the prompt; `warning` never does. The messages
 * describe what the composer can see, not what the document will look like after
 * normalization — that difference is the user's to accept.
 */
export function composerIssues(
  view: ComposerView,
  options: ComposerIssueOptions = {},
): ComposerIssue[] {
  const issues: ComposerIssue[] = [];

  if (view.name.trim().length === 0) {
    issues.push({
      field: 'name',
      path: 'name',
      severity: 'error',
      message: 'Give the prompt a name; every stored prompt needs one.',
    });
  }

  if (view.objective.trim().length === 0) {
    issues.push({
      field: 'objective',
      path: 'objective',
      severity: 'warning',
      message: 'The objective is empty, so the prompt does not state what it is for.',
    });
  }

  const seen = new Map<string, number>();
  view.variables.forEach((variable, index) => {
    if (variable.unreadable !== undefined) {
      issues.push({
        field: 'variables',
        path: `variables[${index}]`,
        severity: 'warning',
        message:
          'This variable entry is not an object, so it cannot be edited here. It is kept as-is.',
      });
      return;
    }

    const name = variable.name.trim();
    if (!VARIABLE_NAME_PATTERN.test(name)) {
      issues.push({
        field: 'variables',
        path: `variables[${index}].name`,
        severity: 'error',
        message: `“${variable.name}” is not a usable variable name. Use letters, digits, and underscores, starting with a letter or underscore.`,
      });
    } else {
      const first = seen.get(name);
      if (first !== undefined) {
        issues.push({
          field: 'variables',
          path: `variables[${index}].name`,
          severity: 'error',
          message: `“${name}” is already declared at position ${first + 1}. Two variables cannot share a name.`,
        });
      } else {
        seen.set(name, index);
      }
    }

    if (
      variable.defaultValue !== undefined &&
      !defaultMatchesType(variable.defaultValue, variable.type)
    ) {
      issues.push({
        field: 'variables',
        path: `variables[${index}].defaultValue`,
        severity: 'error',
        message: `The default for “${name || `variable ${index + 1}`}” is not a ${variable.type} value.`,
      });
    }
  });

  view.examples.forEach((example, index) => {
    if (example.unreadable !== undefined) {
      issues.push({
        field: 'examples',
        path: `examples[${index}]`,
        severity: 'warning',
        message: 'This example is not an object, so it cannot be edited here. It is kept as-is.',
      });
      return;
    }

    if (example.input === undefined && example.output === undefined) {
      issues.push({
        field: 'examples',
        path: `examples[${index}]`,
        severity: 'warning',
        message: `Example ${index + 1} has neither an input nor an output, so it shows nothing.`,
      });
    }
  });

  const schemaIds = options.schemaIds;
  if (
    schemaIds &&
    view.outputSchemaRef.trim().length > 0 &&
    !schemaIds.includes(view.outputSchemaRef.trim())
  ) {
    issues.push({
      field: 'output.schemaRef',
      path: 'output.schemaRef',
      severity: 'warning',
      message: `No stored schema has the id “${view.outputSchemaRef.trim()}”, so the output is not checked against one.`,
    });
  }

  const snippetIds = options.snippetIds;
  if (snippetIds) {
    for (const include of view.includes) {
      if (!snippetIds.includes(include)) {
        issues.push({
          field: 'includes',
          path: 'includes',
          severity: 'warning',
          message: `The document lists a snippet that is not in this library (“${include}”). The reference is kept, not silently removed.`,
        });
      }
    }
  }

  if (view.extras.length > 0) {
    issues.push({
      field: 'extras',
      path: 'extras',
      severity: 'warning',
      message: `${view.extras.length === 1 ? 'One field is' : `${view.extras.length} fields are`} outside this form (${view.extras.join(', ')}). ${
        view.extras.length === 1 ? 'It is' : 'They are'
      } preserved as written and never interpreted here.`,
    });
  }

  return issues;
}

/** The first error (or warning) attached to one field, for inline display. */
export function issueForField(
  issues: readonly ComposerIssue[],
  field: ComposerField,
  severity: 'error' | 'warning' = 'error',
): ComposerIssue | null {
  return (
    issues.find((issue) => issue.field === field && issue.severity === severity) ??
    issues.find((issue) => issue.field === field) ??
    null
  );
}

export function hasComposerErrors(issues: readonly ComposerIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

/* -------------------------------------------------------------------------- */
/* Completeness                                                               */
/* -------------------------------------------------------------------------- */

export interface ComposerCompleteness {
  readonly completed: number;
  readonly total: number;
  /** Section titles with nothing in them yet. */
  readonly missing: readonly string[];
}

/**
 * A count of sections that have *something* in them.
 *
 * Deliberately not a score: it says how much of the form is filled in, and says
 * nothing about whether the prompt is any good.
 */
export function describeCompleteness(view: ComposerView): ComposerCompleteness {
  const sections = [
    {
      title: 'Identity',
      done: view.name.trim().length > 0 && view.role.trim().length > 0,
    },
    { title: 'Task', done: view.objective.trim().length > 0 && view.instructions.length > 0 },
    {
      title: 'Context',
      done:
        view.contextDescription.trim().length > 0 ||
        view.contextReferences.length > 0 ||
        view.contextData !== undefined,
    },
    {
      title: 'Variables',
      done: view.variables.some((variable) => variable.name.trim().length > 0),
    },
    {
      title: 'Output',
      done: view.outputExample !== undefined || view.outputSchemaRef.trim().length > 0,
    },
    {
      title: 'Metadata',
      done: view.author.trim().length > 0 || view.tags.length > 0 || view.notes.trim().length > 0,
    },
  ];

  const missing = sections.filter((section) => !section.done).map((section) => section.title);
  return { completed: sections.length - missing.length, total: sections.length, missing };
}

/** A human name for a JSON-valued form field, so an error can say where it is. */
export function describeJsonFieldKey(key: string): string {
  const variable = /^variables\[(\d+)\]\.defaultValue$/.exec(key);
  if (variable) return `Variable ${Number(variable[1]) + 1} default value`;

  const example = /^examples\[(\d+)\]\.(input|output)$/.exec(key);
  if (example) return `Example ${Number(example[1]) + 1} ${example[2] ?? ''}`.trim();

  if (key === 'context.data') return 'Structured data';
  if (key === 'output.example') return 'Example output';
  return key;
}

/* -------------------------------------------------------------------------- */
/* Starters                                                                   */
/* -------------------------------------------------------------------------- */

export interface ComposerStarter {
  readonly id: 'blank' | 'sample';
  readonly label: string;
  readonly description: string;
  readonly create: () => JsonObject;
}

/** The two starting points the composer offers; nothing else is implied. */
export const COMPOSER_STARTERS: readonly ComposerStarter[] = [
  {
    id: 'blank',
    label: 'Blank document',
    description: 'Every section empty, with the canonical shape in place.',
    create: () => documentToJson(createBlankDocument()),
  },
  {
    id: 'sample',
    label: 'Worked example',
    description: 'A small release-notes prompt you can read, edit, or empty out.',
    create: () => documentToJson(createSampleDocument()),
  },
];

/** A fresh, valid document object for a new prompt. */
export function createComposerDocument(): JsonObject {
  return documentToJson(createBlankDocument());
}

/* -------------------------------------------------------------------------- */
/* Snippets                                                                   */
/* -------------------------------------------------------------------------- */

export type SnippetTargetId =
  | 'role'
  | 'objective'
  | 'context.description'
  | 'context.references'
  | 'instructions'
  | 'constraints'
  | 'metadata.notes';

export interface SnippetTarget {
  readonly id: SnippetTargetId;
  readonly label: string;
  readonly kind: 'text' | 'list';
}

export const SNIPPET_TARGETS: readonly SnippetTarget[] = [
  { id: 'role', label: 'Role', kind: 'text' },
  { id: 'objective', label: 'Objective', kind: 'text' },
  { id: 'context.description', label: 'Context description', kind: 'text' },
  { id: 'context.references', label: 'Context references', kind: 'list' },
  { id: 'instructions', label: 'Instructions', kind: 'list' },
  { id: 'constraints', label: 'Constraints', kind: 'list' },
  { id: 'metadata.notes', label: 'Metadata notes', kind: 'text' },
];

export function snippetValueFits(target: SnippetTarget, value: JsonValue): boolean {
  if (target.kind === 'text') return typeof value === 'string';
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function applyTextPatch(raw: JsonObject, target: SnippetTargetId, value: string): JsonObject {
  switch (target) {
    case 'role':
      return applyComposerPatch(raw, { field: 'role', value });
    case 'objective':
      return applyComposerPatch(raw, { field: 'objective', value });
    case 'context.description':
      return applyComposerPatch(raw, { field: 'context.description', value });
    case 'metadata.notes':
      return applyComposerPatch(raw, { field: 'metadata.notes', value });
    default:
      return raw;
  }
}

function applyListPatch(
  raw: JsonObject,
  target: SnippetTargetId,
  value: readonly string[],
): JsonObject {
  switch (target) {
    case 'instructions':
      return applyComposerPatch(raw, { field: 'instructions', value });
    case 'constraints':
      return applyComposerPatch(raw, { field: 'constraints', value });
    case 'context.references':
      return applyComposerPatch(raw, { field: 'context.references', value });
    default:
      return raw;
  }
}

/** The target a snippet suggests, or `instructions` when its path is not editable here. */
export function defaultSnippetTarget(snippet: Snippet): SnippetTargetId {
  const match = SNIPPET_TARGETS.find((target) => target.id === snippet.targetPath);
  return match ? match.id : 'instructions';
}

export type SnippetInsertResult =
  | { readonly ok: true; readonly raw: JsonObject; readonly message: string }
  | { readonly ok: false; readonly message: string };

function listAt(raw: JsonObject, target: SnippetTargetId): string[] {
  switch (target) {
    case 'instructions':
      return readStringList(raw.instructions);
    case 'constraints':
      return readStringList(raw.constraints);
    case 'context.references':
      return readStringList(readObject(raw, 'context').references);
    default:
      return [];
  }
}

function textAt(raw: JsonObject, target: SnippetTargetId): string {
  switch (target) {
    case 'role':
      return readString(raw, 'role');
    case 'objective':
      return readString(raw, 'objective');
    case 'context.description':
      return readString(readObject(raw, 'context'), 'description');
    case 'metadata.notes':
      return readString(readObject(raw, 'metadata'), 'notes');
    default:
      return '';
  }
}

function withIncludes(raw: JsonObject, snippetId: string): JsonObject {
  const includes = readStringList(raw.includes);
  return includes.includes(snippetId) ? raw : { ...raw, includes: [...includes, snippetId] };
}

/**
 * Inserts a snippet's value into the chosen section.
 *
 * Text fields are **replaced**; list fields are **appended** unless the exact
 * value is already there. The snippet id is recorded in `includes` either way,
 * and the returned message says which of those happened.
 */
export function applySnippet(
  raw: JsonObject,
  snippet: Snippet,
  targetId: SnippetTargetId,
): SnippetInsertResult {
  const target = SNIPPET_TARGETS.find((candidate) => candidate.id === targetId);
  if (!target)
    return { ok: false, message: `“${targetId}” is not a section the composer can fill.` };

  if (!snippetValueFits(target, snippet.value)) {
    return {
      ok: false,
      message: `“${snippet.name}” holds a ${Array.isArray(snippet.value) ? 'list' : typeof snippet.value}, which does not fit ${target.label.toLowerCase()}. Nothing was changed.`,
    };
  }

  if (target.kind === 'text') {
    const previous = textAt(raw, target.id).trim();
    const next = applyTextPatch(raw, target.id, snippet.value as string);

    return {
      ok: true,
      raw: withIncludes(next, snippet.id),
      message: previous
        ? `Replaced the ${target.label.toLowerCase()} with “${snippet.name}”.`
        : `Inserted “${snippet.name}” as the ${target.label.toLowerCase()}.`,
    };
  }

  const current = listAt(raw, target.id);
  const addition = snippet.value as readonly string[];
  const missing = addition.filter((entry) => !current.includes(entry));

  if (missing.length === 0) {
    return {
      ok: true,
      raw: withIncludes(raw, snippet.id),
      message: `“${snippet.name}” is already in ${target.label.toLowerCase()}; nothing was added.`,
    };
  }

  const next = applyListPatch(raw, target.id, [...current, ...missing]);

  return {
    ok: true,
    raw: withIncludes(next, snippet.id),
    message: `Added ${missing.length === 1 ? 'one entry' : `${missing.length} entries`} from “${snippet.name}” to ${target.label.toLowerCase()}.`,
  };
}
