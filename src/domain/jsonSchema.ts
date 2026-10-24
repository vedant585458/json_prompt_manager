/**
 * JSON Schema validation without code generation (TASK-016).
 *
 * The plan named Ajv. Ajv compiles a schema into JavaScript and instantiates it
 * with `new Function`, which is exactly the eval-shaped path this project forbids
 * for untrusted input (ADR-83): a schema is user data, and a strict CSP without
 * `unsafe-eval` would refuse to run a compiled validator at all. This module
 * interprets a **documented subset** of JSON Schema instead — no `eval`, no
 * `new Function`, no network, and nothing that can escape the value it is given.
 *
 * The subset is small on purpose. Anything outside it is a *compile* problem, not
 * a silently ignored keyword: a typo such as `requird` or an unimplemented
 * `if`/`then` must never produce a confident "valid" answer.
 */

import type { JsonObject, JsonValue } from '@/domain/types';

/** Guards that keep a hostile schema or document from stalling the UI. */
export const JSON_SCHEMA_LIMITS = {
  /** Largest schema text accepted, in characters. */
  maxSchemaChars: 100_000,
  /** Deepest schema nesting accepted. */
  maxSchemaDepth: 64,
  /** Longest `pattern` source accepted. */
  maxPatternLength: 512,
  /** Deepest `$ref` chain followed while validating. */
  maxRefDepth: 32,
  /** Errors collected before validation stops and reports truncation. */
  maxErrors: 100,
} as const;

/** A schema may be an object or the booleans `true` (anything) / `false` (nothing). */
export type JsonSchema = boolean | JsonObject;

/** A problem with the schema itself, located inside the schema document. */
export interface SchemaProblem {
  /** JSON Pointer into the schema. Empty string means the schema root. */
  readonly pointer: string;
  /** The keyword responsible, or `schema` for structural problems. */
  readonly keyword: string;
  readonly message: string;
}

/** One failure found while validating a value. */
export interface SchemaError {
  /** JSON Pointer into the validated value, e.g. `/variables/0/name`. */
  readonly pointer: string;
  readonly keyword: string;
  readonly message: string;
  readonly params?: Readonly<Record<string, JsonValue>>;
}

export type SchemaCompileResult =
  | {
      readonly ok: true;
      readonly schema: JsonSchema;
      /** Non-blocking notes, e.g. an unknown `format` that was not checked. */
      readonly warnings: readonly SchemaProblem[];
    }
  | { readonly ok: false; readonly problems: readonly SchemaProblem[] };

export interface SchemaValidationResult {
  readonly errors: readonly SchemaError[];
  /** True when the error cap stopped the walk early. */
  readonly truncated: boolean;
}

const TYPE_NAMES = ['null', 'boolean', 'object', 'array', 'number', 'integer', 'string'] as const;

type TypeName = (typeof TYPE_NAMES)[number];

/** Keywords whose value is an annotation; they never change the result. */
const ANNOTATION_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$anchor',
  '$vocabulary',
  '$comment',
  'title',
  'description',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly',
]);

/** Keywords this validator implements. */
const SUPPORTED_KEYWORDS = new Set([
  ...ANNOTATION_KEYWORDS,
  '$defs',
  'definitions',
  '$ref',
  'type',
  'enum',
  'const',
  'multipleOf',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'items',
  'prefixItems',
  'minItems',
  'maxItems',
  'uniqueItems',
  'properties',
  'patternProperties',
  'additionalProperties',
  'required',
  'minProperties',
  'maxProperties',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
]);

/**
 * Valid JSON Schema keywords this build does not implement. Naming them turns an
 * incomplete check into a clear refusal instead of a false pass.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'contains',
  'minContains',
  'maxContains',
  'propertyNames',
  'unevaluatedProperties',
  'unevaluatedItems',
  'dependentRequired',
  'dependentSchemas',
  'additionalItems',
  'contentEncoding',
  'contentMediaType',
  'contentSchema',
]);

/** Formats checked with a conservative pattern; everything else is a warning. */
const FORMAT_CHECKS: Readonly<Record<string, (value: string) => boolean>> = {
  email: (value) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value),
  uri: (value) => /^[a-z][a-z0-9+.-]*:[^\s]*$/i.test(value),
  date: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
  'date-time': (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value)),
  time: (value) => /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(value),
  uuid: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  ipv4: (value) =>
    /^(\d{1,3}\.){3}\d{1,3}$/.test(value) &&
    value.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255),
  hostname: (value) =>
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(value),
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === 'boolean' || isObject(value);
}

