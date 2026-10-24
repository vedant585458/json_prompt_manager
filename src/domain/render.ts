/**
 * Prompt rendering (TASK-021).
 *
 * `renderPrompt` turns a document plus values into the text a person would send:
 * `{{name}}` tokens are replaced with the declared variable's value, the prose
 * fields are laid out under headings, and everything that could not be resolved
 * is named. Three properties are non-negotiable:
 *
 * 1. **No evaluation.** There is no expression syntax, no helper lookup, no
 *    function call, and no `eval`, `Function`, timer, or `import()` anywhere in
 *    this module or its dependencies. A token is matched, its identifier is read,
 *    and that identifier is looked up in an object. That is the whole language.
 * 2. **Nothing is silently dropped.** An undeclared name, an unclosed token, an
 *    unusable placeholder, or a value of the wrong type is copied through and
 *    reported. A missing required variable blocks the render instead of
 *    producing a prompt that looks finished.
 * 3. **Deterministic output.** The same document and values always produce the
 *    same text, byte for byte, with sections in a fixed order.
 *
 * Only the prose fields are rendered (role, objective, instructions, context
 * description, references, constraints). Examples, output configuration, and
 * metadata are part of the document but not of the text; the screen says so, and
 * variable extraction still scans them so a token there is never invisible.
 */

import type { JsonValue, PromptDocument, VariableDefinition, VariableType } from '@/domain/types';
import { coerceVariableText, scanTemplate, type TemplateTokenProblem } from '@/domain/variables';

/* -------------------------------------------------------------------------- */
/* Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** A rendered prompt longer than this is refused rather than displayed. */
export const MAX_RENDER_CHARACTERS = 200_000;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type RenderSegmentKind = 'text' | 'value' | 'unresolved' | 'unknown' | 'invalid';

export interface RenderSegment {
  readonly kind: RenderSegmentKind;
  /** The exact text this segment contributes. */
  readonly text: string;
  /** The variable name, when the segment is a token. */
  readonly name?: string;
}

export type RenderIssueCode =
  | 'missing-required'
  | 'missing-optional'
  | 'undeclared'
  | 'invalid-token'
  | 'type-mismatch'
  | 'too-many-tokens'
  | 'too-large';

export interface RenderIssue {
  readonly severity: 'error' | 'warning';
  readonly code: RenderIssueCode;
  readonly message: string;
  readonly name?: string;
  readonly path?: string;
}

export type RenderSectionId =
  'role' | 'objective' | 'instructions' | 'context' | 'references' | 'constraints';

export interface RenderSection {
  readonly id: RenderSectionId;
  readonly title: string;
  /** The section body with values substituted; tokens keep their raw text. */
  readonly text: string;
  readonly segments: readonly RenderSegment[];
}

export interface RenderedPrompt {
  readonly sections: readonly RenderSection[];
  /** The complete text; empty when `blocked`. */
  readonly text: string;
  /** Characters in `text`. */
  readonly characters: number;
  /** True when an error-severity issue makes the output untrustworthy. */
  readonly blocked: boolean;
  readonly issues: readonly RenderIssue[];
  /** Declared variables with no value and no default, in declaration order. */
  readonly missing: readonly string[];
  /** The values actually used, including defaults. */
  readonly values: Readonly<Record<string, JsonValue>>;
}

/** Scanning context for one string: what exists, and what it is worth. */
export interface RenderContext {
  readonly declared: ReadonlyMap<string, VariableType>;
  readonly values: Readonly<Record<string, JsonValue>>;
  /** Where this text came from, for issue detail. */
  readonly path?: string;
}

export interface TemplateRender {
  readonly segments: readonly RenderSegment[];
  readonly text: string;
  readonly issues: readonly RenderIssue[];
}

/* -------------------------------------------------------------------------- */
/* One string                                                                 */
/* -------------------------------------------------------------------------- */

const PROBLEM_MESSAGES: Readonly<Record<TemplateTokenProblem, string>> = {
  unclosed: 'This “{{” is never closed, so it is shown as written.',
  'empty-name': '“{{}}” does not name a variable, so it is shown as written.',
  'invalid-name':
    'This placeholder is not a variable name. Only letters, digits, and underscores are supported — no expressions.',
};

/**
 * Renders one string against the declared variables.
 *
 * Unresolved, undeclared, and invalid tokens are copied through with a distinct
 * segment kind so the interface can mark them inline; none of them is dropped.
 */
