# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-013 complete — favorites, pins, archive, tags, and bulk actions.**
> The repository contains the toolchain, the Prompt Observatory token system with dark and light
> themes, the primitive layer, the overlay/feedback layer demonstrated in a design gallery, the typed
> domain model, the persistence layer (repository interfaces, IndexedDB with migrations, an in-memory
> parity adapter, typed storage errors), the application data lifecycle (storage selection with a
> labelled ephemeral fallback, versioned first-run seeding, data/preferences/UI stores, pure selectors,
> a hydrating bootstrap, and an error boundary), the application shell (route table, collapsible rail,
> drawer navigation, breadcrumbs, skip link, route focus/title/scroll behaviour, recovery screens, and a
> working settings screen for theme, density, and autosave), the command system (declarative registry
> that rejects duplicate shortcuts, platform-aware single and two-step bindings, a fuzzy-searchable
> palette at `⌘K` / `Ctrl K`, and a generated shortcut reference), the dashboard, and the **library**:
> URL-synced search across titles, descriptions, tags, and JSON, tag/folder/collection/status/validation
> /date filters, three sorts, pinned section, grid and list views, and per-card selection — plus the
> full prompt lifecycle (create from a template or blank, edit metadata, duplicate, archive with undo,
> delete with a confirmed cascade), folder/collection management with cycle guards, and multi-select
> bulk actions with an honest undo. Every declared route is reachable; screens not yet built say so
> instead of showing mock controls. Each subsequent feature is built in a separate, explicitly
> authorized task tracked in [`tasks.md`](./tasks.md).

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
| `npm run test:coverage`  | Domain coverage report + 90% thresholds                |
| `npm run build`          | Type-check, then production build into `dist/`         |
| `npm run preview`        | Serve the production build at http://localhost:4173    |

All of the above must pass before a task can be marked complete in `tasks.md`.

## Technology stack

| Area        | Choice                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| UI          | React 19, TypeScript (strict), Vite                                         |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`                                     |
| State       | Zustand (introduced with the data layer)                                    |
| Routing     | react-router-dom 7 (`createBrowserRouter`, memory router in tests)          |
| Commands    | Custom registry + palette (`src/lib/commands`), Radix dialog, no extra deps |
| Persistence | IndexedDB through repository interfaces (`idb`), in-memory parity adapter   |
| Editor      | CodeMirror 6 — planned TASK-014                                             |
| Validation  | Ajv (JSON Schema) — planned TASK-016                                        |
| Testing     | Vitest, Testing Library, `jest-dom`, `fake-indexeddb`, jsdom                |
| Quality     | ESLint (flat config), Prettier                                              |

Dependencies for later tasks are already pinned in `package.json` where they define the
architecture; features are still implemented only when their task is authorized.

## Project structure

```
src/
  app/            application root, providers, router (grows in later tasks)
  routes/         route-level screens (shell scaffolds + settings + design gallery)
  components/layout/  shell, rail, drawer, breadcrumbs, top bar, route chrome, shortcut help
  components/command-palette/  palette dialog and the command layer mounted by the shell
  components/dashboard/  dashboard sections, stat strip, rails, and the first-run guide
  components/library/  filter bar, ingredient rail, prompt cards and rows, badges
  components/prompts/  prompt create/edit dialog, action menu, delete confirmation
  lib/commands/   registry, shortcut parsing/matching, core commands, React bindings
  components/     ui primitives, layout, and domain components
  features/       feature modules (organization, save pipeline, revisions, diff, lab, ...)
  domain/         pure TypeScript domain logic and types (no React, no storage)
  data/           repository interfaces, IndexedDB + in-memory adapters, migrations,
                  typed storage errors, write queue, cross-tab announcements
  store/          Zustand stores (data, preferences, interface) and pure selectors
  hooks/          reusable hooks
  lib/            small framework-agnostic utilities
  styles/         tokens and global styles
  test/           test setup and shared fixtures
docs/             architecture, data model, persistence, testing, limits
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for layer rules, the design-system contract,
and architectural decisions, and [`docs/DECISIONS.md`](./docs/DECISIONS.md) for the decision log and
the generated contrast table.

## Dashboard

`/` is the command centre, and every number on it is read from stored records through one pure
selector (`src/store/dashboard.ts`) — nothing is hard-coded and nothing is estimated.

- **Editorial header.** Greeting and long date, one summary sentence generated from the same counts as
  the stat strip, and three ways in: New prompt (`/composer`), From template (`/templates`), Search
  (opens the command palette).
