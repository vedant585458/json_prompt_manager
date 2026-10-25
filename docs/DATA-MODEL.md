# PromptForge data model

**Status:** implemented in TASK-005 (`src/domain/`). Persistence (TASK-006) stores these records
unchanged; the UI reads them through stores (TASK-007 onward).

This document is the contract for the domain layer: what an entity is, which values are allowed,
what uniqueness means, and how a prompt document is validated and serialized. Entity definitions
live in [`src/domain/types.ts`](../src/domain/types.ts); this file explains them.

---

## 1. Layer rules

| Rule                                                                  | Why                                                                         |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/domain/` imports nothing but itself                              | Domain logic must be testable without a DOM, a store, or IndexedDB          |
| No React, no `zustand`, no `idb`, no `window`/`document`/storage APIs | Verified by `src/domain/purity.test.ts`, which reads the sources            |
| Failures are values, not exceptions                                   | The UI renders `DomainIssue[]`; nothing has to be caught at the boundary    |
| Time and identity are injected                                        | `DomainDependencies { now, newId }` makes factories and tests deterministic |
| Everything is JSON-serializable                                       | The same shapes move through IndexedDB, the clipboard, and export bundles   |

Dependency direction: `routes → features → components → store → data → domain`.

---

## 2. Entities

All timestamps are ISO-8601 strings (`2026-10-24T09:41:07.123Z`); all IDs are opaque strings
(UUIDs in the app). Every field is `readonly`; edits produce new objects.

### Prompt

The unit the library lists. `content` is the canonical document (§5).

| Field                            | Type                                  | Notes                                                        |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `id`                             | `string`                              | UUID                                                         |
| `title`                          | `string`                              | Never empty; whitespace collapsed. Titles need not be unique |
| `description`                    | `string`                              | Free text, may be empty                                      |
| `content`                        | `PromptDocument`                      | Canonical JSON prompt (§5)                                   |
| `format`                         | `'json'`                              | Reserved; v1 stores JSON documents only                      |
| `folderId`                       | `string \| null`                      | `null` = Unfiled                                             |
| `collectionIds`                  | `string[]`                            | Many-to-many; cascade-cleaned when a collection is deleted   |
| `tags`                           | `string[]`                            | Normalized (§7.1), unique, insertion order preserved         |
| `favorite`, `pinned`, `archived` | `boolean`                             | Independent flags                                            |
| `status`                         | `'draft' \| 'active' \| 'deprecated'` | Defaults to `draft`                                          |
| `createdAt`, `updatedAt`         | ISO string                            | Equal at creation                                            |
| `schemaId`                       | `string \| null`                      | Stored JSON Schema used by the validation studio             |
| `variables`                      | `VariableDefinition[]`                | Denormalized from `content.variables` for list/query use     |
| `metadata`                       | `Record<string, string>`              | User-defined custom metadata (string values only)            |
| `version`                        | `number`                              | Optimistic concurrency counter, starts at 1                  |

### PromptRevision

Immutable snapshot used by history, diff, and restore.

| Field                                  | Type                                       | Notes                                              |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `id`                                   | `string`                                   | UUID                                               |
| `promptId`                             | `string`                                   | Owner                                              |
| `revisionNumber`                       | `number`                                   | Monotonic per prompt, starts at 1                  |
| `contentSnapshot`                      | `PromptDocument`                           | Deep copy; later edits cannot change it            |
| `titleSnapshot`, `descriptionSnapshot` | `string`                                   | Metadata at snapshot time                          |
| `tagsSnapshot`                         | `string[]`                                 | Normalized tags at snapshot time                   |
| `variablesSnapshot`                    | `VariableDefinition[]`                     | Variable declarations at snapshot time             |
| `label`                                | `string \| null`                           | `null` when the user did not describe the snapshot |
| `kind`                                 | `'manual' \| 'restore-safety' \| 'import'` | Why the revision exists                            |
| `createdAt`                            | ISO string                                 |                                                    |

### Organisation

| Entity       | Fields                                                                | Notes                                                 |
| ------------ | --------------------------------------------------------------------- | ----------------------------------------------------- |
| `Folder`     | `id`, `name`, `parentId` (`string \| null`), `createdAt`, `updatedAt` | Tree, max depth 5, no cycles, names unique per parent |
| `Collection` | `id`, `name`, `description`, `createdAt`, `updatedAt`                 | Flat grouping; a prompt can belong to several         |

### Content libraries

| Entity           | Fields                                                                                                              | Notes                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `PromptTemplate` | `id`, `name`, `description`, `category`, `content`, `isBuiltIn`, `createdAt`, `updatedAt`                           | Built-in templates are immutable; using one creates a new prompt                                                                   |
| `TestCase`       | `id`, `promptId`, `name`, `inputValues: Record<string, JsonValue>`, `expectedStructure: string \| null`, timestamps | Named variable inputs for the laboratory                                                                                           |
| `PromptSchema`   | `id`, `name`, `description`, `schemaContent: JsonObject`, timestamps                                                | Stored JSON Schema for validation                                                                                                  |
| `Snippet`        | `id`, `name`, `description`, `targetPath`, `value: JsonValue`, timestamps                                           | Reusable field fragment; `targetPath` is a dot path such as `context.description`; documents reference snippets through `includes` |
| `ActivityEvent`  | `id`, `type`, `promptId?`, `promptTitle?`, `summary`, `createdAt`                                                   | Capped log; `promptTitle` is a snapshot so deleted prompts stay readable                                                           |

`ActivityType` is `created \| updated \| deleted \| restored \| archived \| imported \| exported \|
snapshot \| validation \| settings`.

### Settings

Singleton record: `theme` (`dark \| light \| system`), `reducedMotion`, `indentSize` (`2 \| 4`),
`autosaveEnabled`, `autosaveDelayMs` (300–5000, default 900), `density` (`comfortable \| compact`),
`healthThresholds` (`{ attentionDays, staleDays, dormantDays }`, days clamped to 1–3650, default 30 / 60 / 90;
TASK-025), `onboardedAt` (`string \| null`), `seedVersion`. A record written before TASK-025 has no
`healthThresholds` field; readers normalise it to the defaults rather than migrating the row.

---

## 3. Relationships

```
Folder (self-referencing tree, depth ≤ 5)
  └── Prompt.folderId (nullable)