export function renderTemplateString(text: string, context: RenderContext): TemplateRender {
  const scan = scanTemplate(text);
  const segments: RenderSegment[] = [];
  const issues: RenderIssue[] = [];
  const reported = new Set<string>();

  const report = (issue: RenderIssue) => {
    const key = `${issue.code}\u0000${issue.name ?? issue.message}`;
    if (reported.has(key)) return;
    reported.add(key);
    issues.push(issue);
  };

  let cursor = 0;

  for (const token of scan.tokens) {
    if (token.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, token.start) });
    }

    if (token.problem !== null) {
      segments.push({ kind: 'invalid', text: token.raw });
      report({
        severity: 'warning',
        code: 'invalid-token',
        message: PROBLEM_MESSAGES[token.problem],
        ...(context.path ? { path: context.path } : {}),
      });
      cursor = token.end;
      continue;
    }

    const name = token.name as string;
    const type = context.declared.get(name);

    if (type === undefined) {
      segments.push({ kind: 'unknown', text: token.raw, name });
      report({
        severity: 'warning',
        code: 'undeclared',
        message: `“${name}” is not declared as a variable, so it is shown as written.`,
        name,
        ...(context.path ? { path: context.path } : {}),
      });
      cursor = token.end;
      continue;
    }

    if (!Object.hasOwn(context.values, name)) {
      segments.push({ kind: 'unresolved', text: token.raw, name });
      report({
        severity: 'warning',
        code: 'missing-optional',
        message: `“${name}” has no value, so the placeholder is shown as written.`,
        name,
        ...(context.path ? { path: context.path } : {}),
      });
      cursor = token.end;
      continue;
    }

    const coerced = coerceVariableText(context.values[name] as JsonValue, type);
    if (!coerced.ok) {
      segments.push({ kind: 'unresolved', text: token.raw, name });
      report({
        severity: 'error',
        code: 'type-mismatch',
        message: `“${name}” could not be inserted: ${coerced.error}`,
        name,
        ...(context.path ? { path: context.path } : {}),
      });
    } else {
      segments.push({ kind: 'value', text: coerced.text, name });
    }

    cursor = token.end;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }

  if (scan.truncated) {
    report({
      severity: 'error',
      code: 'too-many-tokens',
      message: 'This field holds more placeholders than the preview will resolve.',
      ...(context.path ? { path: context.path } : {}),
    });
  }

  return { segments, text: segments.map((segment) => segment.text).join(''), issues };
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

interface SectionSource {
  readonly id: RenderSectionId;
  readonly title: string;
  /** One entry per paragraph; `prefix` is added when present. */
  readonly paragraphs: readonly {
    readonly text: string;
    readonly prefix?: string;
    readonly path: string;
  }[];
}

