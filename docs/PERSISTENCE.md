# PromptForge — Persistence

**Status:** written by TASK-006 (persistence foundation) and extended by TASK-007 (seeding and
bootstrapping). Covers the schema, migrations, the repository contract, failure semantics, storage
selection, first-run seeding, and the test evidence behind them.

**Scope.** Repository interfaces, the IndexedDB implementation, an in-memory implementation,
migrations, typed errors, a write queue, cross-tab write announcements, one shared contract suite,
module-boundary lint rules, storage selection with an honest ephemeral fallback, versioned seed data,
and this document.

**Explicitly out of scope here:** the store's UI actions and selectors (TASK-007's
`docs/ARCHITECTURE.md` section), the autosave UI and save pipeline (TASK-015), and import/export
(TASK-026).

---

## 1. Where the code lives

| Path                                 | Responsibility                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/data/db/schema.ts`              | database name, schema version, store/index definitions, row types, `expectedIndexes()`  |
| `src/data/db/migrations.ts`          | ordered migrations, validation, `pendingMigrations`, `applyMigrations`, `missingStores` |
| `src/data/db/indexedDb.ts`           | opening, `meta` bookkeeping, integrity check, capability probe, deletion                |
| `src/data/db/errors.ts`              | typed error hierarchy, `mapStorageError`, `withStorageErrors`                           |
| `src/data/repositories/contracts.ts` | the interfaces the rest of the app depends on                                           |
| `src/data/repositories/shared.ts`    | row conversion, validation, ordering, query matching, cloning                           |
| `src/data/repositories/indexedDb.ts` | the durable implementation                                                              |
| `src/data/repositories/contract.ts`  | the shared contract suite every adapter must pass                                       |
| `src/data/adapters/inMemory.ts`      | the ephemeral implementation used in tests and by the future demo mode                  |
| `src/data/writeQueue.ts`             | per-key serialization of writes                                                         |
| `src/data/broadcast.ts`              | `BroadcastChannel` write announcements, with a no-op fallback                           |
| `src/data/index.ts`                  | the only public entry point for code outside `src/data`                                 |

Layer direction: **domain (pure) ← data (storage) ← store/UI**. `src/data` imports the domain model
and never the reverse; `src/data` imports nothing from React, components, stores, or styling (ADR-39).

---

## 2. Database

- Name: `promptforge` (probe database: `promptforge-probe`, created and deleted by the capability check).
- Version: `DB_SCHEMA_VERSION = 2`.
- One database, eleven object stores. The `settings` and `meta` stores are singletons keyed `"app"`.
- Every other store is keyed by the entity `id`.

| Store         | Key path | Indexes                                                                                                                   |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `prompts`     | `id`     | `updatedAt`, `folderId`, `archived` → `archivedFlag`, `favorite` → `favoriteFlag`, `pinned` → `pinnedFlag`, `status` (v2) |
| `revisions`   | `id`     | `promptId`, `promptId_revisionNumber` **(unique, compound `[promptId, revisionNumber]`)**                                 |
| `folders`     | `id`     | —                                                                                                                         |
| `collections` | `id`     | —                                                                                                                         |
| `templates`   | `id`     | `isBuiltIn` → `builtInFlag`                                                                                               |
| `testCases`   | `id`     | `promptId`                                                                                                                |
| `schemas`     | `id`     | —                                                                                                                         |
| `snippets`    | `id`     | —                                                                                                                         |
| `activity`    | `id`     | `createdAt`                                                                                                               |
| `settings`    | `key`    | —                                                                                                                         |
| `meta`        | `key`    | —                                                                                                                         |

### Numeric flag mirrors (ADR-34)

IndexedDB does not index booleans: a boolean key path produces no index entry, so an `archived`
index would silently match nothing. The domain booleans stay authoritative and the adapter writes
`0 | 1` mirrors (`archivedFlag`, `favoriteFlag`, `pinnedFlag`, `builtInFlag`) through `flag()` on
every write. Index names keep the specification's names, so query code reads naturally.

### `expectedIndexes()`

`expectedIndexes()` merges the v1 definitions with the indexes added by later migrations. It is the
single source of truth for two things: the post-open integrity check, and the test that asserts a
real database has exactly the expected index names per store. Because no browser is available in
this work environment, that assertion **is** the schema verification (see §9).

---

## 3. Migrations (ADR-37)

`MIGRATIONS` is an ordered list, one entry per version, starting at 1 with no gaps:

| Version | Description                                          |
| ------- | ---------------------------------------------------- |
| 1       | Create the eleven object stores and their v1 indexes |
| 2       | Add the `prompts.status` index                       |

A migration has `version`, `description`, and `apply({ database, transaction, fromVersion, toVersion })`.
Each step re-checks what exists before creating it, so re-running is a no-op even after a partial
upgrade. `createObjectStore` and `createIndex` are only legal inside the `versionchange` transaction,
which is the atomic unit: if any step throws, the browser rolls the entire upgrade back.

`openPromptForgeDatabase()`:

1. refuses to run without `indexedDB` (`StorageUnavailableError`);
2. opens `promptforge` at `DB_SCHEMA_VERSION`, running `applyMigrations` inside `upgrade`;
3. on failure inside the upgrade, rethrows the captured cause as `MigrationError('failed')` rather
   than the generic `AbortError` the platform raises;
4. writes the `meta` singleton (`dbSchemaVersion`, preserved `seedVersion`) so upgrades never re-seed;
5. verifies the schema against `expectedIndexes()`/`missingStores()` and closes with
   `CorruptDataError` if the layout is incomplete;
6. refuses a database created by a newer build with `MigrationError('newer-database')`
   (`isNewerDatabaseError` classifies it without string matching).

`validateMigrations` rejects an empty list, gaps, duplicate versions, and out-of-order lists;
`pendingMigrations(migrations, from, to)` selects the steps to run.

### Observed behaviour (tests)

- fresh database: v0 → v2, `appliedMigrations` lists both steps, indexes match `expectedIndexes()`;
- reopening: `appliedMigrations` is empty, version unchanged, third open identical;
- v1 fixture upgraded to v2: rows survive, `status` index appears, `seedVersion` preserved;
- failing migration: open rejects with `MigrationError('failed')` and the database is left at its
  previous version (a later normal open creates v2 cleanly);
- newer database: open rejects with `MigrationError('newer-database')`;
- incomplete layout: open rejects with `MigrationError('failed')` (from the migration guard) or
  `CorruptDataError` (from the integrity check), depending on which check sees it first.

---

## 4. Repository contract

`Repositories` exposes eleven repositories plus `close()`. The same interface backs both adapters, so
the store and UI layers never know which one is active.

| Repository                                                                | Operations                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `prompts`                                                                 | `list`, `query(criteria?)`, `get`, `create`, `update(prompt, { expectedVersion })`, `delete` |
| `revisions`                                                               | `listByPrompt`, `get`, `create`, `deleteMany`, `deleteByPrompt`, `countByPrompt`             |
| `folders`, `collections`, `templates`, `testCases`, `schemas`, `snippets` | `list`, `get`, `create`, `update`, `delete`                                                  |
| `activity`                                                                | `append`, `list(limit?)`, `prune(limit)`, `clear`                                            |
| `settings`                                                                | `get()` (null before first run), `save`                                                      |
| `meta`                                                                    | `get`, `getSeedVersion` (0 before seeding), `setSeedVersion`                                 |

### Ordering is part of the contract

| Query                    | Order                                              |
| ------------------------ | -------------------------------------------------- |
| `prompts.list/query`     | `updatedAt` descending, `id` ascending tie-breaker |
| `revisions.listByPrompt` | `revisionNumber` descending                        |
| named entities           | name ascending, case-insensitive, `id` ascending   |
| `activity.list`          | `createdAt` descending, `id` descending            |

### Query semantics

`PromptQuery` fields combine with **AND**: `folderId` (including `null` for Unfiled; omit to include
every folder), `collectionId`, `tag`, `status`, `archived`, `favorite`, `pinned`, and the inclusive
`updatedAfter`/`updatedBefore` ISO-string bounds.

### Write semantics

- `create` on an existing id rejects with `DuplicateRecordError`; nothing is overwritten.
- `update` on an unknown id rejects with `RecordNotFoundError`.
- `delete` is **idempotent**: deleting a missing record resolves.
- Reads and writes copy through `structuredClone` (ADR-40), so mutating a returned object cannot
  change stored state, and mutating an argument after the call cannot either.
- Stored rows are re-validated on read (`assertStoredPrompt`, `assertStoredRevision`,
  `assertStoredEntity`); a malformed row surfaces as `CorruptDataError` instead of propagating as
  `undefined` later.

### Optimistic concurrency (ADR-35)

`prompts.update(prompt, { expectedVersion })`:

1. `expectedVersion` must equal the stored `version` → otherwise `StaleWriteError(promptId,
expectedVersion, actualVersion)`, **no mutation**;
2. the incoming record must carry `version === expectedVersion + 1` → otherwise `InvalidWriteError`.

The check and the write happen in one `readwrite` transaction, so a concurrent writer cannot slip
between them.

---

## 5. Failure semantics (ADR-36)

No raw `DOMException` leaves the data layer. `mapStorageError(error, context)` and
`withStorageErrors(context, operation)` convert platform failures into one typed hierarchy, and the
`context` string (`prompts.create`, `database.open`) appears in the message so a log line is
actionable without a stack trace.

| Platform failure                                  | Typed error                        | What the UI should offer                |
| ------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| `QuotaExceededError`                              | `QuotaExceededError`               | export, prune revisions/activity, retry |
| `VersionError`                                    | `MigrationError('newer-database')` | stop writing; reload in a newer build   |
| `DataError`, `DataCloneError`, `NotFoundError`    | `CorruptDataError`                 | reload the record, offer repair         |
| `ConstraintError`                                 | `DuplicateRecordError`             | rename or open the existing record      |
| `InvalidStateError`, `AbortError`, `UnknownError` | `StorageUnavailableError`          | retry; fall back to ephemeral mode      |
| anything else                                     | `StorageError('unknown')`          | generic retry                           |

Every error carries a stable `code` (`unavailable`, `quota-exceeded`, `stale-write`, `migration`,
`corrupt-data`, `duplicate-record`, `not-found`, `invalid-write`, `unknown`) and, where available,
the original error as `cause` for diagnostics. Messages are user-safe: they never contain prompt
content.

### No unhandled rejections

`idb` caches a `done` promise for the wrapped `versionchange` transaction. When an upgrade aborts,
that promise rejects and nothing awaits it — the open request already carries the failure — which
surfaces as an unhandled rejection. `openPromptForgeDatabase` marks it handled
(`void transaction.done.catch(() => undefined)`) and keeps the open rejection as the single source of
truth. The migration test suite asserts a clean run with zero unhandled errors.

### Storage capability probe

`probeStorage(name?)` proves storage end to end — open, write, read, delete — and never throws:

```ts
const probe = await probeStorage();
if (!probe.available) {
  // probe.error is a StorageUnavailableError; TASK-007 switches to ephemeral mode
}
```

`isIndexedDbAvailable()` is the synchronous check, `assertStorageAvailable()` the throwing one.

---

## 6. Concurrency helpers

### Write queue (ADR-35)

```ts
const queue = createWriteQueue();
await queue.run(promptId, () => repositories.prompts.update(next, { expectedVersion }));
```

`run(key, task)` serializes tasks for the same key in submission order while different keys run
concurrently. A rejected task does not wedge the chain; `isBusy(key)` and `size(key)` report depth;
`drain()` resolves once everything has settled, including work queued during the drain. The queue is
bookkeeping only — version checks remain the enforcement.

### Cross-tab announcements (ADR-38)

```ts
const broadcaster = createWriteBroadcaster();
broadcaster.announcePromptWrite({ id: prompt.id, version: prompt.version });
const unsubscribe = broadcaster.subscribe((announcement) => {
  /* warn about the other tab */
});
```

Announcements are `prompt-written`, `prompt-deleted`, and `settings-written` on the channel
`promptforge`, received messages are validated with `isWriteAnnouncement` (unknown or malformed
payloads are dropped), and the whole object degrades to a no-op when `BroadcastChannel` is missing or
creation throws. Edits are **not** merged across tabs: version checks still reject stale writes; the
save pipeline (TASK-015) uses the announcements to warn a dirty tab and offer to review both versions.

---

## 7. In-memory adapter

`createInMemoryRepositories(seed?)` implements the same interfaces over `Map`s, with the same
cloning, ordering, query, version, and error semantics. It exists for three reasons: fast contract
parity tests, an ephemeral demo mode when IndexedDB is unavailable, and the TASK-029 UI suites.
`close()` marks the instance closed — operations after it reject with `StorageUnavailableError`,
which is the one behaviour that intentionally differs (there is no connection to lose).

---

## 8. Storage selection and ephemeral mode (TASK-007)

`openStorage()` is the only place that decides which adapter runs:

1. probe IndexedDB with a real write/read/delete round trip (`probeStorage`);
2. if the probe passes, open the durable adapter (`promptforge` database, migrations run);
3. if the probe fails, **or** the database cannot be opened (corrupt layout, newer build, denied
   origin), fall back to the in-memory adapter;
4. return `{ mode, repositories, notice }`, where `notice` is a plain-language sentence for the
   banner and is `null` only in durable mode.

The fallback is never silent. The notice says what happened and that nothing is being saved:
_"IndexedDB is not available in this browser. Changes you make now are kept in memory only and
disappear when you reload; nothing is being saved."_ The app still runs: seeding, the stores, and
the UI work exactly as they do durably, so the demo is honest about its limits rather than blank.

Boot order (in `src/app/dataBoot.ts`, run once by `DataBootstrap`):

```
openStorage → attach repositories to the data store → seed (version-gated) → hydrate stores
            → apply persisted preferences → render children
