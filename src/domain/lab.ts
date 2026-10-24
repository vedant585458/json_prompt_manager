/**
 * Prompt laboratory (TASK-022).
 *
 * A saved test case is a name plus typed variable values. A *run* validates the
 * document and the case, renders the prompt, and reports what came out. Nothing
 * here calls a model: a run is a pure function from a document and values to
 * text, which is the only reason the screen can promise "local rendering only"
 * without an asterisk.
 *
 * Three kinds of finding are kept apart on purpose, because they have different
 * fixes:
 *
 * - **document** — the prompt document (or its attached schema) is not valid;
 * - **inputs** — the case does not answer the document's variables correctly;
 * - **render** — the render itself refused to produce text (caps, type errors).
 *
 * A second distinction runs across all three: an *error* blocks the run, a
 * *warning* does not. An undeclared placeholder, for example, is a warning: the
 * prompt still renders, and the placeholder stays visible in the output.
 */

import { scanJson } from '@/domain/jsonText';
import { validateInstance } from '@/domain/jsonSchema';
import { validatePromptDocument } from '@/domain/promptDocument';
import { renderPrompt, type RenderIssue, type RenderedPrompt } from '@/domain/render';
import { documentToJson } from '@/domain/serialization';
import type { JsonValue, PromptDocument, VariableDefinition } from '@/domain/types';
import { compileSchema, pointerToPath, validateJsonValue } from '@/domain/validation';
import { coerceVariableText, formatVariableInput } from '@/domain/variables';

/* -------------------------------------------------------------------------- */
/* Limits                                                                     */
/* -------------------------------------------------------------------------- */

export const LAB_LIMITS = {
  /** Saved cases per prompt. The laboratory lists them all, so it caps them. */
  maxCasesPerPrompt: 50,
  /** Characters in a case name, matching the rest of the app's titles. */
  maxCaseNameLength: 120,
  /** Characters of rendered output kept per run. */
  maxRunCharacters: 200_000,
} as const;

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export type LabProblemCategory = 'document' | 'inputs' | 'render';

export interface LabProblem {
  readonly category: LabProblemCategory;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  /** Readable location (`$.variables[0]`), for document findings. */
  readonly path?: string;
  /** Variable name, for input and render findings. */
  readonly name?: string;
}

export interface CaseCoverage {
  readonly declared: number;
  /** Variables answered by the case or by a declared default. */
  readonly answered: number;
  /** 0–100; 100 when the document declares no variables. */
  readonly percent: number;
}

export interface CaseInputsReport {
  /** Values the renderer will use; defaults are left for it to apply. */
  readonly values: Readonly<Record<string, JsonValue>>;
  readonly problems: readonly LabProblem[];
  /** Declared variables with neither a value nor a default. */
  readonly unresolved: readonly string[];
  /** Stored values for names the document no longer declares. */
  readonly unused: readonly string[];
  readonly coverage: CaseCoverage;
}

/** One sentence for a case card, e.g. `2 of 3 variables answered.` */
export function describeCoverage(coverage: CaseCoverage): string {
  if (coverage.declared === 0) return 'The document declares no variables.';
  return `${coverage.answered} of ${coverage.declared} variable${
    coverage.declared === 1 ? '' : 's'
  } answered.`;
}

/**
 * Checks a case's stored values against the document's declarations.
 *
 * The values are already typed JSON, so this is a type check rather than a
 * parse: `coerceVariableText` is the same function the renderer uses, which
 * means "the case validates" and "the case renders" cannot disagree.
 */