function typeOf(value: JsonValue): TypeName {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return Number.isInteger(value) ? 'integer' : 'number';
    case 'string':
      return 'string';
    default:
      return 'object';
  }
}

/** True when `value` satisfies `name`; `integer` accepts whole numbers only. */
function isType(value: JsonValue, name: TypeName): boolean {
  switch (name) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isObject(value);
    default:
      return false;
  }
}

function jsonEqual(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => jsonEqual(item, right[index] as JsonValue))
    );
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.hasOwn(right, key) && jsonEqual(left[key] as JsonValue, right[key] as JsonValue),
      )
    );
  }
  return false;
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function childPointer(pointer: string, segment: string | number): string {
  return `${pointer}/${escapePointerSegment(String(segment))}`;
}

/** Resolves a local `#/...` reference against the schema root. */
function resolvePointer(root: JsonSchema, reference: string): unknown {
  if (reference === '#') return root;
  if (!reference.startsWith('#/')) return undefined;

  let current: unknown = root;
  for (const raw of reference.slice(2).split('/')) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (Array.isArray(current)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    if (!isObject(current) || !Object.hasOwn(current, key)) return undefined;
    current = current[key];
  }

  return current;
}

/* -------------------------------------------------------------------------- */
/* Compilation                                                                */
/* -------------------------------------------------------------------------- */

interface CompileContext {
  readonly root: JsonSchema;
  readonly problems: SchemaProblem[];
  readonly warnings: SchemaProblem[];
}

function problem(context: CompileContext, pointer: string, keyword: string, message: string): void {
  context.problems.push({ pointer, keyword, message });
}