function sectionSources(document: PromptDocument): SectionSource[] {
  return [
    {
      id: 'role',
      title: 'Role',
      paragraphs: [{ text: document.role, path: 'role' }],
    },
    {
      id: 'objective',
      title: 'Objective',
      paragraphs: [{ text: document.objective, path: 'objective' }],
    },
    {
      id: 'instructions',
      title: 'Instructions',
      paragraphs: document.instructions.map((text, index) => ({
        text,
        prefix: `${index + 1}. `,
        path: `instructions[${index}]`,
      })),
    },
    {
      id: 'context',
      title: 'Context',
      paragraphs: document.context.description
        ? [{ text: document.context.description, path: 'context.description' }]
        : [],
    },
    {
      id: 'references',
      title: 'References',
      paragraphs: (document.context.references ?? []).map((text, index) => ({
        text,
        prefix: '- ',
        path: `context.references[${index}]`,
      })),
    },
    {
      id: 'constraints',
      title: 'Constraints',
      paragraphs: document.constraints.map((text, index) => ({
        text,
        prefix: '- ',
        path: `constraints[${index}]`,
      })),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* The whole document                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Renders a document with the supplied values.
 *
 * Values may omit optional variables with defaults — the default is used. A
 * required variable with neither a value nor a default produces a
 * `missing-required` error and makes `blocked` true, in which case `text` is
 * empty: a partly rendered prompt would look finished and is worse than none.
 */
export function renderPrompt(
  document: PromptDocument,
  values: Readonly<Record<string, JsonValue>>,
): RenderedPrompt {
  const declared = new Map<string, VariableType>(
    document.variables.map((variable) => [variable.name, variable.type]),
  );

  const effective: Record<string, JsonValue> = {};
  const issues: RenderIssue[] = [];
  const missing: string[] = [];

  for (const variable of document.variables) {
    if (Object.hasOwn(values, variable.name)) {
      effective[variable.name] = values[variable.name] as JsonValue;
      continue;
    }

    if (variable.defaultValue !== undefined) {
      effective[variable.name] = variable.defaultValue;
      continue;
    }

    missing.push(variable.name);
    issues.push(
      variable.required
        ? {
            severity: 'error',
            code: 'missing-required',
            message: `“${variable.name}” is required and has no value.`,
            name: variable.name,
          }
        : {
            severity: 'warning',
            code: 'missing-optional',
            message: `“${variable.name}” is optional and has no value; its placeholder is shown as written.`,
            name: variable.name,
          },
    );
  }

  const context: RenderContext = { declared, values: effective };
  const sections: RenderSection[] = [];
  const issuesByName = new Map<string, RenderIssue>();

  // A required variable that is missing already has an error; the per-string
  // pass would also call it "optional and unresolved", which is both wrong and
  // noisy. One issue per variable is the rule.
  const requiredMissing = new Set(
    issues.filter((issue) => issue.code === 'missing-required').map((issue) => issue.name),
  );

  for (const issue of issues) {
    issuesByName.set(`${issue.code}\u0000${issue.name ?? issue.message}`, issue);
  }

  const addIssue = (issue: RenderIssue) => {
    if (issue.code === 'missing-optional' && issue.name && requiredMissing.has(issue.name)) return;
    const key = `${issue.code}\u0000${issue.name ?? issue.message}`;
    if (!issuesByName.has(key)) issuesByName.set(key, issue);
  };

  for (const source of sectionSources(document)) {
    const segments: RenderSegment[] = [];

    let wroteParagraph = false;

    for (const paragraph of source.paragraphs) {
      if (paragraph.text.trim().length === 0) continue;

      const rendered = renderTemplateString(paragraph.text, { ...context, path: paragraph.path });
      for (const issue of rendered.issues) addIssue(issue);

      if (wroteParagraph) segments.push({ kind: 'text', text: '\n' });
      if (paragraph.prefix) segments.push({ kind: 'text', text: paragraph.prefix });
      segments.push(...rendered.segments);
      wroteParagraph = true;
    }

    if (segments.length === 0) continue;

    sections.push({
      id: source.id,
      title: source.title,
      segments,
      text: segments.map((segment) => segment.text).join(''),
    });
  }

  issues.length = 0;
  issues.push(...issuesByName.values());

  const text = sections
    .map((section) => `${section.title.toUpperCase()}\n${section.text}`)
    .join('\n\n');

  const blockedByErrors = issues.some((issue) => issue.severity === 'error');

  if (!blockedByErrors && text.length > MAX_RENDER_CHARACTERS) {
    issues.push({
      severity: 'error',
      code: 'too-large',
      message: `The rendered prompt is ${text.length.toLocaleString()} characters; the preview limit is ${MAX_RENDER_CHARACTERS.toLocaleString()}.`,
    });
  }

  const blocked = issues.some((issue) => issue.severity === 'error');

  return {
    sections: blocked ? [] : sections,
    text: blocked ? '' : text,
    characters: blocked ? 0 : text.length,
    blocked,
    issues,
    missing,
    values: effective,
  };
}

/* -------------------------------------------------------------------------- */
/* Summaries                                                                  */
/* -------------------------------------------------------------------------- */

/** `5 sections, 1,284 characters` — one phrasing for the panel and the tests. */
export function describeRenderedPrompt(rendered: RenderedPrompt): string {
  const sections = rendered.sections.length;
  const characters = rendered.characters.toLocaleString();

  if (rendered.blocked) return 'Not rendered.';
  if (sections === 0) return 'Nothing to render.';

  return `${sections} ${sections === 1 ? 'section' : 'sections'}, ${characters} ${
    rendered.characters === 1 ? 'character' : 'characters'
  }.`;
}

/** A sentence naming what is unresolved, or `null` when everything resolved. */
export function describeRenderIssues(issues: readonly RenderIssue[]): string | null {
  if (issues.length === 0) return null;

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;

  const parts: string[] = [];
  if (errors > 0)
    parts.push(`${errors} ${errors === 1 ? 'problem blocks' : 'problems block'} the preview`);
  if (warnings > 0) parts.push(`${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`);

  return `${parts.join(', ')}.`;
}

/** Variables declared with no value and no default, for the form's summary. */
export function missingVariables(
  variables: readonly VariableDefinition[],
  values: Readonly<Record<string, JsonValue>>,
): readonly VariableDefinition[] {
  return variables.filter(
    (variable) => !Object.hasOwn(values, variable.name) && variable.defaultValue === undefined,
  );
}
