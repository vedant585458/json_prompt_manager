# Import and export

PromptForge keeps everything in this browser's IndexedDB, which makes a local file
the only way to move a library between machines, keep a backup, or hand one prompt
to somebody else. This document describes that file: what it holds, what it cannot
hold, how an import validates it, and what happens when the data is wrong.

Everything in this document is implemented by `src/domain/transfer/` (pure),
`src/features/transfer/` (browser download), `src/components/transfer/` (the
dialog), and `DataStore.applyImport` (the write).

## Three files, one shape

| Marker               | `manifest.scope` | What it holds                                          | Produced by                                |
| -------------------- | ---------------- | ------------------------------------------------------ | ------------------------------------------ |
| `promptforge.bundle` | `library`        | Every record in the library, referenced or not         | Settings → **Download a backup**           |
| `promptforge.bundle` | `selection`      | The selected prompts plus everything they reference    | Library selection → **Export**             |
| `promptforge.prompt` | `prompt`         | One prompt plus everything it references               | Prompt workspace → **Export** (or palette) |
| _(none)_             | —                | A single prompt document, with no PromptForge metadata | Anywhere — a JSON file you already have    |

Both PromptForge markers share one envelope, so one reader understands both and a
single-prompt export cannot drift away from a backup. A file is JSON, UTF-8, and
pretty-printed with a fixed key order, so two exports of the same library differ
only in the `exportedAt` timestamp.

```json
{
  "format": "promptforge.bundle",
  "version": 1,
  "manifest": {
    "app": "PromptForge",
    "appVersion": "0.1.0",
    "exportedAt": "2026-10-25T09:30:00.000Z",
    "scope": "library",
    "counts": { "prompts": 2, "revisions": 2, "folders": 3, "collections": 1,
                "schemas": 1, "snippets": 1, "templates": 1, "testCases": 1 },
    "fidelity": ["Preserved: …", "Regenerated: …", "Not included: …", "…"]
  },
  "prompts": [ … ],
  "revisions": [ … ],
  "folders": [ … ],
  "collections": [ … ],
  "schemas": [ … ],
  "snippets": [ … ],
  "templates": [ … ],
  "testCases": [ … ]
}
```

`version` is the only version this build reads and writes. A file that declares
anything else is refused before a single record is looked at.

## What a file preserves

| Record            | Preserved as-is                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt            | title, description, document, format, tags, status, favorite, pinned, archived, folder, collections, attached schema, variable declarations, custom metadata, `createdAt`, `updatedAt`, `version` |
| Revision          | document and metadata snapshots, label, kind, `revisionNumber`, `createdAt`                                                                                                                       |
| Folder            | name, parent, timestamps                                                                                                                                                                          |
| Collection        | name, description, timestamps                                                                                                                                                                     |
| Schema            | name, description, JSON Schema content, timestamps                                                                                                                                                |
| Snippet           | name, description, target path, value, timestamps                                                                                                                                                 |
| Template          | name, description, category, document, timestamps (always imported as a user template)                                                                                                            |
| Test case         | name, input values, expected structure, timestamps                                                                                                                                                |
| Document `extras` | unknown top-level document fields, verbatim, because the editor round-trips them                                                                                                                  |

## What is regenerated

| Regenerated                      | Why                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Record ids, when they collide    | Two records cannot share an id. A free id is kept, so an import into an empty library reproduces the file exactly. |
| References to remapped records   | A prompt's folder, collection, schema, and snippet links are rewritten to the ids that were actually written.      |
| Test-case names that collide     | Case names are unique per prompt; `Short invoice` becomes `Short invoice (copy)`.                                  |
| Template names that collide      | A template whose name already exists here is skipped and reported, never overwritten.                              |
| Revision numbers on an overwrite | The stored prompt already owns numbers 1…n, so the imported history continues at n+1.                              |
| Folder names that collide        | A folder of the same name under the same parent is reused, and the prompt is linked to it instead of a duplicate.  |

Every id that changed is reported in the import result (`IdRemap`), and the dialog
explains how many records were affected.

## What is never in a file

The bundle format has no list for these, so they cannot be exported by accident:

- the activity log,
- settings and preferences (theme, density, autosave, health thresholds),
- recovery drafts,
- playground inputs,
- quality dismissals,
- onboarding state,
- storage metadata (database schema version, seed version).

`NON_TRANSFERRED_STATE` in `src/domain/transfer/bundle.ts` is the code-level copy of
this list, and a test asserts that a serialized backup contains neither
`"activity"`, `settings`, `recoveryDraft`, nor `healthThresholds`.

## Exporting

