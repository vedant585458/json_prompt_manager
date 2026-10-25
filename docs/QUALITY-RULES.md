# Quality rules

The quality inspector (TASK-024) reviews a prompt document against the fifteen
rules below and reports what it finds. It never edits anything, never scores
anything, and never calls a model.

- **Source of truth:** `src/domain/quality.ts` (`QUALITY_RULES`). The table here
  and the array there are kept in step by the reader, not by code — the array is
  what the screen renders, and `src/domain/quality.test.ts` fails if a rule is
  missing a title, a severity, a classification, an explanation of what it
  checks, or a caveat.
- **Where it runs:** the **Quality** tab in the prompt workspace
  (`/prompts/:promptId?panel=quality`), the header chip that counts its findings,
  the `quality.inspect` palette command, and the dashboard's "Needs attention"
  list (which escalates only the five defect rules, see §3).

## 1. Severities and classifications

| Severity  | Means                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| `error`   | Something the document promises cannot be delivered (a reference resolves to nothing, or a required part is missing). |
| `warning` | Probably a mistake, but the document still works.                                                                     |
| `info`    | A suggestion. Never counted against a prompt.                                                                         |

| Classification  | Promise                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| `deterministic` | A fact about the document. If the rule fired, the thing it names is really there.     |
| `heuristic`     | A rule of thumb about writing prompts. It can be wrong, and it is always dismissible. |

A heuristic rule is never an `error` — a rule of thumb cannot block anything. A
test enforces that.

## 2. The rules

### Deterministic

