# PromptForge — Architecture

This document explains how the application is put together: the layers and the rules between
them, how state and data move, the modules that carry the logic, and where a future change
belongs. It is about **structure**, not features — for what each screen does, see the
[README](../README.md#what-it-does); for decisions and their consequences, see
[DECISIONS.md](./DECISIONS.md).

Last verified against the code at the TASK-031 delivery (2026-10-25).

---

## 1. Shape of the application

A single-page React 19 application, statically built by Vite, with no backend of any kind.
Everything it stores is in the browser; everything it computes is local.

```
index.html
  └─ main.tsx                 theme boot script runs first (no flash of wrong theme)
       └─ App.tsx             <AppProviders> → <ErrorBoundary> → <RouterProvider>
            └─ DataBootstrap  openStorage → seed → hydrate → applySettings → children
                 └─ <Shell>   skip link, rail, top bar, breadcrumbs, palette, dialogs
                      └─ route element (dashboard, library, editor, …)
```

The shell owns the landmarks, navigation, route chrome (title, scroll, focus), the command
palette, and the overlays that are global (help, import). Each route owns its own screen,
data reads, and dialogs; nothing renders outside `<main>` except the overlays.

## 2. Layers and the rules between them

```
routes  →  components / features  →  store  →  data  →  domain
                    ↘  lib/commands  ↗
```

| Layer         | Directory                          | May import                                                     | Must not                                                            |
| ------------- | ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Screens       | `src/routes/`                      | components, features, stores, `@/data` (types + `openStorage`) | reach into `src/data/db` or adapters                                |
| UI + features | `src/components/`, `src/features/` | stores, domain logic, `@/data` types, UI primitives            | own IndexedDB handles or duplicate domain rules                     |
| State         | `src/store/`                       | `@/data` (public surface), `src/domain`                        | render, or store DOM nodes                                          |
| Data          | `src/data/`                        | `src/domain` types, `idb`                                      | React, stores, components, styles, UI libraries                     |
| Domain        | `src/domain/`                      | nothing but itself                                             | React, storage, browser APIs, `Date.now()`/`Math.random()` in logic |

Three of these rules are **enforced**, not documented: `eslint.config.js` blocks React, stores,
components, styling helpers, and UI libraries inside `src/data/**`, and blocks deep imports of
`@/data/repositories/*`, `@/data/adapters/*`, and `@/data/db/*` everywhere else. The domain's
purity is additionally asserted at runtime by `src/domain/purity.test.ts`, which reads the
module graph and fails if a domain file pulls in React, a store, or the data layer.

The reason for the strictness: the domain is the only layer with real logic (parsing, rendering,
diffing, validation, quality rules, health metrics), and it is the layer that must be testable
with no DOM, no database, and no clock. Everything above it is composition.

## 3. State and data flow

Three Zustand stores, one of which owns the library:

| Store                           | Owns                                                                                                                                      | Persistence                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `src/store/dataStore.ts`        | prompts, revisions, folders, collections, templates, test cases, schemas, snippets, activity, settings, `mode`, `status`, `error`, `busy` | every write goes through a repository first  |
| `src/store/preferencesStore.ts` | theme, density, indentation, autosave, reduced motion, health thresholds                                                                  | written back through the settings repository |
| `src/store/uiStore.ts`          | palette, help, sidebar, selection, recent commands                                                                                        | none — deliberately session-only             |

A write always follows the same path, which is why a failure can never look saved:

```
screen action
   → dataStore method      e.g. editPrompt(id, changes, { expectedVersion })
       → repository call   prompts.update(next, { expectedVersion })
           → IndexedDB     one transaction, version-guarded
       ← saved row         the value the repository actually returned
   → set(state => adopt(saved row))    the store holds what storage holds
   → UI re-renders from the store
```

Two derived guarantees follow from that order:

- **Nothing is optimistic.** A dialog closes, the store adopts the confirmed row, and only then
  does a card change. If the write throws, the error surfaces in the screen and the store's copy
  still matches the database.
- **Conflicts are visible.** Document writes pass the version the editor's draft was based on.
  A stale base is rejected with `StaleWriteError`, the editor shows a conflict dialog naming the
  stored version, and nothing is overwritten until the user chooses.

Reading is one-shot hydration plus in-memory selectors: `hydrate()` reads every repository in
parallel, `src/store/selectors.ts` derives every filtered view and dashboard aggregate with a
single-entry memo cache, and screens subscribe to the slices they render. There is no polling,
no query cache, and no server to re-fetch from.

Cross-tab coordination is a `BroadcastChannel` announcement (ids, versions, timestamps — never
prompt text) plus storage-event fallbacks, so a write in one tab makes another tab's stale draft
visible as a conflict rather than silently losing it.

## 4. Key modules

### 4.1 Domain (`src/domain/`) — pure logic

| Module                                                  | Responsibility                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`                                              | Entity and document types; the single source of truth for shapes                                                         |
| `promptDocument.ts`, `serialization.ts`, `jsonText.ts`  | The canonical document spec, formatting/parsing, and position-accurate JSON scanning                                     |
| `validation.ts`, `jsonSchema.ts`                        | Document rules and an in-house JSON Schema interpreter (supported subset documented in [VALIDATION.md](./VALIDATION.md)) |
| `render.ts`, `variables.ts`                             | Strict `{{name}}` substitution; typed variables; no `eval`, no expression language                                       |
| `diff.ts`, `renderDiff.ts`, `textDiff.ts`               | Structural JSON diff and its rendering                                                                                   |
| `graph.ts`                                              | The blueprint graph and its deterministic layout inputs                                                                  |
| `quality.ts`                                            | Heuristic rules with written reasons ([QUALITY-RULES.md](./QUALITY-RULES.md))                                            |
| `health.ts`                                             | Staleness, duplicates, undeclared/unused variables, storage figures                                                      |
| `search.ts`                                             | Term extraction and highlight spans                                                                                      |
| `composer.ts`, `templates.ts`, `revisions.ts`, `lab.ts` | Section editing, template instantiation, snapshot numbering, test-case runs                                              |
| `factories.ts`, `invariants.ts`                         | Deterministic constructors (injected clock and ids) and invariant checks                                                 |
| `transfer/*`                                            | Bundle format, export, import planning, conflict detection                                                               |

### 4.2 Data (`src/data/`) — storage behind interfaces

- `repositories/contracts.ts` defines every repository interface; `adapters/inMemory.ts` and
  `db/indexedDb.ts` both implement them and share one contract suite
  (`*.contract.test.ts`) so parity is proven rather than assumed.
- `storage.ts` is the only place that decides between durable and ephemeral storage. It probes
  with a real write/read/delete, falls back to the in-memory adapter with a notice, and returns
  `{ mode, repositories, notice }`.
- `db/schema.ts` + `db/migrations.ts` own the IndexedDB shape (v2, eleven object stores);
  migrations run inside the version-change transaction and abort as a unit on failure.
- `db/errors.ts` maps platform errors onto typed ones (`StaleWriteError`, `QuotaExceededError`,
  `CorruptDataError`, …) so the UI can choose a recovery path instead of parsing messages.
- `writeQueue.ts` serialises writes per prompt, and `broadcast.ts` announces them to other tabs.

Details, tables, and failure semantics: [PERSISTENCE.md](./PERSISTENCE.md).

### 4.3 Store (`src/store/`)

`dataStore` is the mutation surface (one method per action, each returning what storage saved),
`preferencesStore` bridges persisted settings to live preferences, `uiStore` holds interface
state only, and `dashboard.ts` / `selectors.ts` are pure derivations with no side effects.
`dataStoreContext.ts` exposes the store through React context so tests can render the real shell
over in-memory repositories.

### 4.4 Commands (`src/lib/commands/`) — one registry, three consumers

Every shortcut and palette entry is a `CommandDefinition` registered once. The palette, the global
key listener, and the generated shortcut reference all read the same registry, so a binding cannot
exist in one surface and be missing from another (the TASK-030 verification asserts exactly this
correspondence). Feature screens register their own commands while mounted and return the
disposer; a command that would do nothing is never registered.

`registry.ts` rejects duplicate ids and duplicate bindings at registration; `shortcuts.ts` parses
and matches single chords and two-step sequences; `filter.ts` ranks fuzzy matches; `useCommand.ts`
binds React to the runner, which refuses to run an id that is already in flight.

### 4.5 UI layers (`src/components/`, `src/features/`)

`components/ui/` is a small design system with no domain knowledge: Radix primitives with
token-driven styling. `components/layout/` is the shell. Everything else is per-feature, and
`features/` holds the stateful logic that is too big for a component (save pipeline, revisions,
diff selection, quality dismissals, health computation, organization dialogs, transfer dialogs,
editor drafts). Styles are CSS custom properties in `src/styles/` consumed through Tailwind
utilities; no component contains a colour literal, and `npm run check:contrast` gates 88 pairings.

## 5. Extension points

Where a change belongs, in the order most changes arrive:

| You want to…              | Do this                                                                                                        | Guarded by                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Add a screen              | Add a route in `src/app/router.tsx`, a folder in `src/routes/`, and an entry in `ALL_NAV` or `OFF_NAV_LABELS`  | route matrix test fails if a declared path has no case, or a screen reports "Not found" |
| Add a command or shortcut | Define it in `src/lib/commands/` and register it (core, or from a mounted screen)                              | registry rejects duplicate ids/bindings; the help overlay is generated                  |
| Add a domain rule         | Add a pure module or extend `quality.ts` / `health.ts` with a rule that carries a written reason               | domain purity test, unit tests                                                          |
| Add a JSON Schema keyword | Extend `jsonSchema.ts` and [VALIDATION.md](./VALIDATION.md); unsupported keywords must be refused at save time | validation tests                                                                        |
| Add a stored entity       | New type in `domain/types.ts`, repository interface + both adapters, migration, then a store method            | shared contract suite runs against both adapters                                        |
| Change the document shape | Bump the document `schemaVersion`, migrate in `serialization.ts`, keep unknown fields                          | round-trip and invariant tests                                                          |
| Add a template            | Add to `src/data/db/templates.ts` and bump `SEED_VERSION` so existing libraries receive it                     | seed tests (idempotent, version-gated)                                                  |
| Swap storage              | Implement the repository interfaces and return them from `openStorage`                                         | contract suite, store tests unchanged                                                   |

## 6. The path to a backend

The design deliberately keeps a server optional. Adding one is a storage change, not a rewrite:

1. **Implement `Repositories` over HTTP.** The interfaces in
   `src/data/repositories/contracts.ts` already carry the semantics a server needs —
   `expectedVersion` on prompt writes, cascade deletes with an all-or-nothing guarantee,
   `updateMany` as one transaction. A fetch-based adapter satisfies the same contract, and the
   existing contract suite can be pointed at it.
2. **Return it from `storage.ts`.** This is the only place that chooses an adapter; no screen,
   store, or feature imports IndexedDB directly (ESLint enforces that).
3. **Keep the version guard.** `expectedVersion` and `StaleWriteError` are what make multi-writer
   conflicts visible; a server implementation must keep returning them, which is why they are in
   the contract rather than in the adapter.
4. **Add authentication and scoping above the repository layer**, not inside it, so the domain
   stays free of identity concepts.
5. **Expect to revisit conflict UX.** Today the "written elsewhere" idea assumes another tab;
   across devices it needs a stronger merge story than "reload or keep mine".

What would _not_ carry over unchanged: `BroadcastChannel` announcements (they become server push
or polling), the "storage unavailable ⇒ in-memory" fallback (a backend that is down is a different
failure), and export-as-backup, which becomes a secondary path rather than the only one.

## 7. Testing and quality gates as architecture

The layering is what makes the test strategy possible: domain logic is tested with no DOM, the data
layer against a real IndexedDB (via `fake-indexeddb`) and an in-memory adapter, and the UI through
the real router, stores, and repositories. Coverage floors are ratchets per tree, and a network
guard makes any outbound request fail the suite. See [TESTING.md](./TESTING.md) for the inventory
and [VERIFICATION.md](./VERIFICATION.md) for the integration pass.

| Gate     | Command                  | What it protects                             |
| -------- | ------------------------ | -------------------------------------------- |
| Types    | `npm run typecheck`      | Shapes across the whole program, strict mode |
| Lint     | `npm run lint`           | Layer boundaries, hook rules, unused code    |
| Format   | `npm run format:check`   | Diffs that are about code, not whitespace    |
| Tests    | `npm run test:run`       | Behaviour and contracts                      |
| Coverage | `npm run test:coverage`  | Per-tree ratchets in `vite.config.ts`        |
| Contrast | `npm run check:contrast` | Token pairings in both themes                |
| Links    | `npm run check:links`    | Documentation that points at something real  |
| Build    | `npm run build`          | A production bundle that type-checks first   |

## 8. Deliberate non-choices

- **No server rendering.** Nothing needs it; the app is client-stateful by definition.
- **No state library beyond Zustand.** Three stores, one mutation path, no reducers to replicate.
- **No component kit.** The design system is local so tokens, contrast, and focus behaviour stay
  auditable in one place.
- **No indexing or background workers.** Library scale is bounded by what fits in a browser; the
  search and selectors are plain in-memory passes and are measured at 1,000 prompts in tests.
- **No offline service worker.** The app is a static bundle; it is not installable, and it does
  not claim to work offline after a cold cache.
- **No expression language in prompts.** Valid JSON is validated, never executed (ADR-04).

## 9. Where the decisions live

This document describes the shape; [DECISIONS.md](./DECISIONS.md) records why it took that shape —
116 numbered decisions, 109 of them with a full entry, including the deviations from the original
plan (a self-written JSON Schema interpreter, a structural diff instead of a text-only one, the
schema and chunking changes that came from real constraints, and the accessibility, coverage, and
documentation decisions taken late in the project).