```

A seeding failure closes the connection and surfaces a recovery screen with a retry; a hydration
failure is reported on the store and shown as a load error. The UI never renders an empty library as
if it were real data.

---

## 9. First-run seeding (TASK-007)

`SEED_VERSION = 2` in `src/data/db/seed.ts`. Seeding is **versioned and resumable**:

- `meta.seedVersion` gates the whole run: a stored version at or above `SEED_VERSION` means one read
  and no writes at all;
- every seeded row has a fixed id (`SEED_IDS`) and is created only when that id is missing, so an
  interrupted seed can be re-run without duplicating or overwriting anything;
- existing settings are preserved; only their `seedVersion` is advanced;
- the version is written **last**, so an interrupted run is retried on the next boot;
- seeded rows write **no activity events**: the timeline records what the user did, not what shipped.

| Row                                    | Id                                    | Notes                                                |
| -------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Folder "Getting started"               | `seed-folder-getting-started`         | parent of the welcome prompt                         |
| Collection "Starter kit"               | `seed-collection-starter-kit`         | groups the starter content                           |
| Welcome prompt                         | `seed-prompt-welcome`                 | active, pinned, explains local storage; one variable |
| Template "Structured field extraction" | `seed-template-structured-extraction` | built-in, category Extraction, JSON output           |
| Template "Review response"             | `seed-template-review-response`       | built-in, category Writing, text output              |
| Seven further built-ins (TASK-018)     | `seed-template-*`                     | one per category; see `src/data/db/templates.ts`     |
| Settings singleton                     | `app`                                 | defaults with `seedVersion: 2`, `onboardedAt: null`  |
| Meta singleton                         | `app`                                 | `seedVersion: 2`, `dbSchemaVersion: 2`               |

The built-in catalogue is nine documents defined once in `src/data/db/templates.ts`. Seed v2 added seven
to the two that v1 shipped; because the ids are fixed and the loop creates only missing rows, upgrading a
v1 database adds exactly those seven and leaves every stored row — including user templates — untouched.
Because seeding spans several stores it is **not** one IndexedDB transaction; per-row `ensure` plus
the last-written version make it idempotent instead, which the seed suite verifies for both adapters.

---

## 6a. The editor save pipeline (TASK-015)

Everything the editor writes goes through one hook, `src/features/save/useSavePipeline.ts`. It owns
the draft's relationship with storage; no component calls `editPrompt` for document content.

### What is written, and what is not

A save writes `PromptDocument` content only — `editPrompt(id, { content }, { expectedVersion })`.
Title, tags, filing, and status still change through their own store mutations, so a save can never
revert a rename made in another surface. The text is validated first (`scanJson`, then
`validatePromptDocument`); an invalid document is refused with a line/column or field path, and
storage is not touched. Saving with no changes is a no-op that does not bump a version.

### Ordering

Writes for one prompt run through the shared `createWriteQueue()` instance (`src/features/save/saveBus.ts`),
keyed by prompt id. The queued task re-reads the editor text _when it runs_, so an edit that arrives
while an earlier write is in flight is the text that lands — rapid edits collapse into one write with
the latest content rather than a lost update. A second explicit save while one is in flight coalesces
onto the same promise.

### Versions and conflicts

The pipeline always sends the version its draft was based on. `PromptRepository.update` rejects a
guarded write whose `expectedVersion` no longer matches with `StaleWriteError`, so the store can no
longer overwrite another tab's write by re-reading first (ADR-78). A stale write becomes a conflict
state: autosave stops and the dialog offers _Reload the stored version_ (reads storage, replaces the
draft, clears the recovery copy), _Keep my draft as new content_ (writes the draft over the freshly
read version, explicitly labelled), or _View the stored version_ (a preview read with the store's
read-only `readStoredPrompt`). Nothing is hydrated or overwritten before the user chooses (ADR-79).

A version bump whose content did not change (a favorite, a rename) is adopted silently. A content
change from another tab becomes a passive banner; the draft is never replaced by it (ADR-82).

### Autosave and explicit save

Autosave is a debounce over `autosaveEnabled`/`autosaveDelayMs` from the preferences store; changing
either takes effect in the mounted editor immediately. `Mod+S`/`Ctrl+S` writes immediately, from
anywhere on the screen. A failed write keeps the draft, shows the failure with its detail and a Retry
action, and never reports success; the failed text is remembered so the timer does not retry a
document that is known to be rejected. The last confirmed `updatedAt` is shown as "Saved at …".

### Recovery drafts

`src/features/save/recoveryStorage.ts` is a version-aware layer over TASK-014's `draftStorage`:

| Property        | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Key             | `promptforge.editor.draft.<promptId>` (unchanged)                                              |
| Written         | 400 ms after the last edit while the draft is dirty                                            |
| Record          | `{ promptId, text, savedAt, baseUpdatedAt, baseVersion? }`                                     |
| Size cap        | 2 000 000 characters                                                                           |
| Cleared         | only after a confirmed write, an explicit discard, or a reload of the stored version           |
| Offered on open | when its text differs from the stored text, with a line-level hint and an "older version" flag |

It is **not** a persisted prompt: no repository, table, or migration was added for it, and it never
travels between devices. Clearing site data, or a browser that blocks `localStorage`, means no
recovery.

### Ephemeral mode

When storage did not open, the pipeline reports `disabled`: the Save button is genuinely disabled, the
editor shows "Ephemeral mode — saving is disabled", and a write is refused before it reaches the
store. Recovery drafts keep working, because they do not need the database.

### Revisions

`snapshot(label)` is exposed behind a `SnapshotService` interface and only allowed when the draft is
clean, so a snapshot always describes stored content. The default implementation is the store's
existing `snapshotPrompt`; TASK-019 replaces the presentation, not the write.

## 9a. What is deliberately _not_ in this layer

The editor's recovery draft is **not** a persisted prompt. It is a `localStorage` copy of the text in
the current tab, namespaced per prompt, size-capped, and removed once storage has confirmed the write.
It exists so a reload does not lose typing. No repository, table, or migration was added for it.

## 10. Module boundary (ADR-39)

Two ESLint rules enforce the layering:

1. `src/data/**` may not import `react`, `react-dom`, `@/components/*`, `@/app/*`, `@/routes/*`,
   `@/store/*`, `@/styles/*`, `zustand`, `lucide-react`, `@radix-ui/*`, `clsx`, or `tailwind-merge`.
2. Code outside `src/data` may not import `@/data/repositories/*`, `@/data/adapters/*`, or
   `@/data/db/*` — it must import `@/data`, so the adapter choice stays in one place. The in-memory
   adapter is re-exported from the barrel because the ephemeral mode and the store tests need it;
   the IndexedDB adapter is not.

Both rules were verified by adding a temporary file that violates each rule, confirming ESLint
rejects it, and removing the file. The data layer also contains no `any` in its public types.

---

## 11. Verification

### Automated suites

| Suite               | File                                               | What it proves                                                                                      |
| ------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Shared contract     | `src/data/repositories/contract.ts` + two callers  | identical semantics in both adapters (25 cases each)                                                |
| IndexedDB specifics | `src/data/repositories/indexedDb.contract.test.ts` | stores/indexes, unique compound index, row conversion, lifecycle, quota, unavailability, corruption |
| In-memory specifics | `src/data/adapters/inMemory.contract.test.ts`      | seed loading, operations after `close()`                                                            |
| Migrations          | `src/data/db/migrations.test.ts`                   | v0→v2, idempotency, v1→v2 upgrade, meta, atomic abort, newer database, incomplete schema            |
| Errors              | `src/data/db/errors.test.ts`                       | the full mapping table, cause retention, typed pass-through                                         |
| Write queue         | `src/data/writeQueue.test.ts`                      | order, concurrency, failure recovery, depth, drain                                                  |
| Broadcast           | `src/data/broadcast.test.ts`                       | announcements, validation, subscribe/unsubscribe, no-op fallback                                    |

Current result: **8 data files / 119 tests**, whole suite **36 files / 419 tests**, all passing.

### Schema verification without a browser

The task's validation step asks for a manual DevTools inspection of the created stores and indexes.
**No browser or headed environment exists in this workspace, so that inspection was not performed
and is not claimed.** The documented substitute is stronger for regression purposes:

- `IndexedDB schema > creates every store and index from the specification` opens a real (fake)
  database and compares `objectStoreNames` and each store's `indexNames` to `expectedIndexes()`;
- `marks the revision number index as unique` reads the index metadata from the transaction;
- `detects a structurally incomplete database` proves the integrity check fails a layout that does
  not match.

When a browser is available, the manual check is: open DevTools → Application → IndexedDB →
`promptforge` → confirm eleven stores and, on `prompts`, the indexes `updatedAt`, `folderId`,
`archived`, `favorite`, `pinned`, `status`; on `revisions`, `promptId` and the unique compound
`promptId_revisionNumber`.

### Coverage

`npm run test:coverage` measures `src/domain/**` and `src/data/**` with separate floors: domain
90 % on all four metrics, data 90 % statements / 82 % branches / 88 % functions / 92 % lines. The
data floor is lower on branches because platform-failure branches that a fake IndexedDB cannot reach
are excluded by construction (for example, a real browser's version-change blocking events).

---

## 12. Known limitations at this stage

- The seed is deliberately small (one prompt, nine built-in templates); a catalogue larger than that
  would be a product decision, not a seeding one.
- Seeding cannot be atomic across stores through the repository interface; idempotent `ensure` calls
  plus the last-written version make a retry safe instead.
- The in-memory fallback loses everything on reload by design; export arrives in TASK-026.
- The contract suite covers semantics, not browser performance. A large-library benchmark is not part
  of v1.
- `fake-indexeddb` is not a browser: quota, blocking, and termination behaviour are emulated where
  possible (quota is injected at the object-store boundary) and otherwise untested.
- Cross-tab merging does not exist by design; the channel only notifies.
- `structuredClone` copies do not extend to class instances — the data layer stores plain domain
  objects only.
- Multi-tab `versionchange` handling closes the connection (`onBlocking`) but the recovery UI that
  asks the user to reload is TASK-015's.

---

## 13. Future server-backed path

The interfaces exist so a server adapter can be added without touching the UI:

1. implement `Repositories` against an HTTP API with the same ordering, query, and version rules;
2. keep `expectedVersion` → `409` mapping onto `StaleWriteError` so conflict UI is unchanged;
3. use the `meta` seed version and `revisions` history server-side for the same migration and
   recovery flows;
4. optionally drain the write queue to an outbox for offline-first sync.

This is a design note, not a commitment: v1 remains client-only and sends nothing anywhere
(ADR-01). No network code exists in the data layer, and none may be added without an explicit task.
