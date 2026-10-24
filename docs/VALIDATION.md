# PromptForge — Validation

**Built in:** TASK-016.
**Authority:** `src/domain/jsonSchema.ts` and `src/domain/validation.ts` are the implementation; this page
is the readable contract. Decisions behind it: ADR-83…ADR-88 in [`DECISIONS.md`](./DECISIONS.md).

## What validation is, and what it is not

Validation answers two questions, and only these two:

1. **Is this text valid JSON?** If not, where exactly does it stop being JSON?
2. **Does this value match the rules it was given?** The PromptForge document shape always applies; an
   attached JSON Schema applies when a prompt points at one.

It is **not** a judgement of prompt quality, clarity, or whether a model will follow the instructions.
There is no score, grade, or percentage anywhere in the product, and the scope sentence that says so is
rendered on every validation surface and cannot be dismissed. Quality heuristics, if they arrive, belong
to TASK-024 and will use their own words.

## Three kinds of finding, four outcomes

| Kind       | Produced by                                      | Severity         | Blocks a save? |
| ---------- | ------------------------------------------------ | ---------------- | -------------- |
| `syntax`   | `scanJson` on the draft text                     | error            | yes            |
| `schema`   | schema compilation, or instance validation       | error            | yes            |
| `document` | `validatePromptDocument` (the PromptForge shape) | warning (always) | no             |

`ValidationReport.status` is one of `valid`, `warning`, `invalid`, `skipped`. `valid` means: the text
parsed, there are no schema errors, there are no document warnings, and a schema check actually ran
(`schemaStatus` `checked` or `none`). A check that did not run is never reported as `valid`.

`schemaStatus` distinguishes the schema outcomes so the UI never blames the document for a schema
problem:

| `schemaStatus` | Meaning                                                                                |
| -------------- | -------------------------------------------------------------------------------------- |
| `none`         | No schema is attached; only syntax and the document shape were checked.                |
| `checked`      | The schema compiled and the document was validated against it.                         |
| `rejected`     | The schema is unusable. Its problems are reported; **no** conformance findings follow. |
| `unchecked`    | A schema is attached but was not evaluated (for example, text past the size limit).    |

## Report shape

```ts
interface ValidationReport {
  status: 'valid' | 'warning' | 'invalid' | 'skipped';
  valid: boolean; // true only when everything was checked and nothing found
  syntaxOk: boolean;
  schemaStatus: 'none' | 'checked' | 'rejected' | 'unchecked';
  conforms: boolean | null; // null when nothing was checked against a schema
  counts: { syntax; schema; document; errors; warnings; total };
  issues: ValidationIssue[]; // syntax + schema + document findings
  schemaWarnings: ValidationIssue[]; // notes about the schema itself (unknown format, etc.)
  truncated: boolean; // the 100-error cap stopped the walk
  skippedReason: string | null; // why nothing was deep-checked, in words
}

interface ValidationIssue {
  kind: 'syntax' | 'schema' | 'document';
  severity: 'error' | 'warning';
  path: string; // `$.variables[0].name`, `$` for the root
  pointer: string; // `/variables/0/name`, `` for the root
  message: string;
  keyword?: string; // the rule responsible, e.g. `minLength`
  line?: number; // 1-based, syntax findings only
  column?: number; // 1-based, syntax findings only
}
```

Paths are `$`-rooted and pointers are RFC 6901, so a finding can be copied into other tooling and
`pathToPointer`/`pointerToPath` round-trip between the two forms.

## Supported JSON Schema

The validator is an in-house **interpreter** (ADR-83). It never compiles a schema to JavaScript, never
uses `eval` or `new Function`, and never fetches anything (ADR-87).