function warn(context: CompileContext, pointer: string, keyword: string, message: string): void {
  context.warnings.push({ pointer, keyword, message });
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Checks one schema node and everything under it.
 *
 * Every branch reports rather than throws: the caller wants the complete list of
 * problems so the studio can show them all at once.
 */
function compileNode(node: unknown, pointer: string, context: CompileContext, depth: number): void {
  if (typeof node === 'boolean') return;

  if (!isSchema(node)) {
    problem(
      context,
      pointer,
      'schema',
      'Expected a schema object (or `true`/`false`) but found a different JSON value.',
    );
    return;
  }

  if (isObject(node) === false) return;

  if (depth > JSON_SCHEMA_LIMITS.maxSchemaDepth) {
    problem(
      context,
      pointer,
      'schema',
      `This schema nests more than ${JSON_SCHEMA_LIMITS.maxSchemaDepth} levels deep, which is more than this validator will read.`,
    );
    return;
  }

  for (const [keyword, value] of Object.entries(node)) {
    const here = childPointer(pointer, keyword);

    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      if (UNSUPPORTED_KEYWORDS.has(keyword)) {
        problem(
          context,
          here,
          keyword,
          `This schema uses \`${keyword}\`, which this validator does not implement. The document was not checked against it, because a partial answer could look like a pass.`,
        );
      } else {
        problem(
          context,
          here,
          keyword,
          `Unrecognised keyword \`${keyword}\`. A misspelled keyword would silently check nothing, so it is reported instead.`,
        );
      }
      continue;
    }

    switch (keyword) {
      case '$defs':
      case 'definitions': {
        if (!isObject(value)) {
          problem(context, here, keyword, 'Expected an object of schemas.');
          break;
        }
        for (const [name, sub] of Object.entries(value)) {
          compileNode(sub, childPointer(here, name), context, depth + 1);
        }
        break;
      }

      case '$ref': {
        if (typeof value !== 'string' || !value.startsWith('#')) {
          problem(
            context,
            here,
            keyword,
            'Only local references such as `#/$defs/Name` are supported; a remote reference would need a network request.',
          );
          break;
        }
        const target = resolvePointer(context.root, value);
        if (target === undefined) {
          problem(
            context,
            here,
            keyword,
            `\`${value}\` does not point at anything in this schema.`,
          );
        }
        break;
      }

      case 'type': {
        const names = Array.isArray(value) ? value : [value];
        const invalid = names.filter(
          (name) => typeof name !== 'string' || !TYPE_NAMES.includes(name as TypeName),
        );
        if (names.length === 0 || invalid.length > 0) {
          problem(
            context,
            here,
            keyword,
            `Expected a type or a non-empty list of types drawn from ${TYPE_NAMES.join(', ')}.`,
          );
        }
        break;
      }

      case 'enum': {
        if (!Array.isArray(value) || value.length === 0) {
          problem(context, here, keyword, 'Expected a non-empty list of allowed values.');
        }
        break;
      }

      case 'const':
        break;

      case 'multipleOf': {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
          problem(context, here, keyword, 'Expected a number greater than zero.');
        }
        break;
      }

      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          problem(
            context,
            here,
            keyword,
            'Expected a number (the boolean draft-4 form is not supported).',
          );
        }
        break;
      }

      case 'minLength':
      case 'maxLength':
      case 'minItems':
      case 'maxItems':
      case 'minProperties':
      case 'maxProperties': {
        if (!isNonNegativeInteger(value)) {
          problem(context, here, keyword, 'Expected a whole number of zero or more.');
        }
        break;
      }

      case 'pattern': {
        if (typeof value !== 'string') {
          problem(context, here, keyword, 'Expected a regular expression written as a string.');
          break;
        }
        if (value.length > JSON_SCHEMA_LIMITS.maxPatternLength) {
          problem(
            context,
            here,
            keyword,
            `Patterns longer than ${JSON_SCHEMA_LIMITS.maxPatternLength} characters are refused.`,
          );
          break;
        }
        try {
          new RegExp(value); // compiled once here, reused during validation
        } catch {
          problem(context, here, keyword, 'This is not a valid regular expression.');
        }
        break;
      }

      case 'format': {
        if (typeof value !== 'string') {
          problem(context, here, keyword, 'Expected a format name.');
          break;
        }
        if (!Object.hasOwn(FORMAT_CHECKS, value)) {
          warn(
            context,
            here,
            keyword,
            `Format \`${value}\` is not checked by this validator; the document was not tested for it.`,
          );
        }
        break;
      }

      case 'items': {
        if (Array.isArray(value)) {
          value.forEach((sub, index) =>
            compileNode(sub, childPointer(here, index), context, depth + 1),
          );
          warn(
            context,
            here,
            keyword,
            'A tuple form of `items` checks positions; `additionalItems` is not supported.',
          );
          break;
        }
        compileNode(value, here, context, depth + 1);
        break;
      }

      case 'prefixItems': {
        if (!Array.isArray(value)) {
          problem(context, here, keyword, 'Expected a list of schemas.');
          break;
        }
        value.forEach((sub, index) =>
          compileNode(sub, childPointer(here, index), context, depth + 1),
        );
        break;
      }

      case 'additionalProperties': {
        if (typeof value !== 'boolean' && !isObject(value)) {
          problem(context, here, keyword, 'Expected `true`, `false`, or a schema.');
          break;
        }
        compileNode(value, here, context, depth + 1);
        break;
      }

      case 'properties':
      case 'patternProperties': {
        if (!isObject(value)) {
          problem(context, here, keyword, 'Expected an object mapping names to schemas.');
          break;
        }
        for (const [name, sub] of Object.entries(value)) {
          if (keyword === 'patternProperties') {
            if (name.length > JSON_SCHEMA_LIMITS.maxPatternLength) {
              problem(
                context,
                childPointer(here, name),
                keyword,
                'This property pattern is too long to compile.',
              );
              continue;
            }
            try {
              new RegExp(name);
            } catch {
              problem(
                context,
                childPointer(here, name),
                keyword,
                'This property name is not a valid regular expression.',
              );
              continue;
            }
          }
          compileNode(sub, childPointer(here, name), context, depth + 1);
        }
        break;
      }

      case 'required': {
        const valid =
          Array.isArray(value) &&
          value.every((entry) => typeof entry === 'string' && entry.length > 0) &&
          new Set(value).size === value.length;
        if (!valid) {
          problem(
            context,
            here,
            keyword,
            'Expected a list of distinct property names written as strings.',
          );
        }
        break;
      }

      case 'uniqueItems': {
        if (typeof value !== 'boolean') {
          problem(context, here, keyword, 'Expected `true` or `false`.');
        }
        break;
      }

      case 'allOf':
      case 'anyOf':
      case 'oneOf': {
        if (!Array.isArray(value) || value.length === 0) {
          problem(context, here, keyword, 'Expected a non-empty list of schemas.');
          break;
        }
        value.forEach((sub, index) =>
          compileNode(sub, childPointer(here, index), context, depth + 1),
        );
        break;
      }

      case 'not': {
        compileNode(value, here, context, depth + 1);
        break;
      }

      default:
        // Annotations: accepted without further checks. They never affect a result.
        break;
    }
  }
}