| Id                         | Severity | What it checks                                                                                                                   | Why it matters                                                                              | Caveat                                                                                                                                                |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name-missing`             | error    | `name` is empty after trimming.                                                                                                  | The name is the heading a reader sees first, and the playground and history screens use it. | The document parser refuses an empty name, so this can only fire on a corrupt row or a document built in code.                                        |
| `objective-missing`        | error    | `objective` is empty after trimming.                                                                                             | Without a stated task, the rest of the document has nothing to be consistent with.          | An objective can be implied by the instructions; the rule cannot tell.                                                                                |
| `instructions-empty`       | error    | `instructions` is an empty list.                                                                                                 | Instructions are the part of the document that actually asks for work.                      | A prompt built only from snippets or context is unusual but not impossible.                                                                           |
| `description-missing`      | warning  | The prompt record's `description` is empty.                                                                                      | The library shows the description under the title, which is how a reader picks a prompt.    | The description lives on the prompt record, not in the document, so this only runs when one is supplied; the finding has no "go to the field" action. |
| `undefined-variable`       | error    | A `{{name}}` token whose name is not in `variables`.                                                                             | Nothing can fill it in, so the rendered prompt keeps the braces instead of a value.         | The token is a plain substitution; there are no expressions or helpers to misread.                                                                    |
| `unused-variable`          | warning  | A `variables` entry whose name appears in no string in the document.                                                             | It asks a reader of the playground for a value that changes nothing in the text.            | Every string is scanned, including examples, metadata, and imported extras.                                                                           |
| `duplicate-instruction`    | warning  | Two `instructions` entries equal after trimming and ignoring case and spacing.                                                   | Repeated instructions consume attention and make it unclear whether they differ.            | The parser already removes _identical_ strings, so this fires on case/spacing variants only.                                                          |
| `duplicate-json-key`       | warning  | The same key twice in one object of the raw draft text.                                                                          | Reading JSON keeps the last value, so the earlier one is silently discarded.                | Needs the raw text; skipped when a caller supplies a document alone. Never guesses at invalid JSON.                                                   |
| `unexpected-property`      | info     | A top-level key that is not one of the document's fields (stored in `extras`).                                                   | The value round-trips on save but no screen reads it, so it is invisible work.              | It may be there on purpose for another tool that reads the same JSON.                                                                                 |
| `output-example-mismatch`  | warning  | `output.format` is `json` but the example is a string, or the format is `text`/`markdown` but the example is an object or array. | An example is read as a model of the answer, so the wrong shape teaches the wrong shape.    | Compares JSON types only; it says nothing about the content of the example.                                                                           |
| `missing-snippet`          | error    | `includes` names a snippet id the snippet library does not hold.                                                                 | The document claims a fragment is part of it, and there is nothing left to merge.           | Only runs when the snippet library is supplied; otherwise reported as skipped.                                                                        |
| `missing-schema-reference` | error    | `output.schemaRef` names a schema id that is not stored.                                                                         | Validation has nothing to check the output against, so the reference is a dead link.        | Only runs when the stored schema ids are supplied; otherwise reported as skipped.                                                                     |

### Heuristic

| Id                  | Severity | What it checks                   | Why it might matter                                                         | Caveat                                                                                                       |
| ------------------- | -------- | -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `role-missing`      | info     | `role` is empty after trimming.  | Naming who the prompt speaks as is a cheap way to steady its voice.         | Plenty of good prompts have no role.                                                                         |
| `examples-missing`  | info     | `examples` is an empty list.     | One input/output pair often communicates a shape faster than a description. | Short prompts rarely need one; an example can anchor a reader to one shape.                                  |
| `oversized-content` | warning  | A field past its threshold (§4). | Long single fields are hard to scan and usually hold several ideas.         | Thresholds are stated, never enforced; nothing is truncated. A deliberately long specification can be right. |

## 3. What the dashboard escalates

The dashboard's "Needs attention" list shows only the rules that describe an
**inconsistency** inside the prompt, because those are worth interrupting
somebody for:

`undefined-variable`, `duplicate-json-key`, `output-example-mismatch`,
`missing-snippet`, `missing-schema-reference`.

An unfinished draft (no objective, no instructions) is a draft, not a defect, and
a rule of thumb is not a reason to put a prompt on a list of things that need
attention. Both stay in the inspector, where the reader can judge them.

## 4. Thresholds

Used only by `oversized-content`, and printed on the screen:

| Field                       | Threshold        |
| --------------------------- | ---------------- |
| `objective`                 | 800 characters   |
| Each `instructions` entry   | 400 characters   |
| `context.description`       | 1,000 characters |
| `metadata.notes`            | 800 characters   |
| Whole document (serialized) | 8,000 characters |

Nothing is truncated, refused, or rewritten at these sizes.

## 5. Findings

Every finding carries: a stable id (a content hash), its rule id, severity,
classification, a document path (`instructions[2]`, `output.example`, `name`),
whether that path is inside the document, a title, an explanation of why the rule
fired, a suggested fix, and an evidence excerpt clipped to 160 characters with an
ellipsis when clipped.

- **Paths point at the document.** `Go to the field` moves the editor caret to
  that key in the draft. A record-level finding (`description-missing`) has no
  such action, because the field is not in the document.
- **Copy finding** copies exactly those lines, so a finding can be handed to
  somebody else without a screenshot.
- **The per-rule cap is 20 findings.** Past it the screen says how many were not
  shown instead of silently truncating.
- **Skipped checks are listed, with the missing input.** A rule that needs the
  snippet library or the schema list says so rather than guessing.

## 6. Dismissals

A dismissal is `{ ruleId, fingerprint, reason, dismissedAt }`, keyed by the
finding's fingerprint — a hash of the rule, the path, and the **full** offending
content.

- **A reason is required** (at least 3 characters, at most 300).
- **It is stored in this browser only**, under
  `promptforge.quality.dismissals.<promptId>`, next to the editor's recovery
  drafts. It never touches the prompt, its history, or the database: dismissing a
  suggestion is not editing a prompt.
- **It hides exactly one finding.** Other findings in the same prompt are
  unaffected.
- **It comes back when the content changes.** Editing the text the finding was
  made about produces a new fingerprint, so the finding is shown again and the old
  dismissal is reported as no longer matching — with a button to forget it.
- **It is reversible**: the dismissed list keeps the reason and a `Restore`
  button, plus `Restore all`.
- **A refused write is reported.** If this browser will not store the dismissal,
  the dialog says so and the finding stays visible; nothing pretends to have been
  saved.