| Area            | Keywords                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Types           | `type` (`null`, `boolean`, `object`, `array`, `number`, `integer`, `string`), `enum`, `const`                                                |
| Numbers         | `multipleOf`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`                                                                   |
| Strings         | `minLength`, `maxLength` (counted in code points), `pattern`, `format`                                                                       |
| Arrays          | `items`, `prefixItems`, `minItems`, `maxItems`, `uniqueItems`                                                                                |
| Objects         | `properties`, `patternProperties`, `additionalProperties`, `required`, `minProperties`, `maxProperties`                                      |
| Combinators     | `allOf`, `anyOf`, `oneOf`, `not`                                                                                                             |
| References      | `$ref` (local `#/…` only), `$defs`, `definitions`                                                                                            |
| Annotations     | `$schema`, `$id`, `$anchor`, `$vocabulary`, `$comment`, `title`, `description`, `default`, `examples`, `deprecated`, `readOnly`, `writeOnly` |
| Boolean schemas | `true` (anything) and `false` (nothing)                                                                                                      |

**Formats actually checked:** `email`, `uri`, `date`, `date-time`, `time`, `uuid`, `ipv4`, `hostname`.
These are conservative pattern checks, not full RFC parsers. Any other format name is a **note on the
schema** — the document is not tested for it, and the note says so.

**Unsupported and refused** (both are compile errors, never silent passes — ADR-84): `if`, `then`,
`else`, `contains`, `minContains`, `maxContains`, `propertyNames`, `unevaluatedProperties`,
`unevaluatedItems`, `dependentRequired`, `dependentSchemas`, `additionalItems`, `contentEncoding`,
`contentMediaType`, `contentSchema`. Any keyword that is neither supported nor on this list — including a
misspelling such as `requird` — is reported as unrecognised, because a typo that checked nothing would
otherwise look like a pass.

The legacy tuple form of `items` (`items: [ … ]`) is accepted for compatibility but noted, because
draft 2020-12 uses `prefixItems` for positional validation.

## Bounds

| Guard                 | Value                | What happens past it                                              |
| --------------------- | -------------------- | ----------------------------------------------------------------- |
| Document text         | 2 000 000 characters | `status: 'skipped'`, a `skippedReason`, no findings               |
| Schema text           | 100 000 characters   | compile error, `schemaStatus: 'rejected'`                         |
| Schema nesting        | 64 levels            | compile error at the offending pointer                            |
| `pattern` source      | 512 characters       | compile error                                                     |
| `$ref` chain          | 32 hops              | validation error saying the chain is too deep, instead of looping |
| Reported errors       | 100                  | `truncated: true`, printed by the summary and the issue list      |
| Compiled schema cache | 32 schemas (LRU)     | the least recently used entry is rebuilt on demand                |

## Where findings appear

| Surface           | What it shows                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Editor inspector  | A `Validation` tab with the status pill, counts in words, the scope note, and the first findings with a **Find** action           |
| Editor            | Syntax errors keep their exact line/column and "Go to line"; schema and document findings jump to the nearest line for their path |
| Validation studio | `/validation?prompt=<id>`: selection, per-kind filters, issue list with copy-pointer and Find, schema library with usage counts   |
| Library           | A `Schema mismatch` badge beside, not instead of, the `Parses` badge                                                              |
| Dashboard         | A `schemaMismatches` count and a `schema-mismatch` attention row, ordered after parse failures                                    |
| Command palette   | _Validate the open prompt_ while a workspace has registered the action; `G V` navigates to the studio                             |

## Drafts, saving, and mutation

- **Validating a draft never saves it.** In the editor the live report runs against the current text on
  every parse; nothing is written. The studio reads what is stored and links back to the editor for edits.
- **Document warnings never block a save.** The save pipeline refuses invalid JSON and an invalid prompt
  document, and reports the reason; schema non-conformance is surfaced for attention but is not a
  precondition of storing the prompt.
- **Nothing is mutated.** `validateJsonText`, `compileJsonSchema`, and `validateInstance` are pure: they
  take values and return reports. The only state they touch is the bounded compile cache.

## Honesty rules the UI follows

- A schema that could not be used is described as a **schema** problem, never as an invalid prompt.
- A skipped check says it was skipped; it never renders as an empty (and therefore green-looking) result.
- Severity is never conveyed by colour alone: every finding carries its kind and severity in words, with an
  icon, and counts are printed as text.
- The summary line states what was checked (`Valid JSON — 1 schema error, 4 document warnings.`) and
  contains no synonym for "good".