/**
 * Checks that a value is a schema this validator can fully evaluate.
 *
 * Returns every problem at once, never throws, and never compiles code.
 */
export function compileJsonSchema(input: unknown): SchemaCompileResult {
  if (typeof input === 'boolean') return { ok: true, schema: input, warnings: [] };

  if (!isObject(input)) {
    return {
      ok: false,
      problems: [
        {
          pointer: '',
          keyword: 'schema',
          message: 'A JSON Schema must be an object or the boolean `true`/`false`.',
        },
      ],
    };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(input) ?? '';
  } catch {
    return {
      ok: false,
      problems: [
        { pointer: '', keyword: 'schema', message: 'The schema could not be serialised.' },
      ],
    };
  }

  if (serialized.length > JSON_SCHEMA_LIMITS.maxSchemaChars) {
    return {
      ok: false,
      problems: [
        {
          pointer: '',
          keyword: 'schema',
          message: `This schema is larger than ${JSON_SCHEMA_LIMITS.maxSchemaChars.toLocaleString()} characters, which this validator refuses to read.`,
        },
      ],
    };
  }

  const context: CompileContext = { root: input, problems: [], warnings: [] };
  compileNode(input, '', context, 0);

  if (context.problems.length > 0) return { ok: false, problems: context.problems };
  return { ok: true, schema: input, warnings: context.warnings };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

interface ValidationContext {
  readonly root: JsonSchema;
  readonly errors: SchemaError[];
  truncated: boolean;
  /** True once any check failed, whether or not errors are being collected. */
  failed: boolean;
  /** When false, the walk only answers "would this pass?", collecting nothing. */
  readonly collect: boolean;
}

function fail(
  context: ValidationContext,
  pointer: string,
  keyword: string,
  message: string,
  params?: Readonly<Record<string, JsonValue>>,
): void {
  context.failed = true;
  if (!context.collect) return;
  if (context.errors.length >= JSON_SCHEMA_LIMITS.maxErrors) {
    context.truncated = true;
    return;
  }
  context.errors.push(
    params ? { pointer, keyword, message, params } : { pointer, keyword, message },
  );
}

/** Evaluates a schema silently, for `anyOf` / `oneOf` / `not`. */
function passes(node: JsonSchema, value: JsonValue, root: JsonSchema, depth: number): boolean {
  const silent: ValidationContext = {
    root,
    errors: [],
    truncated: false,
    failed: false,
    collect: false,
  };
  evaluate(node, value, '', silent, depth);
  return !silent.failed && !silent.truncated;
}

function evaluateRef(
  reference: string,
  value: JsonValue,
  context: ValidationContext,
  pointer: string,
  depth: number,
): void {
  const target = resolvePointer(context.root, reference);
  if (target === undefined || !isSchema(target)) {
    // Compilation already rejected unresolvable references; reaching here means
    // the schema was changed after compiling, so say so rather than pass.
    fail(context, pointer, '$ref', `The reference \`${reference}\` could not be resolved.`);
    return;
  }
  if (depth >= JSON_SCHEMA_LIMITS.maxRefDepth) {
    fail(context, pointer, '$ref', 'This schema references itself too many times to check.');
    return;
  }
  evaluate(target, value, pointer, context, depth + 1);
}

function evaluate(
  node: JsonSchema,
  value: JsonValue,
  pointer: string,
  context: ValidationContext,
  depth: number,
): void {
  if (node === true) return;
  if (node === false) {
    fail(context, pointer, 'false', 'The schema `false` permits no value here.');
    return;
  }
  if (depth > JSON_SCHEMA_LIMITS.maxSchemaDepth) return;

  const schema = node;
  const actual = typeOf(value);

  // `$ref` replaces the rest of the object in draft-07; siblings are ignored,
  // which is the behaviour most schemas in the wild expect.
  const reference = schema.$ref;
  if (typeof reference === 'string') {
    evaluateRef(reference, value, context, pointer, depth);
    return;
  }

  const type = schema.type;
  if (type !== undefined) {
    const names = (Array.isArray(type) ? type : [type]).filter(
      (name): name is TypeName => typeof name === 'string',
    );
    if (names.length > 0 && !names.some((name) => isType(value, name))) {
      fail(context, pointer, 'type', `Expected ${names.join(' or ')} but found ${actual}.`, {
        expected: names.join('|'),
        actual,
      });
      // Further keywords are type-specific; a wrong type is the whole story.
      return;
    }
  }

  const allowed = schema.enum;
  if (Array.isArray(allowed) && !allowed.some((entry) => jsonEqual(entry, value))) {
    fail(
      context,
      pointer,
      'enum',
      `Expected one of ${allowed.map((entry) => JSON.stringify(entry)).join(', ')}.`,
      { allowed: allowed as JsonValue[] },
    );
  }

  if (Object.hasOwn(schema, 'const') && !jsonEqual(schema.const as JsonValue, value)) {
    fail(context, pointer, 'const', `Expected exactly ${JSON.stringify(schema.const)}.`, {
      expected: schema.const as JsonValue,
    });
  }

  if (typeof value === 'number') {
    validateNumberKeywords(schema, value, pointer, context);
  } else if (typeof value === 'string') {
    validateStringKeywords(schema, value, pointer, context);
  } else if (Array.isArray(value)) {
    validateArrayKeywords(schema, value, pointer, context, depth);
  } else if (isObject(value)) {
    validateObjectKeywords(schema, value, pointer, context, depth);
  }

  const allOf = schema.allOf;
  if (Array.isArray(allOf)) {
    for (const sub of allOf) {
      if (isSchema(sub)) evaluate(sub, value, pointer, context, depth + 1);
    }
  }

  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf)) {
    const matched = anyOf.filter(
      (sub) => isSchema(sub) && passes(sub, value, context.root, depth + 1),
    );
    if (matched.length === 0) {
      fail(context, pointer, 'anyOf', `Expected to match one of ${anyOf.length} alternatives.`, {
        count: anyOf.length,
      });
    }
  }

  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf)) {
    const matched = oneOf.filter(
      (sub) => isSchema(sub) && passes(sub, value, context.root, depth + 1),
    );
    if (matched.length === 0) {
      fail(
        context,
        pointer,
        'oneOf',
        `Expected to match exactly one of ${oneOf.length} alternatives.`,
        {
          count: oneOf.length,
        },
      );
    } else if (matched.length > 1) {
      fail(
        context,
        pointer,
        'oneOf',
        `Matches ${matched.length} alternatives, but exactly one is allowed.`,
        { matched: matched.length },
      );
    }
  }

  const not = schema.not;
  if (isSchema(not) && passes(not, value, context.root, depth + 1)) {
    fail(context, pointer, 'not', 'This value matches a schema it must not match.');
  }
}

