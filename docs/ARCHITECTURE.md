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

| Area        | Choice                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| UI          | React 19, TypeScript (strict), Vite                                                       |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`                                                   |
| State       | Zustand stores for data, preferences, and interface state (TASK-007)                      |
| Routing     | react-router-dom                                                                          |
| Persistence | IndexedDB through repository interfaces (`idb`), in-memory parity adapter                 |
| Editor      | CodeMirror 6 via `@uiw/react-codemirror` + `@codemirror/lang-json` (lazy chunk, TASK-014) |
| Validation  | In-house JSON Schema interpreter for a documented subset — no `eval` (TASK-016)           |
| Testing     | Vitest, Testing Library, `jest-dom`, `fake-indexeddb`, jsdom                              |
| Quality     | ESLint (flat config), Prettier                                                            |

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

| Path                            | Screen                | State                                              |
| ------------------------------- | --------------------- | -------------------------------------------------- |
| `/`                             | Dashboard             | **Implemented** (TASK-010)                         |
| `/library`                      | Library               | **Implemented** (TASK-011)                         |
| `/prompts/:promptId`            | Prompt workspace      | **Implemented** (TASK-014/015; Preview tab in 021) |
| `/prompts/:promptId/history`    | Version history       | **Implemented** (TASK-019)                         |
| `/prompts/:promptId/playground` | Variable playground   | **Implemented** (TASK-021)                         |
| `/composer`                     | Composer              | Scaffold → TASK-017                                |
| `/templates`                    | Templates             | Template catalog, preview, custom templates        |
| `/validation`                   | Validation            | Scaffold → TASK-016                                |
| `/health`                       | Health                | Scaffold → TASK-025                                |
| `/settings`                     | Settings              | **Implemented** (theme, density, autosave)         |
| `/design`                       | Design system gallery | **Implemented** (TASK-003/004)                     |
| `*`                             | Not found             | **Implemented** (recovery links)                   |

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

| Piece                                        | Responsibility                                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/library/libraryQuery.ts`         | URL ⇄ `LibraryState` contract: `readLibraryState`, `writeLibraryState`, `SEARCH_MAX_LENGTH`, `SEARCH_DEBOUNCE_MS`, option lists, `toggleTag`, `editedAfter`, `hasActiveFilters`        |
| `src/domain/search.ts`                       | `parseSearchQuery`, `matchPrompt`, `searchPrompts`, `highlightSegments` — the only definition of a match (ADR-62)                                                                      |
| `src/lib/folderTree.ts`                      | `buildFolderTree`, `flattenFolderTree`, `folderSubtreeIds`: nesting for the rail and subtree filtering, with cycle rejection                                                           |
| `src/lib/viewPreference.ts`                  | Validated `localStorage` grid/list preference (ADR-64)                                                                                                                                 |
| `src/components/library/IngredientRail.tsx`  | Folder tree, collections, and tag multi-select with counts scoped to the archive scope, per-row `⋯` menus, `+` create buttons (TASK-012), and `Manage tags` (TASK-013)                 |
| `src/components/library/FilterBar.tsx`       | Debounced search, removable filter chips, clear-all, sort / status / validation / date selects, archived and favorites toggles, result count                                           |
| `src/components/library/PromptBadges.tsx`    | Status pill and the "Parses / Will not parse" badge shared by both views                                                                                                               |
| `src/components/library/HighlightedText.tsx` | Renders `highlightSegments` output as `<mark>` runs — no user text is ever treated as markup                                                                                           |
| `src/components/library/PromptCard.tsx`      | Artifact card (grid): selection checkbox, title, description, tags, status, parsability, pin/favorite markers, relative edit time, JSON excerpt when the document matched, action menu |
| `src/components/library/PromptRow.tsx`       | Dense row (list) showing the same facts with a stable column rhythm, including the action menu                                                                                         |
| `src/components/library/PromptGrid.tsx`      | Responsive grid + empty slot, labelled for the a11y tree                                                                                                                               |
| `src/components/library/PromptList.tsx`      | Table-like list + empty slot, labelled for the a11y tree                                                                                                                               |
| `src/routes/library/LibraryRoute.tsx`        | Derives the query from the URL, renders pinned and matching sections, the selection bar, and the loading/empty/error states, and owns the prompt/folder/collection lifecycle           |

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
- The selection checkbox is a sibling of the card link (never nested inside it). Selecting shows the
  sticky bulk bar, which counts the set, states the current filter when the selection came from
  `Select all shown`, and owns favorite/unfavorite/tag/archive/restore/delete (ADR-69).
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