Collection ◀── Prompt.collectionIds (many-to-many, cascade-clean memberships)

Prompt ─┬─ PromptRevision.promptId        (1:N, revisions deleted with the prompt)
        ├─ TestCase.promptId              (1:N, deleted with the prompt)
        ├─ PromptDocument.includes → Snippet.id (N:M, by reference)
        └─ Prompt.schemaId → PromptSchema.id    (N:1, nullable)

PromptDocument.output.schemaRef → PromptSchema.id (declared expectation, nullable)
PromptTemplate → PromptDocument            (copy-on-use)
ActivityEvent → promptId (detached on delete, title snapshot retained)
```

---

## 4. Uniqueness and identity

| Rule              | Behaviour                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Folder names      | Unique within the same parent, compared case-insensitively after whitespace collapse (`checkFolderName`) |
| Folder tree       | No cycles; max depth 5 measured to the deepest descendant (`checkFolderMove`)                            |
| Deleting a folder | Prompts and child folders move to the parent (or root); prompts are never deleted                        |
| Prompt titles     | **Not** unique; conflicts are detected on import by title + content hash (TASK-026)                      |
| Revision numbers  | `(promptId, revisionNumber)` unique; new numbers come from `nextRevisionNumber`                          |
| Tags              | Normalized to lowercase hyphenated form, deduplicated, order preserved                                   |
| Activity log      | Newest 500 events kept (`capActivityLog`), stable ordering by `createdAt` then `id`                      |

---

## 5. Canonical prompt document

```jsonc
{
  "schemaVersion": "1.0", // required; unknown versions are an error
  "name": "Release notes summarizer",
  "role": "Senior release manager writing for busy engineers.",
  "objective": "Turn a changelog into release notes …",
  "instructions": ["Group changes by area …"],
  "context": {
    "description": "The changelog is supplied as JSON …",
    "references": ["Keep a Changelog 1.1.0"],
    "data": {},
  },
  "constraints": ["Never drop a breaking change."],
  "variables": [
    { "name": "version", "type": "string", "required": true, "description": "2.4.0" },
    {
      "name": "audience",
      "type": "string",
      "required": false,
      "defaultValue": "application developers",
    },
  ],
  "output": { "format": "json", "schemaRef": "schema-1", "example": {} },
  "examples": [{ "input": {}, "output": "" }],
  "metadata": { "author": "", "tags": ["documentation"], "notes": "" },
  "includes": [],
}
```

Full realistic example: run `formatDocument(createSampleDocument())`, or see §8 below.

### Field rules

| Field           | Type                    | Required | Rules                                                                                                         |
| --------------- | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | `"1.0"`                 | yes      | Missing, wrong type, or another version ⇒ **error**                                                           |
| `name`          | string                  | yes      | Non-empty after trimming, ≤ 120 chars                                                                         |
| `role`          | string                  | yes      | Empty string allowed but produces a **warning**                                                               |
| `objective`     | string                  | yes      | Empty string allowed but produces a **warning**                                                               |
| `instructions`  | string[]                | no       | Non-string entries ⇒ **error**; empty or duplicate entries ⇒ warning and removed                              |
| `context`       | object                  | no       | `description` string, `references` string[], `data` any JSON                                                  |
| `constraints`   | string[]                | no       | Same rules as `instructions`                                                                                  |
| `variables`     | `VariableDefinition[]`  | no       | See below                                                                                                     |
| `output`        | object                  | yes      | `format` ∈ `json \| text \| markdown` (missing ⇒ warning, default `json`); `schemaRef` string; `example` JSON |
| `examples`      | `{ input?, output? }[]` | no       | Non-object entries ⇒ error; an entry with neither side ⇒ warning and removed                                  |
| `metadata`      | object                  | no       | `author`, `notes` strings; `tags` string[] normalized; ≤ 4000 chars each                                      |
| `includes`      | string[]                | no       | Snippet IDs; duplicates and empties removed                                                                   |
| `extras`        | object                  | no       | Unknown top-level fields, preserved verbatim (§6)                                                             |

### Variable declarations

| Field          | Type                                          | Rules                                                                              |
| -------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `name`         | string                                        | `^[A-Za-z_][A-Za-z0-9_]*$` (mustache-friendly); duplicates keep the first and warn |
| `type`         | `'string' \| 'number' \| 'boolean' \| 'json'` | Missing ⇒ warning and defaults to `string`; unknown ⇒ error                        |
| `required`     | boolean                                       | Missing ⇒ warning and defaults to `true`; non-boolean ⇒ error                      |
| `defaultValue` | JSON                                          | Must be JSON data; a default that mismatches `type` ⇒ warning                      |
| `description`  | string                                        | Optional, trimmed                                                                  |

Values in a `TestCase`, the playground, and the laboratory are never evaluated as code, and
`defaultValue` is never interpreted as a template.

### Normalization

`validatePromptDocument` always returns the normalized interpretation of its input:

- strings are trimmed; empty optional strings are omitted rather than stored as `""`;
- empty list entries are dropped; lists are deduplicated (order preserved);
- variables are deduplicated by `name`; metadata tags are normalized (§7.1);
- `examples` with neither `input` nor `output` are dropped;
- unknown nested fields are dropped **with a warning**; unknown top-level fields are preserved.

`normalizeDocument(document)` applies the same rules to an already-typed document (used after
programmatic edits) and is idempotent.

### Issues

```ts
interface DomainIssue {
  path: string; // JSON path, e.g. 'variables[2].name'
  message: string; // actionable, user-facing
  severity: 'error' | 'warning';
}
```

Errors block persistence and import. Warnings mean the value was accepted but normalized, or that
the prompt is incomplete; they are surfaced, not swallowed.

```ts
const result = parseDocument(rawText);
if (!result.ok) {
  // result.issues: readonly DomainIssue[] — render directly
} else {
  result.value; // normalized PromptDocument
  result.issues; // warnings only
}
```

---

## 6. Serialization

`src/domain/serialization.ts` owns four guarantees:

1. **Canonical order.** `documentToJson` writes the canonical section order (§5); `formatDocument`
   pretty-prints with 2 spaces by default (the editor's indent setting is applied by the caller).
2. **Stable key order.** `stableStringify` sorts object keys, so equal values always produce equal
   text — the basis for hashing and for deterministic diffs (TASK-020).
3. **Round-trip fidelity.** Unknown top-level fields are captured into `PromptDocument.extras` and
   written back on export, so importing a document from a newer build does not silently lose data.
   Unknown _nested_ fields are reported and dropped because the section shapes are fixed.
4. **Typed failures.** `parseDocument` and `parseJson` return `DomainResult`; a malformed document
   produces `{ ok: false, issues }` with a line/column message. Nothing throws at the UI.

Hashing uses FNV-1a 64-bit (`hashString` → 16 hex chars, `contentHash`, `documentHash`). It is
synchronous and deterministic, and it is **not** a security primitive — it detects "did this
change?" for import conflicts and autosave diffs.

```ts
parseDocument(text); // DomainResult<PromptDocument>
parseJson(text); // DomainResult<JsonValue>
formatDocument(document, 2); // canonical pretty JSON
documentHash(document); // 16 hex chars, key-order independent
```

---

## 7. Invariants (`src/domain/invariants.ts`)

### 7.1 Tags

`normalizeTag`: trim → lowercase → spaces/underscores to hyphens → strip anything outside
`[a-z0-9-]` → collapse and strip edge hyphens → cap at 32 characters. `normalizeTags` drops empties
and duplicates. `hasTag` compares normalized forms.

### 7.2 Folders

- `folderDepth` counts the folder itself as depth 1; `null` when an ancestor is missing,
  `Infinity` for a corrupt cycle.
- `checkFolderName` rejects empty (>80 chars) names and duplicates within the same parent.
- `checkFolderMove` rejects self-parenting, moving into a descendant, a missing target, targeting a
  corrupt tree, and any move that would push a subtree past depth 5.
- `findFolderCycles` reports corrupt records so a repair screen can explain them (TASK-006).

### 7.3 Revisions and activity

`nextRevisionNumber` = highest existing number + 1; `isRevisionNumberAvailable` guards the unique
index; `sortRevisions` returns newest first without mutating input. `capActivityLog` keeps the
newest 500 events and is order-stable for identical timestamps.

### 7.4 Autosave delay

`clampAutosaveDelay` keeps the configured debounce inside 300–5000 ms and falls back to 900 ms for
non-finite input.

---

## 8. Factories and determinism

```ts
import { createPrompt, type DomainDependencies } from '@/domain';

