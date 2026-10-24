# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-001 complete — foundation only.**
> The repository currently contains the application toolchain and a temporary smoke screen.
> No PromptForge product features are implemented yet. Each subsequent feature is built in a
> separate, explicitly authorized task tracked in [`tasks.md`](./tasks.md).

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

| Command                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `npm run typecheck`    | TypeScript project check (`tsc --noEmit`, strict mode) |
| `npm run lint`         | ESLint flat config (TypeScript + React hooks)          |
| `npm run format:check` | Prettier verification                                  |
| `npm run format`       | Prettier write                                         |
| `npm test`             | Vitest in watch mode                                   |
| `npm run test:run`     | Vitest single run (CI style)                           |
| `npm run build`        | Type-check, then production build into `dist/`         |
| `npm run preview`      | Serve the production build at http://localhost:4173    |

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

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for layer rules and architectural decisions.

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