| Piece                                                 | Responsibility                                                                                                                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/errors.ts`                                | `RuleViolationError` carries one message per field (`issueFor(path)`), so a rule explains itself under the offending control instead of in a generic banner                                                                       |
| `src/domain/invariants.ts`                            | `checkNewFolder`, `checkCollectionName`, plus the existing depth/cycle/name rules `checkFolderMove` and `wouldCreateFolderCycle`                                                                                                  |
| `src/store/dataStore.ts`                              | `duplicatePrompt`, `movePrompt`, `addFolder`, `updateFolder`, `deleteFolder`, `addCollection`, `updateCollection`, `deleteCollection` — every write goes through `run()` + `writePrompt` and records activity                     |
| `src/features/organization/organization.ts`           | Pure helpers: `folderOptions` (indented labels, subtree excluded), `countFolderContents`, `countCollectionMembers`, `parentFolderLabel`, `folderLabel`, `folderMoveIssues`, `formatTagInput`/`parseTagInput`, `sortedCollections` |
| `src/features/organization/FolderDialog.tsx`          | Create/rename/move a folder; the parent list cannot express a cycle, and the rule still runs on submit                                                                                                                            |
| `src/features/organization/CollectionDialog.tsx`      | Create/rename a collection with a description                                                                                                                                                                                     |
| `src/features/organization/DeleteContainerDialog.tsx` | Confirms container deletion with the exact destination and counts, and states that no prompt is deleted                                                                                                                           |
| `src/components/prompts/PromptFormDialog.tsx`         | Create/edit prompt metadata; create also picks a template or a blank document. Never edits the document body                                                                                                                      |
| `src/components/prompts/PromptActionsMenu.tsx`        | One dropdown per prompt: edit details, duplicate, archive/restore, delete                                                                                                                                                         |
| `src/components/prompts/DeletePromptDialog.tsx`       | Names the prompt and itemises the snapshots and test cases that go with it                                                                                                                                                        |
| `src/routes/library/libraryQuery.ts`                  | `LIBRARY_DIALOGS` and the `?new=` parameter, so palette commands and links open the same dialog (ADR-68)                                                                                                                          |

**Rules the screen follows.**

- Deleting a prompt calls `prompts.deleteCascade(id)` once: prompt, revisions, and test cases disappear
  in a single IndexedDB transaction, or nothing does (ADR-66).
- Deleting a folder re-parents its prompts and subfolders to the _removed folder's_ parent — never
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

## Favorites, pins, archive, and bulk actions (TASK-013)

Selection is UI state; every other change is a stored write. The route holds the selection (a
`Set<string>` of ids in `LibraryRoute`), the store owns the transaction, and the domain owns the rules.

| Piece                                          | Responsibility                                                                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/invariants.ts`                     | `applyTagEdit` (removals win over additions, both normalized and de-duplicated), `normalizeTags`, `normalizeTag` — the only tag rules                                                                                     |
| `src/store/dataStore.ts`                       | `toggleFavorite`, `togglePin`, `setFavorite`, `setPinned`, `setArchived`, `editTags`, `restorePrompts`, `renameTag`, `deleteTag`, `deletePrompts`, `restoreDeletedPrompts`; all batched writes go through one `bulkWrite` |
| `src/store/selectors.ts`                       | `sortPinnedByTitle` and the library query's `archived` scope; dashboard counts and recents exclude archived rows                                                                                                          |
| `src/features/bulk/bulkActions.ts`             | `rangeIds` (Shift-click range over the rendered order), `tagCensus`, `countPrompts`, `isEmptyTagEdit` — pure helpers, no React                                                                                            |
| `src/components/library/BulkActionBar.tsx`     | Sticky, labelled `role="region"` bar: count (live), favorite, unfavorite, tag, archive, restore, delete, clear selection                                                                                                  |
| `src/components/library/SelectionCheckbox.tsx` | Per-prompt checkbox that also handles Shift-click ranges, labelled with the prompt title                                                                                                                                  |
| `src/components/library/TagManagerDialog.tsx`  | Rename/remove a tag across the library, with the affected prompt count shown before either action                                                                                                                         |
| `src/components/library/BulkTagDialog.tsx`     | Add/remove tags on the selection, suggestions from the existing census                                                                                                                                                    |
| `src/components/prompts/PromptSummaryCard.tsx` | Metadata header on the editor route (tags, folder, collection, status) with favorite/pin/archive controls                                                                                                                 |
| `src/lib/commands/promptActions.ts`            | `registerPromptFavoriteToggle` / `togglePromptFavorite`: the palette command needs the editor, so it registers while that screen is mounted                                                                               |

