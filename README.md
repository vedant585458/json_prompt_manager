# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-004 complete — overlays and feedback.**
> The repository contains the toolchain, the Prompt Observatory token system with dark and light
> themes, the primitive layer (buttons, form controls, tabs, tooltips, status, progress), and the
> overlay/feedback layer (dialogs, confirmations, sheets, dropdown and context menus, toasts,
> alerts, empty/error states, skeletons), all demonstrated in a design gallery. No PromptForge
> product features are implemented yet. Each subsequent feature is built in a separate, explicitly
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
| `npm run build`          | Type-check, then production build into `dist/`         |
| `npm run preview`        | Serve the production build at http://localhost:4173    |

All of the above must pass before a task can be marked complete in `tasks.md`.

## Technology stack

| Area        | Choice                                                             |
| ----------- | ------------------------------------------------------------------ |
| UI          | React 19, TypeScript (strict), Vite                                |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`                            |
| State       | Zustand (introduced with the data layer)                           |
| Routing     | react-router-dom                                                   |
| Persistence | IndexedDB through repository interfaces (`idb`) — planned TASK-006 |
| Editor      | CodeMirror 6 — planned TASK-014                                    |
| Validation  | Ajv (JSON Schema) — planned TASK-016                               |
| Testing     | Vitest, Testing Library, `jest-dom`, `fake-indexeddb`, jsdom       |
| Quality     | ESLint (flat config), Prettier                                     |

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
  data/           repository interfaces, IndexedDB adapters, migrations
  store/          Zustand stores
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

## Data and privacy

PromptForge is designed to be **local-first and single-user**. Once persistence lands
(TASK-006), all prompts, revisions, and settings will be stored in the browser's IndexedDB on
this device. The application will not send prompt content to any server, make no external
runtime requests, and integrate no AI model provider in its planned v1 scope.

**At this stage the application stores nothing at all.**

## Roadmap

The complete, approval-gated plan — 31 tasks with acceptance criteria and validation steps —
lives in [`tasks.md`](./tasks.md). Planning is complete; implementation proceeds one authorized
task at a time.