| Action           | Where                                                                          | Filename                                              |
| ---------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| One prompt       | Workspace header → **Export**, or the palette command _Export the open prompt_ | `promptforge-prompt-<slug>-YYYY-MM-DD.json`           |
| Selected prompts | Library bulk bar → **Export**                                                  | `promptforge-selection-<n>-prompt(s)-YYYY-MM-DD.json` |
| Full backup      | Settings → **Download a backup**                                               | `promptforge-backup-YYYY-MM-DD.json`                  |

Which records travel with a prompt:

- its folder **and every ancestor**, so a nested prompt never loses its place;
- its collections, its attached schema, and the snippets its document merges;
- all of its revisions, oldest first, and all of its test cases (and the schema a
  test case expects);
- templates only in a full backup, because a template is standalone — a selection
  cannot imply it.

Downloads go through `downloadJson` (`src/features/transfer/download.ts`): a
`Blob` of type `application/json`, an object URL, an anchor with a `download`
attribute, and a revoke on the next tick so the browser is not left holding the
blob. The filename is a slug (`safeSlug`), and the download helper strips path
separators, quotes, and control characters again before it hands the name to the
browser — a name can never be read as a path.

While a file is being prepared the button says **Preparing**; the toast afterwards
names the file, the number of prompts, and the byte size, and adds a "give the
browser a moment" note above 500 kB.

## Importing

The import is staged so that a failure at any point leaves the library untouched:

1. **Choose a file.** The text input accepts JSON; a file larger than **2 MB**
   (2,000,000 bytes, the same way every size in the app is printed) is refused
   before it is read.
2. **Read.** `readImportFile` parses the JSON, detects the format, and validates
   every record with `readBundle`.
3. **Preview.** Each prompt becomes a row with its folder, collections, schema,
   counts, content hash, and any conflict with the stored library. Nothing is
   written. The confirm button names the exact number of prompts that will be
   written.
4. **Decide.** Per prompt: add as new, add as a copy, skip, or overwrite. The
   defaults are described below.
5. **Write.** `buildImportPlan` resolves every identifier and reference; the
   dialog hands that plan to `DataStore.applyImport`, which writes it in
   dependency order and rolls back if a step fails.
6. **Report.** Created, overwritten, and skipped counts; the skipped titles; how
   many ids changed; and any notes the plan collected.

### Rejected input, by category

| Category              | Example                                                                                                       | What the dialog says                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `empty`               | a whitespace-only file                                                                                        | "That file is empty."                                                                           |
| `too-large`           | a 9 MB file                                                                                                   | The size, the limit, and "export a selection instead of the whole library".                     |
| `not-json`            | a truncated file                                                                                              | "That file is not valid JSON" plus the parser's line and column.                                |
| `unrecognised`        | `{"hello":"world"}`                                                                                           | What a PromptForge file should look like (`format` marker, or a document with `schemaVersion`). |
| `unsupported-version` | `"version": 7`                                                                                                | The version found, the version this build reads.                                                |
| `invalid-records`     | a record with the wrong type, a document that does not parse, a reference to a folder that is not in the file | How many problems there are, and the path and message of up to six of them.                     |

A file with **any** invalid record is refused as a whole: importing the good half of
a broken file would leave the user with a library that is neither version.

### Conflicts

Detection runs before anything is written, in this order:

| Kind           | Detected when                                             | Default decision |
| -------------- | --------------------------------------------------------- | ---------------- |
| `same-id`      | a stored prompt has the same id                           | skip             |
| `same-content` | a stored prompt has an identical document (document hash) | skip             |
| `same-title`   | a stored prompt has the same title, case-insensitively    | add as new       |

Titles are not unique in this application, so a title clash is advisory: the
default keeps both prompts. An identical document or a taken id is a duplicate
until the user says otherwise. Every row offers the same four decisions:

- **Add as a new prompt** — keep the title; the id is kept when free, otherwise a
  new one is generated (and reported).
- **Add as a copy** — a new id and `Title (copy)`, then `(copy 2)`, …
- **Skip** — nothing at all is written for that prompt, including its history.
- **Overwrite** — only offered when there is a stored prompt to replace.

Overwriting keeps the stored record's **identity**: its id, its `createdAt`, and
its version counter (incremented), with `updatedAt` set to the import time. The
stored title, description, document, tags, flags, status, variables, custom
metadata, folder, collections, schema, and test cases are replaced by the
imported values. Imported revisions are appended after the stored history rather
than colliding with it, and an imported test-case name that already exists gains
`(copy)`. Choosing **Add as a copy** instead keeps both prompts.

### What the plan contains

`buildImportPlan` returns complete records — no ids left to decide, no references
left to resolve — split into folders, collections, schemas, snippets, templates,
prompts to create, prompts to update, revisions, and test cases. Folders are
ordered parents-first. The store writes them in that order.

Supporting records follow the prompts:

- Folders, collections, schemas, and snippets that an imported (created or
  overwritten) prompt references are written.
