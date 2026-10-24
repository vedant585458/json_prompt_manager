# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-009 complete — command registry, command palette, and shortcut help.**
> The repository contains the toolchain, the Prompt Observatory token system with dark and light
> themes, the primitive layer (buttons, form controls, tabs, tooltips, status, progress), the
> overlay/feedback layer (dialogs, confirmations, sheets, dropdown and context menus, toasts,
> alerts, empty/error states, skeletons) demonstrated in a design gallery, the typed domain model
> (entities, canonical prompt document, validation, factories, serialization), the persistence layer
> (repository interfaces, IndexedDB adapter with migrations, an in-memory parity adapter, typed
> storage errors, a per-prompt write queue, cross-tab announcements), and the application data
> lifecycle (storage selection with an honest ephemeral fallback, versioned first-run seeding, the
> data/preferences/UI stores, pure selectors, a hydrating bootstrap, and an error boundary), and the
> application shell (browser router, collapsible rail, drawer navigation, breadcrumbs, skip link,
> route focus/title/scroll handling, and a working settings screen).
> Every declared route renders, but only the shell, the settings screen, and the design gallery have
> real content; the rest are honest scaffolds that name the task which will build them.
> Each subsequent feature is built in a separate, explicitly authorized task tracked in
> [`tasks.md`](./tasks.md).

---

## Requirements

- **Node.js** `>= 22.12.0` (verified with v22.22.3)
- **npm** `>= 10`

## Getting started

```bash
npm install       # install dependencies from package-lock.json
npm run dev       # start the dev server at http://localhost:5173
```

The dev server binds to `0.0.0.0:5173` and accepts proxied hostnames, so it also works inside
sandbox/preview environments. It does not use a host allowlist.

## Quality gates

| Command                  | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `npm run typecheck`      | TypeScript project check (`tsc --noEmit`, strict mode) |
| `npm run lint`           | ESLint flat config (TypeScript + React hooks)          |
| `npm run format:check`   | Prettier verification                                  |
| `npm run check:contrast` | WCAG contrast gate for design-token pairings           |
| `npm run format`         | Prettier write                                         |
| `npm test`               | Vitest in watch mode                                   |
| `npm run test:run`       | Vitest single run (CI style)                           |
| `npm run build`          | Type-check, then production build into `dist/`         |
| `npm run preview`        | Serve the production build at http://localhost:4173    |

All of the above must pass before a task can be marked complete in `tasks.md`.

## Technology stack

| Area        | Choice                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| UI          | React 19, TypeScript (strict), Vite                                       |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`                                   |
| State       | Zustand stores for data, preferences, and interface state (TASK-007)      |
| Routing     | react-router-dom                                                          |
| Persistence | IndexedDB through repository interfaces (`idb`), in-memory parity adapter |
| Editor      | CodeMirror 6 — planned TASK-014                                           |
| Validation  | Ajv (JSON Schema) — planned TASK-016                                      |
| Testing     | Vitest, Testing Library, `jest-dom`, `fake-indexeddb`, jsdom              |
| Quality     | ESLint (flat config), Prettier                                            |

Dependencies for later tasks are already pinned in `package.json` where they define the
architecture; features are still implemented only when their task is authorized.

## Project structure

```
src/
  app/            application root, providers, boot sequence, error boundary
  routes/         route-level screens
  components/     ui primitives, layout, command palette, dashboard, and domain components
  features/       feature modules (save pipeline, revisions, diff, lab, ...)
  domain/         pure TypeScript domain logic and types (no React, no storage)
  data/           repository interfaces, IndexedDB + in-memory adapters, migrations,
                  typed storage errors, write queue, cross-tab announcements
  store/          Zustand stores (data, preferences, interface) and pure selectors
  hooks/          reusable hooks
  lib/            small framework-agnostic utilities
    commands/     command registry, shortcut parsing/matching, core commands, React bindings
  styles/         tokens and global styles
  test/           test setup and shared fixtures
docs/             architecture, data model, persistence, testing, limits
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for layer rules, the design-system contract,
and architectural decisions, and [`docs/DECISIONS.md`](./docs/DECISIONS.md) for the decision log and
the generated contrast table.

## Design system

- **Dark-first**, with a designed light theme. A tiny inline boot script applies the stored or system
  preference before first paint, so no page flashes the wrong theme.
- **Tokens only.** Every color, spacing, radius, type size, shadow, easing, and stacking value is a
  CSS custom property in `src/styles/tokens.css`; components consume Tailwind utilities generated
  from them. No component contains a color literal.