**Rules the screen follows.**

- **One transaction per bulk action.** `prompts.updateMany` writes every row or none; a stale version,
  a missing record, or a storage failure aborts the batch (ADR-70). The store then re-reads storage
  and adopts what is actually stored, so a partial write can never be displayed as success.
- **Undo is a snapshot, not an inverse.** A reversible bulk action returns `{ prompts, previous }`; the
  toast's Undo passes those rows back to `restorePrompts`, which writes the reversible fields
  (`favorite`, `pinned`, `archived`, `tags`) and nothing else, so later edits survive. A failed restore
  reports `That change could not be undone` and changes nothing (ADR-71).
- **Deleting is confirmed and reversible only in-session.** The confirmation names the count, the
  delete cascades in one transaction, and Undo re-creates prompts, revisions, and test cases from the
  snapshot it returned. The copy says so.
- **Selection never leaks past a filter.** `Select all shown` selects the currently rendered ids and
  the bar states the filter (`All 3 prompts shown`). Changing a filter, sort, scope, or folder clears
  the selection, and a row that leaves the view can never be modified by a later bar action.
- **Tag renames are in place.** `renameTag` maps existing tags, normalizes, and de-duplicates, so tag
  order survives and a merge into an existing tag collapses instead of repeating (ADR-72).
- **Feedback is written, not assumed.** Toasts report the rows the store returned (`2 prompts updated`),
  and a failure keeps the selection intact with `That change was not saved`.

Palette commands added here: `prompt.toggle-favorite` (available on the editor route only), and
`library.favorites` / `library.archived`, which switch the library scope through the same URL contract
the rail uses.

## Saving and recovery (TASK-015)

One hook, `src/features/save/useSavePipeline.ts`, owns every write of editor content. It wraps
`useDocumentDraft` (text + parse) with a persisted baseline, a save state, a conflict, a recovery
candidate, and a cross-tab notice. Components render; they do not decide when a save happened.