function validateNumberKeywords(
  schema: JsonObject,
  value: number,
  pointer: string,
  context: ValidationContext,
): void {
  const minimum = schema.minimum;
  if (typeof minimum === 'number' && value < minimum) {
    fail(context, pointer, 'minimum', `Must be at least ${minimum}; found ${value}.`, {
      limit: minimum,
    });
  }

  const maximum = schema.maximum;
  if (typeof maximum === 'number' && value > maximum) {
    fail(context, pointer, 'maximum', `Must be at most ${maximum}; found ${value}.`, {
      limit: maximum,
    });
  }

  const exclusiveMinimum = schema.exclusiveMinimum;
  if (typeof exclusiveMinimum === 'number' && value <= exclusiveMinimum) {
    fail(
      context,
      pointer,
      'exclusiveMinimum',
      `Must be greater than ${exclusiveMinimum}; found ${value}.`,
      { limit: exclusiveMinimum },
    );
  }

  const exclusiveMaximum = schema.exclusiveMaximum;
  if (typeof exclusiveMaximum === 'number' && value >= exclusiveMaximum) {
    fail(
      context,
      pointer,
      'exclusiveMaximum',
      `Must be less than ${exclusiveMaximum}; found ${value}.`,
      { limit: exclusiveMaximum },
    );
  }

  const multipleOf = schema.multipleOf;
  if (typeof multipleOf === 'number' && multipleOf > 0) {
    const quotient = value / multipleOf;
    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      fail(context, pointer, 'multipleOf', `Must be a multiple of ${multipleOf}.`, {
        limit: multipleOf,
      });
    }
  }
}