- **Stat strip.** Prompts, favorites, archived, collections, snapshots, and documents that will not
  parse. Each tile links to the view it counts (filtered library or `/validation`), and the parse tile
  changes its wording as well as its colour when the count is above zero.
- **Sections.** Recently edited (5), pinned rail (6 cards), favorites (5), quick-start templates (3),
  needs attention (broken documents first, then prompts idle for 30+ days, capped at 5), and the last
  eight activity events — each with an empty state that says what belongs there.
- **First run.** A three-step guide shown only while `settings.onboardedAt` is null. Dismissing writes
  the timestamp through the settings repository; the guide disappears only after that write succeeds,
  and a failure is reported instead of pretended away.
- **Honesty rules.** "Invalid" means `parseDocument()` refused the stored document, and the copy says
  "will not parse" — valid JSON is never presented as prompt quality. Archived prompts stay out of
  recents, pinned, favorites, attention, and the unreadable count.

## Library

`/library` is the working index of the studio. Everything it shows comes from stored prompts, and the
address bar is the only filter state — reload, back/forward, and in-app links all reproduce the view.

- **Search.** Case-insensitive across title, description, tags, and the stored JSON document. Terms are
  ANDed (`json schema` needs both), fields are ORed, and matches are highlighted in the title,
  description, and the JSON excerpt that explains why a prompt matched. Typing is debounced (250 ms)
  and replaces the current history entry; pressing `/` from anywhere in the library focuses the field.
- **Filters.** Tag multi-select (tags combine with AND), folder subtree, collection, status, document
  health ("parses" / "will not parse"), archived toggle, favorites, prompts with snapshots, and an
  edited-within window. Active filters appear as removable chips with a single "Clear all".
- **Sort and views.** Updated, created, or title; grid of artifact cards or a dense list with the same
  facts. The choice is remembered (`promptforge.library.view`) and a `?view=` link can override it.
- **Pinned.** Pinned prompts render in their own section above the results and are never duplicated in
  the main list; counts count each prompt once.