| Piece                                                       | Responsibility                                                                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/save/useSavePipeline.ts`                      | Baseline `{ text, version, updatedAt }`, derived save state, validation before write, queued write with `expectedVersion`, autosave debounce, `Mod+S`, retry, snapshot gate |
| `src/features/save/saveBus.ts`                              | Lazily created shared `WriteQueue` and `WriteBroadcaster`, so every editor mount serializes and announces through the same instances                                        |
| `src/features/save/recoveryStorage.ts`                      | Version-aware recovery drafts over `draftStorage`: `readRecovery` (with a diff hint), `writeRecovery`, `clearRecovery`, `canRecover`                                        |
| `src/domain/textDiff.ts`                                    | `summarizeLineDifference` / `describeLineDifference` — common-prefix/suffix line comparison used for the recovery hint                                                      |
| `src/components/editor/SaveStatus.tsx`                      | `role="status"` live region: label + icon + detail per state, last-saved time, Retry, and an explicit Save now button                                                       |
| `src/components/editor/SaveConflictDialog.tsx`              | Stale-write resolution: reload the stored version, keep the draft as new content, or view the stored version — no timeout, no silent overwrite                              |
| `src/store/dataStore.ts` (`editPrompt`, `readStoredPrompt`) | `expectedVersion` guard on writes; a read-only read for conflict previews that does not disturb the draft                                                                   |

**Rules the pipeline follows.**

- **Ordered, latest-content writes.** Every save is queued per prompt, and the queued task re-reads the
  text when it runs, so a fast edit is the one that lands. A save requested while another is in flight
  coalesces onto it.
- **"Saved" is a resolved fact.** The state is derived (`disabled`, `conflict`, `saving`, `error`,
  `dirty`, `saved`, `clean`) and `saved` is unreachable until the write promise resolves. A failed
  write keeps the draft, shows the reason, and offers Retry.
- **Conflicts ask.** A write whose `expectedVersion` lost the race becomes a conflict: autosave stops
  and the dialog presents the two destructive outcomes by name, plus a preview of what storage holds.
- **Another tab is a notice.** Announcements raise a banner with _Review both versions_ / _Keep
  editing_; a message never replaces the draft (ADR-82).
- **Recovery is the safety net, not the save.** A dirty draft is mirrored to `localStorage` with the
  version it was typed over; the copy is cleared only after a confirmed write.
- **Ephemeral mode is explicit.** No Save button claims to work, a banner says saving is disabled, and
  recovery drafts still protect the text.

## JSON editor workspace (TASK-014)

`/prompts/:promptId` is a workspace, not a form: a metadata header, a save-status row, a raw/tree tab
strip, the CodeMirror host, a syntax-error panel, a status bar, and a collapsible inspector. The
editor owns its document text; persistence lives in the save pipeline (see the next section).

| Piece                                       | Responsibility                                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/domain/jsonText.ts`                    | `scanJson` (recursive-descent parser with exact offsets), `formatJsonText`, `minifyJsonText`, `lineColumnAt`, `offsetAtLineColumn`, `jsonTextStats`, `LARGE_DOCUMENT_CHARS`, `PARSE_DEBOUNCE_MS`, `MAX_JSON_DEPTH` |
| `src/domain/jsonTree.ts`                    | `buildJsonTree`, `visibleJsonTreeRows`, `defaultExpandedPaths`, `treeKeyboardAction`, `formatJsonPath`, `jsonValuePreview` — the tree and its keys, with no renderer                                               |
| `src/components/editor/JsonEditor.tsx`      | CodeMirror host: extensions, aria-label, caret reporting, and the imperative handle (`jumpToOffset`, `selectAll`, `openSearch`, `undo`, `redo`)                                                                    |
| `src/components/editor/editorTheme.ts`      | Editor chrome and JSON token colors, all through `--pf-*` variables (ADR-74)                                                                                                                                       |
| `src/components/editor/EditorToolbar.tsx`   | Format, Minify, Undo/Redo, Find, Copy all, Jump to error — each a real action, disabled (never hidden) when the text does not parse                                                                                |
| `src/components/editor/TreeView.tsx`        | Read-only `role="tree"` with `aria-activedescendant`, arrow-key navigation, expansion toggles, and the active row's path with a copy control (ADR-77)                                                              |
| `src/components/editor/JsonErrorPanel.tsx`  | `role="alert"` error with the exact line/column and a "go to line" action; states that the text is unchanged                                                                                                       |
| `src/components/editor/EditorStatusBar.tsx` | Caret line/column, line and character counts, indent, and a validity badge that has a `Checking…` state instead of a stale "Valid JSON"                                                                            |
| `src/components/editor/EditorInspector.tsx` | Collapsible inspector with real structure facts (nodes, depth, top-level keys) and an explicit note that schema validation is TASK-016                                                                             |
| `src/features/editor/useDocumentDraft.ts`   | Draft text, debounced parse, `beforeunload` guard, and the `Checking…` state; when the save pipeline is present it leaves recovery to the pipeline (ADR-80)                                                        |
| `src/features/editor/draftStorage.ts`       | Fail-soft draft storage: namespaced keys, size cap, defensive parsing, and no throwing when storage is blocked                                                                                                     |

**Rules the workspace follows.**

- **The scanner owns the location.** `JSON.parse` errors carry a character offset _or_ a truncated
  snippet depending on the message length, and V8's token can be the character after the mistake. The
  scanner in `jsonText.ts` reports the position of the token that is actually wrong, with a sentence a
  person can act on (ADR-73).
- **A syntax error never edits the text.** It disables formatting and minifying (the actions that need a
  parsed value), shows the error panel, and leaves the tree view with guidance instead of a partial tree.
- **Nothing claims a save.** The save-status row reports what the pipeline knows: "Saving…", "Saved at
  HH:MM" (only after the write resolved), the failure with a Retry action, or "Saving is off" in
  ephemeral mode. The status bar's draft line says "Unsaved changes — this text is not in storage yet.".
- **Leaving is guarded twice.** `useBlocker` asks before an in-app navigation while the draft is dirty,
  and `beforeunload` covers the browser; the recovery copy survives either way.
- **The editor is a lazy chunk.** The route imports it with `React.lazy`, so CodeMirror lives in its own
  bundle (~428 kB, ~139 kB gzip) and the rest of the app does not download it (ADR-75).
- **Preferences, not constants.** Indent width comes from settings; the stored document is formatted
  with two spaces as the canonical base, so changing the preference never rewrites the draft's baseline.
- **Validity is never color-only.** The status badge pairs a color with an icon and a word, and the
  `Checking…` state exists so a pending parse is not displayed as success.

## Validation (TASK-016)

Validation is one pure pipeline plus three surfaces that render its result. Nothing in it writes.