- **Typography.** Inter Variable for UI, JetBrains Mono for structure and JSON, Instrument Serif for
  editorial display — all self-hosted with metric-adjusted fallbacks. No runtime font requests.
- **Accessible accent.** Chartreuse is the identity color; it is split into `accent` (text/icons,
  light-theme darkening included) and `accent-fill` (surfaces) so both themes meet WCAG AA.
- **Proof, not promises.** `npm run check:contrast` verifies 52 text/UI pairings in both themes and
  fails the build threshold on regression.
- **Reduced motion** is honored through the OS preference and a `data-reduced-motion` hook for the
  future in-app setting.

## Component library

`src/components/ui/` holds framework-level primitives with **no domain knowledge** — the same
components every later screen composes:

- **Actions:** `Button` (primary / secondary / ghost / danger, three sizes, loading), `IconButton`,
  `CopyButton`, `CopyIconButton`
- **Forms:** `Field` (label, hint, error, `aria-describedby`/`aria-invalid` wiring), `Input`,
  `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup`
- **Structure:** `Surface`, `Card`, `Separator`, `Tabs`
- **Feedback:** `Badge`, `StatusPill`, `ProgressBar`, `Spinner`, `Tooltip`, `Kbd`, `Alert`,
  `InlineError`, `EmptyState`, `ErrorState`, `Skeleton`/`SkeletonText`, `AsyncBoundary`
- **Overlays:** `Dialog`, `ConfirmDialog` (destructive variant with optional typed confirmation),
  `Sheet` (right panel that becomes a bottom sheet under 640 px), `DropdownMenu`/`DropdownMenuItem`,
  `ContextMenu`, and `ToastProvider`/`useToast` (queue, undo action, 8 s minimum for errors)

Composite widgets delegate keyboard and screen-reader behavior to Radix UI while keeping bespoke,
token-driven styling. Component tests cover roles, accessible names, keyboard interaction, error
association, and loading announcements.

The **design gallery** (`src/routes/design/DesignGallery.tsx`) renders every primitive in every
state — including live dialog, confirmation, sheet, menu, toast, and state demos — and is the visual
reference for later tasks. Since TASK-008 it lives at `/design`, inside the application shell.

## Application shell and routing

`src/app/router.tsx` is the single route table. One layout route owns the shell, so every screen
shares the same landmarks, focus behaviour, and navigation; `*` is a child of the shell (a mistyped
URL still gets navigation), while the recovery screen is the layout's `errorElement` and therefore
renders even if the shell itself throws.

| Path                 | Screen                | State                                      |
| -------------------- | --------------------- | ------------------------------------------ |
| `/`                  | Dashboard             | **Implemented** (TASK-010)                 |
| `/library`           | Library               | **Implemented** (TASK-011)                 |
| `/prompts/:promptId` | Prompt workspace      | Scaffold → TASK-014                        |
| `/composer`          | Composer              | Scaffold → TASK-017                        |
| `/templates`         | Templates             | Scaffold → TASK-018                        |
| `/validation`        | Validation            | Scaffold → TASK-016                        |
| `/health`            | Health                | Scaffold → TASK-025                        |
| `/settings`          | Settings              | **Implemented** (theme, density, autosave) |
| `/design`            | Design system gallery | **Implemented** (TASK-003/004)             |
| `*`                  | Not found             | **Implemented** (recovery links)           |

- **One navigation model.** `src/components/layout/navigation.ts` declares every destination once
  (path, label, description, icon). The rail, the drawer, the breadcrumbs, and the document title all
  read from it, so a route cannot appear in one place and be missing from another. `NavLink` marks
  the active destination with `aria-current="page"`.
- **Rail and drawer.** The rail is 240 px expanded / 64 px collapsed and hidden below `lg`
  (1024 px); the drawer renders the same `NavList` in a `Sheet side="left"`. Collapsing hides labels
  visually but keeps them as accessible names, and the collapsed state lives in `uiStore` (session
  only, reset on reload).
- **Focus is deliberate.** The skip link is the first focusable element and targets `#main-content`.
  On navigation, focus moves to that `main` landmark and scroll resets — but not on first render, so
  loading the app does not steal focus. Closing the drawer with Escape, the close button, or the
  overlay returns focus to the menu button; closing it _because the user picked a destination_ does
  not, because the new screen's landmark should win (`Sheet.restoreFocusOnClose`).