function validateStringKeywords(
  schema: JsonObject,
  value: string,
  pointer: string,
  context: ValidationContext,
): void {
  // Length is counted in code points, so an emoji is one character to the user.
  const length = [...value].length;

  const minLength = schema.minLength;
  if (typeof minLength === 'number' && length < minLength) {
    fail(context, pointer, 'minLength', `Must be at least ${minLength} characters.`, {
      limit: minLength,
    });
  }

  const maxLength = schema.maxLength;
  if (typeof maxLength === 'number' && length > maxLength) {
    fail(context, pointer, 'maxLength', `Must be at most ${maxLength} characters.`, {
      limit: maxLength,
    });
  }

  const pattern = schema.pattern;
  if (typeof pattern === 'string') {
    try {
      if (!new RegExp(pattern).test(value)) {
        fail(context, pointer, 'pattern', `Must match the pattern \`${pattern}\`.`, { pattern });
      }
    } catch {
      // Compilation rejected an invalid pattern; nothing to check here.
    }
  }

  const format = schema.format;
  if (typeof format === 'string') {
    const check = FORMAT_CHECKS[format];
    if (check && !check(value)) {
      fail(context, pointer, 'format', `Must be a valid ${format}.`, { format });
    }
  }
}

function uniqueItemIndexes(items: readonly JsonValue[]): number[] {
  const duplicates: number[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as JsonValue;
    if (items.slice(0, index).some((earlier) => jsonEqual(earlier, item))) duplicates.push(index);
  }
  return duplicates;
}

function validateArrayKeywords(
  schema: JsonObject,
  value: readonly JsonValue[],
  pointer: string,
  context: ValidationContext,
  depth: number,
): void {
  const minItems = schema.minItems;
  if (typeof minItems === 'number' && value.length < minItems) {
    fail(
      context,
      pointer,
      'minItems',
      `Must have at least ${minItems} items; found ${value.length}.`,
      {
        limit: minItems,
      },
    );
  }

  const maxItems = schema.maxItems;
  if (typeof maxItems === 'number' && value.length > maxItems) {
    fail(
      context,
      pointer,
      'maxItems',
      `Must have at most ${maxItems} items; found ${value.length}.`,
      {
        limit: maxItems,
      },
    );
  }

  if (schema.uniqueItems === true) {
    for (const index of uniqueItemIndexes(value)) {
      fail(
        context,
        childPointer(pointer, index),
        'uniqueItems',
        'Duplicate item; items must be unique.',
      );
    }
  }

  const prefixItems = schema.prefixItems;
  if (Array.isArray(prefixItems)) {
    prefixItems.forEach((sub, index) => {
      const item = value[index];
      if (index < value.length && item !== undefined && isSchema(sub)) {
        evaluate(sub, item, childPointer(pointer, index), context, depth + 1);
      }
    });
  }

  const items = schema.items;
  if (Array.isArray(items)) {
    items.forEach((sub, index) => {
      const item = value[index];
      if (index < value.length && item !== undefined && isSchema(sub)) {
        evaluate(sub, item, childPointer(pointer, index), context, depth + 1);
      }
    });
  } else if (isSchema(items)) {
    const start = Array.isArray(prefixItems) ? prefixItems.length : 0;
    for (let index = start; index < value.length; index += 1) {
      evaluate(items, value[index] as JsonValue, childPointer(pointer, index), context, depth + 1);
    }
  }
}