export function resolveCaseInputs(
  variables: readonly VariableDefinition[],
  inputValues: Readonly<Record<string, JsonValue>>,
): CaseInputsReport {
  const problems: LabProblem[] = [];
  const values: Record<string, JsonValue> = {};
  const unresolved: string[] = [];
  const declaredNames = new Set(variables.map((variable) => variable.name));

  let answered = 0;

  for (const variable of variables) {
    if (Object.hasOwn(inputValues, variable.name)) {
      const value = inputValues[variable.name] as JsonValue;
      const coerced = coerceVariableText(value, variable.type);

      if (!coerced.ok) {
        problems.push({
          category: 'inputs',
          severity: 'error',
          name: variable.name,
          message: `“${variable.name}” does not match its declared ${variable.type} type: ${coerced.error}`,
        });
        unresolved.push(variable.name);
        continue;
      }

      values[variable.name] = value;
      answered += 1;
      continue;
    }

    if (variable.defaultValue !== undefined) {
      // The renderer applies the default; the case is still "answered" by it.
      answered += 1;
      continue;
    }

    unresolved.push(variable.name);
    if (variable.required) {
      problems.push({
        category: 'inputs',
        severity: 'error',
        name: variable.name,
        message: `“${variable.name}” is required and this case has no value for it.`,
      });
    } else {
      problems.push({
        category: 'inputs',
        severity: 'warning',
        name: variable.name,
        message: `“${variable.name}” is optional and unanswered; its placeholder will stay visible.`,
      });
    }
  }

  for (const name of Object.keys(inputValues)) {
    if (declaredNames.has(name)) continue;
    problems.push({
      category: 'inputs',
      severity: 'warning',
      name,
      message: `“${name}” is stored on this case but the document no longer declares it.`,
    });
  }

  const unused = Object.keys(inputValues)
    .filter((name) => !declaredNames.has(name))
    .sort((left, right) => left.localeCompare(right));

  const declared = variables.length;
  const coverage: CaseCoverage = {
    declared,
    answered,
    percent: declared === 0 ? 100 : Math.round((answered / declared) * 100),
  };

  return { values, problems, unresolved, unused, coverage };
}

/**
 * The raw field text the playground should show for a saved case.
 *
 * A case stores typed values; the form holds text. `formatVariableInput` is the
 * same formatter the playground uses for restored values, so loading a case
 * cannot produce a field the form would then call invalid.
 */
export function formatCaseInputs(
  variables: readonly VariableDefinition[],
  inputValues: Readonly<Record<string, JsonValue>>,
): Record<string, string> {
  const text: Record<string, string> = {};

  for (const variable of variables) {
    const value = inputValues[variable.name];
    if (value === undefined) continue;
    text[variable.name] = formatVariableInput(variable, value);
  }

  return text;
}

/* -------------------------------------------------------------------------- */
/* Structure checks                                                           */
/* -------------------------------------------------------------------------- */

export type StructureStatus =
  'none' | 'missing-schema' | 'invalid-schema' | 'not-json' | 'pass' | 'fail';

export interface StructureFinding {
  readonly pointer: string;
  readonly path: string;
  readonly message: string;
}

export interface StructureCheck {
  readonly status: StructureStatus;
  /** One sentence describing the outcome; always present. */
  readonly message: string;
  readonly findings: readonly StructureFinding[];
}

export interface StructureCheckInput {
  /** Expected-structure schema content, or `null` when the case has none. */
  readonly schema: unknown;
  /** Set when the case references a schema id that is not stored. */
  readonly missingSchemaId?: string | null;
  readonly text: string;
}

/**
 * Checks a rendered prompt against a case's expected structure.
 *
 * The expectation is a JSON Schema for the *JSON the prompt should produce*, so
 * it can only be applied when the rendered text parses as JSON. When it does
 * not, the outcome is `not-json` rather than "failed": "this is prose" and "this
 * violates the schema" are different facts, and conflating them would make the
 * check look broken.
 */
