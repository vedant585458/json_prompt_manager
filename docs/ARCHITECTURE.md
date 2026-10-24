# PromptForge Architecture

**Status:** Skeleton established by TASK-001. Expanded by TASK-002 (design system), TASK-005
(domain model), TASK-006 (persistence), TASK-031 (final documentation).

The authoritative plan, task order, and acceptance criteria live in [`../tasks.md`](../tasks.md).

---

## 1. System shape

PromptForge is a **client-only single-page application**. There is no server component in the
planned v1: the browser hosts the UI, the domain logic, and the persistence layer. User data is
device-local.

```
┌────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│                                                             │
│  routes/  ──▶ components/ ──▶ store/ ──▶ data/repositories  │
│      │            │             │              │            │
│      └────────────┴──▶ domain/ ◀┘              ▼            │
│                  (pure TS)                IndexedDB         │
└────────────────────────────────────────────────────────────┘
```

## 2. Stack decisions

| Concern     | Decision                                       | Rationale                                              |
| ----------- | ---------------------------------------------- | ------------------------------------------------------ |
| Build       | Vite                                           | Fast dev server and build; minimal configuration       |
| UI runtime  | React 19 + TypeScript strict                   | Component reuse, strong typing, large ecosystem        |
| Styling     | Tailwind CSS v4 + CSS custom-property tokens   | One token source for both themes; consistent scale     |
| Routing     | react-router-dom                               | Nested layout routes; standard navigation model        |
| State       | Zustand                                        | Selector subscriptions keep editor typing cheap        |
| Persistence | IndexedDB (`idb`) behind repository interfaces | Realistic data volume, transactional writes, swappable |
| Editor      | CodeMirror 6                                   | Mature, lightweight JSON editing with folding/search   |
| Validation  | Ajv 8 (+ formats)                              | Established JSON Schema implementation                 |
| Tests       | Vitest + Testing Library + fake-indexeddb      | Same toolchain as Vite; fast domain tests              |
| Quality     | ESLint flat config + Prettier                  | Standardized lint and formatting gates                 |

Deliberate exclusions: a server framework, Redux, a heavyweight visual component kit, Monaco,
and external runtime services. Each would add cost without serving the v1 requirements.

## 3. Layer rules

The dependency direction is strictly:

```
routes ─▶ features ─▶ components ─▶ store ─▶ data ─▶ domain
                                                   ▲
                              (domain depends on nothing)
```

- `domain/` contains pure TypeScript: types, document parsing/serialization, template rendering,
  structural diff, graph derivation, health metrics, project rules, and validation adapters'
  normalization. It imports **no** React, no browser APIs, and no data-layer modules.
- `data/` contains repository **interfaces** and their IndexedDB implementations, migrations, and
  seed data. It may import domain types. It must not import React or `store/`.
- `store/` contains Zustand stores and selectors that orchestrate repository calls. Components
  never touch IndexedDB directly.
- `components/ui/` contains design-system primitives with no domain knowledge.
- `routes/` composes features and components for each screen.
- `lib/` holds small framework-agnostic utilities (`cn`, ids, dates, debounce).

These boundaries are what make the validation, rendering, diffing, and rule logic independently
testable — a requirement in `tasks.md` §5 and §10.

## 4. Planned module map

| Path                     | Responsibility                                                                           | Introduced by        |
| ------------------------ | ---------------------------------------------------------------------------------------- | -------------------- |
| `src/app/`               | Root component, providers, router, bootstrap, error boundary                             | TASK-001 / 007 / 008 |
| `src/routes/`            | Dashboard, library, editor, composer, templates, validation, diff, lab, health, settings | TASK-008 onward      |
| `src/components/ui/`     | Buttons, fields, overlays, toasts, empty/error states                                    | TASK-003 / 004       |
| `src/components/layout/` | Shell, sidebar, top bar, mobile navigation                                               | TASK-008             |
| `src/components/editor/` | CodeMirror host, tree view, error panel, status bar                                      | TASK-014             |
| `src/domain/`            | Entities, prompt document spec, render, diff, graph, quality, health                     | TASK-005 onward      |
| `src/data/`              | Repositories, IndexedDB schema, migrations, seed                                         | TASK-006 / 007       |
| `src/store/`             | Data, preferences, and UI stores                                                         | TASK-007             |
| `src/test/`              | Test setup, fixtures, render helpers                                                     | TASK-001 onward      |
| `src/styles/`            | Tokens, theme, global styles                                                             | TASK-001 / 002       |
| `docs/`                  | Architecture, data model, persistence, testing, limitations                              | TASK-001 onward      |

## 5. Data model (summary)

The full entity definitions land in TASK-005 and `docs/DATA-MODEL.md`. The planned core:

- **Prompt** — metadata plus a canonical `PromptDocument` (`schemaVersion`, `name`, `role`,
  `objective`, `instructions`, `context`, `constraints`, `variables`, `output`, `examples`,
  `metadata`, `includes`).
- **PromptRevision** — immutable snapshot with a per-prompt monotonic revision number.
- **Folder** (tree), **Collection** (many-to-many), **Tag** (normalized strings on prompts).
- **PromptTemplate** — built-in or user-created blueprint.
- **TestCase** — named variable inputs for a prompt.
- **PromptSchema** — reusable JSON Schema for validation.
- **Snippet** — reusable field fragment referenced by documents.
- **ActivityEvent** — capped mutation log feeding the activity timeline.
- **Settings** — theme, editor, autosave, density, onboarding state.

## 6. Persistence and save semantics (planned)

- IndexedDB database `promptforge`, versioned with ordered idempotent migrations.
- One repository interface per aggregate; an in-memory adapter mirrors the same contract for tests.
- Save states: `idle → dirty → saving → saved` plus `error`. A save is reported only after the
  transaction resolves.
- Optimistic concurrency: every write carries a `version`; stale writes raise `StaleWriteError`
  instead of silently overwriting.
- One serialized write queue per prompt; debounced autosave; recovery drafts mirrored to
  `localStorage` and cleared only after successful persistence.
- Revisions are created on explicit snapshot/save-with-description and before any restore.

Details are finalized in TASK-006/TASK-015 and documented in `docs/PERSISTENCE.md`.

## 7. Quality gates

Every task must leave the repository green:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:run
npm run build
```

Task-specific validation (integration tests, keyboard passes, viewport checks, axe audits) is
described in each task in `tasks.md`. Results are reported only when actually executed.

## 8. Architectural decisions log

The full ADR list is in `tasks.md` §5.3 and will be maintained in `docs/DECISIONS.md` from
TASK-005 onward. Decisions currently embodied in the codebase:

- **ADR-01 — Client-only, local-first v1.** No backend, accounts, or network calls at runtime.
- **ADR-02 — Repository boundary.** UI never imports an IndexedDB adapter; storage is swappable.
- **ADR-03 — Toolchain baseline.** Vite + React 19 + strict TypeScript; Tailwind v4 tokens from
  TASK-002; Vitest/Testing Library from the start so domain logic is testable before UI exists.
- **ADR-07 — Revisions are explicit.** Autosave never spams history; restore always creates a
  safety snapshot.

## 9. Extension points for future work

- A server-backed repository implementation can replace IndexedDB adapters without touching UI.
- AI provider execution is intentionally absent; a future provider integration must live behind a
  server-side boundary so credentials are never shipped to the client.
- Collaboration features require a backend and access-control model before any UI is added.

## 10. Known limitations at this stage

TASK-001 delivers tooling only. There is no routing, no design system, no data model, no
persistence, and no product feature. The `src/` skeleton contains empty structure markers
(`.gitkeep`) for modules that later tasks fill in.