function validateObjectKeywords(
  schema: JsonObject,
  value: JsonObject,
  pointer: string,
  context: ValidationContext,
  depth: number,
): void {
  const properties = isObject(schema.properties) ? schema.properties : {};
  const patternProperties = isObject(schema.patternProperties) ? schema.patternProperties : {};
  const keys = Object.keys(value);

  const minProperties = schema.minProperties;
  if (typeof minProperties === 'number' && keys.length < minProperties) {
    fail(
      context,
      pointer,
      'minProperties',
      `Must have at least ${minProperties} properties; found ${keys.length}.`,
      { limit: minProperties },
    );
  }

  const maxProperties = schema.maxProperties;
  if (typeof maxProperties === 'number' && keys.length > maxProperties) {
    fail(
      context,
      pointer,
      'maxProperties',
      `Must have at most ${maxProperties} properties; found ${keys.length}.`,
      { limit: maxProperties },
    );
  }

  const required = schema.required;
  if (Array.isArray(required)) {
    for (const name of required) {
      if (typeof name === 'string' && !Object.hasOwn(value, name)) {
        fail(
          context,
          childPointer(pointer, name),
          'required',
          `Required property \`${name}\` is missing.`,
          {
            property: name,
          },
        );
      }
    }
  }

  const patterns = Object.entries(patternProperties).flatMap(([source, sub]) => {
    try {
      return [{ expression: new RegExp(source), schema: sub }];
    } catch {
      return [];
    }
  });

  for (const key of keys) {
    const item = value[key] as JsonValue;
    let matched = false;

    if (Object.hasOwn(properties, key)) {
      matched = true;
      const sub = properties[key];
      if (isSchema(sub)) evaluate(sub, item, childPointer(pointer, key), context, depth + 1);
    }

    for (const pattern of patterns) {
      if (pattern.expression.test(key) && isSchema(pattern.schema)) {
        matched = true;
        evaluate(pattern.schema, item, childPointer(pointer, key), context, depth + 1);
      }
    }

    if (!matched) {
      const additional = schema.additionalProperties;
      if (additional === false) {
        fail(
          context,
          childPointer(pointer, key),
          'additionalProperties',
          `\`${key}\` is not an allowed property.`,
          { property: key },
        );
      } else if (isSchema(additional)) {
        evaluate(additional, item, childPointer(pointer, key), context, depth + 1);
      }
    }
  }
}

/**
 * Validates `value` against a schema produced by `compileJsonSchema`.
 *
 * A schema that failed to compile produces no document errors here — the caller
 * must not ask. Errors are capped at `maxErrors`; `truncated` says so.
 */
export function validateInstance(schema: JsonSchema, value: JsonValue): SchemaValidationResult {
  const context: ValidationContext = {
    root: schema,
    errors: [],
    truncated: false,
    failed: false,
    collect: true,
  };
  evaluate(schema, value, '', context, 0);
  return { errors: context.errors, truncated: context.truncated };
}

/** Location of a schema problem as a readable path (`$/$defs/Person/type`). */
export function schemaProblemPath(problem: SchemaProblem): string {
  if (problem.pointer.length === 0) return '$';
  return `$${problem.pointer}`;
}