const deps: DomainDependencies = {
  now: () => new Date('2026-10-24T09:41:07.123Z'),
  newId: () => 'id-1',
};
const prompt = createPrompt({ title: 'Summarizer' }, deps);
// prompt.id === 'id-1'; prompt.createdAt === '2026-10-24T09:41:07.123Z'
```

`systemDependencies` (the default) uses the real clock and `crypto.randomUUID`, with a
timestamp-based fallback when `crypto` is unavailable. Every factory:

- derives timestamps from `now()` and IDs from `newId()`;
- normalizes user input (titles, tags, descriptions, folder names);
- applies documented defaults — prompt `status: 'draft'`, `version: 1`, flags `false`,
  `format: 'json'`; settings `theme: 'system'`, `indentSize: 2`, `autosaveDelayMs: 900`,
  `density: 'comfortable'`, `healthThresholds` 30 / 60 / 90, `seedVersion: 0`;
- deep-copies documents where a snapshot must be independent (`createRevision`).

---

## 9. Example document (`createSampleDocument()`)

```json
{
  "schemaVersion": "1.0",
  "name": "Release notes summarizer",
  "role": "Senior release manager writing for busy engineers.",
  "objective": "Turn a changelog into release notes that a reader can skim in under a minute without losing accuracy.",
  "instructions": [
    "Group changes by area, strongest user impact first.",
    "Rewrite each entry in the active voice and keep one idea per line.",
    "Keep every breaking change, deprecation, and migration step.",
    "Do not invent entries that are absent from the changelog."
  ],
  "context": {
    "description": "The changelog is supplied as JSON with a \"changes\" array.",
    "references": ["Keep a Changelog 1.1.0", "Semantic Versioning 2.0.0"]
  },
  "constraints": [
    "Never drop a breaking change.",
    "Use plain language; expand internal codenames on first use.",
    "Stay within 250 words."
  ],
  "variables": [
    {
      "name": "version",
      "type": "string",
      "required": true,
      "description": "Version being released, e.g. 2.4.0."
    },
    {
      "name": "changes",
      "type": "json",
      "required": true,
      "description": "Array of change objects from the changelog export."
    },
    {
      "name": "audience",
      "type": "string",
      "required": false,
      "defaultValue": "application developers",
      "description": "Who the notes are written for."
    }
  ],
  "output": {
    "format": "markdown",
    "example": "## 2.4.0\n\n### Improved\n\n- Faster project search."
  },
  "examples": [
    {
      "input": {
        "version": "2.3.0",
        "changes": [{ "type": "fix", "summary": "Crash on empty import" }]
      },
      "output": "## 2.3.0\n\n### Fixed\n\n- Importing an empty file no longer crashes."
    }
  ],
  "metadata": {
    "author": "PromptForge",
    "tags": ["documentation", "release"],
    "notes": "Pair with the changelog schema before enabling validation."
  },
  "includes": []
}
```

It exists to exercise the format in the gallery, factories, and tests. A sample is **not** a claim
of prompt quality; that is what the quality inspector (TASK-024) is for.

---

## 10. Not in this task

- IndexedDB stores, indexes, migrations, and repositories (TASK-006).
- Stores, seeding, and first-run state (TASK-007).
- Template rendering, variable resolution, diffing, JSON Schema validation, quality rules, and the
  blueprint graph (TASK-016 onward).
- Import/export bundle envelopes and conflict resolution (TASK-026).