| Piece                                       | Responsibility                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/jsonSchema.ts`                  | `compileJsonSchema` (refuses unknown keywords, malformed values, remote `$ref`, and anything past the depth/size limits) and `validateInstance` (the supported keyword subset)  |
| `src/domain/validation.ts`                  | `validateJsonText` / `validateJsonValue` → one `ValidationReport`; `findSchemaProblems` for library-wide checks; `findLineForPath`, `pathToPointer`, `pointerToPath`; LRU cache |
| `src/store/dataStore.ts`                    | `addSchema`, `updateSchema`, `deleteSchema` (detaches first, atomically), `setPromptSchema` (version-guarded)                                                                   |
| `src/components/validation/`                | `IssueList` (+ `IssueCounts`), `ValidationSummary` (+ `ValidationScopeNote`), `SchemaEditorDialog`                                                                              |
| `src/features/schemas/useSchemaLibrary.ts`  | Selection, draft, save/delete flows, and the schema dialog's state                                                                                                              |
| `src/routes/validation/ValidationRoute.tsx` | The `/validation` studio: prompt selection (`?prompt=`), filters, issue list, schema library with usage counts                                                                  |
| `src/components/editor/EditorInspector.tsx` | A `Validation` tab over the live draft report, with Find actions and a link to the studio                                                                                       |

**Rules the pipeline follows.**

- **One report, three kinds.** Findings are `syntax` (errors with line/column), `schema` (errors, either
  a rejected schema or non-conformance), or `document` (shape warnings). The report carries counts,
  `schemaStatus`, `conforms`, `truncated`, and an optional `skippedReason`; the UI never re-derives
  severity or invents a verdict.
- **The schema, not the document, is blamed for a bad schema.** A compile failure sets
  `schemaStatus: 'rejected'`, reports the schema's own problems, and performs no conformance checks.
- **Validation never mutates.** Text and an optional schema in, a report out. The only stateful element
  is a 32-entry compile cache; nothing is saved, and the studio is read-only over the prompt.
- **"Valid" has a precise meaning.** Syntax passes, no schema errors, no document warnings, and the check
  actually ran. A skipped check renders as skipped, never as an empty pass (ADR-88).
- **The scope sentence is part of the data flow.** `ValidationScopeNote` is rendered by the studio, the
  inspector tab, and the dashboard copy, so a new surface cannot accidentally omit it (ADR-85).
- **Severity is never color-only.** Every row states its kind and severity in words with an icon, and the
  counts are printed; the pills use `StatusPill`, whose tone always pairs with text.
- **Document warnings never block a save.** The save pipeline refuses invalid JSON or an invalid prompt
  document and names the reason; schema non-conformance is surfaced for attention but is not a
  precondition of storage.

Schema authoring is local: `SchemaEditorDialog` scans the text for JSON syntax with `scanJson`, compiles
it with `compileJsonSchema`, and refuses to save until both agree. Deleting a schema counts the prompts
that currently use it, detaches them in one `updateMany`, then deletes — a prompt never points at a
schema that is gone. The dialect and its limits are documented in [`VALIDATION.md`](./VALIDATION.md).

## Guided composer (TASK-017)

The composer is a second way to edit the same document, not a second document. `/composer` creates a
prompt; `/prompts/:promptId/compose` edits one through the save pipeline.

| Piece                                         | Responsibility                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/composer.ts`                      | `readComposerView` (tolerant reader), `applyComposerPatch` (raw JSON patches that keep unknown keys), issues, completeness, starters, snippets |
| `src/features/composer/useComposerDraft.ts`   | The draft object and its canonical text; no writes, no storage                                                                                 |
| `src/components/composer/ComposerFields.tsx`  | One fieldset per section with labelled controls; nothing here is unwired                                                                       |
| `src/components/composer/VariablesEditor.tsx` | Variable rows: name, type, required, default, description, with per-row errors and keyboard reordering                                         |
| `src/components/composer/JsonValueField.tsx`  | A JSON-valued field that applies only parseable text and reports when it cannot                                                                |
| `src/components/composer/SnippetInsert.tsx`   | Inserts a stored snippet's value into a chosen section and records `includes`                                                                  |
| `src/components/composer/ComposerPreview.tsx` | Read-only JSON of the current draft, with a handoff to the raw editor                                                                          |
| `src/components/composer/ComposerIssues.tsx`  | Completeness in words plus the errors that hold a save back                                                                                    |

**Rules the composer follows.**

