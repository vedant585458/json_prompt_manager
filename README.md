# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-002 complete — foundation and design system.**
> The repository contains the application toolchain, the Prompt Observatory token system with
> dark and light themes, and a temporary token-proof page. No PromptForge product features are
> implemented yet. Each subsequent feature is built in a separate, explicitly authorized task
> tracked in [`tasks.md`](./tasks.md).

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