- **Selection.** Every card and row has a checkbox; Shift-click extends a range, `Select all shown`
  selects exactly the current filter, and the sticky bulk bar reports the count and the scope. See
  [Favorites, pins, archive, and bulk actions](#favorites-pins-archive-and-bulk-actions).
- **Actions.** Each card and row has a `⋯` menu (edit details, duplicate, archive/restore, delete) and
  the header has "New prompt"; both open dialogs rather than navigating to empty screens.
- **Honesty rules.** "Will not parse" is `parseDocument()` refusing the stored document — never a claim
  about prompt quality. Archived prompts stay hidden unless the toggle is on, and the archive toggle
  changes the rail's counts with it. An empty library and an empty _result set_ are different states
  with different explanations and different ways forward.
- **URL contract.** `?q=&folder=&tag=&collection=&status=&validation=&archived=&favorites=&snapshots=&incollection=&edited=&sort=&view=`,
  plus the dashboard's `?filter=` shorthand as a base layer that explicit parameters override.

## Creating and organizing

The library owns the prompt lifecycle. Nothing is optimistic: a dialog closes, a toast appears, and a
card changes only after the store confirms the write.

- **Create.** Title, description, folder, collections, tags, status, and a template/blank choice. The
  document is created from the template (or the schema defaults) and the editor opens on the stored
  prompt, never on a draft.
- **Edit details.** The same fields, minus the template choice. The JSON document is deliberately out
  of reach here — it belongs to the editor (TASK-014).
- **Duplicate.** Copies the document and metadata with fresh IDs and a `(copy)`, `(copy 2)`, … title, so
  editing one never touches the other. The activity log records it.
- **Archive.** Archived prompts leave the working views, the archive scope (`?archived=1` or the rail
  toggle) shows only them with its own empty state, and both the single and bulk toasts offer **Undo**.
- **Delete.** Confirmation names the prompt and lists the snapshots and test cases that disappear with
  it. Deletion is one IndexedDB transaction over prompts, revisions, and test cases — a failure leaves
  every row in place and the dialog open with an error.
- **Folders.** Create, rename, re-parent, and delete. Depth is capped at five levels, duplicate sibling
  names are refused, and the parent picker cannot express a cycle; the domain rule still runs on submit
  and renders its message under the field. Deleting a folder moves its prompts and subfolders to the
  removed folder's parent and says where they went.
- **Collections.** Create, rename, describe, and delete. A collection is membership, not a container:
  deleting one clears the membership and never deletes a prompt.
- **Palette and links.** `prompt.new` and `folder.new` open the same dialogs as `/library?new=prompt`
  and `/library?new=folder`, so a command, a link, and a click share one path.

## Favorites, pins, archive, and bulk actions

Library rows and cards carry a selection checkbox next to their link, and an actions menu with edit,
duplicate, favorite, pin, archive/restore, and delete. Favorites and pins are write-through: the toggle
persists, rolls back visually if storage refuses, and shows up on the dashboard. Pinned prompts collect
in their own section, sorted A→Z.

- **Archive** is a scope, not a delete: `?archived=1` (or the rail toggle) shows only archived prompts,
  with its own empty state and a `Back to the library` link. Archived prompts are excluded from the
  dashboard's recents, favorites, and health counts, and can be restored individually or in bulk.
- **Tags** come from a census of the library. The tag manager renames or removes a tag across every
  prompt in one transaction and states the affected count first; the bulk tag dialog adds or removes
  tags on a selection.
- **Selection** is route state: `Select all shown` selects exactly the current filter, the sticky bar
  states the scope (`All 3 prompts shown`, `2 prompts selected`), and any filter, sort, or scope change
  clears it — a hidden row can never be modified by a later action. Shift-click extends a range.
- **Undo** restores a snapshot of the affected rows (favorite/pinned/archived/tags) without discarding
  later edits; a bulk delete's Undo re-creates the prompts with their revisions and test cases. A failed
  undo says so instead of claiming success.

Every bulk write is one repository transaction (`prompts.updateMany`, `prompts.deleteManyCascade`), so a
selection is never half-changed.

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
- **Proof, not promises.** `npm run check:contrast` verifies 26 text/UI pairings in both themes and
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
reference for later tasks. It becomes the `/design` route in TASK-008 and
is the temporary application root until then.

## Domain model

`src/domain/` is pure TypeScript with no React, storage, or browser APIs — enforced by
`src/domain/purity.test.ts`. It contains the entity types, the canonical `PromptDocument`
specification, validation that returns structured issues instead of throwing, deterministic entity
factories (injected clock and ID generator), serialization with round-trip preservation of unknown
fields, and the folder/revision/tag invariants. See [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md).

```ts
import { createPrompt, formatDocument, parseDocument } from '@/domain';

const result = parseDocument(pastedText);
if (!result.ok)
  showIssues(result.issues); // path + message + severity
else editor.load(formatDocument(result.value));
```

## Persistence

`src/data/` holds the storage layer behind repository interfaces: eleven repositories over a
`promptforge` IndexedDB database (schema v2, eleven object stores, versioned migrations) plus an
in-memory adapter that passes the same contract suite. Every failure is typed — `StaleWriteError`,
`QuotaExceededError`, `StorageUnavailableError`, `CorruptDataError`, and friends — and prompt writes
are guarded by an `expectedVersion` check, so a stale edit is rejected instead of overwriting newer
content.

```ts
import { createWriteQueue, type Repositories } from '@/data';

const queue = createWriteQueue();
await queue.run(prompt.id, () => repositories.prompts.update(next, { expectedVersion }));
```

Code outside `src/data` imports only `@/data`; ESLint blocks deep adapter imports and any React/UI
import inside the layer. Schema, migrations, and failure semantics are documented in
[`docs/PERSISTENCE.md`](./docs/PERSISTENCE.md).

## First run and storage

On first load the app probes storage with a real write/read/delete, opens (or creates) the
`promptforge` database, seeds a starter library exactly once, and hydrates the stores before any
screen renders. If storage is unavailable the app still starts on an in-memory adapter and says so in
a banner: **changes are kept in memory only and disappear when you reload**.

The seed is versioned (`meta.seedVersion`), resumable, and never overwrites edits: a welcome prompt, a
folder, a collection, two starter templates, and default settings — no activity events, because the
timeline belongs to the user. Details: [`docs/PERSISTENCE.md`](./docs/PERSISTENCE.md) §8–9.

## Data and privacy

PromptForge is designed to be **local-first and single-user**. Prompts, revisions, and settings are
stored in the browser's IndexedDB on this device (or in memory in ephemeral mode). The application
does not send prompt content to any server, makes no external runtime requests, and integrates no AI
model provider in its planned v1 scope.

## Roadmap

The complete, approval-gated plan — 31 tasks with acceptance criteria and validation steps —
lives in [`tasks.md`](./tasks.md). Planning is complete; implementation proceeds one authorized
task at a time.