- **Patches, not rebuilds.** Every edit starts from the current JSON object, so a key the form does not
  render survives it — including unknown keys inside `context`, `output`, and `metadata` (ADR-89).
- **No silent normalization.** Blank rows, duplicate variable names, and a default that contradicts its
  type are reported, not cleaned up. The form keeps what was typed, and the write gate refuses to store a
  different document than the one on screen (ADR-90).
- **JSON fields apply or hold back.** A JSON field that does not parse keeps its previous value in the
  document, shows why, and blocks saving until it parses (ADR-91).
- **One writer.** The form owns the draft; the pipeline owns debounce, autosave, conflicts, and recovery.
  Stored content is adopted into the form only while the pipeline reports nothing unsaved (ADR-92).
- **Accessible structure.** Sections are fieldsets with legends; repeated rows are their own groups;
  reordering is a named button pair, never a drag-only affordance (ADR-93).
- **Honest scope.** "4 of 6 sections have something in them" is a count, not a score, and the copy says the
  checks are shape checks rather than a judgement of prompt quality.

Creating a prompt validates the document with `parseDocument`, reports any normalization the domain
applied, and only then writes through `addPrompt`; edit mode saves through `useSavePipeline`.

## Template catalog (TASK-018)

A template is a `PromptDocument` plus a name, a description, and a category. The catalogue is the only
surface that writes templates; every other surface deep-links into it.