- **`document.title` is per route** (`<Screen> · PromptForge`), driven by the same navigation model.
- **No phantom controls.** The top bar's search trigger opens the real command palette and shows the
  platform's own shortcut (`⌘K` or `Ctrl K`); the adjacent button opens the generated shortcut
  reference. Scaffolded routes list what will be built and offer no controls that would appear to
  work, and the palette never lists a command that is not registered.
- **Settings are real.** Theme, editor density, and autosave write through `preferencesStore` and the
  settings repository immediately and report the outcome — including the honest "session only"
  message when storage is ephemeral. Fields whose features do not exist yet (indentation, reduced
  motion) are named in copy but not exposed as controls.

```tsx
// Composition order (src/app/App.tsx)
AppProviders (theme → tooltips → toasts → error boundary)
  └─ DataBootstrap          // skeletons until storage is resolved, seeded, hydrated
       └─ RouterProvider    // createBrowserRouter(routes); tests inject a memory router
```

## Dashboard (TASK-010)

The landing screen is the one place that summarises the library, so its data path is deliberately
narrow: **store → one pure selector → presentational sections**. No component counts anything itself.

| Piece                                          | Responsibility                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/store/dashboard.ts`                       | `selectDashboardData()` (counts, recents, pinned, favorites, templates, attention, activity, `isEmpty`), `findDocumentProblems()`, `selectAttention()`, `describeDashboardSummary()` |
| `src/components/dashboard/useDashboardData.ts` | Reads the injected store slices and memoises the selector on those slices                                                                                                            |
| `src/components/dashboard/*.tsx`               | `StatStrip`, `RecentList`, `PinnedRail`, `AttentionList`, `ActivityRail`, `FirstRunPanel`, plus the shared `DashboardSection` shell, `PromptRow`, and `TemplatePreview`              |
| `src/routes/dashboard/DashboardRoute.tsx`      | Editorial header (greeting, date, summary, actions, palette trigger) and the section layout                                                                                          |
| `src/lib/dates.ts`                             | Locale-pinned date, date-time, relative-time, and greeting helpers (pure, `now` injectable)                                                                                          |
| `src/lib/libraryLinks.ts`                      | The `?filter=` vocabulary the stat tiles and section actions link into (ADR-57)                                                                                                      |

**Rules the screen follows.**

- Every number is derived at render time from stored records; the header sentence is generated from the
  same counts object, so the two cannot disagree (ADR-56).
- "Invalid" is decided only by `parseDocument()` refusing the stored document. The copy says "will not
  parse"; no screen claims a prompt is good, and valid syntax is never presented as quality.
- Archived prompts are excluded from recents, pinned, favorites, unreadable-document counts, and
  attention (ADR-60).
- Each stat tile and section action is a real link: `/library` (optionally filtered), `/validation`,
  `/prompts/:promptId`, `/templates`, `/composer`. Unbuilt destinations render their honest scaffold.
- The first-run guide shows only while `settings.onboardedAt` is null, and it disappears only after the
  settings write succeeds; a failure is reported and the guide stays (ADR-58).
- Empty states differ for "no prompts at all", "all archived", and "nothing in this section yet",
  because those mean different things to the user.

## Library (TASK-011)

The library is a view over stored prompts: nothing is cached, nothing is mutated, and the URL is the
only filter state (ADR-61). Search, filtering, and sorting run through `src/store/selectors.ts`; the
matching rules themselves live in `src/domain/search.ts` (ADR-62).

| Piece                                        | Responsibility                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/library/libraryQuery.ts`         | URL ⇄ `LibraryState` contract: `readLibraryState`, `writeLibraryState`, `SEARCH_MAX_LENGTH`, `SEARCH_DEBOUNCE_MS`, option lists, `toggleTag`, `editedAfter`, `hasActiveFilters` |
| `src/domain/search.ts`                       | `parseSearchQuery`, `matchPrompt`, `searchPrompts`, `highlightSegments` — the only definition of a match (ADR-62)                                                               |
| `src/lib/folderTree.ts`                      | `buildFolderTree`, `flattenFolderTree`, `folderSubtreeIds`: nesting for the rail and subtree filtering, with cycle rejection                                                    |
| `src/lib/viewPreference.ts`                  | Validated `localStorage` grid/list preference (ADR-64)                                                                                                                          |
| `src/components/library/IngredientRail.tsx`  | Folder tree, collections, and tag multi-select with counts scoped to the archive scope, plus per-row `⋯` menus and `+` create buttons (TASK-012)                               |
| `src/components/library/FilterBar.tsx`       | Debounced search, removable filter chips, clear-all, sort / status / validation / date selects, archived and favorites toggles, result count                                    |
| `src/components/library/PromptBadges.tsx`    | Status pill and the "Parses / Will not parse" badge shared by both views                                                                                                        |
| `src/components/library/HighlightedText.tsx` | Renders `highlightSegments` output as `<mark>` runs — no user text is ever treated as markup                                                                                    |
| `src/components/library/PromptCard.tsx`      | Artifact card (grid): title, description, tags, status, parsability, pin/favorite markers, relative edit time, JSON excerpt when the document matched, action menu             |
| `src/components/library/PromptRow.tsx`       | Dense row (list) showing the same facts with a stable column rhythm, including the action menu                                                                                  |
| `src/components/library/PromptGrid.tsx`      | Responsive grid + empty slot, labelled for the a11y tree                                                                                                                        |
| `src/components/library/PromptList.tsx`      | Table-like list + empty slot, labelled for the a11y tree                                                                                                                        |
| `src/routes/library/LibraryRoute.tsx`        | Derives the query from the URL, renders pinned and matching sections, the selection bar, and the loading/empty/error states, and owns the prompt/folder/collection lifecycle   |

**Rules the screen follows.**

- The URL is the state. Typing is debounced and replaced in history; deliberate filters push an entry,
  so back/forward walks the filter history (ADR-61).
- A result is counted, listed, and highlighted by the same search module, so the count always equals the
  rendered items (ADR-62).
- Pinned prompts appear once, in their own section, and the count still counts them once (ADR-63).
- Grid and list render the same prompts with the same facts; the preference is persisted, and a `?view=`
  link overrides it for that navigation (ADR-64).
- Archived prompts are excluded unless the archive toggle is on; every rail count describes the current
  archive scope, not the current search.
- The selection checkbox is a sibling of the card link (never nested inside it), the selection bar counts
  the set, and it says that bulk actions arrive in TASK-013.
- Empty states distinguish "this library has no prompts" (offers composer and templates) from "nothing
  matches these filters" (offers clear-filters).
- Loading renders skeleton cards with `aria-busy`; a failed read renders `ErrorState` with a retry that
  re-runs `hydrate()` and the technical detail collapsed behind a disclosure.

Screens read the store through `useDataStoreApi()` (`src/store/dataStoreContext.ts`), which returns the
store provided by `DataBootstrap` or the application singleton. That is what lets the integration tests
mount the real shell, store, and seeded in-memory repositories together (ADR-59).

## Organization and prompt lifecycle (TASK-012)

Creating, editing, duplicating, archiving, and deleting prompts — plus folders and collections — happens
in the library. The route owns the intent; the store owns the write; the domain owns the rules.

| Piece                                        | Responsibility                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/errors.ts`                       | `RuleViolationError` carries one message per field (`issueFor(path)`), so a rule explains itself under the offending control instead of in a generic banner                 |
| `src/domain/invariants.ts`                   | `checkNewFolder`, `checkCollectionName`, plus the existing depth/cycle/name rules `checkFolderMove` and `wouldCreateFolderCycle`                                            |
| `src/store/dataStore.ts`                     | `duplicatePrompt`, `movePrompt`, `addFolder`, `updateFolder`, `deleteFolder`, `addCollection`, `updateCollection`, `deleteCollection` — every write goes through `run()` + `writePrompt` and records activity |
| `src/features/organization/organization.ts`  | Pure helpers: `folderOptions` (indented labels, subtree excluded), `countFolderContents`, `countCollectionMembers`, `parentFolderLabel`, `folderLabel`, `folderMoveIssues`, `formatTagInput`/`parseTagInput`, `sortedCollections` |
| `src/features/organization/FolderDialog.tsx` | Create/rename/move a folder; the parent list cannot express a cycle, and the rule still runs on submit                                                                     |
| `src/features/organization/CollectionDialog.tsx` | Create/rename a collection with a description                                                                                                                         |
| `src/features/organization/DeleteContainerDialog.tsx` | Confirms container deletion with the exact destination and counts, and states that no prompt is deleted                                                           |
| `src/components/prompts/PromptFormDialog.tsx`| Create/edit prompt metadata; create also picks a template or a blank document. Never edits the document body                                                               |
| `src/components/prompts/PromptActionsMenu.tsx`| One dropdown per prompt: edit details, duplicate, archive/restore, delete                                                                                                 |
| `src/components/prompts/DeletePromptDialog.tsx`| Names the prompt and itemises the snapshots and test cases that go with it                                                                                               |
| `src/routes/library/libraryQuery.ts`         | `LIBRARY_DIALOGS` and the `?new=` parameter, so palette commands and links open the same dialog (ADR-68)                                                                  |

**Rules the screen follows.**

- Deleting a prompt calls `prompts.deleteCascade(id)` once: prompt, revisions, and test cases disappear
  in a single IndexedDB transaction, or nothing does (ADR-66).
- Deleting a folder re-parents its prompts and subfolders to the *removed folder's* parent — never
  `null` unless the folder was already at the top level — so the tree keeps its shape and no prompt is
  deleted (ADR-67).
- Deleting a collection clears membership only; prompt rows are rewritten without the collection id and
  nothing else about them changes.
- Toasts report what the mutation returned (`{ promptsMoved, foldersMoved }`, `{ promptsDetached }`),
  not a number recomputed in the component (ADR-65).
- Duplicate names, depth, and cycles come back as `RuleViolationError` and render under the field; a
  non-rule failure renders as a form-level `role="alert"` and leaves the dialog open with the values
  intact.
- Archive/restore offers an Undo action in the toast; deletion is confirmed and final.
- A create navigates to `/prompts/:id` only after the store confirms the write, so the editor always
  opens on stored data.
- Empty rails say so and open the create dialog; they never fake a filter.

## Commands and keyboard

Everything a shortcut can do is declared once, in `src/lib/commands/`:

```ts
{
  id: 'navigation.library',        // namespaced, unique (duplicates throw)
  title: 'Go to Library',
  group: 'Navigation',             // palette section + help overlay grouping
  keywords: ['prompts', 'browse'], // extra search terms
  shortcut: 'G L',                 // `Mod+K`, `Shift+?`, or a two-step sequence
  when: (context) => context.dev,  // availability, evaluated from live state
  run: (context) => context.navigate('/library'),
}
```

- **One registry.** `createCommandRegistry()` stores the definitions, rejects duplicate ids **and**
  duplicate shortcuts at registration, and exposes a stable, ordered snapshot. The palette, the
  global key listener, and the help overlay all read that same list, so a shortcut cannot be
  documented in one place and bound in another. `ensureCoreCommands()` registers the current set once
  per session.
- **Pure matching.** `parseShortcut` validates definitions; `eventMatchesChord` maps `Mod` to ⌘ on
  Apple platforms and Ctrl elsewhere and requires exact modifier state (so `Ctrl+Shift+K` never fires
  `Ctrl+K`). Shift is ignored only for punctuation that already encodes it (`?`). The stateful
  `createShortcutMatcher` handles two-step sequences: several commands may share a first chord, the
  pending step expires after 1.5 s, a mismatch clears it, and a completed single chord always wins
  over a pending prefix.
- **Dispatch rules.** One `keydown` listener on `document`. It ignores auto-repeat, composed and
  already-consumed events, overlays (they own their keys), everything while the palette or help is
  open, and — except commands marked `allowInInput`, currently only the palette's own `Mod+K` —
  everything typed into an input, textarea, select, or contenteditable.
- **The palette** is a Radix dialog with a combobox input and a `role="listbox"` of grouped,
  fuzzy-ranked options. Focus never leaves the search field; the arrow keys move
  `aria-activedescendant` instead, Enter runs the highlighted command, Escape closes, and focus
  returns to whatever opened it. On phones the dialog becomes a full-screen sheet. Recently used
  commands lead the list on an empty query (session-only, in `uiStore`).
- **No double execution.** The palette closes before running and guards with a local ref, and the
  shared `commandRunner` refuses to start a command whose id is already in flight — so a repeated
  keydown, a double click, or two shortcuts for the same command cannot fire it twice.
- **Help is generated.** `ShortcutHelpDialog` renders the registry's shortcuts grouped exactly as the
  palette groups them; there is no hand-written shortcut table. Commands without shortcuts are still
  searchable in the palette and simply do not appear in the reference.
- **Contract for later tasks.** A feature registers its commands while its screen is mounted and
  returns the disposer from the effect. `when` decides availability from the live context (route,
  selection, theme, typing state, development build). Commands that are not implemented must not be
  registered — the palette's list is the honest list of what the app can do.

## Persistence

`src/data/` is a self-contained layer behind repository interfaces: eleven repositories, a
`promptforge` IndexedDB database at schema version 2 with eleven object stores and versioned
migrations, an in-memory adapter that passes the same contract suite, typed storage errors
mapped at the repository boundary, and a per-prompt write queue.

- **Nothing outside `src/data` imports an adapter or the database module** — only the public surface
  `src/data/index.ts`. ESLint enforces that, and it also forbids React/UI imports inside the layer.
- **Versions only move forward, by one.** `prompts.update` requires an `expectedVersion` that equals
  the stored version; a stale base is rejected with `StaleWriteError` and mutates nothing.
- **Migrations are atomic and replayable.** They run inside the `versionchange` transaction, record
  themselves in `meta`, and abort the whole upgrade on failure.
- **Prompt deletion cascades in one transaction.** `prompts.deleteCascade(id)` removes the prompt, its
  revisions, and its test cases inside a single `readwrite` transaction; a failure leaves every row in
  place (ADR-66).
- **Failures are typed.** `QuotaExceededError`, `StorageUnavailableError`, `CorruptDataError`,
  `DuplicateRecordError`, `RecordNotFoundError`, `InvalidWriteError`, `StaleWriteError`, and
  `MigrationError` let the UI choose a recovery path instead of parsing messages.

Details, schema tables, and the verification evidence live in
[`docs/PERSISTENCE.md`](./PERSISTENCE.md).

## Application data lifecycle

The shell and every route run inside the real lifecycle, so the boot path is exercised by the dev
server rather than existing only in tests.

```
openStorage()            probe → durable adapter, or in-memory with a notice   (src/data/storage.ts)
   ↓
attach + seedDatabase()  version-gated, resumable first-run data               (src/data/db/seed.ts)
   ↓
hydrate()                every repository read in parallel into the store      (src/store/dataStore.ts)
   ↓
applySettings()          persisted preferences adopted                         (src/store/preferencesStore.ts)
   ↓
DataBootstrap renders    loading skeletons → banner + children, or a recovery screen
```

- **`dataStore`** owns the in-memory library (`prompts`, `folders`, `collections`, `templates`,
  `testCases`, `schemas`, `snippets`, `activity`, `settings`) plus `mode`, `status`, `error`, and
  `busy`. Every mutation calls a repository and then adopts the value the repository returned, so a
  failed write can never look saved. Prompt writes read the current row first and pass its version as
  `expectedVersion`, which keeps the optimistic-concurrency guarantee intact.
- **Activity is recorded for create, update, archive, restore, delete, and snapshot.** If the
  activity write alone fails, the mutation stands and the store says the timeline is incomplete —
  rollback would be worse than a missing log line.
- **`preferencesStore`** merges the original theme slice with density, indentation, autosave, and
  reduced motion; `src/store/preferences.ts` re-exports it so the theme provider did not move.
  `applySettings` adopts a persisted record, `toSettings` writes preferences back without losing
  `onboardedAt` or `seedVersion`.
- **`uiStore`** holds panels, the command palette, and selection — never persisted, reset on reload.
- **`selectors.ts`** filters/sorts the library (search, tags, folders and subtrees, collections,
  status, parse state, snapshot coverage, edited-after window), memoizes with a single-entry cache keyed on array
  identity plus query, and computes dashboard aggregates. It is pure and tested without a renderer.
- **`DataBootstrap`** renders nothing but skeletons until data is ready, labels ephemeral mode with
  a warning banner that says changes are not saved, and offers retry from typed failures.
- **`ErrorBoundary`** catches render failures and shows a recovery screen with reload, retry, and a
  `Technical details` disclosure; it never claims data was lost or saved.

Seeding writes no activity events and is version-gated by `meta.seedVersion`; a second boot adds
nothing. First-run onboarding is only a data flag (`Settings.onboardedAt`) until the dashboard hosts
the flow in TASK-010.

## Data and privacy

PromptForge is designed to be **local-first and single-user**. Prompts, revisions, and settings are
stored in the browser's IndexedDB on this device (or in memory, in ephemeral mode). The application
does not send prompt content to any server, makes no external runtime requests, and integrates no AI
model provider in its planned v1 scope. Cross-tab messaging uses `BroadcastChannel` and carries ids,
versions, and timestamps only — never prompt content.

## Roadmap

The complete, approval-gated plan — 31 tasks with acceptance criteria and validation steps —
lives in [`tasks.md`](./tasks.md). Planning is complete; implementation proceeds one authorized
task at a time.
