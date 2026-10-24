# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-007 complete — seed data, stores, and first-run foundation.**
> The repository contains the toolchain, the Prompt Observatory token system with dark and light
> themes, the primitive layer, the overlay/feedback layer demonstrated in a design gallery, the typed
> domain model, the persistence layer (repository interfaces, IndexedDB with migrations, an in-memory
> parity adapter, typed storage errors), and the application data lifecycle: storage selection with a
> labelled ephemeral fallback, versioned first-run seeding, data/preferences/UI stores, pure
> selectors, a hydrating bootstrap, and an error boundary. The design gallery is still the only
> screen; each subsequent feature is built in a separate, explicitly authorized task tracked in
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
| `npm run test:coverage`  | Domain coverage report + 90% thresholds                |
| `npm run build`          | Type-check, then production build into `dist/`         |
| `npm run preview`        | Serve the production build at http://localhost:4173    |

All of the above must pass before a task can be marked complete in `tasks.md`.

## Technology stack

| Area        | Choice                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| UI          | React 19, TypeScript (strict), Vite                                       |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`                                   |
| State       | Zustand (introduced with the data layer)                                  |
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
  app/            application root, providers, router (grows in later tasks)
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