| Piece                                          | Responsibility                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/data/db/templates.ts`                     | The nine built-in documents, each with a permanent id and a `buildContent()` that normalizes its shape               |
| `src/domain/templates.ts`                      | Pure rules: summaries, filtering, name checks, built-in protection, and `instantiateTemplate`                        |
| `src/store/dataStore.ts`                       | `createTemplate`, `createTemplateFromPrompt`, `updateTemplate`, `duplicateTemplate`, `deleteTemplate`, `useTemplate` |
| `src/features/templates/useTemplateLibrary.ts` | Wraps those actions as outcomes (`{ ok: true, value }` / `{ ok: false, error }`) so a dialog can stay open           |
| `src/routes/templates/TemplatesRoute.tsx`      | Search, category, and kind filters; the two sections; the preview sheet; the dialogs                                 |
| `src/components/templates/*`                   | Card, preview sheet, and the create/rename/duplicate dialog                                                          |

**Rules the catalogue follows.**

- **Built-ins are immutable.** The store refuses `updateTemplate` and `deleteTemplate` for them, and the
  card menu does not contain those operations — duplicating produces a custom template (ADR-08, ADR-96).
- **Materialisation is one function.** `instantiateTemplate` deep-copies the document, clears `includes`, and
  drops an `output.schemaRef` this browser cannot resolve, reporting both. The preview shows those notices
  before the button is pressed (ADR-94, ADR-95).
- **Names are unique, case-insensitively.** The dialog checks on every keystroke; the store checks again
  against live state before writing, because two tabs can render the same list.
- **Additive seeding.** `SEED_VERSION = 2` adds seven documents to an existing v1 install and touches
  nothing else; a second run creates nothing (ADR-98).
- **Tags are document tags.** A template shows `content.metadata.tags`; the prompt it creates carries the
  same list. There is no second tag column to drift.
- **One creation path from the dashboard.** Quick-start cards link to `/templates?template=<id>`, which
  opens the preview; creation happens from the sheet's single button (ADR-97).

The route announces its filtered count in a `role="status"` line, and empty states are real: no templates
stored, no custom templates yet (with the action that creates one), and no search results (with "Clear
filters"). The preview lives in the URL so it is deep-linkable and Back closes it; filters are component
state because they describe a visit.

## Version history (TASK-019)

A revision is a full copy of one prompt's editable state — document, title, description, tags, and
variables — plus a number, a kind, and an optional label. History is per prompt, append-only, and lives in
the same local database as the prompt.

| Piece                                          | Responsibility                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/revisions.ts`                      | Pure rules: ordering, per-prompt lookup, summaries, `restoreImpact`, label checks, `prunePlan`, the retention threshold      |
| `src/store/dataStore.ts`                       | `snapshotPrompt`, `restoreRevision` (safety snapshot first, compensating delete), `pruneRevisions`                           |
| `src/features/revisions/useRevisionHistory.ts` | Wraps those three actions as outcomes (`{ ok: true, value }` / `{ ok: false, error }`) plus a `busy` flag                    |
| `src/components/revisions/*`                   | `SnapshotDialog`, `RevisionList`, `RevisionViewer` (read-only `JsonEditor`), `RestoreRevisionDialog`, `PruneRevisionsDialog` |
| `src/routes/history/HistoryRoute.tsx`          | List, viewer, warning, and the three dialogs; selection lives in `?revision=` (ADR-99)                                       |

**Rules the screen follows.**

- **Only three things write history.** Saving a snapshot, restoring, and importing. Autosave, typing, and
  formatting never create a revision; the empty state says so in as many words.
- **A restore cannot lose newer work.** The current state is saved as a `restore-safety` revision before the
  prompt write, and that revision is deleted again if the write throws. A restore never deletes or renumbers
  a revision (ADR-100).
- **Numbers are stable identifiers.** Pruning removes the oldest snapshots and leaves gaps; nothing is
  renumbered, and the next snapshot continues from the highest number the prompt ever had (ADR-101).
- **The viewer is read-only, not a second editor.** `JsonEditor` gains `readOnly`, so highlighting, search,
  and the monospace rendering match the editor while `onChange` is not wired at all.
- **Colour is never the only status.** Each kind is a worded badge ("Snapshot", "Safety snapshot",
  "Imported"), the timestamp is text with the exact time in `title`, and a match with the stored prompt is a
  sentence.
- **The confirmation lists fields.** `restoreImpact` produces a field-level before/after for the five
  captured fields and a "what stays as it is" list for folder, collections, status, favorite, pinned,
  archived, and the schema reference; a no-op restore disables its own button.
- **Pruning is opt-in.** The warning appears past 25 snapshots and states the count; the dialog shows exactly
  how many will be removed and which numbers, and the button is disabled when the answer is zero.

## Diff explorer (TASK-020)

`/diff` compares two JSON documents and explains every change by path. It is a read-only surface: no
control here writes to storage.

| Piece                           | Responsibility                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/domain/diff.ts`            | The engine: ordered `DiffEntry` list with pointers, kinds, categories, moves, summaries, and both copy formats |
| `src/features/diff/sources.ts`  | `prompt:` / `revision:` / `text` references, default pairs, and resolution against the hydrated store          |
| `src/components/diff/*`         | Source pickers, summary and filters, the change list (unified/split), path breadcrumb, and value rendering     |
| `src/routes/diff/DiffRoute.tsx` | URL state, paste parsing, filtering, selection, copying, and the identical/blocked states                      |

**Rules the screen follows.**

- **The sources are the URL.** `?left=` and `?right=` hold short references (`prompt:<id>`,
  `revision:<id>`, `text`); `?prompt=<id>` is the shortcut the editor and history links use, meaning "newest
  snapshot versus the stored prompt" (ADR-104). Pasted JSON stays in the tab and the screen says so.
- **Every change has a pointer and a category.** Rows show an RFC 6901 pointer in escaped form, a readable
  label, a worded kind badge, and a structure/text badge; the detail panel repeats the path as a breadcrumb
  and offers the pointer itself for copying (ADR-102).
- **Arrays are compared after trimming, and re-orders are only claimed for scalar arrays.** Insertions stay
  one entry instead of a cascade, and no element is called "moved" when its content also changed (ADR-103).
- **Bad input pauses, it does not crash.** A pasted side that does not parse reports the scanner's location on
  the field and the comparison area explains what it is waiting for; a missing prompt or pruned snapshot is a
  warning naming the id.
- **Copy reproduces what is on screen.** Both copy actions use the filtered entries and record the filter in
  the output; the buttons name the count ("Copy 3 shown changes").
- **Keyboard traversal is real.** Rows form a single tab stop with ↑/↓/Home/End moving between them, and the
  detail panel follows the selection.
- **The wording is honest.** The scope note says the comparison is textual and structural, not semantic, and
  that it never judges prompt quality.

## Variable rendering and playground (TASK-021)

`/prompts/:promptId/playground` and the editor's **Preview** tab render one document with values.
The template language is exactly one thing: `{{name}}` is replaced by that declared variable's value.
There is no expression syntax, no helper, no loop, and no evaluation.

| Piece                                       | Responsibility                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/domain/variables.ts`                   | Token scanning, reference extraction, declaration reconciliation, input parsing, coercion, and type wording |
| `src/domain/render.ts`                      | Section layout and substitution, blocked-render rules, issue and character accounting, summaries            |
| `src/features/playground/usePlayground.ts`  | Parses each field, applies defaults, debounces the derived render, and keeps the tab's inputs               |
| `src/features/playground/valuesStorage.ts`  | `sessionStorage` records per prompt, size-capped, fail-soft (ADR-105)                                       |
| `src/components/playground/*`               | `VariableForm` (typed fields, resets, reconciliation report) and `RenderedPreview` (output, issues, copy)   |
| `src/routes/playground/PlaygroundRoute.tsx` | The screen around them: breadcrumbs, missing/blocked-document states, and the scope note                    |

**Rules the renderer follows.**

- **A token is a name, and a name is a lookup.** `{{ticket}}` is matched, its identifier is validated
  against `[A-Za-z_][A-Za-z0-9_]*`, and looked up in an object of declared variables. Anything else
  (`{{1 + 1}}`, `{{constructor}}`, `{{__proto__}}`) is copied through and reported — never evaluated,
  never silently dropped (ADR-105's security note, and a source-level test that greps for `eval`,
  `Function`, timers, and dynamic `import`).
- **Values are coerced by declaration.** A string is inserted as-is (newlines kept, no quoting), a number
  and a boolean use their literals, and JSON uses compact JSON. A value whose type does not match the
  declaration is an error, not a guess.
- **Missing is not the same as empty.** A required variable with no value and no default blocks the
  render: `text` is empty, `characters` is 0, and the panel lists what to fill in. An optional variable
  falls back to its declared default; with no default the placeholder stays visible and is reported.
- **Blank fields are unanswered questions.** The form treats an empty field as "no value" for every
  type, including string, so a cleared required field cannot quietly substitute nothing. A declared
  default of `""` still works, because defaults are applied by the renderer.
- **Only the prose fields are rendered** — role, objective, instructions, context description,
  references, constraints — under fixed uppercase headings, with empty sections omitted. Examples,
  output configuration, and metadata are part of the document but not of the text, and the screen says
  so.
- **Undeclared and unused are both named.** Extraction scans every string in the document (including
  fields that are not rendered), so a `{{token}}` in `examples` is never invisible, and the form lists
  declared variables the text never uses.
- **Both entry points are the same component.** The route renders the stored document; the editor's
  Preview tab renders the draft (and says so, with the preview pausing while the draft is not valid
  JSON), so the two can never disagree about what "rendered" means.
- **Nothing is sent anywhere.** Inputs live in this tab's `sessionStorage`, are never written to a
  prompt or a revision, and the screen says both things plainly. The panel offers no "Save as test
  case" button: that belongs to TASK-022 and a control that does nothing would be worse than none.
- **Keyboard and contrast.** Every field is labelled and errors are wired through `Field`
  (`aria-describedby`, `aria-invalid`); the numbered placeholders are a list you can tab through; the
  output block is a focusable `region` with wrapping text so it stays readable at 390 px; and every
  status is a word plus an icon, never colour alone.

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
  place (ADR-66). `prompts.deleteManyCascade(ids)` is the same guarantee for a bulk selection.
- **Bulk updates are one transaction.** `prompts.updateMany(writes)` validates every `expectedVersion`
  and version step before writing, aborts on the first violation, and resolves with the saved rows;
  both the IndexedDB and in-memory adapters implement it and the shared contract suite proves they
  behave identically (ADR-70).
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
  failed write can never look saved. Document writes pass the version the editor's draft was based on
  as `expectedVersion`, so a stale save fails loudly instead of overwriting another tab; ordinary
  metadata writes read the current row first.
- **Activity is recorded for create, update, archive, restore, delete, and snapshot.** If the
  activity write alone fails, the mutation stands and the store says the timeline is incomplete —
  rollback would be worse than a missing log line.
- **`preferencesStore`** merges the original theme slice with density, indentation, autosave, and
  reduced motion; `src/store/preferences.ts` re-exports it so the theme provider did not move.
  `applySettings` adopts a persisted record, `toSettings` writes preferences back without losing
  `onboardedAt` or `seedVersion`.
- **`uiStore`** holds panels, the command palette, and selection — never persisted, reset on reload.
- **Playground inputs** (TASK-021) are the one deliberate `sessionStorage` record: per prompt, capped,
  and gone when the tab closes, because a variable's value is often a customer's text (ADR-105). They
  are never merged into a prompt or a revision.
- **Editor recovery drafts** (TASK-015) are the one deliberate `localStorage` record outside
  preferences: a namespaced, size-capped copy of the text in this tab, written after a short pause and
  removed only once storage confirmed a write. They are a recovery aid, not a save — the prompt itself
  is written through `editPrompt` with a version guard.
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
