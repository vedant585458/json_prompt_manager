# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-008 complete — application shell, routing, and responsive navigation.**
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
  components/     ui primitives, layout, and domain components
  features/       feature modules (save pipeline, revisions, diff, lab, ...)
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
| `/`                  | Dashboard             | Scaffold → TASK-010                        |
| `/library`           | Library               | Scaffold → TASK-011                        |
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
- **No phantom controls.** The command palette does not exist until TASK-009, so the top bar shows a
  visibly disabled search control with a written explanation and no ⌘K hint. Scaffolded routes list
  what will be built and offer no controls that would appear to work.
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

## Persistence

`src/data/` is a self-contained layer behind repository interfaces: eleven repositories, a
`promptforge` IndexedDB database at schema version 2 with eleven object stores and versioned
migrations, an in-memory adapter that passes the same 25-case contract suite, typed storage errors
mapped at the repository boundary, and a per-prompt write queue.

- **Nothing outside `src/data` imports an adapter or the database module** — only the public surface
  `src/data/index.ts`. ESLint enforces that, and it also forbids React/UI imports inside the layer.
- **Versions only move forward, by one.** `prompts.update` requires an `expectedVersion` that equals
  the stored version; a stale base is rejected with `StaleWriteError` and mutates nothing.
- **Migrations are atomic and replayable.** They run inside the `versionchange` transaction, record
  themselves in `meta`, and abort the whole upgrade on failure.
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
- **`selectors.ts`** filters/sorts the library, memoizes with a single-entry cache keyed on array
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