export function checkStructure(input: StructureCheckInput): StructureCheck {
  if (input.missingSchemaId) {
    return {
      status: 'missing-schema',
      message: `The schema “${input.missingSchemaId}” this case expects is not in the library.`,
      findings: [],
    };
  }

  if (input.schema === null || input.schema === undefined) {
    return {
      status: 'none',
      message: 'This case does not expect a structure.',
      findings: [],
    };
  }

  const compiled = compileSchema(input.schema);
  if (!compiled.ok) {
    return {
      status: 'invalid-schema',
      message: 'The expected structure is not a usable JSON Schema, so nothing was checked.',
      findings: compiled.problems.map((problem) => ({
        pointer: problem.pointer,
        path: pointerToPath(problem.pointer),
        message: problem.message,
      })),
    };
  }

  const parsed = scanJson(input.text);
  if (!parsed.ok) {
    return {
      status: 'not-json',
      message: `The rendered text is not JSON, so the structure was not checked: line ${parsed.error.line}, column ${parsed.error.column}: ${parsed.error.message}`,
      findings: [],
    };
  }

  const result = validateInstance(compiled.schema, parsed.value);

  if (result.errors.length === 0) {
    return {
      status: 'pass',
      message: 'The rendered text matches the expected structure.',
      findings: [],
    };
  }

  return {
    status: 'fail',
    message: `The rendered text does not match the expected structure (${result.errors.length} finding${
      result.errors.length === 1 ? '' : 's'
    }).`,
    findings: result.errors.map((error) => ({
      pointer: error.pointer,
      path: pointerToPath(error.pointer),
      message: error.message,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Runs                                                                       */
/* -------------------------------------------------------------------------- */

/** The part of a saved test case a run needs. */
export interface LabCase {
  readonly id: string;
  readonly name: string;
  readonly inputValues: Readonly<Record<string, JsonValue>>;
}

export interface LabRunInput {
  readonly document: PromptDocument;
  /** Content of the schema attached to the prompt, or `null`. */
  readonly promptSchema: unknown;
  readonly testCase: LabCase;
  /** Content of the schema named by `testCase.expectedStructure`, or `null`. */
  readonly expectedSchema: unknown;
  /** Set when the case references a schema that is no longer stored. */
  readonly missingExpectedSchemaId?: string | null;
}

export type LabRunStatus = 'rendered' | 'blocked';

export interface LabRun {
  readonly caseId: string;
  readonly caseName: string;
  readonly status: LabRunStatus;
  readonly problems: readonly LabProblem[];
  readonly inputs: CaseInputsReport;
  readonly rendered: RenderedPrompt | null;
  /** The rendered text, or `''` when the run is blocked. */
  readonly text: string;
  /** Characters in `text` — a character count, never a token count. */
  readonly characters: number;
  /** Variables with no value that survive into the output. */
  readonly unresolved: readonly string[];
  readonly structure: StructureCheck;
}

function renderProblemsOf(issues: readonly RenderIssue[]): LabProblem[] {
  return issues.map((issue) => ({
    category: 'render' as const,
    severity: issue.severity,
    message: issue.message,
    ...(issue.name ? { name: issue.name } : {}),
    ...(issue.path ? { path: issue.path } : {}),
  }));
}

function blocked(
  input: LabRunInput,
  problems: readonly LabProblem[],
  inputs: CaseInputsReport,
  structure: StructureCheck,
): LabRun {
  return {
    caseId: input.testCase.id,
    caseName: input.testCase.name,
    status: 'blocked',
    problems,
    inputs,
    rendered: null,
    text: '',
    characters: 0,
    unresolved: inputs.unresolved,
    structure,
  };
}

/**
 * Runs one saved case against one version of a prompt.
 *
 * Order matters: the document and the case are checked first, because rendering
 * a document that is not valid, or with values that do not fit its declarations,
 * would produce text that looks like an answer to a question nobody asked.
 */
export function runTestCase(input: LabRunInput): LabRun {
  const inputs = resolveCaseInputs(input.document.variables, input.testCase.inputValues);

  // The document rules carry their own severities. The validation studio demotes
  // them to warnings because a shape problem must never block a *save* (ADR-86);
  // a *run* is the opposite case: a document whose shape is wrong cannot be
  // rendered at all, so its errors block here.
  const documentResult = validatePromptDocument(documentToJson(input.document));
  const documentProblems: LabProblem[] = documentResult.ok
    ? []
    : documentResult.issues.map((issue) => ({
        category: 'document' as const,
        severity: issue.severity,
        message: issue.message,
        path: issue.path.length > 0 ? `$.${issue.path}` : '$',
      }));

  // Conformance to the prompt's attached schema is about the document's content,
  // so it is reported in the same category, and its errors block a run.
  if (input.promptSchema !== null && input.promptSchema !== undefined) {
    const report = validateJsonValue(documentToJson(input.document), {
      schema: input.promptSchema,
      checkDocument: false,
    });

    for (const issue of report.issues) {
      documentProblems.push({
        category: 'document',
        severity: issue.severity,
        message: issue.message,
        path: issue.path,
      });
    }
  }

  const skippedStructure: StructureCheck = {
    status: 'none',
    message: 'The structure was not checked because the run did not render.',
    findings: [],
  };

  const blocking = [...documentProblems, ...inputs.problems].filter(
    (problem) => problem.severity === 'error',
  );

  if (blocking.length > 0) {
    return blocked(input, [...documentProblems, ...inputs.problems], inputs, skippedStructure);
  }

  let rendered: RenderedPrompt;
  try {
    rendered = renderPrompt(input.document, inputs.values);
  } catch (error) {
    // A document that passes its shape rules should never throw, so this is a
    // guard rather than an expected path. Reporting it as a blocked run keeps a
    // single bad document from taking down the laboratory.
    return blocked(
      input,
      [
        ...documentProblems,
        ...inputs.problems,
        {
          category: 'document',
          severity: 'error',
          message: `The document could not be rendered: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        },
      ],
      inputs,
      skippedStructure,
    );
  }

  // An input problem and a render problem can describe the same variable (a
  // missing optional value is both). The input finding is the actionable one, so
  // the render copy is dropped to keep one issue per variable.
  const inputNames = new Set(
    inputs.problems
      .map((problem) => problem.name)
      .filter((name): name is string => typeof name === 'string'),
  );
  const renderProblems = renderProblemsOf(rendered.issues).filter(
    (problem) => !problem.name || !inputNames.has(problem.name),
  );

  const problems: LabProblem[] = [...documentProblems, ...inputs.problems, ...renderProblems];

  if (rendered.blocked) {
    return blocked(input, problems, inputs, skippedStructure);
  }

  const structure = checkStructure({
    schema: input.expectedSchema,
    missingSchemaId: input.missingExpectedSchemaId ?? null,
    text: rendered.text,
  });

  const unresolved = [
    ...new Set([
      ...inputs.unresolved,
      ...rendered.issues
        .filter((issue) => issue.code === 'missing-optional' || issue.code === 'undeclared')
        .map((issue) => issue.name)
        .filter((name): name is string => typeof name === 'string'),
    ]),
  ].sort((left, right) => left.localeCompare(right));

  return {
    caseId: input.testCase.id,
    caseName: input.testCase.name,
    status: 'rendered',
    problems,
    inputs,
    rendered,
    text: rendered.text,
    characters: rendered.characters,
    unresolved,
    structure,
  };
}

/** `Rendered · 1,284 characters, 2 warnings.` — used on result cards. */
export function describeLabRun(run: LabRun): string {
  const errors = run.problems.filter((problem) => problem.severity === 'error').length;
  const warnings = run.problems.length - errors;

  if (run.status === 'blocked') {
    return `${errors} problem${errors === 1 ? '' : 's'} blocked this run.`;
  }

  const parts = [`${run.characters.toLocaleString()} characters`];
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  if (run.unresolved.length > 0) {
    parts.push(
      `${run.unresolved.length} unresolved variable${run.unresolved.length === 1 ? '' : 's'}`,
    );
  }

  return `Rendered · ${parts.join(' · ')}.`;
}

/** Counts for the laboratory's header: how many runs produced text. */
export function summarizeLabRuns(runs: readonly LabRun[]): {
  readonly rendered: number;
  readonly blocked: number;
  readonly total: number;
} {
  const rendered = runs.filter((run) => run.status === 'rendered').length;
  return { rendered, blocked: runs.length - rendered, total: runs.length };
}