- If **every** prompt in the file is imported, the whole file is written, including
  records no prompt points at — that is what makes a full backup a full restore.
- Otherwise the unreferenced records are left out, and the summary says how many
  and why.

### The write, and what happens if it fails

`DataStore.applyImport` records an undo step for every write it completes and, if a
later step throws, runs those steps in reverse before rethrowing. The error message
distinguishes a clean undo ("The import was undone, so nothing was written") from an
incomplete one ("N step(s) could not be undone"). After either outcome the store
re-reads storage, so the screen shows what is actually stored rather than what was
attempted.

This is a **compensating rollback**, not one database transaction: the repositories
each own their own IndexedDB transaction and the app does not expose a cross-store
one. The honest consequence is that a compensating write is itself a write — an
overwritten prompt that is rolled back keeps its fields but keeps a **higher version
number** than before, because versions never go backwards. The import records one
`imported` activity event; nothing from the file's history is added to the log.

## Limits and guards

| Guard                                  | Value / behaviour                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| File size                              | 2,000,000 bytes                                                                                                        |
| Accepted formats                       | JSON only (`.json`, `application/json`); the file's name is never trusted                                              |
| Transfer version                       | 1                                                                                                                      |
| Folder chains                          | followed at most 32 levels, and a parent cycle stops the walk instead of looping                                       |
| Duplicate ids inside one file          | rejected (records would overwrite each other)                                                                          |
| Duplicate `(promptId, revisionNumber)` | rejected                                                                                                               |
| Missing references                     | rejected: a prompt pointing at a folder, collection, schema, snippet, or test-case prompt that the file does not carry |
| Manifest counts                        | checked against the lists; a mismatch is a warning, and the lists win                                                  |
| Imported templates                     | always user templates (`isBuiltIn: false`), even if the file claims otherwise                                          |

## How this was verified

| Area                         | Tests                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope read/write          | `src/domain/transfer/bundle.test.ts` — 37: serialization, determinism, round-trip, version, duplicates, dangling references, broken documents, manifest warnings, unknown keys, built-in flag, and every per-record validation error (wrong type, wrong status/format/version, unreadable variables, non-object records, missing manifest fields) |
| Selection and filenames      | `src/domain/transfer/export.test.ts` — 25: folder chains, prompt/selection/backup contents, slugs, byte sizes, fingerprints                                                                                                                                                                                                                       |
| Reading, conflicts, planning | `src/domain/transfer/import.test.ts` — 56: every error category, size limit, raw documents, conflict kinds and defaults, copy/overwrite/skip, id remapping, revision renumbering, folder/collection/template reuse, a repeating id generator, a folder cycle, a plan with no prompts, warnings, full round trip, importing the same file twice    |
| Download helper              | `src/features/transfer/download.test.ts` — 6: blob type and content, anchor name, click, URL revocation, name sanitising                                                                                                                                                                                                                          |
| Store write and rollback     | `src/store/dataStore.test.ts` — 4 new: full write with one activity event, rollback of every completed step, rollback of an overwrite, export notes                                                                                                                                                                                               |
| Dialog                       | `src/components/transfer/ImportDialog.test.tsx` — 12: preview without writes, confirm, conflicts and copy, skip-all, malformed JSON, wrong shape, oversized file, unsupported version, partially invalid bundle, retry, palette entry point                                                                                                       |
| Screens                      | `SettingsRoute.test.tsx` (+2), `LibraryRoute.test.tsx` (+2), `EditorRoute.test.tsx` (+2): each export entry point and the data card                                                                                                                                                                                                               |
| Commands                     | `src/lib/commands/coreCommands.test.ts` (+2): availability of import and export                                                                                                                                                                                                                                                                   |
| Purity                       | `src/domain/purity.test.ts`: the nested `domain/transfer` modules are pure and registered in the barrel                                                                                                                                                                                                                                           |

## Limitations (stated, not hidden)

- No ZIP archives, cloud transfer, drag-and-drop from other applications, or share
  links — all explicitly out of scope for this task.
- A prompt that is left out (skipped) does not bring its revisions, test cases, or
  snippet links, and its unreferenced supporting records are reported as left out.
- Snippets and schemas are matched by id only, so a copy of a bundle edited by hand
  to use different ids will create new supporting records instead of linking to the
  existing ones.
- A compensating rollback can leave a bumped version on a prompt it restored; the
  document, metadata, and history are unaffected.
- The import is not resumable: an interrupted tab means choosing the file again.
- The id generator is trusted but not infinitely: if it keeps returning an id that
  is already taken, the allocator gives up after 100 attempts and suffixes the id
  (`generated-1-42`) instead of spinning, so a broken UUID source makes an import
  ugly rather than impossible.
- Large libraries are serialized on the main thread. A backup of a few thousand
  prompts takes tens of milliseconds; there is no worker.
