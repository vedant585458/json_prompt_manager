# PromptForge — Implementation Plan & Task Tracker

**Document version:** 1.0 (Phase 1 — Planning)
**Created:** 2026-10-24
**Repository:** `vedant585458/json_prompt_manager`
**Branch:** `arena/3b0d1d76-json-prompt-manager`
**Current phase:** Phase 2 — Implementation, one authorized task per cycle. Planning is complete; TASK-026 is the latest completed task.
**Authoritative status source:** This file. One status per task, maintained here only.

---

## Table of Contents

1. [Repository Inspection Summary](#1-repository-inspection-summary)
2. [Project Overview](#2-project-overview)
3. [Target Users and Core Workflows](#3-target-users-and-core-workflows)
4. [Product Requirements](#4-product-requirements)
5. [Technical Architecture](#5-technical-architecture)
6. [Data Model and Persistence Strategy](#6-data-model-and-persistence-strategy)
7. [UI and Design System Plan](#7-ui-and-design-system-plan)
8. [Security and Privacy Requirements](#8-security-and-privacy-requirements)
9. [Accessibility and Responsive Requirements](#9-accessibility-and-responsive-requirements)
10. [Testing Strategy](#10-testing-strategy)
11. [Feature-to-Task Roadmap](#11-feature-to-task-roadmap)
12. [Task Dependency Graph](#12-task-dependency-graph)
13. [Task Index and Status](#13-task-index-and-status)
14. [Task Specifications](#14-task-specifications)
15. [Milestones](#15-milestones)
16. [Risks and Mitigations](#16-risks-and-mitigations)
17. [Open Decisions and Planned Deviations](#17-open-decisions-and-planned-deviations)
18. [Completion, Approval, and Workflow Rules](#18-completion-approval-and-workflow-rules)

---

## 1. Repository Inspection Summary

Inspected on 2026-10-24 before planning.

| Item | Finding |
| --- | --- |
| Tracked files | `README.md` only (21 bytes, contains only the repo name) |
| Commits | One initial commit (`9013ad4 Initial commit`) |
| Application code | None |
| Package manifest | None (`package.json` absent) |
| Lockfile | None |
| Build tooling | None |
| CI configuration | None |
| Tests | None |
| Documentation | None beyond the stub README |
| Runtime available | Node.js v22.22.3, npm 10.9.8 |
| Network | npm registry reachable; package installation is viable |

**Conclusion:** This is a greenfield project. No existing infrastructure, conventions, or dependencies need preservation. The stack below is chosen from scratch against the product requirements, optimizing for a single-user, local-first, offline-capable application with strong typing and testable domain logic.

**Constraints derived from inspection:**
- Every foundational file (manifest, configs, scripts) must be created by TASK-001.
- No CI pipeline exists; verification in each task is performed with local scripts (`typecheck`, `lint`, `test`, `build`).
- Because the repository is empty, Phase 1 creates **only** `tasks.md`. No scaffolding is included in the planning commit.

---

## 2. Project Overview

**Product:** PromptForge — an advanced JSON prompt management studio.
**Category:** AI productivity, prompt engineering, developer tooling.
**Form factor:** Local-first single-page web application (desktop-first, fully responsive).
**Visual concept:** *The Prompt Observatory* — prompts are inspectable artifacts inside a structured workspace; the clarity of an IDE, the discoverability of a creative library, and the precision of a data tool.

### 2.1 Mission

Give anyone who maintains structured prompts a single reliable workspace to create, organize, validate, version, compare, and optimize JSON prompt documents — with zero data leaving the browser and no fake intelligence presented as real.

### 2.2 Product Principles

1. **Honest tooling.** Every control does what it says. No mock providers, no decorative charts, no simulated collaboration, no "valid JSON" claims about semantic prompt quality.
2. **Local-first, durable work.** IndexedDB persistence with explicit save status, autosave, recovery, and race protection. A save is only reported after it succeeds.
3. **Developer-grade ergonomics.** Keyboard-first operation, command palette, syntax-aware editing, raw/tree duality, precise error locations.
4. **Composed, not cluttered.** Dense but calm editorial layout; panels collapse; accents are reserved for state and action.
5. **Verifiable increments.** Each task is independently testable; nothing is marked complete without executed validation.

### 2.3 Scope of v1

**In scope:** prompt library with folders/collections/tags/favorites/pins/archive, JSON editor with syntax + JSON Schema validation, guided composer, templates, version history, structural diff, variable playground, local prompt laboratory with saved test cases, blueprint dependency graph, quality inspector, health dashboard with activity timeline, import/export, command palette, dark/light themes, responsive + accessible UI, automated tests, documentation.

**Explicitly out of scope for v1** (documented in-product where relevant, never faked):

- Any real AI model provider integration (execution is local template rendering only).
- Backend, accounts, multi-device sync, sharing links, collaboration, comments, RBAC.
- Real-time multi-tab collaborative editing (multi-tab conflict *detection* is handled defensively; see §6.6).
- Prompt "quality scoring" presented as objective intelligence; the inspector is transparent, rule-based, and heuristic-labeled.
- Mobile native apps, i18n/localization, plugin marketplace, billing.

---

## 3. Target Users and Core Workflows

### 3.1 Primary Users

| Persona | Need | Success signal |
| --- | --- | --- |
| **Prompt engineer** (primary) | Rapid iteration on structured prompts with versions, diffs, and variable testing | Can go from template to validated, versioned prompt without leaving the app |
| **AI application developer** | Schema-constrained prompts, reusable components, export into code | Exported JSON preserves structure and metadata; schemas validate reliably |
| **Technical product/ops writer** | Organize a library of prompts, find them fast, avoid breaking them | Search/filter/tags work; destructive actions are guarded |
| **Researcher / evaluator** | Reproducible test cases and variant comparison | Named test cases persist and re-render identically |

### 3.2 Core Workflows

1. **First run → first prompt.** Land on dashboard → choose starter template or blank → compose → save → see it in library.
2. **Edit and validate.** Open prompt → raw/tree editor → fix syntax error with line/column guidance → optionally validate against a JSON Schema → save.
3. **Version and compare.** Save a named snapshot → edit → view revision history → diff revisions → restore earlier revision (with automatic safety snapshot).
4. **Variable testing.** Define variables → preview rendered prompt with typed inputs → catch missing required values → save the configuration as a test case → compare two variants side by side.
5. **Organize.** Create folders/collections, tag and favorite prompts, pin active work, archive stale items, bulk-archive or bulk-tag.
6. **Audit the library.** Health dashboard surfaces invalid documents, unresolved variables, stale prompts, and real activity, each linking to the underlying record.
7. **Portability.** Import a JSON prompt file (with validation and conflict handling) or export one prompt / a selection / a full backup bundle.

---

## 4. Product Requirements

Requirement IDs are stable and referenced by tasks. **FR** = functional, **NFR** = non-functional.

### 4.1 Functional Requirements

| ID | Requirement | Owning task(s) |
| --- | --- | --- |
| FR-01 | Create, rename, duplicate, favorite, pin, archive, and delete prompts with confirmation and undo for destructive bulk operations | TASK-012, TASK-013 |
| FR-02 | Organize prompts into folders (tree, one parent) and collections (many-to-many), with rename/delete safeguards | TASK-012 |
| FR-03 | Tags and custom metadata on prompts; filter and sort by tag, category/status, and dates | TASK-012, TASK-011 |
| FR-04 | Full-text search across title, description, tags, and JSON content; filter by validation state | TASK-011 |
| FR-05 | Grid and list views, responsive across breakpoints; pinned section | TASK-011 |
| FR-06 | JSON editing with syntax highlighting, formatting, bracket folding, search, raw and tree views, copy, undo/redo, parse errors with line/column | TASK-014 |
| FR-07 | Unsaved-change protection and clear save-status indicator | TASK-015 |
| FR-08 | Debounced autosave with failure handling, recovery of interrupted drafts, stale-write protection | TASK-015 |
| FR-09 | JSON Schema validation (optional), reusable schema library, structured errors with JSON pointer paths, syntax vs. schema distinction, explicit semantic disclaimer | TASK-016 |
| FR-10 | Guided composer for roles, objectives, instructions, context, constraints, output format, examples; bidirectional sync with raw JSON | TASK-017 |
| FR-11 | Custom prompt schemas/field templates and reusable field snippets | TASK-016, TASK-017 |
| FR-12 | Starter template catalog with categories and previews; user templates created from prompts; built-in vs. user distinction; duplication without overwriting originals | TASK-018 |
| FR-13 | Named snapshots, revision history, revision descriptions, restoration with safety snapshot | TASK-019 |
| FR-14 | Structural JSON diff (objects/arrays) with added/removed/changed values, JSON paths, structural vs. textual distinction, copyable result | TASK-020 |
| FR-15 | Variable definitions with types, defaults, required flags; typed inputs; safe rendering; missing-variable detection; rendered preview | TASK-021 |
| FR-16 | Named, persisted test cases; local variant comparison with validation before run; provider-free labeling | TASK-022 |
| FR-17 | Blueprint graph of prompt components, variables, schema references, and snippets; unresolved reference highlighting; list-view fallback; hidden for trivially simple prompts | TASK-023 |
| FR-18 | Rule-based quality inspector with deterministic vs. heuristic labeling, explanations, suggestions, dismissals, no silent rewrites | TASK-024 |
| FR-19 | Health dashboard from real stored data: invalid documents, unresolved variables, stale prompts, collection counts, recent activity | TASK-025 |
| FR-20 | Import JSON files with size limits and validation; export prompt/selection/backup with documented metadata fidelity; conflict detection; malformed-input resilience | TASK-026 |
| FR-21 | Command palette with searchable commands, navigation, shortcuts display, duplicate-execution protection | TASK-009 |
| FR-22 | Dark-first theme with light theme and theme persistence; reduced-motion support | TASK-002 |
| FR-23 | First-run experience explaining capabilities, storage location, and starter template; skippable | TASK-007, TASK-010 |
| FR-24 | Activity timeline recording meaningful mutations | TASK-007 (recording), TASK-025 (surface) |
| FR-25 | Configurable editor preferences (indent size, autosave toggle, theme, reduced motion, view density) | TASK-002, TASK-015, TASK-027 |

### 4.2 Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Strict TypeScript throughout; no `any` in domain modules without documented justification |
| NFR-02 | Domain logic (parsing, rendering, diffing, validation, rules, graph derivation) is framework-independent and unit-testable |
| NFR-03 | Storage access only through repository interfaces; no direct IndexedDB calls in components |
| NFR-04 | No external network requests at runtime; fonts and assets are bundled; no telemetry |
| NFR-05 | Interactive performance: editor keystrokes do not re-render unrelated panels; library remains responsive at 1,000 prompts |
| NFR-06 | All destructive actions require explicit confirmation; bulk operations offer undo where feasible |
| NFR-07 | WCAG 2.2 AA target for contrast, focus, keyboard access, and error association |
| NFR-08 | Layout integrity from 360 px to 2560 px with no horizontal overflow |
| NFR-09 | Errors are recoverable, explained in plain language, and never swallow user content |
| NFR-10 | Every metric and status shown in the UI is traceable to stored records |

---

## 5. Technical Architecture

### 5.1 Selected Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Build tool | **Vite** (latest stable) | Fast dev server, small config, first-class TS/React support |
| UI runtime | **React 19 + TypeScript (strict)** | Mature ecosystem, component reuse, strong typing |
| Routing | **react-router-dom v7** (declarative routes) | Standard, supports nested layout routes and route-level guards |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) + CSS custom properties for tokens | Token-driven theming, consistent spacing scale, no runtime CSS-in-JS |
| Component library | **Custom primitives** on Radix UI behavior where a11y is non-trivial (Dialog, DropdownMenu, Tooltip, Tabs) | Avoids a heavy visual kit; keeps the visual identity bespoke while inheriting proven focus/keyboard behavior |
| Icons | **lucide-react** | Consistent, tree-shakeable, accessible stroke icons |
| Code editor | **CodeMirror 6** via `@uiw/react-codemirror` + `@codemirror/lang-json` | Mature, lightweight, fold/gutter/search support; avoids building an editor |
| Schema validation | **In-house JSON Schema interpreter** (subset; supersedes the planned Ajv) | Ajv compiles schemas with `new Function`, which the project forbids for user-supplied data; see ADR-83 |
| Persistence | **IndexedDB** via the tiny `idb` wrapper, behind repository interfaces | Handles realistic prompt/revision volumes; async; transactional |
| Client state | **Zustand** | Minimal API, selector-based subscriptions for editor performance |
| Testing | **Vitest** + **@testing-library/react** + **@testing-library/user-event** + **fake-indexeddb** | Fast unit/integration tests aligned with Vite |
| E2E (optional) | **Playwright** (chromium only) | Smoke coverage of primary workflows if time allows in TASK-029 |
| Lint/format | **ESLint** (flat config, `typescript-eslint`, react-hooks) + **Prettier** | Baseline quality gate |
| Fonts | Self-hosted `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`, `@fontsource/instrument-serif` | No runtime network dependency |
| Diff | Custom structural JSON diff module; `diff` package for optional unified text view | Semantic control where it matters, reliable text fallback |

**Deliberately not used:** Next.js (no server rendering or backend needed), Redux (unnecessary ceremony), a full component kit such as MUI/AntD (visual blandness and weight), Monaco (heavier than required for JSON), Graphviz/D3 (a small purpose-built SVG layout is sufficient and avoids a large dependency), any hosted storage or analytics.

### 5.2 Layered Architecture

```
src/
  app/            app bootstrap, router, providers, error boundary
  routes/         route-level screens (dashboard, library, editor, validation,
                  composer, templates, health, settings, design, not-found)
  components/
    ui/           design-system primitives (no domain knowledge)
    layout/       shell, sidebar, topbar, panels, responsive nav
    prompts/      prompt-specific composed components
    editor/       CodeMirror host, tree view, validation panel
    library/      cards, rows, filters, bulk bar
    ...
  features/       feature modules (composer, revisions, diff, playground,
                  laboratory, blueprint, quality, import-export)
  domain/         pure TypeScript: types, prompt-document spec, template
                  rendering, diff engine, graph derivation, quality rules,
                  validation adapters, search/filter/sort, serialization
  data/
    repositories/ repository interfaces + IndexedDB implementations
    db/           schema, migrations, seed data
    adapters/     in-memory repositories for tests
  store/          Zustand stores (library, editor/drafts, preferences, activity)
  hooks/          reusable hooks (shortcuts, autosave, media query, focus)
  lib/            small utilities (cn, dates, ids, debounce, clipboard)
  styles/         tokens.css, theme.css, global.css
docs/             ARCHITECTURE.md, DATA-MODEL.md, PERSISTENCE.md, TESTING.md,
                  LIMITATIONS.md, DECISIONS.md
```

**Dependency rule:** `routes → features/components → store/hooks → domain/data`. The `domain` layer imports nothing from React or the data layer. The `data` layer imports domain types only. This keeps validation, rendering, diff, and rule logic independently testable and allows a future server-backed repository to replace the IndexedDB adapter without touching UI code.

### 5.3 Key Architecture Decisions (ADR summary)

| ADR | Decision | Consequence |
| --- | --- | --- |
| ADR-01 | Client-only SPA with IndexedDB persistence | No auth/backend complexity; data is per-browser and must be exported for backup; documented prominently |
| ADR-02 | Repository interface boundary (`PromptRepository`, `RevisionRepository`, `FolderRepository`, `CollectionRepository`, `TemplateRepository`, `TestCaseRepository`, `SchemaRepository`, `SnippetRepository`, `ActivityRepository`, `SettingsRepository`) | Swappable storage; in-memory adapters for tests; future server sync possible |
| ADR-03 | Prompt documents are validated JSON objects but not assumed "semantically effective" | UI wording and inspector copy must never conflate syntax validity with quality |
| ADR-04 | Variables resolved by a strict, non-evaluating template renderer (`{{name}}` tokens only) | No `eval`, no expression language, no code execution from imported content |
| ADR-05 | Structural diff engine written in-house (JSON-path aware); `diff` only for text mode | Deterministic, testable, arrays keep order semantics |
| ADR-06 | Blueprint graph rendered by a purpose-built deterministic layered SVG layout | Small dependency footprint; explicit list fallback for accessibility and library failure |
| ADR-07 | Autosave updates the prompt record; revisions are created on explicit snapshot/save-with-description, and before any restore | Predictable history, no revision spam, no silent loss |
| ADR-08 | Built-in templates are versioned seed data with a seed-version marker, copied on use | Built-ins never mutate; user edits create user-owned copies |
| ADR-09 | Theme tokens are CSS custom properties consumed by Tailwind theme variables | Single source of truth for dark/light, easy contrast auditing |

Detailed documentation is written in TASK-031 (`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`), with preliminary notes in TASK-001/005/006.

### 5.4 Target npm Scripts (created in TASK-001)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server bound to `0.0.0.0` on port 5173 |
| `npm run build` | Type-check + production build |
| `npm run preview` | Serve production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run check:contrast` | WCAG contrast gate over design-token pairings (added in TASK-002) |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest single run (CI-style) |

### 5.5 Performance Budget

- Initial JS for the shell route target: < 350 kB gzipped excluding the editor chunk; CodeMirror and heavy feature modules lazy-loaded per route.
- JSON parse/format on documents up to 1 MB stays under 100 ms on a mid-range laptop; imports are capped (default 2 MB per file) with clear rejection messaging.
- Editor state is isolated: typing must not re-render the library or sidebar (selector-based store subscriptions, memoized panels).
- Lists render with windowing only if profiling at 1,000 prompts shows a problem; otherwise CSS containment and memoized rows.

---

## 6. Data Model and Persistence Strategy

### 6.1 Entities

All entities are plain serializable TypeScript interfaces with ISO-8601 string timestamps and opaque string IDs (`crypto.randomUUID()`). Full definitions live in `src/domain/types.ts` (TASK-005) and are documented in `docs/DATA-MODEL.md`.

**Prompt**
```
id, title, description, content: PromptDocument,
format: 'json',                 // reserved for future formats; v1 = 'json'
folderId: string | null,
collectionIds: string[],
tags: string[],
favorite: boolean,
pinned: boolean,
archived: boolean,
status: 'draft' | 'active' | 'deprecated',
createdAt, updatedAt,
schemaId: string | null,
variables: VariableDefinition[],
metadata: Record<string, string>,   // user-defined custom metadata
version: number                      // optimistic concurrency counter
```

**PromptDocument** — the canonical PromptForge JSON prompt structure stored in `content`:
```
schemaVersion: '1.0',
name, role, objective,
instructions: string[],
context: { description?, references?: string[], data? },
constraints: string[],
variables: VariableDefinition[],
output: { format: 'json' | 'text' | 'markdown', schemaRef?: string, example? },
examples: { input?, output? }[],
metadata: { author?, tags?: string[], notes? },
includes: string[]        // snippet IDs referenced by this document
```

**VariableDefinition:** `name, type: 'string' | 'number' | 'boolean' | 'json', required: boolean, defaultValue?: unknown, description?: string`.

**PromptRevision:** `id, promptId, revisionNumber, contentSnapshot: PromptDocument, titleSnapshot, descriptionSnapshot, tagsSnapshot, variablesSnapshot, label: string | null, kind: 'manual' | 'restore-safety' | 'import', createdAt`.

**Folder:** `id, name, parentId: string | null, createdAt, updatedAt`.
**Collection:** `id, name, description, createdAt, updatedAt`.
**PromptTemplate:** `id, name, description, category, content: PromptDocument, isBuiltIn, createdAt, updatedAt`.
**TestCase:** `id, promptId, name, inputValues: Record<string, unknown>, expectedStructure: string | null, createdAt, updatedAt`.
**Schema:** `id, name, description, schemaContent: object, createdAt, updatedAt`.
**Snippet:** `id, name, description, targetPath: string, value: unknown, createdAt, updatedAt` — reusable field fragments inserted by the composer and referenced by `includes` in documents (extension to the supplied model, justified by the reusable-field-snippet and blueprint-graph requirements).
**ActivityEvent:** `id, type: 'created' | 'updated' | 'deleted' | 'restored' | 'archived' | 'imported' | 'exported' | 'snapshot' | 'validation' | 'settings', promptId?: string, promptTitle?: string, summary: string, createdAt` — capped log (keep newest 500).
**Settings:** singleton record: `theme, reducedMotion, indentSize, autosaveEnabled, autosaveDelayMs, density, onboardedAt, seedVersion`.

### 6.2 Relationships and Uniqueness

- Folder parent/child tree, maximum depth 5; no cycles (validated on move); folder names unique within the same parent (case-insensitive trim compare).
- Prompts: `folderId` nullable (Unfiled); `collectionIds` many-to-many with cascade cleanup on collection delete (membership removed, prompts preserved).
- Deleting a folder moves contained prompts and child folders to its parent (or root), never deletes prompts.
- Prompt titles need not be unique; the library shows duplicates distinctly and import conflicts are detected by title + content hash (TASK-026).
- Revision numbers are monotonic per prompt; `(promptId, revisionNumber)` is unique.
- Deleting a prompt deletes its revisions, test cases, and activity references are detached (activity retained with prompt title snapshot).
- Templates are immutable when `isBuiltIn`; using a template creates a new prompt.

### 6.3 IndexedDB Layout

Database `promptforge`, versioned. Object stores: `prompts`, `revisions`, `folders`, `collections`, `templates`, `testCases`, `schemas`, `snippets`, `activity`, `settings`, `meta`.

Indexes: `prompts.updatedAt`, `prompts.folderId`, `prompts.archived`, `prompts.favorite`, `prompts.pinned`, `revisions.promptId` + `revisions.promptId_revisionNumber` (unique), `templates.isBuiltIn`, `testCases.promptId`, `activity.createdAt`.

### 6.4 Migrations and Data Integrity

- `meta` store holds `dbSchemaVersion` and `seedVersion`.
- `src/data/db/migrations.ts` applies ordered, idempotent migration steps inside a single transaction per version bump; failures abort and surface a recoverable error screen with export/backup guidance.
- Downgrade is not supported; an older app opening a newer DB must refuse writes and show an explicit message instead of corrupting data.
- Seed data is applied only when `seedVersion` is behind current, so upgrades can add new built-in templates without duplicating user data.
- Import validates every field against the entity schema and rejects the transaction as a whole if any record is invalid (no partial imports).

### 6.5 Save Semantics (authoritative rules)

1. Editing mutates an in-memory draft, never the stored record, until persisted.
2. Save states: `idle → dirty → saving → saved`, plus `error` with retry; the indicator shows the exact last-successful timestamp.
3. Autosave is debounced (default 900 ms after last edit, configurable, can be disabled) and writes `content`, `updatedAt`, and an incremented `version`.
4. Manual save with a description, or the "Save snapshot" action, additionally creates a revision.
5. Before restoring a revision, the current state is saved as a `restore-safety` revision; restoration is transactional.
6. Every write includes the draft's base `version`; if the stored version is newer, the write is rejected as stale and the user is shown a compare/merge choice (keep mine, reload, open diff) rather than silently overwriting.
7. Autosave and explicit saves share a single serialized write queue per prompt.
8. `beforeunload` and in-app navigation guards prompt when a dirty draft exists; local recovery drafts (in `localStorage`, keyed by prompt id) are written while dirty and cleared after successful persistence, enabling recovery after a crash.
9. A save is reported as successful only after the IndexedDB transaction resolves.

### 6.6 Multi-Tab Behavior

Tabs share one IndexedDB. v1 does not implement live collaborative editing between tabs. Instead: a `BroadcastChannel('promptforge')` announces writes; other tabs receiving a write for a prompt they have dirty show a non-destructive "changed in another tab" notice with reload/diff options. Version counters prevent last-write-wins corruption.

### 6.7 Storage Failure Handling

- IndexedDB unavailable or blocked (private mode, quota): the app boots in an explicit **ephemeral demo mode** with a persistent warning banner, in-memory repositories, and import/export still functional; nothing is claimed to be saved.
- Quota exceeded (`QuotaExceededError`): save status becomes `error` with actionable guidance (export and prune revisions/activity), and the draft stays in memory and recovery storage.
- Corrupt database: show recovery screen offering database reset (guarded by typed confirmation) and last-known-good export if readable.

---

## 7. UI and Design System Plan

### 7.1 Design Direction — "The Prompt Observatory"

An editorial developer workstation: deep neutral layered surfaces, a single confident accent, a strong display hierarchy, and monospace precision for anything structural. Instrument-panel density without noise. Signature elements: command-center dashboard, artifact-style prompt cards, split editor with contextual inspector, blueprint graph, compact activity rail, command palette, and inspection drawer.

### 7.2 Visual Tokens (design intent; finalized in TASK-002)

**Color — dark (default)**
- Surfaces: `#08090B` (canvas), `#0E1013` (surface 1), `#14171B` (surface 2), `#1B1F24` (surface 3 / hover)
- Borders: `#22262C` (subtle), `#2E343C` (strong)
- Text: `#E9ECEF` primary, `#A3ABB6` secondary, `#6E7681` muted
- Accent: **Chartreuse** `#C9F25C` for primary actions/highlight (dark text on accent); focus ring derived from accent with 2 px offset
- Semantic: success `#4ADE80`, warning `#F5B842`, danger `#F26D78`, info `#63A8F5` — always paired with icon/text, never color alone

**Color — light**
- Surfaces: `#FAF9F6` canvas, `#FFFFFF` surface 1, `#F3F1EC` surface 2
- Borders: `#E2DFD8` / `#CFCAC0`; Text: `#121417` / `#4C5259` / `#787F88`
- Accent: `#4C6B0F` family for AA-contrast interactive text/buttons (accent *fill* `#D7F27A` with dark text)

**Typography**
- Display/editorial: *Instrument Serif* — dashboard headlines, empty-state titles, section markers (used sparingly)
- UI: *Inter Variable* — 400/500/600; tight tracking on headings
- Code/JSON/data: *JetBrains Mono* — editor, keys, paths, counts, shortcuts

**Type scale:** 11/12/13/14/16/20/24/32/44 px with 1.15–1.6 line heights; monospace labels uppercase at 11 px with 0.08em tracking for metadata rails.

**Spacing:** 4 px base scale (4, 8, 12, 16, 24, 32, 48, 64); 4/6/8/12/16 px radii; borders 1 px; elevation via layered surface + 1 px border, not heavy shadows.

**Motion:** 120–180 ms ease-out for state transitions, 240 ms for panels; no decorative loops; all animation behind `prefers-reduced-motion` guards. Graph uses short opacity transitions only.

### 7.3 Layout System

- **Shell:** fixed left navigation rail (240 px, collapsible to 64 px icon rail, drawer under 1024 px) + top bar (breadcrumbs, global search trigger, save/status, theme toggle, command palette hint) + content region.
- **Dashboard:** editorial header, create/search band, stat strip (real counts), recent/favorites columns, validation attention list, activity rail.
- **Library:** sticky filter bar, folder/collection sidebar section, grid or list toggle, bulk action bar that appears only with selection.
- **Editor workspace:** three zones — document header/metadata, central editor with tabs (Raw JSON / Tree / Preview / Revisions / Graph / Quality as the relevant features land), and a right inspector panel (validation, variables, schema, stats) that collapses and becomes a bottom sheet under 1280 px.
- **Overlays:** Radix Dialog for focused tasks, right-side Sheet for inspectors and revision detail, DropdownMenu/ContextMenu for row actions, Toast region bottom-right (`aria-live="polite"`).
- **Panels never permanently consume more than 30% width**, and every panel is collapsible with persisted preference.

### 7.4 Component Inventory (design-system primitives)

Button (primary/secondary/ghost/danger, sizes, loading), IconButton, Input, Textarea, Select, Combobox, Checkbox, Switch, RadioGroup, Badge/StatusPill, Kbd, Tooltip, Surface/Panel, Card, Separator, Tabs, Dialog, ConfirmDialog, Sheet, DropdownMenu, ContextMenu, Toast, Alert/InlineError, EmptyState, Skeleton, Spinner, ProgressBar, Avatar-less list rows, Pagination/VirtualList (only if needed), Field (label + hint + error association via `aria-describedby`), SearchInput, CopyButton, CodeBlock (read-only syntax display), SplitPane (editor layout), TagInput, DateLabel (relative + title absolute), StatCard, ActivityItem, DiffRow.

Required states for every interactive primitive: default, hover, active/pressed, focus-visible, disabled, loading (where applicable), invalid (form fields), and dark/light parity.

### 7.5 Content and State Standards

- **Loading:** route-level skeletons matching final layout (no spinners as the only signal for content regions); inline spinners for actions.
- **Empty:** each surface has a specific empty state explaining what belongs there and one clear next action (e.g., "No prompts match these filters — Clear filters").
- **Error:** plain-language cause + recovery action + expandable technical detail; never a blank screen; error boundary covers render failures.
- **Honesty labels:** Validation studio, inspector, laboratory, and health dashboard carry explicit scope statements ("syntax validity only", "heuristic", "local rendering — no model provider connected").
- **Destructive actions:** typed-name confirmation for database reset/library-wide deletion; standard confirm dialogs elsewhere; bulk archive/delete offer undo via toast.

### 7.6 Responsive Breakpoints

| Name | Width | Behavior |
| --- | --- | --- |
| `sm` | < 640 | Single column, bottom sheets, horizontal-safe tables converted to stacked rows, editor full-screen with compact toolbar |
| `md` | 640–1023 | Two-column library cards, collapsible nav drawer, editor with tab-switched inspector |
| `lg` | 1024–1279 | Persistent icon nav rail or narrow sidebar, editor two-pane (editor + collapsible inspector) |
| `xl` | 1280–1679 | Full sidebar, editor three-zone layout |
| `2xl` | ≥ 1680 | Sidebar + content max-width 1600 px + optional activity rail |

No horizontal page scroll at any breakpoint; code content scrolls within its own container.

---

## 8. Security and Privacy Requirements

1. **All persistence is local.** Data lives in the user's browser IndexedDB (+ small `localStorage` recovery drafts and preferences). No analytics, no telemetry, no prompt content transmitted anywhere at runtime.
2. **No external AI calls.** The laboratory performs local template rendering only and states this explicitly. No provider SDKs are installed in v1.
3. **Imported JSON is untrusted.** Imported content is parsed with `JSON.parse` under a size limit, validated structurally, never evaluated, and rendered as text (never `dangerouslySetInnerHTML`). Values used in URLs or attributes are rejected/escaped by schema checks.
4. **No `eval`, `Function`, template-expression languages, or dynamic code generation.** Variable resolution replaces `{{name}}` tokens only, with declared variables, string coercion rules, and a hard iteration cap.
5. **XSS-safe rendering.** React text interpolation only; the read-only JSON viewer renders tokens as React elements. Markdown is not rendered in v1.
6. **Secrets hygiene.** No secrets or API keys exist in client config. `.env*` files are git-ignored from TASK-001. If a future provider integration is added, keys must live server-side; this plan does not include one.
7. **Logging.** Console logging only in development; never log full prompt content in production paths; error boundaries display summaries, not full payload dumps.
8. **Destructive protection.** Confirmation for delete/archive-bulk/restore-overwrite; safety revision before restore; typed confirmation for database reset; undo toasts for reversible bulk actions.
9. **Resource limits.** Import files capped (default 2 MB, per-file), variables capped (200), instructions capped (500), revision retention policy configurable but defaults to keeping all manual snapshots (with export guidance when storage is large). Schema validation has a timeout guard.
10. **Documented data flows.** FIRST-RUN screen + Settings › Data section explain where data is stored, that it is device-local, and how to export a backup.

---

## 9. Accessibility and Responsive Requirements

### 9.1 Accessibility (target WCAG 2.2 AA)

- Semantic landmarks (`header`, `nav`, `main`, `aside`, `dialog`), one `h1` per route, ordered headings.
- Every interactive control has an accessible name; icon-only buttons use `aria-label`; decorative icons `aria-hidden`.
- Full keyboard operation: skip-to-content link, roving focus in menus/tabs/tree, `Escape` closes overlays, focus trap + restore in dialogs, visible `:focus-visible` ring (2 px, 3:1 contrast) on every focusable element.
- Editor accessibility: CodeMirror configured with accessible labels and keyboard shortcuts; every editor action has a non-editor equivalent button; tree view is keyboard navigable with `role="tree"`/`role="treeitem"`, arrow-key navigation, `aria-expanded`.
- Form errors associated via `aria-describedby`/`aria-invalid`, announced politely; validation summaries are focusable.
- Status never conveyed by color alone: validation uses icon + text; save status uses text + icon; diff uses +/− glyphs and labels.
- Contrast audited against chosen tokens in both themes (TASK-028 with automated axe checks plus manual review of accent-on-surface pairs).
- Reduced motion honored globally; no essential information conveyed by motion.
- Live regions: toasts `polite`, blocking errors `assertive`, autosave status changes announced only when failing or on explicit save.
- Touch targets ≥ 40 px on mobile.

### 9.2 Responsive Requirements

- All primary workflows verified at 360, 390, 768, 1024, 1280, 1440, 1920 px.
- Navigation collapses to a drawer with focus management; editor becomes single-pane with a tabbed inspector; command palette is full-screen sheet on mobile.
- Dialogs become bottom sheets below 640 px; menus support touch (Radix pointer handling) and are reachable without hover.
- Data tables (validation errors, revisions) transform to stacked definition lists on small screens.
- Graph falls back to a numbered list on narrow viewports and for screen-reader users.
- No layout shift caused by font loading (self-hosted fonts with `font-display: swap` and metric-adjusted fallbacks).

---

## 10. Testing Strategy

### 10.1 Unit Tests (domain; Vitest)

| Area | Coverage expectations |
| --- | --- |
| Prompt document parsing/serialization | Round-trip fidelity, unknown-field preservation, schema-version handling, malformed input |
| JSON syntax analysis | Error message extraction, line/column accuracy, empty input, deeply nested input, duplicate keys |
| Template rendering | `{{var}}` substitution, unknown/missing variables, type coercion, escaping rules, no-eval guarantee |
| Variable extraction | Declared vs. referenced variables, duplicates, unresolved references |
| Structural diff | Added/removed/changed, nested objects, array insert/remove/reorder, path generation, no-change case |
| Revision creation/restoration | Numbering, safety snapshots, restore fidelity, description retention |
| Search/filter/sort | Case-insensitive multi-field search, tag/status/date filters, sort stability, archived exclusion |
| JSON Schema validation | Valid/invalid documents, error paths, schema compile failures, timeout guard |
| Quality rules | Each rule's trigger and non-trigger, deterministic vs. heuristic labeling, dismissal handling |
| Blueprint graph derivation | Nodes/edges for sections, variables, schema refs, snippets; unresolved references; simple-prompt suppression |
| Import/export | Bundle round-trip, metadata fidelity, conflict detection, malformed/oversized rejection, ID remapping |
| Storage | Migration chain, quota error mapping, optimistic-concurrency rejection, seed idempotency |

### 10.2 Integration Tests (Vitest + Testing Library + fake-indexeddb)

1. Create a prompt, reload repositories, verify persistence and activity event.
2. Edit and autosave; verify save status transitions and stale-write rejection.
3. Folder/collection creation, move, and deletion safeguards.
4. Create snapshot, edit, restore, verify safety revision exists and newer changes are not silently lost.
5. Validate against a stored schema; verify error list and path display; verify valid-JSON-but-invalid-schema case.
6. Render a prompt with variables; verify missing-required detection and rendered output.
7. Import a valid bundle and an invalid file; verify conflict handling and no partial writes.
8. Simulate IndexedDB failure; verify error state, draft retention, and no false "saved" claim.
9. Command palette navigation and duplicate-execution guard.
10. Bulk archive with undo restores prior state.

### 10.3 End-to-End (optional Playwright, TASK-029)

Create prompt from template → edit invalid JSON → fix and save → add variable → preview → snapshot → diff → export. Plus a mobile viewport smoke pass. If Playwright cannot be installed or run reliably in this environment, it is omitted and the limitation is documented honestly in `docs/LIMITATIONS.md`.

### 10.4 Quality Gates (applied to every task)

- `npm run typecheck`, `npm run lint`, `npm run test:run` pass; `npm run build` passes for tasks touching routing/build config.
- No knowingly broken primary workflow; no fake success messages; no ignored critical errors.
- No task marked complete without executed validation, with actual outputs reported.
- New domain logic ships with unit tests; new workflows ship with at least one integration test.
- Manual keyboard check of any new interactive surface.
- Both themes checked visually for any new surface.

### 10.5 What will not be claimed

Automated accessibility tests do not replace manual review; passing axe does not mean "fully accessible". Tests are not described as complete unless executed. Valid JSON is never described as an effective prompt.

---

## 11. Feature-to-Task Roadmap

| Phase | Tasks | Outcome |
| --- | --- | --- |
| 0. Planning | TASK-000 (this document) | Approved plan |
| 1. Foundation | 001–007 | Toolchain, design tokens, UI primitives, domain model, persistence, state, seeds |
| 2. Shell & navigation | 008–010 | App shell, command palette, real-data dashboard |
| 3. Library & authoring | 011–018 | Library, CRUD/organization, JSON editor, save pipeline, validation, composer, templates |
| 4. Versioning & experimentation | 019–024 | History, diff, variable playground, laboratory, blueprint graph, quality inspector |
| 5. Insight & portability | 025–026 | Health dashboard/activity, import/export |
| 6. Hardening & delivery | 027–031 | Responsive, accessibility, test suite, integration verification, documentation |

Feature traceability: library → 011–013; JSON editor → 014–015; validation studio → 016; composer → 017; templates → 018; version control → 019; diff explorer → 020; variable playground → 021; laboratory → 022; blueprint graph → 023; quality inspector → 024; health dashboard → 025 (+010 surface); import/export → 026; command palette → 009; recovery/autosave → 015; organization → 012–013; dashboard → 010.

---

## 12. Task Dependency Graph

```
TASK-001
  └─ TASK-002
      ├─ TASK-003
      │   └─ TASK-004
      └─ TASK-005
          └─ TASK-006
              └─ TASK-007  (deps: 004, 006)
                  ├─ TASK-008
                  │   ├─ TASK-009
                  │   ├─ TASK-010
                  │   └─ TASK-011
                  │       └─ TASK-012
                  │           ├─ TASK-013
                  │           └─ TASK-014
                  │               └─ TASK-015
                  │                   ├─ TASK-016
                  │                   │   ├─ TASK-023
                  │                   │   └─ TASK-025
                  │                   ├─ TASK-017
                  │                   │   └─ TASK-018
                  │                   ├─ TASK-019
                  │                   │   └─ TASK-020
                  │                   ├─ TASK-021
                  │                   │   ├─ TASK-022
                  │                   │   └─ TASK-024
                  │                   └─ TASK-026 (also needs 019)
                  └─ ...
TASK-027 (deps: 018, 020, 022, 023, 024, 025, 026)
  └─ TASK-028
  └─ TASK-029
      └─ TASK-030
          └─ TASK-031
```

Execution order is the numeric order; each task's dependencies are also listed in its specification. Parallelizable pairs (002↔005 after 001) are still executed sequentially under the one-task-per-approval rule.

---

## 13. Task Index and Status

**Status legend:** `Not Started` · `In Progress` · `Blocked` · `Completed`

- [x] TASK-001 — Project foundation and toolchain — High — deps: none
- [x] TASK-002 — Design tokens, theme system, and global styles — High — deps: 001
- [x] TASK-003 — Core UI primitives and design gallery — High — deps: 002
- [x] TASK-004 — Overlay, feedback, and form primitives — High — deps: 003
- [x] TASK-005 — Domain model and prompt document specification — High — deps: 001
- [x] TASK-006 — Persistence foundation with repositories and migrations — High — deps: 005
- [x] TASK-007 — Seed data, application store, and first-run foundation — High — deps: 004, 006
- [x] TASK-008 — Application shell, routing, and responsive navigation — High — deps: 004, 007
- [x] TASK-009 — Keyboard shortcut registry and command palette — High — deps: 008
- [x] TASK-010 — Dashboard with real library data — High — deps: 008, 009
- [x] TASK-011 — Prompt library browsing, search, filters, and views — High — deps: 008
- [x] TASK-012 — Prompt CRUD, folders, and collections — High — deps: 011
- [x] TASK-013 — Tags, favorites, pins, archive, and bulk actions — Medium — deps: 012
- [x] TASK-014 — JSON editor workspace (raw + tree views) — High — deps: 012
- [x] TASK-015 — Save pipeline, autosave, and recovery — High — deps: 014
- [x] TASK-016 — Validation engine and validation studio — High — deps: 015
- [x] TASK-017 — Guided prompt composer with JSON synchronization — High — deps: 015
- [x] TASK-018 — Template catalog and custom templates — Medium — deps: 012, 017
- [x] TASK-019 — Version history and safe restoration — High — deps: 015
- [x] TASK-020 — Structural diff explorer — High — deps: 019
- [x] TASK-021 — Variable playground and prompt preview — High — deps: 015
- [x] TASK-022 — Prompt laboratory with saved test cases — Medium — deps: 021
- [x] TASK-023 — Blueprint dependency graph — Medium — deps: 016, 019
- [x] TASK-024 — Quality inspector — Medium — deps: 016, 021
- [x] TASK-025 — Health dashboard and activity timeline — Medium — deps: 016, 019
- [x] TASK-026 — Import and export — High — deps: 012, 019
- [ ] TASK-027 — Responsive refinement pass — High — deps: 018, 020, 022, 023, 024, 025, 026
- [ ] TASK-028 — Accessibility review and remediation — High — deps: 027
- [ ] TASK-029 — Automated test suite expansion — High — deps: 027
- [ ] TASK-030 — Integration verification and defect pass — High — deps: 028, 029
- [ ] TASK-031 — Documentation and delivery — High — deps: 030

**Progress:** 26 of 31 tasks complete. TASK-001 through TASK-022 were completed on 2026-10-24; TASK-023, TASK-024, TASK-025, and TASK-026 on 2026-10-25.

---

## 14. Task Specifications

Each task follows the required template. **No task may begin without explicit user authorization**, and **only one task runs per execution cycle**.

---

### TASK-001 — Project foundation and toolchain

- **Status:** Completed
- **Priority:** High
- **Dependencies:** None
- **Objective:** Establish a runnable, strictly typed React + TypeScript + Vite + Tailwind application with quality gates and the folder structure that later tasks depend on.
- **Scope:**
  - Initialize Vite React-TS project in the repository root; install runtime and dev dependencies listed in §5.1 (only those needed now: react, react-dom, react-router-dom, zustand, lucide-react, idb, tailwind, testing stack, eslint/prettier).
  - Configure `tsconfig` (strict, path alias `@/`), Vite (port 5173, host `0.0.0.0`), Tailwind v4 via `@tailwindcss/vite`, Vitest (`jsdom`, setup file), ESLint flat config, Prettier, `.gitignore`, `.env` ignores.
  - Create the `src/` directory skeleton from §5.2 with placeholder-free minimal files (app root rendering a temporary smoke screen only, no product features).
  - Add npm scripts from §5.4 and `index.html` metadata (title, description, theme-color, favicon placeholder-free).
  - Write `docs/ARCHITECTURE.md` skeleton with stack decisions and dependency rule; update `README.md` with setup/run/test commands.
- **Acceptance criteria:**
  - `npm install` completes and lockfile is committed.
  - `npm run dev` serves the app on port 5173 bound to `0.0.0.0`; root route renders without console errors.
  - `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build` all exit 0.
  - One meaningful smoke test exists and passes.
  - No product feature, mock data, or fake navigation is introduced.
- **Validation:**
  - Run all four quality scripts and record output.
  - Start the dev server, request `/`, confirm HTTP 200 and expected root markup.
  - Confirm `package.json` dependency list matches installed modules and no secrets/env files are tracked.
- **Deliverables:** `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/styles/global.css`, `src/test/setup.ts`, `src/app/App.test.tsx`, `README.md`, `docs/ARCHITECTURE.md`, `.gitignore`.
- **Out of scope:** Design tokens, product UI, routing screens, data models, persistence.
- **Completion record (2026-10-24):** Completed after explicit user authorization. Installed and pinned: React 19.3.1, TypeScript 6.0.3, Vite 8.3.5, Tailwind CSS 4.3.3 (`@tailwindcss/vite`), Vitest 5.0.5, jsdom, Testing Library, ESLint 10.13.0 (flat config), Prettier 3.9.10. Later-task runtime dependencies (`react-router-dom`, `zustand`, `lucide-react`, `idb`) are pinned per the task scope; none is used by feature code, because no feature code exists yet.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run test:run` — 1 file / 3 tests passed; `npm run build` exit 0 (JS 220.59 kB → 69.14 kB gzip, CSS 11.63 kB → 3.08 kB gzip); `npm run format:check` clean; `npm ci --dry-run` succeeds; `npm ls --depth=0` reports no missing/extraneous/invalid dependencies; no `.env` or secret files tracked.
  - **Runtime verification:** dev server binds `0.0.0.0:5173` (confirmed with `ss`), `/` returns HTTP 200 with the expected title and `#root`, and a preview-style proxied `Host` header returns HTTP 200. Production preview on `0.0.0.0:4173` served `/`, the hashed JS asset, and a proxied host with HTTP 200.
  - **Smoke test content:** asserts a single `h1`, honest "no product features yet" copy, absence of navigation/buttons (no mock UI), and zero `console.error`/`console.warn` calls during render.
  - **Notes/limitations:** Design tokens, theming, and product UI remain deferred to TASK-002+; `global.css` contains only a temporary neutral base. Directory skeleton is tracked with `.gitkeep` markers where later tasks add modules. No browser E2E runner is installed yet (planned as conditional in TASK-029).

---

### TASK-002 — Design tokens, theme system, and global styles

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-001
- **Objective:** Implement the Prompt Observatory visual foundation: tokenized colors, typography, spacing, radii, motion, focus rings, layered surfaces, and a dark-first theme with a light theme.
- **Scope:**
  - `styles/tokens.css` + `theme.css`: CSS custom properties for surfaces, text, borders, accent, semantic states, spacing scale, radii, shadows, z-index scale, type scale; Tailwind `@theme` mapping.
  - Self-host Inter Variable, JetBrains Mono, Instrument Serif via fontsource; define display/UI/mono font families and fallbacks with metric-adjusted fallback metrics.
  - Theme provider: `system | dark | light` resolution, `data-theme` attribute, persistence in settings/localStorage, no flash of wrong theme on load.
  - Global base styles: resets, selection color, scrollbar treatment, focus-visible ring, reduced-motion media guard, background layering utilities, `::selection`, `.tabular` numerals.
  - Layout utilities: content container widths, editor surface, metadata rail, skeleton shimmer (motion-safe).
  - A temporary internal route or fixture page proving token application in both themes (replaced by the gallery in TASK-003).
- **Acceptance criteria:**
  - Both themes render with tokens only; no hard-coded hex values in components.
  - Theme choice persists across reloads and respects OS preference when set to system.
  - Text/background pairs used by tokens meet ≥ 4.5:1 for body text and ≥ 3:1 for large text/UI boundaries (documented contrast table).
  - Reduced-motion disables all non-essential transitions.
  - No layout flash on first paint in either theme.
- **Validation:** Unit test theme-resolution logic (system/dark/light + persistence); manual toggle verification in dev server; contrast values recorded in `docs/DECISIONS.md`; typecheck/lint/tests/build.
- **Deliverables:** `src/styles/tokens.css`, `theme.css`, `global.css`, `src/app/providers/ThemeProvider.tsx`, `src/store/preferences.ts` (theme slice), theme tests, contrast notes.
- **Out of scope:** Component primitives (TASK-003/004), application shell, product screens.
- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Delivered:** `src/styles/tokens.css` (dark + light palettes and theme-invariant spacing, radii, type, motion, layout, and z-index scales), `src/styles/theme.css` (Tailwind v4 `@theme inline` bridge, `data-theme` dark variant, keyframes), `src/styles/fonts.css` (self-hosted Inter Variable, JetBrains Mono Variable, Instrument Serif with metric-adjusted fallbacks), `src/styles/global.css` (base styles, `:focus-visible` ring, selection, scrollbars, dual reduced-motion guard, and `content-container` / `surface-panel` / `editor-surface` / `metadata-rail` / `tabular` / `skeleton` / `z-*` utilities), `src/styles/theme.ts` (framework-free resolution, validation, persistence, application), `src/store/preferences.ts` (theme slice as a createable Zustand store), `src/app/providers/ThemeProvider.tsx` + `theme-context.ts`, `src/components/theme/ThemeToggle.tsx` (working control), and a pre-paint boot script in `index.html`.
  - **Proof page:** the TASK-001 smoke screen was replaced by a token-proof fixture (surfaces, type hierarchy, semantic states with icons and labels, accent and focus, spacing/radii, elevation/motion/skeleton) with no product navigation and no fake controls. TASK-003 replaces it with the real component gallery.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run test:run` — 6 files / 47 tests passed (theme resolution matrix, corruption and storage-failure paths, OS-follow and override behavior, listener teardown, boot-script sandbox cases, token coverage and discipline, store slice); `npm run check:contrast` — 52 pairings across both themes pass (26 pairs × 2 themes, thresholds 4.5:1 text / 3:1 UI); `npm run format:check` clean; `npm run build` exit 0 (CSS 31.06 kB → 9.17 kB gzip).
  - **Additional verification:** grep confirmed zero hex color literals outside `tokens.css`; inspection of the production CSS bundle confirmed utilities emit `var(--pf-*)` references, both theme blocks compile, and every referenced custom property is defined (no dangling `--color-*`/`--text-*`); dev server returns HTTP 200 on `0.0.0.0:5173` with the updated fixture.
  - **Contrast corrections:** the first gate run failed `ink-muted` on `surface-3` (4.42:1 dark, 4.36:1 light) and initially flagged the decorative `line-strong` token; muted text was retuned to `#828D9A` (dark) and `#5F666F` (light), and borders were split into decorative `line` and 3:1-rated `line-control`/`line-strong`. Documented in `docs/DECISIONS.md`.
  - **Notes/limitations:** Theme persistence uses `localStorage` until the settings repository lands in TASK-007 (key `promptforge.theme` kept stable). No browser is available in this sandbox, so verification is CSS/test evidence rather than screenshots; visual QA is scheduled in TASK-027/028. `clsx`/`tailwind-merge` were installed one task early to support the shared `cn` helper (recorded as a deviation in TASK-003's scope). Font metric overrides are approximations, not measured. All decisions and the generated contrast table are in `docs/DECISIONS.md`; the design-system contract is in `docs/ARCHITECTURE.md` §10.
- **Out of scope (unchanged):** Component primitives (TASK-003/004), application shell, product screens.

---

### TASK-003 — Core UI primitives and design gallery

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-002
- **Objective:** Deliver the reusable, accessible primitives every later screen composes, plus a `/design` gallery route that demonstrates every variant and state.
- **Scope:**
  - Install/configure `class-variance-authority`, `clsx`, `tailwind-merge`, and Radix primitives as needed (`@radix-ui/react-tooltip`, `@radix-ui/react-tabs`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-switch`, `@radix-ui/react-checkbox`).
  - Implement: Button (primary/secondary/ghost/danger, sm/md/lg, loading, icon slots), IconButton, Input, Textarea, Select, Checkbox, Switch, RadioGroup, Field (label/hint/error with `aria-describedby` + `aria-invalid`), Badge/StatusPill, Card/Surface, Separator, Tooltip, Kbd, Tabs, CopyButton, Spinner, ProgressBar.
  - Gallery route `/design` (dev-oriented, linked from Settings later) showing all variants, disabled/loading/invalid states, and both themes; documented component usage notes in `docs/ARCHITECTURE.md`.
- **Acceptance criteria:**
  - Every primitive supports keyboard focus, visible focus ring, disabled state, and accessible naming.
  - Field errors are programmatically associated and announced; inputs never lose content on validation.
  - Tooltips are reachable by keyboard and dismissible with Escape.
  - Components contain no domain knowledge and no direct storage access.
  - Gallery renders all variants without console warnings.
- **Validation:** Component tests for Button/Field/Tabs/Tooltip (roles, accessible names, keyboard behavior, error association); gallery manual pass in both themes; typecheck/lint/tests/build.
- **Deliverables:** `src/components/ui/*` primitives, `src/lib/cn.ts`, `/design` route (`src/routes/design/DesignGallery.tsx`), component tests, docs update.
- **Out of scope:** Dialog/Sheet/Toast/EmptyState/Skeleton (TASK-004), domain components, app shell.
- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Primitives delivered (`src/components/ui/`):** `Button` (4 variants × 3 sizes, loading with `aria-busy` + stable name + sibling `role="status"` announcement, leading/trailing icon slots, block), `IconButton` (required `label` prop → `aria-label`/`title`, icons hidden from AT), `Spinner`, `Field` (render-prop ARIA wiring: id, `aria-describedby`, `aria-invalid`, `required`; hint/error/optional label/hidden label), `Input` (sizes, invalid, decorative adornment), `Textarea` (mono, auto-resize), `Select` (native select with options/placeholder/disabled), `Checkbox` (incl. indeterminate), `Switch`, `RadioGroup` (roving focus), `Badge` + `StatusPill` (semantic tone always paired with icon + text), `Surface` + `Card` (`flat`/`panel`/`sunken`/`interactive`, polymorphic `as`), `Separator` (semantic vs decorative), `Kbd` + `ShortcutHint`, `Tooltip` (focus/hover, Escape, `aria-describedby`, provider), `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`/`SimpleTabs`, `CopyButton`/`CopyIconButton` (real clipboard outcome, failure announced), `ProgressBar` (determinate, labelled, clamped). Variant recipes split into `buttonVariants.ts`, `fieldVariants.ts`, `surfaceVariants.ts`, `badgeVariants.ts`, `controlStyles.ts` (ADR-17).
  - **Gallery:** `src/routes/design/DesignGallery.tsx` renders every primitive in every state (variants, sizes, disabled, loading, invalid, indeterminate, empty), both themes, keyboard-hint and tooltip demos, plus one composed interaction (in-memory snapshot list) proving real state wiring. It is the temporary application root; TASK-008 mounts it at `/design` (ADR-21).
  - **Dependencies added:** `class-variance-authority@0.7.1`, `@radix-ui/react-{tooltip,tabs,switch,checkbox,radio-group}`. Dialog and dropdown-menu were deliberately **not** installed — they belong to TASK-004 and are unused.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — 12 files / **92 tests passed**; `npm run format:check` clean; `npm run build` exit 0 (CSS 37.66 kB → 10.34 kB gzip; JS 370.69 kB → 115.91 kB gzip); `npm run check:contrast` 52 pairings pass.
  - **Additional verification:** dev server serves `/` and the gallery module (HTTP 200); production CSS inspected for every primitive utility (`size-4.5`, `data-[state=...]` variants, `aria-invalid`, `animate-spin`, `animate-fade-in`, `field-sizing-content`, `sr-only`, `divide-line`) with no undefined custom properties. Component tests cover roles, names, keyboard activation, focus/roving behavior, error association without data loss, clipboard success/failure/missing-API, and zero console warnings while toggling both themes.
  - **Deviation:** the spec's "gallery route `/design`" is delivered as a route-ready component rendered at the root, because routing does not exist until TASK-008; recorded as ADR-21 and in `docs/ARCHITECTURE.md` §11. "Manual pass in both themes" was executed as an automated DOM/theme pass plus compiled-CSS inspection because no browser is available in this sandbox (documented).
  - **Notes/limitations:** overlays, toasts, empty/error states, and skeletons remain TASK-004; `theme` segmented control is still bespoke until the shell refactors it; no screenshot-level visual verification yet (TASK-027/028). Component usage notes are in `docs/ARCHITECTURE.md` §11 and decisions in `docs/DECISIONS.md` (ADR-16…ADR-21).

---

### TASK-004 — Overlay, feedback, and form primitives

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-003
- **Objective:** Complete the design system with overlays and state components required for CRUD dialogs, navigation, and every loading/empty/error surface.
- **Scope:**
  - Dialog, ConfirmDialog (destructive variant with required confirmation text option), Sheet (right/bottom), DropdownMenu, ContextMenu, Toast provider + queue + undo action support, Alert/InlineError, EmptyState, Skeleton, ErrorState, AsyncBoundary helpers.
  - Focus management: trap, restore, scroll lock, Escape handling, nested overlay rules; mobile bottom-sheet behavior under 640 px.
  - Toast API: `success | error | info`, optional action, dedupe, auto-dismiss with pause on hover/focus, `aria-live` regions.
  - Extend `/design` gallery with overlay and state demos, including a destructive-confirmation demo and a toast with undo.
- **Acceptance criteria:**
  - Dialogs trap focus, restore focus to the trigger, close on Escape/overlay click (configurable), and expose `role="dialog"` with `aria-modal` and labelled title.
  - Toasts are announced politely, never auto-dismiss errors before 8 s, and the undo action is keyboard reachable.
  - Empty and error states always offer an action; error states include technical detail in a disclosure.
  - All overlays usable by touch and keyboard without hover.
- **Validation:** Tests for ConfirmDialog (confirm/cancel/callback), Toast (queue, undo action, dismissal), EmptyState/ErrorState rendering; gallery manual pass with keyboard-only; typecheck/lint/tests/build.
- **Deliverables:** overlay/feedback primitives in `src/components/ui/`, toast provider wired in `src/app/providers`, tests, gallery additions.
- **Out of scope:** Business logic, prompt dialogs, shell layout.
- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Overlays delivered (`src/components/ui/`):** `Dialog`/`DialogContent` (required `title`, optional `description`, `size` sm/md/lg, `dismissible`, `hideCloseButton`, `footer`; scroll lock and focus trap from Radix; explicit `role="dialog"` + `aria-modal="true"`; Escape/outside-pointer configurable), `ConfirmDialog` (destructive variant → non-dismissible, hidden corner close, "cannot be undone" banner; optional `confirmationPhrase` gating confirm, trimmed and case-sensitive; `pending` state), `Sheet`/`SheetContent` (right panel that becomes a bottom sheet under 640 px via `max-sm:*`, scrollable body, pinned footer), `DropdownMenu`/`DropdownMenuItem`/`DropdownMenuActions` (disabled and destructive items, checked state, shortcuts), `ContextMenu`/`ContextMenuTrigger`/items (right-click, long-press, and real Shift+F10 / Menu-key support in the wrapper).
  - **Feedback delivered:** `ToastProvider` + `useToast` (reducer with `{visible, queued}`, max 3 visible, FIFO promotion, id dedupe, `success`/`error`/`info`, optional `action` for undo, `dismiss`/`dismissAll`, pause on hover/focus, polite + assertive live regions, 8 s error floor via exported `resolveToastDuration`), `Alert` + `InlineError` (tone variants, optional dismiss, optional action), `EmptyState` (required `action`), `ErrorState` (required `action`, technical `detail` inside a collapsed `<details>`), `Skeleton`/`SkeletonText` (shimmer behind a `prefers-reduced-motion` guard), `AsyncBoundary` (`idle | loading | error | success` + `isEmpty` + `onRetry`).
  - **Focus management:** trap, scroll lock, and Escape come from Radix; restoration is implemented for externally opened overlays in `src/components/ui/focus-return.ts` — the opener is captured at portal mount and restored on close, falling back to the last element focused outside any overlay when the opener is gone (ADR-26). New `Alert`/`EmptyState`/`ErrorState` components are non-modal and need no trap. Destructive confirms deliberately do not pre-focus the destructive button.
  - **Gallery:** `src/routes/design/DesignGallery.tsx` now mounts `OverlayDemos.tsx` (dialog, cancelable + typed-phrase destructive confirmations, sheet, dropdown with disabled/destructive items, context menu with keyboard/long-press notes, toast with Undo) and `FeedbackDemos.tsx` (four toast variants + a five-toast queue test, alert tones with dismissal, `InlineError`, `EmptyState`, `ErrorState`, skeleton patterns, `AsyncBoundary` state switcher). Shared section/example chrome was extracted to `galleryParts.tsx`. Every demo is driven by real state; nothing is a static mock.
  - **Dependencies added:** `@radix-ui/react-dialog@1.3.1`, `@radix-ui/react-dropdown-menu@2.2.1`, `@radix-ui/react-context-menu@2.4.1` (all previously scheduled for this task; `npm audit` reports 0 vulnerabilities).
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — 16 files / **135 tests passed** with no React `act(...)` warnings; `npm run format:check` clean; `npm run build` exit 0 (CSS 42.92 kB → 11.26 kB gzip; JS 433.64 kB → 133.38 kB gzip); `npm run check:contrast` 52 pairings pass; dev server serves `/` (HTTP 200).
  - **Additional verification:** production CSS inspected for `z-modal`/`z-overlay`/`z-popover`/`z-toast`, `shadow-panel`, `skeleton` + shimmer with its reduced-motion guard, `text-2xs`, `rounded-xs`, `bg-danger-soft`, `border-line-strong`, `bg-surface-3`, `editor-surface`, `animate-fade-in`, and the `max-sm:` bottom-sheet utilities. New tests: `Dialog.test.tsx` (aria-modal, title/description, trap, restore, Escape, overlay click, non-dismissible, sheet), `ConfirmDialog.test.tsx` (callbacks, destructive dismissal rules, typed phrase incl. wrong case, pending, reset), `states.test.tsx` (empty/error actions and disclosure, alerts, boundary states + retry, skeletons, menu items, context menu via right-click and Shift+F10), `ToastProvider.test.tsx` (duration floor/override, queue cap and promotion, dedupe, hover/focus pause, dismissal, keyboard undo, live-region politeness). `test/setup.ts` now sets `IS_REACT_ACT_ENVIRONMENT` so React 19 act warnings cannot be missed.
  - **Deviations:** (1) the destructive confirm inherits `dismissible={false}` rather than exposing a separate prop — documented as ADR-22; (2) `EmptyState`/`ErrorState` require an `action` prop instead of accepting optional content (ADR-24); (3) `ConfirmDialog` no longer auto-focuses its confirm button, which is both safer and what makes focus restoration deterministic (ADR-26); (4) "gallery manual pass with keyboard-only" was executed as automated keyboard-driven tests (Escape, Tab trap, Shift+F10, Enter on undo) plus compiled-CSS inspection, because no browser exists in this sandbox.
  - **Notes/limitations:** focus restoration relies on `DialogContent`/`SheetContent`; a future primitive that bypasses them must implement ADR-26. Toast countdowns have no visible progress indicator, and timer behavior is verified with fake timers in isolation. Long-press context menus use Radix's implementation and were not exercised on a real touch device. No screenshot-level visual verification yet (TASK-027/028). Decisions: ADR-22…ADR-27 in `docs/DECISIONS.md`; usage and nested-overlay rules in `docs/ARCHITECTURE.md` §11.

---

### TASK-005 — Domain model and prompt document specification

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-001
- **Objective:** Define the typed domain: entities from §6.1, the canonical PromptForge prompt document, factories, invariants, and serialization — framework-independent and fully unit-tested.
- **Scope:**
  - `src/domain/types.ts`: Prompt, PromptDocument, VariableDefinition, PromptRevision, Folder, Collection, PromptTemplate, TestCase, PromptSchema, Snippet, ActivityEvent, Settings, enums/unions.
  - `src/domain/promptDocument.ts`: canonical document validation and normalization (version, required fields, allowed types), `createBlankDocument()`, `createSampleDocument()`, section helpers.
  - `src/domain/factories.ts`: entity factories with IDs/timestamps injected (testable clock/ID injection), default settings, defaults for prompt status/flags.
  - `src/domain/serialization.ts`: stable JSON stringify/format, document parse with error result types, content hashing helper.
  - Unit tests for factories, validation, round-trip serialization, and invariant guards (folder cycle detection helper, tag normalization).
  - `docs/DATA-MODEL.md` documenting entities, relationships, uniqueness, and the document format with an example.
- **Acceptance criteria:**
  - All entities compile under strict TypeScript with no `any` and readonly-friendly structures.
  - Document validation returns structured issues (path, message, severity) rather than throwing.
  - Factories are deterministic under injected clock/ID and produce schema-valid entities.
  - Serialization round-trips preserve unknown-but-valid fields; invalid input yields typed errors, never exceptions leaking to UI.
  - Domain module imports no React, storage, or browser-only APIs (verified by import review/test).
- **Validation:** `npm run test:run -- domain` covering all modules with ≥ 90% module coverage; typecheck/lint; manual review that no UI/storage imports exist.
- **Deliverables:** `src/domain/types.ts`, `promptDocument.ts`, `factories.ts`, `serialization.ts`, `invariants.ts`, tests, `docs/DATA-MODEL.md`.
- **Out of scope:** Persistence, rendering/variables, diff, validation studio, sample UI.
- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Modules delivered (`src/domain/`):**
    - `types.ts` — `Prompt`, `PromptDocument`, `VariableDefinition`, `PromptRevision`, `Folder`, `Collection`, `PromptTemplate`, `TestCase`, `PromptSchema`, `Snippet`, `ActivityEvent`, `Settings`, JSON value types, `DomainIssue`/`DomainResult`, `DocumentSectionDefinition`. Everything is `readonly` and JSON-serializable.
    - `promptDocument.ts` — canonical validation/normalization (`validatePromptDocument`, `normalizeDocument`), value guards (`isPlainObject`, `isJsonValue`), variable helpers, `createBlankDocument`, `createSampleDocument`, `DOCUMENT_SECTIONS` outline plus `getDocumentSection`/`setDocumentSection`/`isDocumentEmpty`/`documentStats`.
    - `factories.ts` — `DomainDependencies { now, newId }` (`systemDependencies` default), factories for every entity, `createDefaultSettings`, deep-copied `createRevision` snapshots.
    - `serialization.ts` — `stableStringify`/`tryStableStringify`, `documentToJson`/`formatDocument` (canonical section order), `parseDocument`/`parseJson` returning `DomainResult` with line/column syntax messages, `hashString`/`contentHash`/`documentHash`/`tryContentHash` (pure FNV-1a 64-bit).
    - `invariants.ts` — tag and title normalization, variable-name rules, autosave clamping, folder depth/path/cycle detection/name uniqueness/move validation (`MAX_FOLDER_DEPTH = 5`), revision numbering and sorting, `capActivityLog` (500 entries).
    - `index.ts` — barrel re-exporting the layer.
  - **Validation contract:** structured issues `{ path, message, severity }` where `path` is a JSON path (`variables[2].name`); errors block persistence/import, warnings describe normalization. No exceptions reach the UI; `parseDocument` reports malformed text as one readable message.
  - **Determinism:** identical dependencies produce identical entities; tests use a fixed clock and counter IDs. `createRevision` deep-copies so later edits cannot mutate a snapshot.
  - **Round-trip fidelity:** unknown top-level document fields are preserved in `extras` and re-emitted on export; unknown nested fields are reported and dropped (ADR-29). `format → parse` returns an equal document, verified by test.
  - **Dependencies added:** `@vitest/coverage-v8@5.0.5` (dev) to run the acceptance criterion's ≥ 90% coverage gate; `vite.config.ts` now configures v8 coverage scoped to `src/domain/` with 90% thresholds, and `package.json` gains `test:coverage`.
  - **Docs:** new `docs/DATA-MODEL.md` (entities, relationships, uniqueness, document format with a full example, validation/normalization rules, serialization and hashing contract, invariants, factories). ADR-28…ADR-32 in `docs/DECISIONS.md`; `docs/ARCHITECTURE.md` §5 now indexes the domain modules and links the data model.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — 21 files / **246 tests passed** (domain: 5 files / 111 tests); `npm run test:coverage` — 98.69% statements, 96.21% branches, 100% functions, 98.58% lines across `src/domain/` (per module: factories 100%, invariants 100%, promptDocument 99.6%, serialization 94.4%, types 100%), gate passes; `npm run format:check` clean; `npm run build` exit 0 (CSS 42.98 kB → 11.27 kB gzip; JS 433.64 kB → 133.38 kB gzip); `npm run check:contrast` 52 pairings pass.
  - **Layer purity verified by test:** `src/domain/purity.test.ts` reads the module sources and asserts the exact module inventory, an import allowlist (`@/domain/*` only), absence of React/store/storage imports, absence of DOM/storage globals, no `any`, and a complete barrel.
  - **Notes/limitations:** `Prompt.variables` and `PromptDocument.variables` can diverge until the save pipeline keeps them in step (ADR-32, TASK-015); nested unknown document fields are dropped with a warning (ADR-29); hashing is change detection, not cryptography (ADR-31); no persistence, seeding, or UI consumes these modules yet (TASK-006/TASK-007).

---

### TASK-006 — Persistence foundation with repositories and migrations

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-005
- **Objective:** Provide a durable, migration-aware local persistence layer behind repository interfaces, with in-memory adapters for testing and explicit failure semantics.
- **Scope:**
  - Repository interfaces (§5.3) covering CRUD, queries used by the library (by folder, tag, archived, updated range), revisions by prompt, settings singleton, activity append/prune, seeds metadata.
  - IndexedDB implementation with `idb`: database `promptforge`, stores/indexes per §6.3, transactional writes, ordered migrations runner, `meta` version tracking.
  - In-memory repository adapters (parity-tested against the same contract suite) using `fake-indexeddb` for the IndexedDB adapter.
  - Error mapping: `StorageUnavailableError`, `QuotaExceededError`, `StaleWriteError`, `MigrationError`, `CorruptDataError`; capability probe for IndexedDB availability.
  - Optimistic concurrency via `version` check in `updatePrompt`; serialized write queue helper per prompt id; `BroadcastChannel` write announcements (used from TASK-015).
  - Tests: contract suite, migration chain (v0→v1→v2 fixtures), quota/stale-write behavior, seed idempotency.
  - `docs/PERSISTENCE.md` describing schema, migrations, failure handling, and the future server-backed path.
- **Acceptance criteria:**
  - All repositories satisfy one shared contract suite in both IndexedDB (fake-indexeddb) and in-memory modes.
  - Migrations run idempotently, abort atomically on failure, and record versions.
  - Stale writes are rejected with `StaleWriteError` and do not mutate stored data.
  - Quota and unavailability produce typed errors, never unhandled rejections.
  - No UI or React import in `src/data/*`; components cannot import the IndexedDB adapter directly (enforced by module boundary review and lint rule).
- **Validation:** `npm run test:run -- data` with contract + migration suites; typecheck/lint/build; manual DevTools inspection of created stores and indexes in the browser (documented).
- **Deliverables:** `src/data/repositories/*.ts` (interfaces + IndexedDB), `src/data/db/schema.ts`, `migrations.ts`, `errors.ts`, `src/data/adapters/inMemory.ts`, contract tests, `docs/PERSISTENCE.md`.
- **Out of scope:** Seeding product content, store wiring, autosave UI, import/export.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Modules delivered:**
    - `src/data/db/schema.ts` — database `promptforge`, `DB_SCHEMA_VERSION = 2`, eleven object stores with key paths (`id`, except `settings`/`meta` = `key`), v1 index definitions, the v2 `prompts.status` index, typed `PromptForgeDB` rows, numeric flag mirrors (`archivedFlag`, `favoriteFlag`, `pinnedFlag`, `builtInFlag`), and `expectedIndexes()` as the single source of truth for the integrity check and schema assertions.
    - `src/data/db/migrations.ts` — `migration1` (stores + v1 indexes), `migration2` (`prompts.status`), `MIGRATIONS`, `validateMigrations` (gapless, ascending), `pendingMigrations`, `applyMigrations` (inside the `versionchange` transaction, replay-safe, throwing `MigrationError`), `missingStores`.
    - `src/data/db/indexedDb.ts` — `openPromptForgeDatabase` (migration capture, `meta` bookkeeping with preserved `seedVersion`, integrity check, `onBlocked`/`onBlocking`), `deletePromptForgeDatabase`, `probeStorage`, `isIndexedDbAvailable`, `assertSchemaIntegrity`, `assertStorageAvailable`, `isNewerDatabaseError`.
    - `src/data/db/errors.ts` — `StorageError` with stable `code` values plus `StorageUnavailableError`, `QuotaExceededError`, `StaleWriteError`, `MigrationError` (`failed` | `newer-database`), `CorruptDataError`, `DuplicateRecordError`, `InvalidWriteError`, `RecordNotFoundError`, `mapStorageError`, `withStorageErrors`.
    - `src/data/repositories/contracts.ts` — `Repositories` (prompts, revisions, folders, collections, templates, testCases, schemas, snippets, activity, settings, meta, `close`), `PromptQuery`, and the documented ordering rules.
    - `src/data/repositories/shared.ts` — row conversion (`toPromptRow`, `toRevisionRow`, …), stored-record validation, ordering comparators, `matchesPromptQuery`, `cloneRecord`.
    - `src/data/repositories/indexedDb.ts` — `createIndexedDbRepositories` over the typed `idb` connection with transactional writes, index-backed queries, and one documented cast site for the generic entity stores.
    - `src/data/adapters/inMemory.ts` — `createInMemoryRepositories(seed?)` with identical cloning, ordering, query, version, and error semantics.
    - `src/data/repositories/contract.ts` — `describeRepositoryContract(label, createRepositories)`, 25 shared cases used by both adapters.
    - `src/data/writeQueue.ts` — `createWriteQueue()` with per-key `run`, `isBusy`, `size`, `drain`, and failure-tolerant chaining.
    - `src/data/broadcast.ts` — `createWriteBroadcaster`, `isWriteAnnouncement`, `BROADCAST_CHANNEL_NAME`, no-op fallback when `BroadcastChannel` is unavailable.
    - `src/data/index.ts` — the only public surface for code outside the layer.
  - **Schema and migrations:** v1 creates the eleven stores from `tasks.md` §6.3; v2 adds `prompts.status`. Booleans are indexed through `0 | 1` mirrors because IndexedDB cannot index booleans. Migrations run inside the `versionchange` transaction, record the schema version in `meta` while preserving `seedVersion`, abort atomically on failure (the original error is captured and rethrown as `MigrationError('failed')`, not the platform `AbortError`), and a database from a newer build is refused with `MigrationError('newer-database')`.
  - **Write semantics:** `prompts.update` requires `expectedVersion === stored.version` and `version === expectedVersion + 1` inside one `readwrite` transaction; a stale base raises `StaleWriteError` and changes nothing, a bad counter raises `InvalidWriteError`. `delete` is idempotent, `create` on an existing id raises `DuplicateRecordError`, reads and writes clone via `structuredClone`, and malformed stored rows surface as `CorruptDataError`.
  - **Failure semantics:** every repository operation is wrapped in `withStorageErrors`; the mapping table (`QuotaExceededError`, `VersionError`, `DataError`/`DataCloneError`/`NotFoundError`, `ConstraintError`, `InvalidStateError`/`AbortError`/`UnknownError`) is covered exhaustively. `idb`'s cached `transaction.done` rejection is marked handled in the upgrade callback so an aborted migration produces no unhandled rejection.
  - **Module boundaries:** ESLint forbids React/UI imports inside `src/data/**` and forbids `@/data/repositories/*`, `@/data/adapters/*`, and `@/data/db/*` imports from anywhere outside it, so consumers must use `@/data`. Both rules were verified by temporarily adding violating files (ESLint rejected each) and removing them.
  - **Coverage configuration:** `vite.config.ts` now measures `src/domain/**` and `src/data/**` with per-glob floors — domain 90 % on all metrics; data 90 % statements / 82 % branches / 88 % functions / 92 % lines. Per-glob enforcement was proven by temporarily raising the data branch floor to 99 % (gate failed as expected) and reverting.
  - **Tests added (107 data cases, whole suite 353):** shared contract suite 25 cases in both adapters; `indexedDb.contract.test.ts` 37 (schema against `expectedIndexes()`, unique compound revision index, row conversion, reopening, quota injection, IndexedDB absence, corrupted rows, migration errors); `inMemory.contract.test.ts` 27 (contract + seeding + operations after `close()`); `migrations.test.ts` 12 (v0→v2, idempotency, v1→v2 data-preserving upgrade, `meta` preservation, atomic abort, newer database, incomplete schema); `errors.test.ts` 13; `writeQueue.test.ts` 7; `broadcast.test.ts` 11.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — 27 files / **353 tests passed**; `npm run test:run -- data` — 6 files / 107 tests passed; `npm run test:coverage` — 96.12 % statements, 91.55 % branches, 94.25 % functions, 97.20 % lines combined, data alone 94.54 / 84.88 / 92.25 / 96.34 (gate passes); `npm run format:check` clean; `npm run check:contrast` 52 pairings pass; `npm run build` exit 0 (CSS 43.08 kB → 11.30 kB gzip; JS 433.64 kB → 133.38 kB gzip).
  - **Documented deviation:** the validation step asks for a manual DevTools inspection of the created stores and indexes. No browser or headed environment exists in this workspace, so that inspection was **not** performed and is not claimed. The substitute is the automated assertion that a real (fake) database has exactly the stores and indexes in `expectedIndexes()` plus the unique compound index check; `docs/PERSISTENCE.md` §9 records the limitation and the exact manual procedure to run later.
  - **Docs:** new `docs/PERSISTENCE.md` (code map, schema table, migration strategy, repository contract, failure semantics, concurrency helpers, in-memory adapter, boundary rules, verification, known limitations, future server-backed path); ADR-33…ADR-40 in `docs/DECISIONS.md` with a TASK-006 verification log; `docs/ARCHITECTURE.md` and `README.md` updated for the new layer.
  - **Notes/limitations:** nothing seeds the database or wires repositories into a store yet (TASK-007); quota is injected at the object-store boundary rather than produced by a real full disk; blocked/terminated upgrades are wired but not faithfully simulable under `fake-indexeddb`; seed idempotency is covered only as "the `seedVersion` row survives reopen and upgrade" until seeding exists in TASK-007.
---

### TASK-007 — Seed data, application store, and first-run foundation

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-004, TASK-006
- **Objective:** Bootstrap the app's data lifecycle: seed a first-run dataset, expose typed stores with async actions, record activity, and handle storage-unavailable mode with honest messaging.
- **Scope:**
  - Seed module (`seedVersion` 1): default settings, an "Unfiled" concept, sample folders/collections, one welcome prompt explaining PromptForge and local storage, and 2 starter documents pending full template catalog (TASK-018).
  - Zustand stores: `dataStore` (prompts, folders, collections, schemas, snippets, templates, test cases, activity), `preferencesStore` (theme, density, indent, autosave settings), `uiStore` (panels, palette, selection); async actions calling repositories; loading/error state; activity recording on mutations.
  - Hydration/bootstrap component with skeleton states, error boundary, and ephemeral mode banner when IndexedDB is unavailable.
  - First-run flow data model only (onboarding flag), UI completed in TASK-010.
  - Selectors for library queries (memoized) and dashboard aggregates, tested independently of components.
- **Acceptance criteria:**
  - First run seeds exactly once; second load adds nothing; reseeding is version-gated.
  - Store actions persist through repositories and refresh in-memory state from the write result (no fake success).
  - Mutation activity events are written for create/update/archive/delete/snapshot.
  - Unavailable storage boots into a clearly labeled ephemeral mode with import/export still planned and no "saved" claims.
  - Error boundary displays a recovery screen with technical detail disclosure.
- **Validation:** Integration tests with fake-indexeddb: seed idempotency, create/update/delete through store, activity events, ephemeral-mode boot, error boundary render; typecheck/lint/tests/build.
- **Deliverables:** `src/data/db/seed.ts`, `src/store/dataStore.ts`, `preferencesStore.ts`, `uiStore.ts`, selectors, `src/app/DataBootstrap.tsx`, `src/app/ErrorBoundary.tsx`, ephemeral-mode banner, tests.
- **Out of scope:** App shell/navigation (TASK-008), dashboard UI, prompt creation dialogs, template catalog.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Modules delivered:**
    - `src/data/db/seed.ts` — `SEED_VERSION = 1`, fixed `SEED_IDS`, and `seedDatabase(repositories, dependencies)`. Seeds default settings, a "Getting started" folder, a "Starter kit" collection, a pinned welcome prompt explaining local storage, and two starter templates (structured extraction, review response). Version-gated by `meta.seedVersion`, idempotent per row through a `get`-then-`create` `ensure`, resumable after interruption, preserves existing settings and edits, writes the version last, writes no activity events.
    - `src/data/storage.ts` — `openStorage()` probes storage (open/write/read/delete), opens the durable adapter, and falls back to the in-memory adapter on any failure, returning `{ mode, repositories, notice }` with a plain-language notice that says nothing is being saved. Adapter choice stays inside the data layer (ADR-42).
    - `src/store/dataStore.ts` — Zustand store holding prompts, folders, collections, templates, test cases, schemas, snippets, activity, and settings plus `mode`/`status`/`error`/`busy`; `attach`/`hydrate` plus async actions `addPrompt`, `editPrompt`, `archivePrompt`, `unarchivePrompt`, `deletePrompt`, `snapshotPrompt`, `addFolder`, `addCollection`, `saveSettings`. Prompt edits read the current row, build the next version, and pass `expectedVersion`; state is always refreshed from the repository's return value; failures are stored and rethrown; activity is recorded for create/update/archive/delete/snapshot/settings.
    - `src/store/selectors.ts` — pure `selectLibrary`, `selectPromptById`, `selectCounts`, `selectTagCounts`, `selectDashboard`, and `createLibrarySelector()` with single-entry memoization keyed on array identity plus query.
    - `src/store/preferencesStore.ts` — theme (moved from the TASK-002 slice), density, indent size, autosave enabled/delay (clamped), reduced motion; `applySettings` and `toSettings` round-trip through the settings record. `src/store/preferences.ts` became a re-export so the theme provider and its tests keep their path.
    - `src/store/uiStore.ts` — sidebar, right panel, palette, selected prompt, and multi-selection; never persisted.
    - `src/app/dataBoot.ts` — `bootData()` orders open → attach → seed → hydrate → apply preferences, closes the connection when seeding fails, and returns the mode/notice/seed outcome.
    - `src/app/DataBootstrap.tsx` — skeleton loading state (`role="status"`, `aria-busy`), warning banner in ephemeral mode, boot retry, and a distinct "library could not be loaded" state for hydration failures. Wired into `src/app/App.tsx` inside the error boundary so the dev server exercises the real lifecycle.
    - `src/app/ErrorBoundary.tsx` — class boundary rendering a recovery screen with reload, retry, and a collapsed `Technical details` disclosure; logs locally only.
  - **First-run behaviour:** the seed runs once and only once (second boot reads `meta.seedVersion` and stops), is skipped entirely when a newer seed version is stored, recreates only missing rows after an interruption, and never overwrites a prompt or settings the user edited. Onboarding is data only (`Settings.onboardedAt`), as scoped.
  - **Ephemeral mode:** when IndexedDB is missing or cannot be opened, the app boots on the in-memory adapter, shows "Ephemeral mode — changes are not saved" with the reason above every screen, and never claims a save. Seeding and hydration still run, so the demo contains real data and real behaviour.
  - **Tests added (61 new cases; whole suite 419):** seed suite 7 (first run, second run, version gate, resume, settings preservation, edited row, durable idempotency via `fake-indexeddb`); storage selection 5; data store 17; selectors 11; preferences store 6; UI store 5; boot sequence 5; `DataBootstrap` 5; `ErrorBoundary` 5.
  - **Small corrections carried in this task:** the in-memory adapter's closed state now throws `StorageUnavailableError` (it previously threw the base `StorageError`, which made typed handling inconsistent); `dataStore`'s `run` wrapper now records the "storage not attached" failure on state instead of rejecting without a message; the design-gallery tests await the first render because the app root now boots asynchronously.
  - **Coverage configuration:** `vite.config.ts` measures `src/domain/**`, `src/data/**`, and now `src/store/**` with per-glob floors (store 90 % statements / 85 % branches / 90 % functions / 90 % lines). Measured: domain 98.69/96.65/100/98.58, data 94.78/84.65/93.27/96.44, store 96.20/92.89/96.62/96.64 — all gates pass.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings** (the module-boundary rule rejected the first draft of the new tests until they imported the in-memory adapter through `@/data`); `npm run test:run` — 36 files / **419 tests passed**, zero React `act` warnings; `npm run test:coverage` — all three floors pass; `npm run format:check` clean; `npm run build` exit 0; `npm run check:contrast` 52 pairings pass.
  - **Docs:** `docs/PERSISTENCE.md` gained storage-selection and seeding sections plus the updated test inventory; `docs/ARCHITECTURE.md` gained an "Application data lifecycle" section describing boot order, stores, selectors, and recovery; ADR-41…ADR-46 and a TASK-007 verification log in `docs/DECISIONS.md`; `README.md` describes first run and ephemeral mode.
  - **Notes/limitations:** the seeded library has no product surface yet because the design gallery is still the app root (TASK-008 introduces routing); onboarding is a flag only until TASK-010; the ephemeral banner cannot offer export until TASK-026; seeding is idempotent rather than atomic across stores (ADR-41).
---

### TASK-008 — Application shell, routing, and responsive navigation

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-004, TASK-007
- **Objective:** Build the navigable frame of the application with real routes, responsive navigation, breadcrumbs, and route-level loading/error handling.
- **Scope:**
  - Router (`createBrowserRouter` or `BrowserRouter` + `Routes`) with layout route: `/` (dashboard), `/library`, `/prompts/:promptId` (editor workspace shell), `/composer`, `/templates`, `/validation`, `/health`, `/settings`, `/design`, `*` (not found with recovery link).
  - Shell layout: left rail (collapsible, 240/64 px, drawer < 1024 px), top bar (breadcrumbs, global search trigger placeholder that opens palette in TASK-009 — must be visibly disabled or omitted until functional), save/status slot, theme toggle, keyboard hint.
  - Skip link, landmark structure, focus management on route change, scroll restoration, document title per route.
  - Settings route shell with theme/density/autosave fields wired to preferences store (only settings available now).
  - Not-found and route-error screens.
- **Acceptance criteria:**
  - Every declared route renders without runtime errors; unknown routes show the recovery screen.
  - Navigation state reflects the active route with `aria-current="page"`.
  - Drawer navigation traps/restores focus and closes on route change and Escape.
  - No horizontal overflow at 360 px; shell stays usable at 1920 px.
  - No placeholder control is rendered as if functional; unavailable actions are absent or explicitly disabled with explanation.
- **Validation:** Tests for route rendering, active nav state, not-found, theme persistence through navigation; manual keyboard-only navigation pass; 360/768/1024/1440 px screenshots; typecheck/lint/tests/build.
- **Deliverables:** `src/app/router.tsx`, `src/app/providers/AppProviders.tsx`, `src/components/layout/{Shell,Sidebar,Topbar,MobileNav,Breadcrumbs}.tsx`, route modules with skeleton content, `src/routes/not-found`, settings route, tests.
- **Out of scope:** Command palette implementation, dashboard content, library UI, editor implementation.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Routing:** `src/app/router.tsx` defines one layout route (`/` → `Shell`) with children for `/`, `/library`, `/prompts/:promptId`, `/composer`, `/templates`, `/validation`, `/health`, `/settings`, `/design`, and `*`. The recovery screen is the layout's `errorElement`, outside the shell, so it still renders if the shell throws. `createAppRouter()` returns a browser router; `<App router={…} />` accepts an injected router so tests use `createMemoryRouter` and never touch history.
  - **Shell and navigation:** `Shell` renders the skip link first, a single `main` landmark (`#main-content`), a 240/64 px collapsible rail visible at `lg` and above, a top bar with breadcrumbs, session status, theme toggle, and the mobile menu button, plus the drawer. One navigation model (`src/components/layout/navigation.ts`) drives the rail, the drawer, the breadcrumbs, and `document.title`; `NavLink` supplies `aria-current="page"`. Collapsed-rail labels stay available to assistive technology via `sr-only` plus `title`, and the collapsed state lives in `uiStore` for the session.
  - **Drawer:** built on the existing `Sheet` (`side="left"`, widened in this task), so focus moves in, Tab is trapped, Escape closes, and dismissal returns focus to the menu button. Choosing a destination closes the drawer without restoring focus, letting the new screen's `main` landmark win (new `Sheet.restoreFocusOnClose` prop, ADR-49).
  - **Route chrome:** `useRouteChrome` sets `<Screen> · PromptForge` per route, resets scroll, and focuses `main` on navigation but not on first render.
  - **Screens:** `/settings` is real — theme (dark/light/system), editor density, autosave enabled plus delay — applying immediately and writing through `preferencesStore.toSettings` + `dataStore.saveSettings`, with a status line that reports the outcome and says "session only" when storage is ephemeral. Every other route renders `RouteScaffold`, which names the screen, what it will do, and the task that will build it, and states that nothing on it reads or changes prompts. The design gallery moved to `/design` inside the shell (its own sticky header was removed).
  - **Honesty:** the command palette does not exist until TASK-009, so the top bar shows a visibly disabled Search button with a written explanation (`aria-describedby`) and no ⌘K hint. No scaffold renders a control that appears to work.
  - **Not-found and error screens:** `/…` unknown paths keep the shell and offer "Back to dashboard" and "Open the library"; `RouteErrorScreen` renders a standalone recovery page with reload, a dashboard link, and collapsed technical detail.
  - **Tests added (32 new cases; whole suite 451):** `src/app/router.test.tsx` 21 (every route, not-found recovery, `aria-current`, per-route titles, theme across navigation, skip link, no focus theft on load, focus after navigation, rail collapse persistence, prompt id, breadcrumb semantics, disabled search, storage wording, clean unmount), `src/components/layout/MobileNav.test.tsx` 7 (focus entry, Tab trap, Escape restore, close-button restore, close-on-navigate focus policy, parity with the rail, in-drawer keyboard and storage hints), `src/routes/settings/SettingsRoute.test.tsx` 4 (theme applies and persists, density persists, autosave disables the delay control, no invented save button). `src/test/renderApp.tsx` renders the real app through a memory router; `src/test/setup.ts` stubs `window.scrollTo` because jsdom's stub reports "not implemented".
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — 39 files / **451 tests passed**; `npm run format:check` clean; `npm run build` exit 0 (CSS 46.19 kB / 11.85 kB gzip, JS 592.35 kB / 183.12 kB gzip — Vite warns that the single chunk exceeds 500 kB, documented as a limitation); `npm run check:contrast` 52 pairings pass; dev server `GET /` returns HTTP 200.
  - **Not performed (stated honestly):** no browser binary or screenshot tool exists in this environment, so the requested 360/768/1024/1440 px captures and the manual keyboard-only pass were not executed. Responsive behaviour is covered by Tailwind breakpoints in code and DOM-level tests only, and the build is not route-split yet.
  - **Docs:** `docs/ARCHITECTURE.md` gained an "Application shell and routing" section (route table, navigation model, focus policy, settings, scaffolds) and updated status/contrast figures; `docs/DECISIONS.md` gained ADR-47…ADR-51, index rows for ADR-41…ADR-51, and a TASK-008 verification log with limitations; `README.md` and `tasks.md` updated.

---

### TASK-009 — Keyboard shortcut registry and command palette

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-008
- **Objective:** Provide a centralized shortcut system and a fast, keyboard-accessible command palette that later tasks extend without duplicated logic.
- **Scope:**
  - Shortcut registry: declarative command definitions (`id`, `title`, `group`, `keywords`, `shortcut`, `when`, `run`), global listener with platform-aware sequencing (`Mod+K`, `Mod+S`, `G then L` style optional), input-focus guards, and a `useCommand` hook.
  - Command palette: Radix Dialog + custom filtered list (fuzzy subsequence scoring), grouped results, recent commands, shortcut hints, empty state, screen-reader labels, full-screen sheet on mobile.
  - Initial commands limited to implemented behavior: navigate to each route, toggle theme, open/close palette, focus library search (when on library), go to design gallery in dev.
  - Help overlay listing all registered shortcuts (`?`).
  - Extensibility contract documented so TASK-012+ can register create/save/format/validate commands.
- **Acceptance criteria:**
  - `Mod+K` opens/closes the palette from any route; `Escape` closes; arrow keys and Enter select; focus returns to origin.
  - Commands never execute twice for one activation (guarded against duplicate keydown and double-click).
  - Palette only lists commands that currently work; disabled/unavailable commands are not shown.
  - Shortcuts are ignored while typing in inputs/editor except explicitly scoped ones.
  - All shortcuts visible in the help overlay, generated from the registry (single source of truth).
- **Validation:** Tests for registry dedupe, filtering, open/close, navigation command execution, typing guard; keyboard-only manual test; typecheck/lint/tests/build.
- **Deliverables:** `src/lib/commands/{registry,types,useCommand}.ts`, `src/components/command-palette/*`, `src/components/layout/ShortcutHelpDialog.tsx`, tests.
- **Out of scope:** Save/format/validate commands (added by owning tasks), search history.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Registry (`src/lib/commands/registry.ts`):** `createCommandRegistry()` stores declarative commands and validates each one eagerly — non-empty namespaced id, known group, parseable shortcut — throwing on a duplicate id or a shortcut already bound to another command. Batch registration rolls back on failure, unregistering is identity-safe (a stale disposer cannot remove a re-registered command), and `list()` returns a stable ordered snapshot plus a subscription for `useSyncExternalStore`. `ensureCoreCommands()` registers the current set once per session so a remount cannot duplicate it.
  - **Shortcuts (`src/lib/commands/shortcuts.ts`):** `Mod+K`, `Shift+?`, and two-step sequences such as `G L` are parsed once per definition and validated at registration. Matching is pure and platform-aware (`Mod` = ⌘ on Apple, Ctrl elsewhere; exact modifier state; Shift ignored only for punctuation that encodes it). The stateful matcher supports sequences, multiple commands sharing a first chord, a 1.5 s expiry, mismatch clearing, and single-chord precedence.
  - **Binding (`src/lib/commands/useCommand.ts`):** `useCommandEnvironment()` builds a context from live state (route, typing focus, palette/help state, theme, rail, dev build, platform), `useShortcutListener()` owns the single global keydown listener, `useCommands()` subscribes to the registry, and `useCommand(id)` runs a command with the current context (returning false for unknown or unavailable commands) for future toolbars.
  - **Guard rails:** the listener ignores auto-repeat, composed and consumed events, anything inside an overlay, everything while the palette or help is open, and — except `allowInInput` commands, currently only the palette's `Mod+K` — everything typed into an input, textarea, select, or contenteditable.
  - **Palette (`src/components/command-palette/CommandPalette.tsx`):** Radix dialog with a combobox search field, `role="listbox"` of grouped fuzzy-ranked options, `aria-activedescendant` navigation (focus never leaves the field), shortcut hints per row, a "Recent" group, a real empty state, a live command count, and full-screen behaviour below 640 px. Enter or a click runs the highlighted command after closing the palette, then focus returns to the opener. Duplicate activation is blocked by a per-open ref and the shared `commandRunner`'s in-flight set.
  - **Help (`src/components/layout/ShortcutHelpDialog.tsx`):** opens with `?` or the top-bar keyboard button and lists every available command that has a shortcut, grouped exactly as the palette groups them — generated from the registry, never hand-written.
  - **Initial commands only:** open palette (`Mod+K`), shortcut help (`?`), toggle theme (`Mod+Shift+L`), toggle rail (`Mod+B`), navigation to every real route (`G D`, `G L`, `G C`, `G T`, `G V`, `G H`, `G S`), and the design gallery in development builds. The top bar's disabled search placeholder from TASK-008 is replaced by the working palette trigger with a platform-aware key hint; a keyboard button opens the help overlay.
  - **Deviation, recorded deliberately:** the spec's "focus library search (when on library)" command is **not** registered, because the library has no search field until TASK-011 and the acceptance rule forbids listing a command that cannot do anything. TASK-011 registers it together with the field.
  - **Tests added (75 new cases; whole suite 526 across 46 files):** shortcuts 20 (parsing, platform/modifier matrix, punctuation Shift, display tokens, typing targets, sequences, shared prefixes, expiry, mismatch), registry 11 (duplicates, conflicts, validation, disposal, rollback, subscription, availability, runner guards), filter 11 (fuzzy scoring, ranking, availability, grouping, recents), core commands 10 (catalogue, no unimplemented commands, bindings, dev gate, delegation), `useCommand` 3, palette 14 (Mod+K open/close, focus, groups, filtering, arrows, Enter, Escape + focus return, empty state, double activation, recents, typing guard, sequences, theme toggle, auto-repeat), help 6 (generated list, registry additions, omissions, triggers, Escape, palette priority). `src/test/renderApp.tsx` now resets the UI and preference stores so singleton state cannot leak between tests, and `src/test/commandContext.ts` provides a complete context stub.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — **46 files / 526 tests passed**; `npm run format:check` clean; `npm run build` exit 0; `npm run check:contrast` 52 pairings pass; dev server `GET /` returns HTTP 200.
  - **Not performed (stated honestly):** the requested keyboard-only manual test was not run — this workspace has no browser or input device. Keyboard behaviour is covered by jsdom tests dispatching real key events; no screenshot or visual verification is claimed.
  - **Docs:** `docs/ARCHITECTURE.md` gained a "Commands and keyboard" section (registry contract, matching rules, dispatch guards, palette patterns, extensibility contract) and updated project structure; `docs/DECISIONS.md` gained ADR-52…ADR-55, index rows, and a TASK-009 verification log with limitations; `README.md` and `tasks.md` updated.

---

### TASK-010 — Dashboard with real library data

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-008, TASK-009
- **Objective:** Deliver the command-center dashboard using only real stored data, plus the skippable first-run experience.
- **Scope:**
  - Editorial header (greeting, date, library summary), primary actions (New prompt → composer route with blank doc; New from template → templates route), global search trigger opening palette.
  - Stat strip: total prompts, favorites, archived, collections, snapshots, invalid JSON documents (computed by parsing stored content) — each links to a filtered library view where possible.
  - Recently edited prompts (5, real), pinned prompts rail, favorites list, quick-start template previews (from seeded data until TASK-018 completes catalog), validation attention list with links.
  - Compact activity rail from `ActivityEvent` (last 8).
  - First-run panel: explains capabilities, local storage location/backup, offers starter template or blank prompt, "Skip" persists `onboardedAt`; unsaved-proof.
  - Empty states for first run and for empty sections.
- **Acceptance criteria:**
  - All displayed numbers derive from stored records at render time; no hard-coded counts.
  - Invalid-document count matches actual parse results; "valid JSON" is never equated with quality.
  - Every card/list item navigates to the correct route (editor shell, library filter, templates).
  - First-run panel appears only when `onboardedAt` is unset and can be dismissed permanently.
  - Dashboard renders correctly with zero prompts and with many prompts.
- **Validation:** Integration tests for aggregates (counts, recents, invalid docs, activity) using seeded repositories; first-run dismissal persistence; empty-state tests; visual checks both themes and 390/1440 px; typecheck/lint/tests/build.
- **Deliverables:** `src/routes/dashboard/*`, `src/components/dashboard/{StatStrip,RecentList,PinnedRail,AttentionList,ActivityRail,FirstRunPanel}.tsx`, dashboard selectors/tests.
- **Out of scope:** Health dashboard deep metrics (TASK-025), template catalog management (TASK-018), library interactions (TASK-011).

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Selector (`src/store/dashboard.ts`):** `selectDashboardData()` returns `counts` (total non-archived, active, favorites, archived, collections, snapshots, invalid documents, templates), `recent` (5), `pinned` (6), `favorites` (5), `templates` (3, built-ins first), `attention` (5), `activity` (8), and `isEmpty`, all derived in one pass from stored records. `findDocumentProblems()` runs `parseDocument()` over each stored `content` typed as `unknown` and keeps the first issue's path and message — the only definition of "invalid" in the build. `selectAttention()` lists broken documents first, then prompts idle for more than `STALE_AFTER_DAYS` (30), capped. `describeDashboardSummary()` writes the header sentence from the same counts object.
  - **Store (`src/store/dataStore.ts`):** new `revisions` slice — `hydrate()` fans out `revisions.listByPrompt()` per prompt (the contract has no list-all), sorts newest first; `snapshotPrompt()` prepends the saved revision and `deletePrompt()` drops a deleted prompt's revisions.
  - **Helpers:** `src/lib/dates.ts` (`formatLongDate`, `formatShortDate`, `formatDateTime`, `formatRelativeTime`, `greetingFor`, `toIsoDay`; locale pinned to `en-GB`, `now` injectable) and `src/lib/libraryLinks.ts` (the `?filter=` vocabulary, `libraryFilterHref`, `readLibraryFilter` with fallback to `all`).
  - **Components (`src/components/dashboard/`):** `StatStrip` (six tiles, each a link, wording and colour both change for parse failures), `RecentList` (plus the shared `PromptListSection`, `FavoritesList`, and `LibraryEmptyNotice`), `PinnedRail`, `AttentionList`, `ActivityRail`, `FirstRunPanel`, plus `DashboardSection` (labelled card shell with an optional real action), `PromptRow`, `TemplatePreview`, and `useDashboardData`.
  - **Route (`src/routes/dashboard/DashboardRoute.tsx`):** editorial header (greeting · long date, `h1` Dashboard, generated summary) with New prompt → `/composer`, From template → `/templates`, and Search opening the command palette with the platform key hint; first-run guide; stat strip; pinned rail; two-column recents/attention and favorites/activity; quick-start templates. Empty library gets an explicit "this library is empty" notice with both entry points.
  - **First run:** visible only while `settings.onboardedAt === null`. Dismissal merges the live preferences via `preferencesStore.toSettings()` and awaits `saveSettings()`; the panel disappears only after storage accepted the record, and a rejection keeps the panel and reports the failure in a `role="alert"` message.
  - **Store injection (`src/store/dataStoreContext.ts`, `src/app/providers/DataStoreProvider.tsx`):** screens now read the store provided by `DataBootstrap` (falling back to the singleton), which is what makes the required integration tests honest. `DataBootstrap` wraps its children in the provider.
  - **Library route honesty:** `LibraryRoute` reads the incoming `?filter=` and tells the user which view was requested, instead of silently ignoring a link the dashboard just produced.
  - **Tests added (46 new cases; whole suite 572 across 50 files):** `src/lib/dates.test.ts` 10 (formatting, relative buckets, future skew, greeting boundaries), `src/store/dashboard.test.ts` 16 (counts from records, empty and 250-prompt libraries, list caps and ordering, template order, activity cap, real parse failures, staleness, attention ordering, summary copy), `src/lib/libraryLinks.test.ts` 5 (filter round-trip, labels, fallbacks), `src/routes/dashboard/DashboardRoute.test.tsx` 15 (seeded in-memory repositories through the real shell → rendered numbers and hrefs, summary sentence, filter navigation, recents ordering and editor navigation, pinned/favorites separation, template previews, activity cap, broken-document reporting, empty states, first-run show/persist/re-hide across a fresh boot, failed dismissal, palette trigger). One existing router test was scoped to the top-bar trigger because the header now shows the same `Ctrl` hint.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — **50 files / 572 tests passed**; `npm run format:check` clean; `npm run check:contrast` 52 pairings pass; `npm run build` exit 0 — CSS 49.38 kB (12.33 kB gzip), JS 645.20 kB (197.38 kB gzip).
  - **Not performed (stated honestly):** the requested visual checks at 390 px and 1440 px in both themes — this workspace has no browser binary. Layout rests on wrapping grids, `min-w-0`, and `truncate`; the visual pass is scheduled for TASK-027/028.
  - **Deviations recorded:** extra dashboard modules (`DashboardSection`, `PromptRow`, `TemplatePreview`, `useDashboardData`), the `revisions` store slice, the store-context injection, and a `BadgeTone` type export from the UI barrel. Rationale and consequences are in ADR-56…ADR-60.
  - **Docs:** `docs/DECISIONS.md` gained ADR-56…ADR-60, five index rows, and a TASK-010 verification log with the test inventory, limitations, and deviations; `docs/ARCHITECTURE.md` gained a "Dashboard" section and an updated route table/project structure; `README.md` and `tasks.md` updated.

---

### TASK-011 — Prompt library browsing, search, filters, and views

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-008
- **Objective:** Make the prompt library a fast, legible place to discover work: search, filters, sorting, grid/list views, and organization navigation.
- **Scope:**
  - Library layout: folder tree sidebar section, collection chips, filter bar (search, tag multi-select, validation state, archived toggle, date-edited range), sort control (updated, created, name, usage stub-free), result count.
  - Grid (artifact cards: title, description, tags, validation pill, updated label, pin/favorite indicators) and list (dense rows with columns) views; persisted view preference; pinned section separated from main results.
  - Search across title, description, tags, and JSON content (case-insensitive, debounced, matched-field highlighting, no results empty state with clear-filters action).
  - URL-synced state for filters (`?q=&folder=&tag=&view=`), shareable within the app, back/forward-safe.
  - Selection model foundation (checkbox per card, selection count) used by TASK-013 bulk actions; open prompt → `/prompts/:id`.
  - Accessible keyboard flow through the list; archived prompts excluded unless toggled.
- **Acceptance criteria:**
  - Search/filter/sort produce correct, stable results, verified against fixture datasets (including 300+ prompts performance check).
  - Filters persist through navigation via URL; clearing filters restores full set; result count matches rendered items.
  - Grid and list views show identical data; both respect empty and loading states.
  - No layout overflow at 360 px; cards remain usable on touch.
  - Row/card actions are keyboard accessible; open action works with Enter.
- **Validation:** Unit tests for search/filter/sort selectors (multi-field, tags, dates, archived); integration test for URL sync and empty state; performance spot-check with 500 fixture prompts (no filter keystroke > 100 ms observed); accessibility keyboard pass; typecheck/lint/tests/build.
- **Deliverables:** `src/routes/library/*`, `src/components/library/{FilterBar,PromptGrid,PromptList,PromptCard,PromptRow,IngredientRail}.tsx`, `src/domain/search.ts`, tests.
- **Out of scope:** Create/edit/delete dialogs and folder/collection management (TASK-012), tags/favorites/pins/archive mutations and bulk operations (TASK-013), import/export (TASK-026).

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Search (`src/domain/search.ts`):** one pure module defines a match. `parseSearchQuery` lowercases, splits, and de-duplicates terms (ANDed across a prompt); the four fields (title, description, tags, serialized JSON document) are ORed per term. `matchPrompt` returns the matched fields plus a 96-character excerpt of the first JSON line that matched, so the UI can say *why*. `highlightSegments` builds literal, case-insensitive ranges (no regex from user input) and merges overlaps. Haystacks are cached in a `WeakMap` keyed on prompt identity, so typing never re-stringifies hundreds of documents.
  - **URL contract (`src/routes/library/libraryQuery.ts`):** `LibraryState` for `q`, `folder` (including `unfiled`), repeatable `tag`, `collection`, `status`, `validation`, `archived`, `favorites`, `snapshots`, `incollection`, `edited`, `sort`, `view`; `readLibraryState`/`writeLibraryState` round-trip, drop defaults, cap the query at 120 characters, and fall back on unknown values. The dashboard's `?filter=` shorthand is a base layer that explicit parameters override (ADR-61).
  - **Rail maths and preference:** `src/lib/folderTree.ts` (`buildFolderTree`, `flattenFolderTree`, `folderSubtreeIds`, cycle rejection via reachability) and `src/lib/viewPreference.ts` (validated `localStorage` grid/list preference, default grid).
  - **Selectors (`src/store/selectors.ts`):** `LibraryQuery` gained `folderIds` (subtree), `tags` (AND), `collectionIds`, `hasCollection`, `documentFilter` (parse state), `snapshotPromptIds`, and `updatedAfter`; `matchesSearch` was replaced by the shared `matchPrompt`, so counted results and highlighted results cannot diverge. `selectTagCounts` feeds the rail.
  - **Components (`src/components/library/`):** `PromptCard` (grid artifact card: status, parsability, pin/favorite markers, highlighted title/description, JSON excerpt, tags, relative edit time, sibling selection checkbox), `PromptRow` (dense list with the same facts), `PromptGrid`/`PromptList` (labelled lists with empty slots), `FilterBar` (debounced search, removable chips, clear-all, sort/status/validation/edited selects, archived and favorites toggles, live result count), `IngredientRail` (folder tree, collections, tag multi-select with archive-scoped counts), plus the shared `PromptBadges` and `HighlightedText`.
  - **Route (`src/routes/library/LibraryRoute.tsx`):** session-only local state is avoided entirely — filters come from `useSearchParams()`; typing replaces history, deliberate filters push. Renders a separated pinned section, result count parity, selection bar (count + clear, ready for TASK-013), loading skeletons with `aria-busy`, an error state with a retry that re-runs `hydrate()` and a collapsed technical detail, an empty-library state (composer + templates) distinct from a no-match state (clear filters).
  - **Command:** `library.focus-search` (`/`, group `Workspace`, only on `/library`) is registered with the field, closing the TASK-009 deviation; `focusLibrarySearch` is wired through `CommandContext` and `useCommandEnvironment`.
  - **Tests added (86 new cases; whole suite 658 across 55 files):** `src/domain/search.test.ts` 22 (parsing, per-field matches, AND semantics, excerpts and limit, merge/literal highlighting, 500-prompt timing and order), `src/routes/library/LibraryRoute.test.tsx` 25 (seeded in-memory repositories through the real shell: count parity, pinned separation, grid/list parity, parse-failure badge, debounce→URL→results, highlighting plus JSON excerpt, tag/folder/archive filtering, dashboard shorthand, back/forward, sorting, persisted view, both empty states, loading, failed read with recovery, selection, Enter-to-open, `/` shortcut, 500-prompt filter), `src/routes/library/libraryQuery.test.ts` 16, `src/store/selectors.test.ts` 9 new (folder subtree, tag AND, collection membership, parse-state, snapshots, edited window, combined filters, stability), `src/lib/folderTree.test.ts` 9, `src/lib/viewPreference.test.ts` 5.
  - **Validation executed:** `npm run typecheck` exit 0; `npm run lint` exit 0 with **0 warnings**; `npm run test:run` — **55 files / 658 tests passed**; `npm run format:check` clean; `npm run check:contrast` 52 pairings pass; `npm run build` exit 0 — CSS 50.52 kB (12.54 kB gzip), JS 678.65 kB (206.09 kB gzip).
  - **Not performed (stated honestly):** the visual pass at 360/390/1440 px in both themes and the manual keyboard walkthrough — no browser binary exists here. The keyboard checks are scripted in jsdom (`/` focuses search, Enter on a card opens `/prompts/:id`, checkbox order), and timings are jsdom measurements of the pure filtering pipeline (~9 ms cold / ~1.5 ms warm for 500 prompts), not paint times. Deferred to TASK-027/028.
  - **Deviations recorded:** added `src/lib/folderTree.ts`, `src/lib/viewPreference.ts`, `src/routes/library/libraryQuery.ts`, `src/lib/commands/librarySearchFocus.ts`, `src/components/library/{PromptBadges,HighlightedText}.tsx`, and `src/test/renderAppWithData.tsx` beyond the deliverables list; `PromptGrid`/`PromptList` gained a `label` prop for distinct accessible names; `RouteScaffold`'s unused `note` prop was removed now that library filters are real. Rationale and consequences are in ADR-61…ADR-64.
  - **Docs:** `docs/DECISIONS.md` gained ADR-61…ADR-64, four index rows, and a TASK-011 verification log with the test inventory, limitations, and deviations; `docs/ARCHITECTURE.md` gained a "Library" section and an updated route table; `README.md` and `tasks.md` updated.

---

### TASK-012 — Prompt CRUD, folders, and collections

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-011
- **Objective:** Enable the full lifecycle of prompts and organizational containers with safe, reversible operations.
- **Scope:**
  - Create prompt dialog (title, description, folder, collections, tags, template/blank choice) → creates stored document and navigates to editor; duplicate prompt with "(copy)" naming and fresh IDs.
  - Rename/metadata edit dialog (title, description, folder, collections, schema, status, tags); archive and delete with confirmation; delete removes revisions/test cases transactionally.
  - Folder management: create, rename, nest, move prompts, delete-folder-with-contents-to-parent; cycle/depth guards with inline errors.
  - Collection management: create, rename, description, delete (membership cleanup).
  - Activity + toast feedback on every mutation; palette commands for "New prompt" and "New folder"; empty states for no folders/collections.
  - First-run seed data remains consistent after container operations.
- **Acceptance criteria:**
  - Created prompts persist and appear immediately in library/dashboard aggregates.
  - Duplicate produces an independent copy (edits do not affect source) with activity recorded.
  - Deleting a folder moves prompts to the parent/root and never deletes prompts; cycle creation is rejected with an explanatory error.
  - Deleting a collection removes membership only.
  - Every destructive action requires confirmation and reports real success/failure; failed writes surface an error and leave state unchanged.
- **Validation:** Integration tests for create, duplicate independence, folder move/delete-into-parent, cycle rejection, collection delete cleanup, prompt delete cascade, failure path; manual keyboard dialogs; typecheck/lint/tests/build.
- **Deliverables:** `src/components/prompts/{PromptFormDialog,PromptActionsMenu,DeletePromptDialog}.tsx`, `src/features/organization/*` (folder/collection dialogs + logic), store actions, palette commands, tests.
- **Out of scope:** Favorites/pins/archive bulk (TASK-013), editor content editing (TASK-014), templates (TASK-018), import (TASK-026).

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Domain rules (`src/domain/`):** new `errors.ts` defines `RuleViolationError` with one message per field (`issueFor(path)`), so a rule can explain itself under the offending control instead of in a generic banner; `invariants.ts` gained `checkCollectionName` (library-global, case-insensitive) and `checkNewFolder` (sibling-scoped, explicit `parentId = null` default). The existing folder rules still own depth (5), cycles, and name trimming.
  - **Transactional delete:** `Repositories.prompts` gained `deleteCascade(id)`, implemented in IndexedDB with one `readwrite` transaction over `prompts`, `revisions`, and `testCases`, and in the in-memory adapter with an all-or-nothing check first. Prompt deletion therefore never leaves orphaned snapshots or test cases, and a failure leaves every row in place.
  - **Store (`src/store/dataStore.ts`):** `duplicatePrompt`, `movePrompt`, `addFolder`, `updateFolder`, `deleteFolder`, `addCollection`, `updateCollection`, `deleteCollection`; every write goes through `run()` + `writePrompt` (expected version), records activity, and re-hydrates only when a cascade touched other entities. `deleteFolder` returns `{ promptsMoved, foldersMoved }`, `deleteCollection` returns `{ promptsDetached }`, both derived from the rows actually written. Folder deletion re-parents child folders and prompts to the removed folder's parent, never to the root unless the folder was at the root.
  - **Query (`src/routes/library/libraryQuery.ts`):** `LIBRARY_DIALOGS = ['prompt','folder','collection']` with `?new=` parsing/round-tripping, so palette commands and deep links open the same dialog. Unknown dialog names are ignored rather than guessed.
  - **Organization module (`src/features/organization/`):** `organization.ts` holds the pure helpers the dialogs share — `folderOptions` (indented labels, excludes the edited folder and its subtree), `countFolderContents`/`countCollectionMembers`, `parentFolderLabel`/`folderLabel`, `ROOT_FOLDER_VALUE`, `folderMoveIssues`, `formatTagInput`/`parseTagInput`, `sortedCollections`. `FolderDialog` (create/rename/move), `CollectionDialog` (create/rename/description), and `DeleteContainerDialog` state where prompts go before anything is deleted.
  - **Dialogs (`src/components/prompts/`):** `PromptFormDialog` is metadata-only in both modes (create also offers template/blank), validates the title locally, surfaces rule messages under their fields, disables dismissal while saving, and never pretends to edit the document; `PromptActionsMenu` is a single dropdown whose items are `onEdit`, `onDuplicate`, `onToggleArchive` (label flips to "Restore"), `onDelete`; `DeletePromptDialog` names the prompt and itemises what else disappears (snapshots, test cases) before confirming.
  - **Route (`src/routes/library/LibraryRoute.tsx`):** now owns the whole lifecycle — create/edit submit, duplicate, archive/restore with an Undo toast, delete with confirmation, folder and collection create/edit/delete — and renders the eight dialogs at the end of the route. `update()` treats a dialog-only query patch as a replace so closing a dialog cannot spam history. Empty states open the create dialog instead of navigating, the header button is "New prompt", and every row/card receives the same `PromptActionHandlers` object.
  - **Rail (`src/components/library/IngredientRail.tsx`):** `+` buttons in the Folders and Collections headers, per-row `⋯` menus (`RailMenu`/`FolderMenu`/`CollectionMenu`) with explicit `aria-label`s, and real empty copy ("No folders yet…") that does not pretend filtering.
  - **Commands (`src/lib/commands/coreCommands.ts`):** `prompt.new` → `/library?new=prompt` and `folder.new` → `/library?new=folder`, both in `Workspace`. The deliberately unimplemented IDs asserted absent by `coreCommands.test.ts` (`prompt.create`, `prompt.save`, …) are untouched.
  - **Tests added (75 new cases; whole suite 733 across 57 files):** `src/domain/errors.test.ts` 5, `src/domain/invariants.test.ts` +3 (collection names, new-folder defaults), `src/domain/search.test.ts` +1 (500-prompt keystroke budget), `src/data/**` contract suites +13 (`deleteCascade` success, missing id, cascade atomicity), `src/store/dataStore.test.ts` +15 (duplicate independence and naming, folder create/rename/move/delete with prompts and subfolders, collection CRUD, failure paths), `src/features/organization/organization.test.ts` 17 (new file), `src/routes/library/libraryQuery.test.ts` +2 (dialog round-trip, unknown dialog), `src/routes/library/LibraryRoute.test.tsx` +18 (create from template → editor, missing-title error, edit details, duplicate card, archive + Undo, delete cascade with counts, failed delete keeps data, folder create + duplicate-name error, folder rename/re-parent, cycle-safe parent list, folder delete moves prompt to parent, failed folder delete, collection delete clears membership only, collection create, `?new=folder` and `?new=prompt`, 320-prompt search, Enter-to-open), `src/lib/commands/coreCommands.test.ts` +1 (create commands).
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0; `npx vitest run` — **57 files / 733 tests passed**; `prettier --check "src/**/*.{ts,tsx,css}"` clean; `npm run check:contrast` — 52 pairings pass in both themes; `npm run build` exit 0 — CSS 51.10 kB (12.60 kB gzip), JS 707.54 kB (213.11 kB gzip), same accepted >500 kB advisory as TASK-011.
  - **Not performed (stated honestly):** no browser binary exists here, so no visual pass at 360/390/1440 px and no manual pointer/keyboard walkthrough; keyboard behaviour and layout classes are covered by scripted jsdom tests and code review only. Dialog composition at very small widths is reasoned from the `w-[calc(100vw-2rem)]` dialog shell rather than observed.
  - **Deviations recorded:** added `src/domain/errors.ts` (a domain module, so the purity guard's module list was extended), a `ResizeObserver` no-op in `src/test/setup.ts` (Radix's checkbox input measures itself; jsdom has none), and reused `ConfirmDialog` rather than adding a second confirmation primitive. Grammar in the container-delete copy was corrected to agree with counts ("1 prompt moves", "1 prompt keeps its place"). Rationale in ADR-65…ADR-68.
  - **Docs:** `docs/DECISIONS.md` gained ADR-65…ADR-68 and a TASK-012 verification log; `docs/ARCHITECTURE.md` gained an "Organization and prompt lifecycle" section and an updated route note; `README.md` and `tasks.md` updated.

---

### TASK-013 — Tags, favorites, pins, archive, and bulk actions

- **Status:** Completed
- **Priority:** Medium
- **Dependencies:** TASK-012
- **Objective:** Complete library organization and multi-select operations with undo for reversible bulk changes.
- **Scope:**
  - Favorites and pins: toggle from card/row and detail view with immediate optimistic-safe feedback (write-through, rollback on failure); pinned section ordering (pin recency or title).
  - Archive: archive/unarchive single and bulk; archived view toggle in library with its own empty state; archived prompts excluded from dashboard "recent" and health "active" counts.
  - Tag management: tag input with suggestions from existing tags, normalization (trim, lowercase display rules, dedupe), tag rename/delete across library (with confirmation and count preview).
  - Bulk selection: select all filtered, shift-click range, sticky bulk bar (favorite, unfavorite, tag, archive, restore, delete with undo); selection clears on navigation; keyboard operable.
  - Undo implementation: reversible bulk ops executed against stored snapshots of affected IDs; toast action restores prior state and verifies write success.
  - Palette commands: toggle favorite for current prompt, archive selection filters.
- **Acceptance criteria:**
  - Toggles persist across reload and reflect in all views (library/dashboard/detail).
  - Bulk actions affect exactly the selected records; toast reports actual counts; undo restores prior state or surfaces an error if restore fails.
  - Tag rename updates all referencing prompts transactionally and reports the affected count.
  - Selection state is visible, announced, and never implicitly applied to hidden/filtered-out items (select-all applies to current filter, with count stated).
  - Archived prompts remain accessible and restorable.
- **Validation:** Integration tests for favorite/pin/archive persistence, bulk archive + undo, tag rename propagation, select-all-scope behavior; failure-path test for undo; keyboard-only bulk pass; typecheck/lint/tests/build.
- **Deliverables:** tag/favorite/pin/archive components, selection store slice, bulk action bar, tag management dialogs, undo helpers, tests.
- **Out of scope:** Editor content authoring (TASK-014), permanent tag analytics, import/export.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Domain (`src/domain/`):** `invariants.ts` gained `TagEdit`/`applyTagEdit` (removals applied first and winning over additions, additions normalized and de-duplicated) plus `normalizeTag`/`normalizeTags`, the single definition of how a tag is spelled. No tag rule lives in a component.
  - **Repository contract (`src/data/`):** bulk semantics were lifted out of the store, where they were a per-row loop that could half-apply. `Repositories.prompts` now declares `updateMany(writes)` and `deleteManyCascade(ids)`; the IndexedDB adapter runs each as one `readwrite` transaction that aborts on the first stale, missing, or version-invalid write, and the in-memory adapter validates the whole batch before touching its maps. Both adapters' shared contract suites prove identical behaviour (TASK-013 review question: *is bulk adapter-level?* — yes, and the contract now covers it).
  - **Store (`src/store/dataStore.ts`):** `toggleFavorite`, `togglePin`, `setFavorite`, `setPinned`, `setArchived`, `editTags`, `restorePrompts`, `renameTag`, `deleteTag`, `deletePrompts`, `restoreDeletedPrompts`, all composed over one `bulkWrite()` helper (write → `updateMany` → re-read storage → adopt what came back). `renameTag` renames in place and de-duplicates, so tag order survives a rename and merging two tags collapses instead of repeating. `hydrate` keeps `status: 'ready'` on a re-sync so a bulk write cannot blank the screen to a skeleton mid-interaction.
  - **Selectors (`src/store/selectors.ts`, `src/store/dashboard.ts`):** `sortPinnedByTitle` (title A→Z, then id) and `selectTagCounts` for the tag census; archived rows are excluded from every dashboard count, from recents/pinned/favorites, and from the attention list (`selectDashboardData` filters them before computing anything, and `selectCounts` subtracts them from the status totals).
  - **Bulk helpers (`src/features/bulk/bulkActions.ts`):** pure `rangeIds` (Shift-click range over the rendered order), `tagCensus`, `countPrompts`, `isEmptyTagEdit` — no React, no store.
  - **Components:** `BulkActionBar` (sticky, `role="region"` labelled "Bulk actions", live count, states the filter scope when the selection came from `Select all shown`, favorite/unfavorite/tag/archive/restore/delete/clear), `SelectionCheckbox` (per-row checkbox with Shift range and an `aria-label` naming the prompt), `BulkTagDialog` (add/remove tags on a selection, suggestions from the census), `TagManagerDialog` (rename/remove a tag across the library, with the affected prompt count shown before either action and a confirmation for removal), `PromptSummaryCard` (the editor's metadata header with favorite/pin/archive). `PromptCard`/`PromptRow`/`PromptGrid`/`PromptList` thread the checkbox, handlers, and pinned ordering; `PromptActionsMenu` gained favorite and pin; `PromptFormDialog` suggests existing tags; `IngredientRail` gained `Manage tags`.
  - **Editor route (`src/routes/editor/EditorRoute.tsx`):** real loading skeleton, error and missing-prompt empty states, `PromptSummaryCard`, favorite/pin/archive handlers with write-through toasts (archive offers Undo) and a palette toggle registered while mounted. Content authoring remains TASK-014.
  - **Library route (`src/routes/library/LibraryRoute.tsx`):** selection as route-owned state (cleared by any filter, sort, scope, folder, or search change), bulk run/undo wiring, the tag manager and bulk-tag dialogs, and an archive empty state with `Back to the library`. Toasts report returned rows (`2 prompts updated`), failures keep the selection and say `That change was not saved`, and failed undo says `That change could not be undone` rather than claiming success.
  - **Commands (`src/lib/commands/`):** `CommandContext.togglePromptFavorite`, an injectable `registerPromptFavoriteToggle`/`togglePromptFavorite` pair (`promptActions.ts`), and palette commands `prompt.toggle-favorite` (editor only), `library.favorites`, `library.archived`.
  - **Tests added (58 new cases; whole suite 791 across 59 files):** `src/data/**` contract suites +10 (`updateMany` writes a batch, applies nothing when one write is stale, rejects a missing prompt, accepts an empty batch; `deleteManyCascade` removes prompts with revisions and test cases and is idempotent — proven in both adapters), `src/store/dataStore.test.ts` +14 (favorite/pin persistence, bulk favorite/archive/tag/delete with snapshots, `renameTag`/`deleteTag` counts, undo restoring only reversible fields, all-or-nothing bulk write, failed undo and failed delete-restore leave storage unchanged), `src/routes/library/LibraryRoute.test.tsx` +17 (menu favorite/pin/archive, archive scope + empty state + bulk restore, bulk favorite/archive/delete with Undo, select-all scope under `?tag=finance`, Shift range and clearing on filter change, bulk tag dialog, failed bulk write, failed undo, failed delete-restore, keyboard-only bulk favorite), `src/domain/invariants.test.ts` +3 (`applyTagEdit`), `src/store/selectors.test.ts` +2 (`sortPinnedByTitle`), `src/lib/commands/coreCommands.test.ts` +2 (new palette commands), new `src/features/bulk/bulkActions.test.ts` (6), new `src/routes/editor/EditorRoute.test.tsx` (4).
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **59 files / 791 tests passed, 0 failures**; `npx prettier --check "src/**/*.{ts,tsx,css}"` clean; `npm run check:contrast` — 52 pairings pass in both themes; `npm run build` exit 0 — CSS 51.21 kB (12.65 kB gzip), JS 733.01 kB (218.78 kB gzip), same accepted >500 kB advisory as TASK-012. `npx vitest run --coverage` also passed its `src/domain`, `src/data`, and `src/store` thresholds.
  - **Not performed (stated honestly):** no browser binary exists in this environment, so there was no visual pass at 360/390/1440 px, no pointer-driven layout inspection, and no manual keyboard walkthrough. Keyboard paths — including a keyboard-only bulk favorite tabbed from the search field to a checkbox and then to the bar — are covered by scripted jsdom tests and code review only. No screenshot is claimed.
  - **Deviations recorded:** `updateMany`/`deleteManyCascade` were added to the repository contract rather than leaving bulk composition in the store alone (ADR-70); the store's `hydrate` no longer resets `status` to `loading` on re-sync, because a bulk write re-reads storage and would otherwise blank the library mid-selection; bulk delete's Undo restores from an in-memory snapshot and is deliberately not persisted across reloads (the confirmation copy says so); `sortPinnedByTitle` was added instead of reusing the updated-desc sort, because the task allowed pin recency *or* title and title ordering is stable across favorite/pin toggles.
  - **Docs:** `docs/DECISIONS.md` gained ADR-69…ADR-72 and a TASK-013 verification log; `docs/ARCHITECTURE.md` gained a "Favorites, pins, archive, and bulk actions" section plus updated library/persistence notes; `README.md` and `tasks.md` updated.

---

### TASK-014 — JSON editor workspace (raw and tree views)

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-012
- **Objective:** Deliver a professional JSON editing environment with syntax awareness, precise error locations, dual raw/tree views, and durable draft handling independent of persistence.
- **Scope:**
  - Editor route layout `/prompts/:promptId`: header (title, metadata summary, breadcrumb, actions), tab strip (Raw JSON; Tree view; Preview placeholder deferred to TASK-021 with explicit "coming in a later task" absence — do not render fake tabs), right inspector scaffold (collapsible, used by validation in TASK-016).
  - CodeMirror 6 host: JSON language, line numbers, bracket matching, fold gutter, active line, selection, monospace tokens from theme, indent from preferences, large-document guard, current line/column in status bar.
  - Actions: Format (2/4 spaces from preference), Minify, Copy all, Download not yet (TASK-026), Undo/Redo (CodeMirror history), find (`Mod+F`) with replace, jump to error.
  - Parse validation: debounced `JSON.parse` + error extraction (`line`, `column`, message); status pill (Valid JSON / Syntax error); error panel with clickable line targets; content preserved on errors.
  - Tree view: read-only collapsible tree from parsed JSON with keyboard navigation (`role="tree"`), values typed and labeled, copy-path action, and clear fallback message for invalid JSON.
  - Draft management: local draft state, dirty indicator, in-app navigation guard (dialog) and `beforeunload`; recovery draft persisted to `localStorage` (saving to DB is TASK-015); explicit "not yet saved" honesty.
  - Shortcuts registered: `Mod+S` (deferred save handler stub? No — TASK-015 adds save; until then `Mod+S` must not pretend to save. Omit save binding here).
- **Acceptance criteria:**
  - Editing, formatting, folding, find/replace, copy, and undo/redo work; formatting is idempotent.
  - Syntax errors show accurate 1-based line/column, clicking focuses the line; error state never clears user content.
  - Tree view reflects the parsed document and is fully keyboard operable; invalid JSON shows guidance instead of a broken tree.
  - Dirty state is accurate; navigation away prompts; no save success is claimed anywhere in this task.
  - Editor is usable at 360 px (toolbar condenses, inspector becomes sheet) with no page-level horizontal scroll.
- **Validation:** Unit tests for parse-error extraction and formatting; component tests for tree navigation and error-focus behavior; CodeMirror integration test (typing + parse debounce using fake timers); manual keyboard pass incl. `Mod+F`; typecheck/lint/tests/build.
- **Deliverables:** `src/routes/editor/*`, `src/components/editor/{JsonEditor,EditorToolbar,TreeView,JsonErrorPanel,EditorStatusBar}.tsx`, `src/domain/jsonText.ts`, draft hooks, tests.
- **Out of scope:** Actual persistence/autosave (TASK-015), schema validation (TASK-016), composer (TASK-017), variables preview (TASK-021), import/export.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Domain (`src/domain/`):** new `jsonText.ts` holds `scanJson` — a recursive-descent parser that reports `{ message, line, column, offset }` — plus `formatJsonText`/`minifyJsonText` (idempotent, key order preserved), `lineColumnAt`/`offsetAtLineColumn`, `jsonTextStats`, `isLargeJsonText`, and the `MAX_JSON_DEPTH`/`LARGE_DOCUMENT_CHARS`/`PARSE_DEBOUNCE_MS` constants. `JSON.parse` alone was rejected as the oracle: its message carries a character offset or a snippet depending on length, and its token can be the character after the mistake (ADR-73), so the domain now owns the location as well as the rules. New `jsonTree.ts` builds the read-only tree model, flattens visible rows, formats paths (`$.a[0]`, `$['a b']`), and resolves arrow-key movement as a pure function. Both modules are exported from the barrel and listed in the purity guard.
  - **Editor (`src/components/editor/`):** `JsonEditor` (CodeMirror 6 with JSON language, line numbers, fold gutter, bracket matching, active line, `Mod-F` search/replace, caret reporting, and an imperative `jumpToOffset`/`selectAll`/`openSearch`/`undo`/`redo` handle), `editorTheme.ts` (chrome and JSON token colors through `--pf-editor-*` variables), `EditorToolbar` (Format, Minify, Undo/Redo, Find, Copy all, Jump to error — disabled rather than hidden when the text does not parse), `TreeView` (`role="tree"` with `aria-activedescendant`, arrow keys, expansion, typed summaries, copy-path), `JsonErrorPanel` (`role="alert"`, exact location, "Go to line N"), `EditorStatusBar` (caret, counts, indent, `Valid JSON`/`Checking…`/`Syntax error` badge — never color-only), and `EditorInspector` (real structure facts plus an explicit "validation is TASK-016" note).
  - **Drafts (`src/features/editor/`):** `useDocumentDraft` owns the text, debounces the parse (longer for large documents), mirrors dirty text to `localStorage` after 300 ms, clears the copy when clean, installs `beforeunload`, and surfaces a recovery draft for restore/discard. `draftStorage.ts` is namespaced, size-capped, defensively parsed, and fail-soft. Nothing writes to the database, and the status bar, footer, and summary card all say the text is a draft (ADR-76).
  - **Route (`src/routes/editor/EditorRoute.tsx`):** breadcrumb ("Prompt location"), the existing metadata header with favorite/pin/archive, a Raw/Tree tab strip (no fake Preview tab), the lazily imported editor behind a skeleton, the error panel, status bar, collapsible inspector, a recovery banner, and a `useBlocker` dialog for in-app navigation ("Leave with unsaved changes?"). The palette's favorite command still registers here while the workspace is mounted.
  - **Preferences and theming:** indent width comes from the saved preference; six new editor tokens per theme were added to `tokens.css` and six new pairings to `scripts/check-contrast.mjs`, which is now 64 pairings (ADR-74).
  - **Tests added (71 new cases; whole suite 862 across 63 files):** `src/domain/jsonText.test.ts` 33, `src/domain/jsonTree.test.ts` 19, `src/features/editor/draftStorage.test.ts` 7, `src/components/editor/JsonEditor.test.tsx` 4 (real CodeMirror mount, a real transaction, caret jump, select-all), `src/routes/editor/EditorRoute.test.tsx` +8 (stored document, typed syntax error with location and jump, format/minify idempotence, tree keyboard navigation, invalid-tree guidance, leave guard, clipboard copy, recovery draft without a database write).
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **63 files / 862 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (`src/domain` branches 90.48 %); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 53.21 kB (13.10 kB gzip), app JS 760.90 kB (227.29 kB gzip) with CodeMirror split into a lazy `JsonEditor` chunk of 427.59 kB (138.55 kB gzip).
  - **Not performed (stated honestly):** no browser binary exists in this environment, so there was no visual pass at 360/390/1440 px, no pointer-driven layout inspection, and no manual keyboard walkthrough (including `Mod-F` on a real keyboard). Keyboard behavior is covered by jsdom tests against real CodeMirror instances and by review; no screenshot is claimed. jsdom has no layout, so the test setup returns empty rects from `Range` measurement — test-only infrastructure.
  - **Deviations recorded:** installed the dependencies the plan already named for this task (`@uiw/react-codemirror`, `@codemirror/lang-json`, plus the `@codemirror/*` packages and `@lezer/highlight` the host configures directly); the domain barrel/purity list grew by two modules; the route's breadcrumb landmark is named "Prompt location" so it does not duplicate the shell's "Breadcrumb"; the toolbar disables only on a known error, not while a parse is pending (rewrites re-scan the text); the canonical baseline text is 2-space formatted so an indent-preference change never rewrites the draft's baseline; switching to the tree tab unmounts CodeMirror and therefore resets its undo history for the tab (the text and recovery copy survive).
  - **Docs:** `docs/DECISIONS.md` gained ADR-73…ADR-77 and a TASK-014 verification log; `docs/ARCHITECTURE.md` gained a "JSON editor workspace" section plus a drafts note; `README.md` and `tasks.md` updated.

---

### TASK-015 — Save pipeline, autosave, and recovery

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-014
- **Objective:** Make edits durable and honest: a single serialized save pipeline with debounced autosave, explicit save, stale-write protection, recovery drafts, and a truthful save-status indicator.
- **Scope:**
  - `useSavePipeline` hook: draft source of truth, dirty tracking, serialized queue, debounce (settings-configurable), explicit `Mod+S` save, manual snapshot command (delegates revision creation to TASK-019 via a service interface with a no-op until then), retry on failure, and last-saved timestamp.
  - Save-status component with states and accessible announcements (saving/saved/error with retry), never showing "saved" before the transaction resolves.
  - Version-based stale-write detection with conflict dialog: "Reload stored version", "Keep my draft as new content" (writes with fresh version after explicit confirmation), "View stored version"—no silent overwrite.
  - Recovery: dirty drafts mirrored to `localStorage` with debounce; on editor open, detect a newer recovery draft than the stored record and offer restore/discard with a diff hint; recovery cleared only after successful persistence.
  - Navigation guards (already stubbed in TASK-014) upgraded to use save pipeline; `BroadcastChannel` writes notify other tabs; conflict notice in editor.
  - Ephemeral mode: saving is disabled with explicit banner and recovery drafts still active.
  - Settings: autosave toggle/delay, saved via preferences.
- **Acceptance criteria:**
  - Autosave persists content after the debounce, updates `updatedAt`, and increments `version`; explicit save also persists and enables snapshot creation.
  - Save failures leave the draft intact, show error + retry, and never claim success; recovery draft survives reload.
  - Simulated concurrent write triggers stale-write handling; user choice is honored and persisted.
  - Rapid sequential edits produce exactly one ordered write per prompt with no interleaving loss (verified by test).
  - Multi-tab notice appears without destroying in-progress work.
- **Validation:** Integration tests with fake-indexeddb: autosave debounce, failure/retry, stale-write conflict outcomes, recovery draft restore/discard, rapid-edit queue ordering, ephemeral mode; manual reload recovery test in browser; typecheck/lint/tests/build.
- **Deliverables:** `src/features/save/useSavePipeline.ts`, `SaveStatus.tsx`, conflict dialog, recovery storage module, settings fields, tests, `docs/PERSISTENCE.md` update.
- **Out of scope:** Revision history UI (TASK-019), schema validation, import/export.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Pipeline (`src/features/save/useSavePipeline.ts`):** the draft's single owner of persistence. It wraps `useDocumentDraft` (which keeps the text, the debounced parse, stats, and the large-document guard) with a persisted baseline `{ text, version, updatedAt }`, so "dirty" means "the text differs from what storage confirmed" rather than "differs from a prop". Saving validates the latest text (`scanJson` + `validatePromptDocument`) and writes through the existing `createWriteQueue` per prompt, re-reading the text *inside* the queued task so a fast edit is never left behind. Autosave is a debounce over the autosave preferences; `Mod+S`/`Ctrl+S` writes immediately; a second save while one is in flight coalesces onto it; a failure keeps the draft, records the text that failed (so the timer does not hammer the same rejected document), and exposes `retry`. The status is derived, not stored: `disabled | conflict | saving | error | dirty | saved | clean`, and `saved` is only reachable after the write promise resolved.
  - **Stale writes (`src/store/dataStore.ts`):** `editPrompt` gained an optional `{ expectedVersion }` guard and now passes it to `PromptRepository.update`, so a write based on a version that storage no longer holds fails with `StaleWriteError` instead of last-writer-wins. `readStoredPrompt(id)` was added to read one record straight from storage without touching state — the conflict dialog needs what is *stored now* while the editor still holds the draft. Nothing else in the store changed shape.
  - **Conflicts (`src/components/editor/SaveConflictDialog.tsx`):** three explicit outcomes, no timeout and no silent overwrite: *Reload the stored version* (reads storage, replaces the draft, clears the recovery copy), *Keep my draft as new content* (writes the draft on top of the fresh version, explicitly labelled as replacing the other write), and *View the stored version* (an in-dialog, keyboard-scrollable preview read through `readStoredPrompt`). Version numbers for both sides are shown in words.
  - **Recovery (`src/features/save/recoveryStorage.ts`):** a semantic layer over the TASK-014 `draftStorage` helpers. Drafts now record `baseVersion` alongside `baseUpdatedAt`; a candidate is offered only when its text differs from the stored text, carries a `describeLineDifference` hint (first differing line plus added/removed counts, from the new `src/domain/textDiff.ts`), and is flagged `basedOnOlderVersion` when it was typed over another version. The pipeline mirrors dirty text after a 400 ms debounce and clears the copy **only** after a confirmed write (or an explicit discard), so a failed save leaves the safety net in place.
  - **Cross-tab (`src/features/save/saveBus.ts`):** one lazily created write queue and one `WriteBroadcaster` shared by every editor mount, both injectable for tests. A confirmed write is announced; an announcement for the same prompt at a higher version raises a passive "saved in another tab" banner with *Review both versions* (opens the conflict dialog) and *Keep editing* — the draft is never replaced by a message from another tab. Store-side content changes are handled separately: a metadata-only version bump is adopted silently, a content change with no local edits is adopted, and a content change over a dirty draft becomes the same passive notice.
  - **Status UI (`src/components/editor/SaveStatus.tsx`):** a `role="status"` `aria-live="polite"` region with an icon and words for every state, the last-saved time, the failure message and detail, a Retry button on error, and an explicit *Save now* button with a `⌘S` hint. `EditorStatusBar`'s placeholder line became "Unsaved changes — this text is not in storage yet."; the route's "saving arrives in TASK-015" footer is gone.
  - **Ephemeral mode:** `state: 'disabled'`, a banner in the editor ("Ephemeral mode — saving is disabled"), a Save button that is genuinely disabled, and recovery drafts that still work (the acceptance criterion).
  - **Settings:** the autosave toggle and delay already existed in `SettingsRoute` and in the preferences store; TASK-015 makes them real — the editor's autosave reads `autosaveEnabled`/`autosaveDelayMs` live, and the status line says when autosave is off.
  - **Snapshots:** `snapshot(label)` is exposed behind a `SnapshotService` interface (default: the store's existing `snapshotPrompt`) and is only permitted when the draft is clean (`canSnapshot`), so TASK-019 can swap in richer revision creation without changing the editor.
  - **Tests added (48 new cases; whole suite 910 across 68 files):** `src/features/save/useSavePipeline.test.tsx` 16 (autosave debounce and version/updatedAt bump, autosave-off, `Mod+S`, snapshot enablement, rapid edits collapsing to one ordered write, sequential saves staying in order, invalid JSON and invalid-document refusal, failure/retry with the recovery copy intact, stale-write conflict with both outcomes, recovery mirroring/restore/discard/clearing, ephemeral mode, broadcast announce + remote notice), `src/features/save/savePipeline.indexedDb.test.tsx` 2 (a confirmed write reopened from a second real IndexedDB connection; a refused write leaving no version bump and no content change), `src/features/save/recoveryStorage.test.ts` 9, `src/components/editor/SaveStatus.test.tsx` 7, `src/domain/textDiff.test.ts` 9, `src/routes/editor/EditorRoute.test.tsx` +5 (ephemeral saving-off copy, `Mod+S` save, autosave, conflict keep-draft, conflict reload, recovery hint — the two TASK-014 placeholder assertions were replaced). Existing `useDocumentDraft` and route tests keep their behavior through two new opt-out flags (`manageRecovery`, `resetOnSavedChange`) whose defaults preserve TASK-014 semantics.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **68 files / 910 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (`src/domain` 98.02/93.96/100/98.05, `src/data` 96.51/87.03/100/97.22, `src/store` 95.71/90.16/96.8/97.21; `dataStore.ts` 94.82/82.58/97.26/97.41); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 53.89 kB (13.18 kB gzip), app JS 779.30 kB (232.69 kB gzip), lazy `JsonEditor` chunk unchanged at 427.59 kB (138.55 kB gzip), same accepted >500 kB advisory.
  - **Not performed (stated honestly):** the task's "manual reload recovery test in browser" was **not** performed — this environment has no browser binary, so no manual reload, no visual pass, and no screenshot is claimed. Reload recovery is covered by scripted tests that unmount and remount the pipeline against the same storage (jsdom + a `localStorage` stand-in) and by the IndexedDB reopen test.
  - **Deviations recorded:** `editPrompt` gained an optional expected-version guard and the store gained `readStoredPrompt` (ADR-78); recovery drafts are owned by the pipeline, not `useDocumentDraft`, so there is exactly one writer (ADR-80); the conflict dialog reads storage directly rather than hydrating first, because hydrating would replace the very draft the dialog is protecting (ADR-79); the "already saved" fast path avoids bumping a version for an empty `Mod+S`; the `SnapshotService` default is the store's real `snapshotPrompt` rather than a no-op — TASK-019 replaces the presentation, not the write.
  - **Docs:** `docs/DECISIONS.md` gained ADR-78…ADR-82 and a TASK-015 verification log; `docs/PERSISTENCE.md` gained a save-pipeline section (what is written, when, by whom, and what a recovery draft is not); `docs/ARCHITECTURE.md` gained a "Saving and recovery (TASK-015)" section; `README.md` and `tasks.md` updated.

---

### TASK-016 — Validation engine and validation studio

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-015
- **Objective:** Provide reliable syntax + optional JSON Schema validation with reusable schemas, distinguishable error classes, and an entirely honest scope statement.
- **Scope:**
  - Validation engine (`src/domain/validation.ts`): syntax analysis (shared with editor), JSON Schema validation via Ajv with formats, compile caching, error normalization to `{ kind: 'syntax' | 'schema' | 'document', path, jsonPointer, message, params, severity }`, schema timeout/size guards, safe handling of invalid schemas (schema error vs document error).
  - Document-shape validation of the canonical PromptForge prompt document (warnings, not hard failures).
  - Schema library: create/edit/delete schemas, attach to prompt (`schemaId`), sample schema and example documents, schema syntax validation with line/column, no silent overwrite of schemas in use (warn + count).
  - Validation studio route `/validation`: prompt/schema selector, document editor (read-only summary + link to editor), results panel grouped by kind with counts and filters, path display and copy, "jump to line" for syntax errors, banner: "Syntax and schema validity only — not a judgment of prompt quality."
  - Editor integration: validation tab in inspector with live/on-demand run, status pill distinguishing valid JSON vs schema-invalid, error count in prompt list/dashboard.
  - Palette commands: validate current prompt, open validation studio.
- **Acceptance criteria:**
  - Syntax errors, schema errors, and document-shape warnings are clearly distinguished in data and UI.
  - Valid schema + invalid document yields per-path schema errors; invalid schema produces a schema-level error and no false document errors.
  - Validating never mutates the prompt or the schema.
  - Schema attachment persists and appears in editor/dashboard indicators.
  - Disclaimer is present and non-dismissible in the studio; no copy claims semantic quality.
- **Validation:** Unit tests with fixture documents/schemas (valid, invalid, malformed schema, large input timeout); integration test for schema CRUD + attachment + editor validation panel; manual check of line jumping and error copying; typecheck/lint/tests/build.
- **Deliverables:** `src/domain/validation.ts`, `src/data/repositories/schemaRepository.ts` (if not already), `src/routes/validation/*`, `src/components/validation/*`, `src/features/schemas/*`, tests, docs update (validation limits).
- **Out of scope:** Quality heuristics (TASK-024), import-time validation UI (TASK-026), provider execution.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Engine (`src/domain/jsonSchema.ts`):** an in-house JSON Schema **interpreter**, not Ajv. Ajv compiles a schema into JavaScript with `new Function`, which is the eval-shaped path this project forbids for user-authored data and which a strict CSP without `unsafe-eval` would block (ADR-83). The supported subset is explicit: `type`/`enum`/`const`, the numeric bounds and `multipleOf`, `minLength`/`maxLength`/`pattern`/`format`, `items`/`prefixItems` and array bounds, `properties`/`patternProperties`/`additionalProperties`/`required`/property counts, `allOf`/`anyOf`/`oneOf`/`not`, local `$ref` with `$defs`/`definitions`, annotations, and boolean schemas. Formats actually checked are `email`, `uri`, `date`, `date-time`, `time`, `uuid`, `ipv4`, and `hostname`; any other format is a note on the schema, not a pass on the document. Every keyword outside the subset — including a misspelling such as `requird` — is a **compile error** naming the pointer, so an unsupported feature can never yield an unearned "valid" (ADR-84). Malformed keyword values, non-local `$ref`s, dangling references, patterns over 512 characters, schemas over 100 000 characters, and nesting past 64 levels are compile errors too.
  - **Report (`src/domain/validation.ts`):** one `ValidationReport` with `status` (`valid | warning | invalid | skipped`), `valid`, `syntaxOk`, `schemaStatus` (`none | checked | rejected | unchecked`), `conforms`, `counts`, `issues`, `schemaWarnings`, `truncated`, and `skippedReason`. Findings carry `kind` (`syntax | schema | document`), `severity`, `path`, `pointer`, `message`, `keyword`, and line/column for syntax. A rejected schema reports only schema problems and performs no conformance checks, so a bad schema is never mistaken for a bad prompt. Documents over 2 000 000 characters are **skipped** with a reason rather than silently passing, error collection stops at 100 with `truncated: true`, and compiled schemas are memoised in an LRU of 32 (ADR-88). Helpers: `findSchemaProblems`, `countSchemaUsage`, `describeValidation`, `findLineForPath`, `pathToPointer`, `pointerToPath`.
  - **Schema library (`src/store/dataStore.ts`):** `addSchema`, `updateSchema`, `deleteSchema`, and `setPromptSchema`. Deletion detaches every attached prompt in one `updateMany` **before** the schema is removed, and a stale detach aborts the whole deletion, so no prompt is left pointing at a missing record. Attachment is version-guarded and moves the prompt's version forward as a metadata-only change.
  - **Studio (`src/routes/validation/*`, `src/components/validation/*`, `src/features/schemas/*`):** `/validation?prompt=<id>` selects a prompt, shows its stored document's report with per-kind counts and an `all | errors | warnings` filter, and lists the schema library with usage counts. `IssueList` states each finding's kind and severity in words, offers a copy-pointer action, and a `Find` action that jumps into the editor. `ValidationSummary` pairs a `StatusPill` with `describeValidation`, and `ValidationScopeNote` renders the non-dismissible statement that validity is syntax and structure, never prompt quality (ADR-85). The schema dialog validates with `scanJson` **and** `compileJsonSchema` before saving, refusing a schema with a misspelled or unsupported keyword. The studio is explicitly read-only over the prompt, with a link back to the editor.
  - **Editor integration:** `EditorInspector` gained a Validation tab over the **live draft** (so a draft is checked without being saved), showing the status, counts, the scope note, the first findings, a `Find` action per finding that moves the caret to the finding's path, and an *Open the studio* link. `EditorRoute` computes the report (with a recheck token), registers the palette action, and honours `?line=` deep links from the studio. Document-shape findings are warnings and never block a save; schema non-conformance is surfaced for attention but is not a storage precondition (ADR-86).
  - **Library and dashboard:** `SchemaBadge` adds a `Schema mismatch` badge beside (not instead of) `Parses`; `PromptCard`/`PromptRow`/`PromptGrid`/`PromptList` pass the issue count through, and `LibraryRoute` computes it with `findSchemaProblems`. The dashboard gained a `schemaMismatches` count, a `schema-mismatch` attention kind ordered after parse failures, a seventh stat tile, and a summary sentence.
  - **Commands:** `validation.validate-prompt` ("Validate the open prompt", group *Workspace*) is offered only while an editor has registered the action and only on a prompt route, so the palette never lists a command that would do nothing.
  - **Tests added (114 new cases; whole suite 1021 across 72 files):** `src/domain/jsonSchema.test.ts` 54, `src/domain/validation.test.ts` 29, `src/store/schemaStore.test.ts` 10, `src/routes/validation/ValidationRoute.test.tsx` 11, `src/routes/editor/EditorRoute.test.tsx` +4, `src/routes/library/LibraryRoute.test.tsx` +1, `src/store/dashboard.test.ts` +4, `src/lib/commands/coreCommands.test.ts` +1.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **72 files / 1024 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (`src/domain` 96.28/92.11/99.2/96.84, `src/store` 96.07/89/97.08/97.43, `src/data` 96.51/87.03/100/97.22; `jsonSchema.ts` 92.16/90.83/98/93.33, `validation.ts` 94.96/81.55/96.42/97.7); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 54.43 kB (13.26 kB gzip), app JS 823.13 kB (245.20 kB gzip), lazy `JsonEditor` chunk unchanged at 427.59 kB (138.55 kB gzip), same accepted >500 kB advisory.
  - **Not performed (stated honestly):** the task's "manual check of line jumping and error copying" was **not** performed — this environment has no browser binary, so there was no manual or visual pass, no real keyboard walkthrough, and no screenshot. Line jumping and copy actions are covered by scripted tests against the real routes (and by CodeMirror's own selection state in jsdom), not by looking at the app.
  - **Deviations recorded:** Ajv is **not** used, and the schema dialect is a documented subset (ADR-83, ADR-84) — the plan's Ajv-specific wording ("compile caching", "error normalization") is met by a local LRU and one `ValidationIssue` shape; references are local-only so validation performs no I/O (ADR-87); `src/domain/jsonSchema.ts` and `src/domain/validation.ts` are new domain modules, so the purity guard's module list and the barrel export list were extended; the studio validates the stored document and links to the editor rather than embedding a second CodeMirror instance, which is where "validate a draft without saving first" is honoured.
  - **Docs:** `docs/DECISIONS.md` gained ADR-83…ADR-88 and a TASK-016 verification log; `docs/VALIDATION.md` is new (supported keywords, formats, limits, report shape, honesty rules); `docs/ARCHITECTURE.md` gained a "Validation (TASK-016)" section and its technology table now names the interpreter; `README.md` and `tasks.md` updated.

---

### TASK-017 — Guided prompt composer with JSON synchronization

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-015
- **Objective:** Let users assemble structured prompts through a guided form that stays bidirectionally consistent with the underlying JSON, without ever discarding content silently.
- **Scope:**
  - Composer route `/composer` and edit mode `/prompts/:id/compose`: sections for identity (name/role), objective, instructions (reorderable list), context, constraints, variables, output (format, schema ref, example), examples, metadata/includes.
  - Two-way sync: form edits produce a document update preserving unknown fields; raw JSON visible in a side panel (read-only preview) with "Open in editor" handoff; if the document contains fields the form cannot represent, show a clear notice and keep them intact.
  - Template start: blank document or seeded starter; snapshot of original preserved as a revision on first save (delegated to TASK-019 interface).
  - Variable editor: add/remove/edit name/type/required/default/description; duplicate-name and invalid-identifier errors inline; snippets insertion (from stored snippets) into a chosen section.
  - Validation: per-field errors with `aria-invalid`, section completeness summary, "Save prompt" using the save pipeline; unsaved guard consistent with editor.
  - Accessible forms: labeled groups, fieldset/legend for repeated sections, keyboard reordering controls.
- **Acceptance criteria:**
  - Form ↔ JSON synchronization is lossless for supported fields and preserves unsupported fields (verified by round-trip tests).
  - Variable edits update the document and are reflected in the JSON preview.
  - Invalid input blocks save with associated, announced errors; valid input persists through the save pipeline.
  - Switching between composer and raw editor never loses unsaved changes without a guard.
  - Composer is fully keyboard operable and responsive at 390 px.
- **Validation:** Unit tests for form↔document mapping and unknown-field preservation; integration test for create-from-blank → compose → save → reopen; variable validation cases; typecheck/lint/tests/build.
- **Deliverables:** `src/routes/composer/*`, `src/features/composer/{sections,useComposerState,validation}.ts`, variable editor, snippet insert menu, tests.
- **Out of scope:** Template catalog browsing (TASK-018), variable preview rendering (TASK-021), custom schema field definitions beyond JSON Schema attachment.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Model (`src/domain/composer.ts`):** the composer edits **raw JSON**, not a normalized document. `readComposerView` is a tolerant reader (wrong types, missing sections, non-object rows), and `applyComposerPatch` starts from the current object and replaces only the edited key, so unknown top-level keys, unknown keys nested inside `context`/`output`/`metadata`, and unknown keys on a variable or example all survive an edit (ADR-89). Variables and examples carry their unreadable entries through verbatim. `composerIssues` reports a missing name (error), an empty objective (warning), an unusable variable name, a duplicate name, and a default that contradicts the declared type (errors); `describeCompleteness` counts filled sections without pretending to score quality; `applySnippet` inserts a snippet's **value** into a chosen section (text replaces, lists append without duplicates) and records the snippet id in `includes`.
  - **Form (`src/components/composer/*`):** one `<fieldset>`/`<legend>` per section, with `VariablesEditor` (name, type, required, default, description; per-row fieldset and errors), `ExamplesEditor`, `StringListEditor` (instructions, constraints, references, tags), `JsonValueField`, `SnippetInsert`, `ComposerPreview` (read-only JSON, copy, handoff to the raw editor, preserved-field notice), and `ComposerIssues` (completeness in words, blocking errors, warnings, and an explicit "these are shape checks, not a judgement of quality" line). Reordering is a named button pair per row ("Move instruction 2 up"), so the form is keyboard-complete without a drag-only affordance (ADR-93).
  - **JSON fields:** `JsonValueField` applies text only when it parses; unparseable text stays in the field, the document keeps its previous value, and the field key is reported as invalid so the write is held back (ADR-91).
  - **Routes:** `/composer` creates a prompt — nothing is written until **Create prompt** succeeds, then it navigates to edit mode; `/prompts/:promptId/compose` edits through the TASK-015 pipeline. Both share `useComposerDraft` (draft object + canonical text) and the same field components. Leaving an unsubmitted create draft asks first, and edit mode keeps the pipeline's conflict, recovery, remote-write, and unsaved-change handling. Stored content is adopted into the form only while the pipeline reports nothing unsaved, and reload/restore are wrapped so the form adopts exactly the text the pipeline adopted (ADR-92).
  - **Save gate (`src/features/save/useSavePipeline.ts`):** new optional `blockedReason`. When set, autosave is not scheduled and every explicit save returns `false` without writing, so a composer draft with duplicate or blank rows is never stored normalized behind the user's back. Default `null` preserves every TASK-015 behaviour (ADR-90).
  - **Entry points:** the editor header links to `/prompts/:id/compose`; the palette gained `composer.new` ("Compose a prompt"), and `/composer` is reachable from the navigation rail as before.
  - **Tests added (54 new cases; whole suite 1078 across 75 files):** `src/domain/composer.test.ts` 38, `src/routes/composer/ComposerRoute.test.tsx` 9, `src/routes/composer/ComposerEditRoute.test.tsx` 5, `src/features/save/useSavePipeline.test.tsx` +1 (gate suppresses autosave and manual saves, then writes when cleared), `src/routes/editor/EditorRoute.test.tsx` +1 (compose handoff).
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **75 files / 1078 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (`src/domain` 95.86/91.66/98.99/96.33, `src/store` 96.07/89/97.08/97.43, `src/data` 96.51/87.03/100/97.22; `composer.ts` 92.85/88.44/97.77/92.78); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 54.99 kB (13.32 kB gzip), app JS 870.22 kB (256.68 kB gzip), lazy `JsonEditor` chunk unchanged at 427.59 kB (138.55 kB gzip), same accepted >500 kB advisory.
  - **Not performed (stated honestly):** no browser binary exists in this environment, so there was no manual pass at 390 px, no keyboard walkthrough of the reorder buttons on a real device, and no screenshot. Responsive and keyboard behavior are covered by the single-column layout below `lg` and by jsdom tests against the real routes.
  - **Deviations recorded:** the model lives in `src/domain/composer.ts` rather than the planned `src/features/composer/validation.ts`; the side panel is a read-only preview (the raw editor is the text editor), so there is no second save path; `useSavePipeline` gained `blockedReason` as a default-off extension; `/composer` always means "create" and edit mode is `/prompts/:promptId/compose`, so no route has two meanings; `formatDocumentJson` was added to `serialization.ts` so composer and editor share one key order; the purity guard's module list and the barrel export list were extended.
  - **Docs:** `docs/DECISIONS.md` gained ADR-89…ADR-93 and a TASK-017 verification log; `docs/ARCHITECTURE.md` gained a "Guided composer (TASK-017)" section; `README.md` gained a composer section; `tasks.md` updated.

---

### TASK-018 — Template catalog and custom templates

- **Status:** Completed
- **Priority:** Medium
- **Dependencies:** TASK-012, TASK-017
- **Objective:** Provide a useful, clearly labeled catalog of starter blueprints and allow user-owned templates derived from real prompts.
- **Scope:**
  - Built-in template seed (seedVersion bump, migration-safe): at least 8 templates across categories (extraction, classification, summarization, code review, structured analysis, agent system prompt, content generation, data transformation), each with description, category, tags, and a valid PromptForge document using variables.
  - Templates route `/templates`: category filters, search, built-in vs. user badge, card grid with metadata, preview sheet (rendered document summary, variables, size), "Use template" → creates new prompt (fresh IDs, editable copy) and navigates to composer/editor; nothing overwrites built-ins.
  - Create template from existing prompt (title/description/category supplied); duplicate template; delete/rename user templates with confirmation; built-in templates are immutable (duplicate to customize).
  - Quick-start templates on dashboard wired to real catalog.
  - Activity events for template usage and creation; palette command "New from template".
- **Acceptance criteria:**
  - All seeded templates parse and pass document-shape validation; seed is idempotent across reloads and app versions.
  - Using a template creates an independent prompt whose edits never affect the template or other prompts.
  - Preview shows accurate content, variables, and category before creation.
  - Built-in vs. user templates are visually and textually distinguishable; built-ins cannot be edited or deleted.
  - Empty states exist for no user templates and no search results.
- **Validation:** Unit tests for template→prompt materialization (ID remapping, variable defaults); integration test for use/duplicate/delete flows and seed idempotency; manual preview checks; typecheck/lint/tests/build.
- **Deliverables:** `src/data/db/templates.ts` (built-in catalog), seed migration, `src/routes/templates/*`, template preview components, store actions, tests.
- **Out of scope:** Template versioning/sharing, marketplace, prompt package distribution.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Built-in catalogue (`src/data/db/templates.ts`):** nine documents with permanent ids — extraction, review response, intent classification, meeting summary, pull request review, comparative analysis, agent system prompt, launch announcement, and JSON transformation (nine categories; the task required eight). Each entry has a description, a category, document tags, at least one variable, and a `buildContent()` that goes through `createBlankDocument`, so the shape is normalized rather than hand-asserted. `SEED_VERSION` is now 2; the seed loop creates a row only when its id is missing, so a v1 install gains exactly seven new rows and keeps the two it had, byte for byte (ADR-98).
  - **Rules (`src/domain/templates.ts`):** `summariseTemplate` (tags, variables, required/optional, counts, JSON characters, content hash), `filterTemplates` (substring over name, description, category, tags, objective, variable names; kind; category), `templateCategories`, `sortTemplates` / `sortUserTemplatesByRecency`, `templateIssues` (document errors, name limits, description and no-variables warnings), `checkTemplateName` (trimmed, case-insensitive, self-excluding), `nextTemplateName`, `templateIsEditable`, `builtInTemplateIssue`, `templateDraftFromPrompt`, and `instantiateTemplate` (ADR-94, ADR-95).
  - **Store (`src/store/dataStore.ts`):** `createTemplate`, `createTemplateFromPrompt`, `updateTemplate`, `duplicateTemplate`, `deleteTemplate`, and `useTemplate`. Every write re-validates the document and the name against live state, and both edit paths refuse a built-in with `RuleViolationError` — the store, not only the menu, is the guard. Template rows are kept in name order, matching the repository contract, and `useTemplate` records a `template` activity event that names both the template and the new prompt.
  - **Screen (`src/routes/templates/TemplatesRoute.tsx`, `src/components/templates/*`):** search, category, and kind filters with an announced "Showing X of Y" line; built-in and custom sections; card grid with category, badge, tags, variable counts, JSON size, and edit recency; preview sheet (role, objective, instructions, constraints, variable table, output format, counts, size, and the "what will not be copied" notices); create-from-prompt, rename, duplicate, and delete dialog with confirmation. Built-in cards expose no edit or delete operation at all and say "Read-only · duplicate to customise". Empty states cover an empty catalogue, no custom templates (with the action that creates one), and no matching results (with Clear filters). The open preview lives in `?template=<id>`, so the dashboard deep-links into it and Back closes it (ADR-97).
  - **Wiring:** the dashboard's quick-start cards now link to `/templates?template=<id>` instead of a placeholder route, and the palette gained `template.new` ("New from template").
  - **Tests added (89 new cases; whole suite 1167 across 79 files):** `src/domain/templates.test.ts` 40, `src/store/templates.test.ts` 22, `src/routes/templates/TemplatesRoute.test.tsx` 17, `src/data/db/templates.test.ts` 8, `src/data/db/seed.test.ts` +2 (v1 → v2 upgrade is additive; user templates survive a seed bump).
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **79 files / 1167 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 95.94/90.17/97.14/96.86; `src/domain` 96.03/92.07/99.06/96.53, `src/store` 96.14/88.81/97.31/97.66, `src/data` 96.51/87.03/100/97.22; `templates.ts` in the domain 100/100/100/100, `data/db/templates.ts` 97.97/95.83/100/98.86); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 56.04 kB (13.51 kB gzip), app JS 914.89 kB (267.71 kB gzip), lazy `JsonEditor` chunk unchanged at 427.59 kB (138.55 kB gzip).
  - **Not performed (stated honestly):** no browser binary exists in this environment, so there was no manual pass at 390 px, no pointer or keyboard walkthrough of the menu, sheet, or dialogs on a real device, and no screenshot. Responsiveness rests on the grid collapsing to one column below `sm` and on jsdom tests against the real route.
  - **Deviations recorded:** `ActivityType` gained `'template'` (with an icon and label in the activity rail) rather than recording template use as a prompt creation; the six operations are methods on the existing data store rather than a separate template store; `LibraryRoute` materialises a chosen template through `instantiateTemplate` instead of an inline JSON copy, unifying both creation paths (ADR-94); `src/data/db/templates.ts` is exported from the `@/data` barrel because it is shipped data, not an adapter; a duplicated `## Validation studio` heading in `README.md` was removed while editing the docs.
  - **Docs:** `docs/DECISIONS.md` gained ADR-08 → Accepted, ADR-94…ADR-98, and a TASK-018 verification log; `docs/ARCHITECTURE.md` gained a "Template catalog (TASK-018)" section and a corrected route row; `docs/PERSISTENCE.md` records seed v2; `README.md` gained a template-catalog section; `tasks.md` updated.

---

### TASK-019 — Version history and safe restoration

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-015
- **Objective:** Give prompts a trustworthy revision history with named snapshots, restoration that cannot lose newer work, and clear metadata.
- **Scope:**
  - Snapshot creation: "Save snapshot" with optional description/label from editor header and palette; captures full prompt state (content, title, description, tags, variables) and increments `revisionNumber`; activity event.
  - History panel/tab: chronological revisions with number, label/description, kind (manual/restore-safety/import), timestamp (relative + absolute tooltip), size, and actions (view, restore, copy snapshot JSON, diff with current — diff link enabled once TASK-020 lands).
  - Revision viewer: read-only formatted snapshot with syntax highlighting and metadata.
  - Restore flow: confirmation explaining consequences → automatically create a `restore-safety` revision of the current state → transactional restore of all snapshotted fields → refreshed editor with success toast naming the safety revision; failure leaves data untouched.
  - Retention/limits: warning when revision count is high; optional prune of old revisions with explicit confirmation and counts; autosave never creates revisions.
  - Palette commands: save snapshot, open history.
- **Acceptance criteria:**
  - Snapshots capture the complete intended state and can be viewed accurately.
  - Restoration is preceded by a safety revision and restores content/metadata exactly; no newer revision is deleted.
  - Autosaves do not create revisions (verified by count).
  - History is per prompt, ordered, and survives reload.
  - Confirmation text describes exactly what will change; failures are surfaced without partial writes.
- **Validation:** Unit tests for revision numbering and snapshot payload; integration tests for snapshot → edit → restore → safety revision existence, restore failure atomicity, autosave-no-revision; manual history panel check; typecheck/lint/tests/build.
- **Deliverables:** `src/features/revisions/*`, revision panels, restore dialog, repository methods/tests, palette commands.
- **Out of scope:** Diff visualization (TASK-020), branch/merge workflows, multi-prompt bulk snapshots.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Rules (`src/domain/revisions.ts`):** `sortRevisionsNewestFirst`, `revisionsForPrompt`, `findRevision`, `summariseRevision` (version label, title, kind words and description, JSON characters, tags, variable/required/instruction/constraint counts, content hash), `describeRevisionSize`, `restoreImpact` (per-field before/after, unchanged fields, and a `noop` flag when nothing would change), `normaliseRevisionLabel` / `checkRevisionLabel` (trimmed, length-limited), `prunePlan` (newest N kept, floor of 1, removal count), `needsPruneWarning`, and the `REVISION_WARNING_THRESHOLD` of 25. Exported from `src/domain/index.ts` and covered by the purity test's module lists.
  - **Storage (`src/data/repositories/*`):** `RevisionRepository` gained `deleteMany(ids)`, implemented in the in-memory and IndexedDB adapters and specified in the shared contract ("deletes exactly the requested revisions, ignoring unknown ids"). Pruning is one call; a compensating delete after a failed restore is idempotent.
  - **Store (`src/store/dataStore.ts`):** `snapshotPrompt(promptId, label)`, `restoreRevision(revisionId)`, and `pruneRevisions(promptId, keep)`, each returning a typed result (`RestoreResult` / `PruneRevisionsResult`). Restore writes the `restore-safety` revision **first**, applies the restored document through `applyEdit` with the prompt's `expectedVersion`, records a `restored` activity event, and deletes the safety revision again if the prompt write throws (a cleanup failure is swallowed so the original error surfaces) — no revision is ever deleted or renumbered by a restore (ADR-100). Prune keeps the newest N (floor 1), removes only the oldest, renumbers nothing, and records a `snapshot` activity summary (ADR-101).
  - **Screen (`src/routes/history/HistoryRoute.tsx`, `src/components/revisions/*`):** header with the snapshot count and "Save snapshot"; the list (number, label or an honest "No label", worded kind badge, relative time with the absolute time in `title` and the accessible name, size, and per-row View/Restore/Copy as siblings of the row button); the read-only viewer (`JsonEditor` gained `readOnly`, plus a `dl` of number, saving time, document size, captured state, and the saved title/description, and a sentence saying whether it matches the stored prompt); restore confirmation with field-level before/after and a "what stays as it is" list, naming the safety snapshot the button will create and disabling itself for a no-op; the retention warning past 25 snapshots; the prune dialog with exact counts and numbers. The selection lives in `?revision=<id>`, an unknown id is dropped once hydration finishes (a deep link is not lost while loading), and the empty state states plainly that autosave never adds a snapshot. Responsive single column below `lg`.
  - **Wiring:** the editor header gained "Save snapshot" and a **History** link carrying the snapshot count (or "none"); `SnapshotDialog` warns when the draft is dirty and saves it first on request, because a snapshot captures stored state. The palette gained `history.snapshot` (available only while a mounted prompt screen registers the dialog, via `registerPromptSnapshot`) and `history.open` (only from a prompt workspace, not from the history screen itself) (ADR-99).
  - **Tests added (59 new cases; whole suite 1227 across 82 files):** `src/domain/revisions.test.ts` 21, `src/store/revisions.test.ts` 25, `src/routes/history/HistoryRoute.test.tsx` 8, `src/routes/editor/EditorRoute.test.tsx` +3, `src/lib/commands/coreCommands.test.ts` +1, `src/data/repositories/contract.ts` +1.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **82 files / 1227 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 96.06 statements / 90.29 branches / 97.24 functions / 96.95 lines); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 56.51 kB (13.60 kB gzip), app JS 944.08 kB (274.24 kB gzip), lazy `JsonEditor` chunk 427.66 kB (138.58 kB gzip).
  - **Not performed (stated honestly):** no browser binary exists in this environment, so there was no manual pass at 390 px, no pointer or keyboard walkthrough of the list, viewer, or dialogs on a real device, and no screenshot. Responsive and keyboard claims rest on the single-column collapse below `lg`, native buttons with focus-visible outlines, and jsdom tests against the real route.
  - **Deviations recorded:** history is a route (`/prompts/:promptId/history`) rather than a drawer inside the editor, so reading history cannot collide with a dirty draft and the editor's leave guard (ADR-99); restore, prune, and snapshot are methods on the existing data store rather than a new revisions store; the viewer reuses `JsonEditor` in `readOnly` mode instead of a second highlighter; the palette's snapshot command is gated on a registered opener so it cannot act on a prompt that is not mounted; a revision's number is never reused, including after pruning.
  - **Docs:** `docs/DECISIONS.md` gained ADR-99…ADR-101 and a TASK-019 verification log; `docs/ARCHITECTURE.md` gained a "Version history (TASK-019)" section and the route row; `docs/PERSISTENCE.md` records `revisions.deleteMany`; `README.md` gained a version-history section; `tasks.md` updated.

---

### TASK-020 — Structural diff explorer

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-019
- **Objective:** Make prompt changes understandable through a path-aware structural JSON diff with clear structural vs. textual distinctions.
- **Scope:**
  - Domain diff engine (`src/domain/diff.ts`): recursive comparison of objects/arrays/scalars producing ordered change entries with JSON Pointer paths, change type (`added | removed | changed | type-changed | reordered`), old/new values, and classification (structural vs. textual), preserving meaningful array order with index-aware and move detection.
  - Diff explorer route `/diff` with selectors: prompt + revision A/B, prompt vs. current, or two ad-hoc documents pasted/loaded from prompts; validation of both sides with non-blocking error states.
  - UI: split and unified views, change summary counts, path breadcrumb, filter by change type, expandable values with readable formatting (truncated long strings, monospace), keyboard navigation between changes, "Copy diff" (JSON change list and optional text patch), empty "No differences" state, semantic disclaimer (textual comparison, not intent).
  - Integration points: history panel "diff with current" and "compare revisions"; editor header "Compare" action.
  - Palette command: compare revisions.
- **Acceptance criteria:**
  - Engine output matches fixtures for nested add/remove/change, type changes, array insert/remove/reorder, and no-change cases.
  - Every difference displays an accurate path and values; structural changes are visually/textually distinguished from text edits.
  - Selecting identical documents shows a no-differences state, not an error.
  - Copy output reproduces the displayed comparison faithfully.
  - Route is deep-linkable with query params and survives reload.
- **Validation:** Unit tests for the diff engine (comprehensive fixtures, including large arrays and Unicode); component tests for rendering/filtering/copy; integration test from history panel; typecheck/lint/tests/build.
- **Deliverables:** `src/domain/diff.ts` + tests, `src/routes/diff/*`, `src/components/diff/*`, history integration, palette command.
- **Out of scope:** Three-way merge, semantic intent analysis, revision authoring.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Engine (`src/domain/diff.ts`):** `diffDocuments(before, after, options)` walks two parsed values and returns ordered `DiffEntry` records, each with an RFC 6901 `pointer` (escaped and round-tripping), the same path as `segments`, a readable `label`, `kind` (`added | removed | changed | type-changed | reordered`), `category` (`structural | textual`), and the values on both sides. Objects are compared in the new document's key order with removals after their surviving siblings; arrays trim a common prefix and suffix and compare the middle positionally, so an insertion is one entry; a pure re-order of a scalar array is one `reordered` entry with capped `{from,to}` moves and a `movedPositions` total (ADR-102, ADR-103). `identical` is deep equality over parsed values, so whitespace and object member order are not differences while array order is. Helpers: `jsonEquals`, `jsonTypeName`, pointer escape/parse/`describePointer`, `formatDiffValue`, `describeDiffSummary` / `describeDiffCategories`, `filterDiffEntries`, `countDiffEntries`, `restrictDiffResult`, `diffToJson`, `diffToText` (with an optional filter note), and `describeDiffSide`. Bounded by `maxEntries` (2,000) with an explicit `truncated` flag.
  - **Sources (`src/features/diff/sources.ts`):** short, URL-safe references `prompt:<id>` / `revision:<id>` / `text`, `parseDiffSource`/`serializeDiffSource`, `defaultDiffSources` (newest snapshot vs. stored prompt; stored prompt vs. paste when there is no history), `resolveDiffSource` returning a value instead of throwing (missing prompt, pruned snapshot, snapshot of a deleted prompt), `revisionsOfPrompt`, and `switchDiffSourceKind` (keeps the prompt, falls back to paste when it has no snapshots) (ADR-104).
  - **Screen (`src/routes/diff/DiffRoute.tsx`, `src/components/diff/*`):** two source pickers (stored prompt / snapshot / pasted JSON; prompt then snapshot, with parse errors reported on the field), a summary bar (counts by kind and category, per-kind filter buttons that stay in place and disable at zero, unified/split view, a "Full values" switch, and two copy actions), the change list (one button per row, roving tabindex with ↑/↓/Home/End, before/after values as JSON literals with a preview and an honest truncation note), a detail panel with the path breadcrumb, both full values, move positions, and the copyable pointer, plus the "No differences", "No changes match this filter", paused-comparison, missing-prompt, and missing-snapshot states. The URL carries `?left=` / `?right=` / `?prompt=`; pasted JSON stays in the tab and the screen says a reload clears it.
  - **Integration:** the editor header gained **Compare** (`/diff?prompt=<id>`); the history screen gained **Compare snapshots** and each snapshot a **Compare with current** link (`/diff?left=revision:<id>&right=prompt:<id>`); the palette gained `diff.compare` (only from a prompt workspace) and `diff.open` (everywhere). The route writes nothing.
  - **Tests added (78 new cases; whole suite 1305 across 85 files):** `src/domain/diff.test.ts` 43, `src/features/diff/sources.test.ts` 19, `src/routes/diff/DiffRoute.test.tsx` 13, `src/routes/history/HistoryRoute.test.tsx` +1, `src/routes/editor/EditorRoute.test.tsx` +1, `src/lib/commands/coreCommands.test.ts` +1.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **85 files / 1305 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 96.14/90.70/97.36/97.09; `src/domain` 96.22/92.52/99.21/96.91 with `diff.ts` at 97.48/96.42/100/100; `src/store` 96.49/89.24/97.4/97.8; `src/data` 96.51/87.03/100/97.22); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 57.37 kB (13.72 kB gzip), app JS 976.55 kB (283.20 kB gzip), lazy `JsonEditor` chunk 427.66 kB (138.58 kB gzip).
  - **Not performed (stated honestly):** no browser binary exists in this environment, so there was no manual pass at 390 px, no pointer or keyboard walkthrough of the pickers, list, or detail panel on a real device, and no screenshot. Responsive and keyboard claims rest on `lg` breakpoints, native controls, roving tabindex with focus-visible rings, and jsdom tests against the real route.
  - **Deviations recorded:** the split view is a two-column change list rather than two synchronised document trees; re-order detection is limited to scalar arrays (ADR-103); the text copy is a readable change list, not an applicable patch, and is labelled as such; pasted JSON is deliberately not persisted (ADR-104); `src/domain/diff.ts` is a new module rather than an extension of the line-level `textDiff.ts` from TASK-015, whose recovery hint is a different question; the route caps output at 2,000 entries and reports truncation instead of freezing.
  - **Docs:** `docs/DECISIONS.md` gained ADR-102…ADR-104 and a TASK-020 verification log; `docs/ARCHITECTURE.md` gained a "Diff explorer (TASK-020)" section and the `/diff` route row; `README.md` gained a "Comparing documents" section; `tasks.md` updated.

---

### TASK-021 — Variable playground and prompt preview

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-015
- **Objective:** Provide safe, predictable variable resolution with typed inputs, missing-value detection, and a live rendered preview.
- **Scope:**
  - Renderer (`src/domain/render.ts`): `{{variable}}` token replacement only; declared-variable lookup; explicit coercion rules (string/number/boolean/json serialization); missing-required detection; unknown-token reporting; no expressions, no function calls, no `eval`; iteration/length caps.
  - Variable extraction: scan document strings for referenced variables, reconcile with declared definitions, report undeclared references and unused declarations.
  - Playground route `/prompts/:id/playground` and editor Preview tab: typed inputs per declared variable (text, number, switch, JSON textarea with validation), required indicators, default-value reset, live rendered output in a scrollable code/pre styled block with copy and character count.
  - Missing/invalid inputs block rendering with precise messages; unresolved references highlighted inline in the rendered output.
  - Session persistence of input values (per prompt, local draft) and "Save as test case" handoff to TASK-022 (button present only when TASK-022 exists — otherwise deferred and not rendered).
  - Accessibility: labeled inputs, error associations, keyboard navigable output region.
- **Acceptance criteria:**
  - Rendering is deterministic and correct for declared variables, defaults, and all four declared types, verified by unit tests including edge content (`{{`, nested braces, unicode, newlines, JSON values).
  - No template content can cause code execution; unknown tokens are reported, not silently dropped.
  - Missing required variables prevent rendering with actionable errors; optional variables fall back to defaults.
  - Preview matches the document content and updates as inputs change (debounced, no data loss).
  - Playground usable at 390 px with the output readable.
- **Validation:** Extensive unit tests for renderer/extractor (security-oriented cases included); integration test for editing variables → filling inputs → preview; manual check that no `eval`-like API exists in the module (`grep` check documented); typecheck/lint/tests/build.
- **Deliverables:** `src/domain/render.ts`, extraction module, `src/routes/playground/*`, `src/components/playground/{VariableForm,RenderedPreview}.tsx`, tests.
- **Out of scope:** Saved test cases (TASK-022), actual model execution (never in v1), AI provider integration.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Domain (`src/domain/variables.ts`):** the block scanner and everything about *names*. `scanTemplate(text, maxTokens?)` returns `{ tokens, truncated }`, each token carrying `start`, `end`, `raw`, `name`, and a `problem` (`'unclosed' | 'empty-name' | 'invalid-name'`); names must match `VARIABLE_NAME_PATTERN` (`/^[A-Za-z_][A-Za-z0-9_]*$/`) and a string is capped at 1,000 tokens. `extractVariableReferences(document)` walks every string in the document — including examples and metadata, which are not rendered — reporting `{ name, path, occurrences }` per (name, path), sorted by name then path, plus unusable placeholders and a truncation flag. `reconcileVariables(variables, references)` returns `{ used, unused, undeclared }` in a fixed order. `parseVariableInput` / `formatVariableInput` own the four types (decimal pattern rather than `Number()`, so `0x10` is rejected), `describeVariableDefault` caps its preview at 80 characters, and `coerceVariableText` is the single place that decides what a value inserts: a string as-is, a number and a boolean as literals, JSON as compact JSON, and an error for a value that does not match its declaration.
  - **Renderer (`src/domain/render.ts`):** `renderPrompt(document, values)` returns `{ sections, text, characters, blocked, issues, missing, values }`. Sections are role, objective, instructions, context description, references, and constraints, in that order, under fixed uppercase titles, joined by blank lines, with empty sections omitted; examples, output configuration, and metadata are not part of the text. Segments are `text | value | unresolved | unknown | invalid` so unresolved placeholders can be marked inline without being dropped. Issues carry `missing-required | missing-optional | undeclared | invalid-token | type-mismatch | too-many-tokens | too-large` with a severity; any error blocks the render (`text` empty, `characters` 0). `renderTemplateString`, `describeRenderedPrompt`, `describeRenderIssues`, and `missingVariables` round it out. Caps: `MAX_RENDER_CHARACTERS = 200_000` and 1,000 tokens per string.
  - **Inputs (`src/features/playground/valuesStorage.ts`, `usePlayground.ts`):** inputs live in `sessionStorage` under `promptforge.playground.<promptId>` (200 entries / 200,000 characters, validated on read, fail-soft everywhere) — deliberately not `localStorage` (ADR-105). `usePlayground` prefills declared defaults, parses each field, applies an empty field as *unanswered*, debounces the derived render (150 ms) so the preview, errors, and count always describe the same inputs, writes inputs after a 300 ms pause, restores them for the same prompt only, and re-fills fields when the document's variable set changes without discarding answers that still apply.
  - **Screen and components (`src/routes/playground/*`, `src/components/playground/*`):** a route at `/prompts/:promptId/playground` with breadcrumbs, loading/error states, a missing-prompt empty state, an unreadable-document panel that lists the parse issues instead of rendering half a document, and a scope note that says what the screen does and does not do. `VariableForm` gives each declared variable a labelled field (text area, decimal keyboard input, switch, JSON text area), a worded type badge, a required/optional marker, a reset to its default, and a reconciliation report naming unused declarations, undeclared references, and unusable placeholders. `RenderedPreview` shows the exact text in a focusable, wrapping monospace block with a character count, a copy action, inline marks for unresolved placeholders, and a blocked state that lists the reasons and offers no copy of text that does not exist. `PlaygroundPanel` is shared by the route and the editor's new **Preview** tab, so the two can never disagree; the tab follows the *draft* and pauses while the draft is not valid JSON.
  - **Integration:** the editor's `view` union gained `'preview'` with a third `TabsTrigger`/`TabsContent` over `parseDocument(save.parse.value)`; the router gained the route; the palette gained `playground.open` (available from a prompt workspace, navigating to its playground). "Save as test case" is deliberately **not rendered**, because TASK-022 does not exist yet.
  - **Security:** there is no evaluator. `src/domain/render.test.ts` reads both domain files, strips comments, and fails if `eval(`, `new Function`, `Function(`, `setTimeout(`, or dynamic `import(` appear; it also renders `{{1 + 1}}`, `{{constructor}}`, `{{__proto__}}`, and `{{toString}}` and asserts literal output. The documented manual check is `grep -nE '(eval|new Function|Function|setTimeout|import)[[:space:]]*\(' src/domain/render.ts src/domain/variables.ts`, which matches only prose in comments.
  - **Tests added (84 cases; whole suite 1,389 across 90 files):** `src/domain/variables.test.ts` 26, `src/domain/render.test.ts` 26, `src/features/playground/valuesStorage.test.ts` 6, `src/features/playground/usePlayground.test.ts` 12, `src/routes/playground/PlaygroundRoute.test.tsx` 10, `src/routes/editor/EditorRoute.test.tsx` +3, `src/lib/commands/coreCommands.test.ts` +1.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **90 files / 1,389 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 96.28/90.93/97.46/97.19; `src/domain` 96.47/92.68/99.29/97.1 with `render.ts` at 100/93.1/100/100 and `variables.ts` at 96.99/94.18/100/97.47; `src/store` 96.49/89.24/97.4/97.8; `src/data` 96.51/87.03/100/97.22); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 58.96 kB (13.85 kB gzip), app JS 1,005.20 kB (291.15 kB gzip), lazy `JsonEditor` chunk 427.66 kB (138.58 kB gzip).
  - **Not performed (stated honestly):** no browser binary exists in this environment, so there was no manual pass at 390 px, no pointer or keyboard walkthrough of the form or the output block on a real device, and no screenshot. Responsive and keyboard claims rest on wrapping monospace output, `lg`/`xl` breakpoints, labelled native controls, and jsdom tests against the real route.
  - **Deviations recorded:** a blank field counts as *unanswered* for every type including string (whitespace-only included), because substituting `''` would silently drop a required value and hide an optional placeholder; the number field is `type="text"` with `inputMode="decimal"` so a browser cannot discard a typed character without a word; input values are per tab (ADR-105); "Save as test case" is absent until TASK-022; substitution is a single pass, so an inserted value is never re-scanned for tokens.
  - **Docs:** `docs/DECISIONS.md` gained ADR-105, ADR-106, and a TASK-021 verification log; `docs/ARCHITECTURE.md` gained a "Variable rendering and playground (TASK-021)" section, the `/prompts/:promptId/playground` route row, and the `sessionStorage` note in the data lifecycle; `README.md` gained a "Variable playground and preview" section and an updated editor description; `tasks.md` updated.

---

### TASK-022 — Prompt laboratory with saved test cases

- **Status:** Completed
- **Priority:** Medium
- **Dependencies:** TASK-021
- **Objective:** Allow repeatable local experiments: named test cases, validated runs, variant comparison, and an unmistakably clear statement that no model provider is involved.
- **Scope:**
  - Test case persistence: create/save/rename/duplicate/delete test cases per prompt (`inputValues`, optional `expectedStructure` as a JSON Schema string); list with last-updated and variable coverage.
  - Laboratory route `/prompts/:id/lab`: select prompt version/revision + test case(s); pre-run validation (document syntax + schema if attached + required variable values); run locally by rendering the prompt with each case; results show rendered output, character/token-ish length (labeled as character count, not token count), unresolved-variable status, and render errors separately from JSON validation errors.
  - Comparison: side-by-side or stacked diff of two rendered variants (reuse TASK-020 text comparison), with change highlighting and copy.
  - Honesty banner (persistent): "Local rendering only. No AI model provider is connected; PromptForge does not execute prompts against a model."
  - Load case inputs into playground; save playground inputs as a case.
  - Palette commands: open lab, save test case.
- **Acceptance criteria:**
  - Cases persist across reload and are scoped to their prompt; deletion is confirmed.
  - Pre-run validation errors block execution with clear, separate categories; nothing is labeled as "model output".
  - Comparison shows real rendered differences and correctly reports identical variants.
  - No network request is made during a run (verified in a test with a fetch spy that fails on call).
- **Validation:** Unit tests for case CRUD and run orchestration; integration test for save case → run → compare; network-spy test; manual mobile check; typecheck/lint/tests/build.
- **Deliverables:** `src/domain/lab.ts`, `src/features/testCases/*`, `src/routes/lab/*`, comparison components, tests.
- **Out of scope:** Real model calls, evaluation scoring, batch model benchmarking.

- **Completion record (2026-10-24):** Completed after explicit user authorization.
  - **Run orchestration (`src/domain/lab.ts`):** `runTestCase({ document, promptSchema, testCase, expectedSchema, missingExpectedSchemaId })` is synchronous and pure, and checks in order: the document's own shape rules (`validatePromptDocument(documentToJson(document))` — the studio's warning-demoting helper is deliberately *not* used, because a run cannot render a document whose shape is wrong), the attached prompt schema (`validateJsonValue(..., { checkDocument: false })` so the same problem is not reported twice), and the case's values (`resolveCaseInputs`). Any error returns `status: 'blocked'` with `text: ''` and `characters: 0`, and `renderPrompt` is wrapped in `try/catch` so a document that slips past the shape rules refuses the run instead of taking the screen down. Problems carry `category: 'document' | 'inputs' | 'render'`, and a render problem that duplicates an input problem for the same variable name is dropped, so one variable yields one finding. `resolveCaseInputs` treats a declared default as *answered* without copying it into the substituted values, a required value with no answer as an error, an optional unanswered value as a warning that keeps its placeholder visible, a stored value for an undeclared name as a warning (never silently pruned), and a value that contradicts its declared type as an error. `LAB_LIMITS` are 50 cases per prompt, 120-character names, and the renderer's 200,000-character cap. `checkStructure` reports `none | missing-schema | invalid-schema | not-json | pass | fail`: prose is `not-json` with a line number, never "failed". `formatCaseInputs`, `describeCoverage`, `describeLabRun`, and `summarizeLabRuns` round it out.
  - **Comparison (`src/domain/renderDiff.ts`):** line-level alignment with an LCS over `Int32Array`, removals before additions, and exact added/removed counts. Past 2,000 lines or 400,000 cells it abandons the table for a prefix/suffix overview capped at 200 rows per side and sets `truncated`, while its counts stay truthful; `renderedComparisonToText` writes a `+`/`-`/space-prefixed copy capped at 200,000 characters with a note saying it was capped. `describeRenderedComparison` says "identical" in words, so the screen never implies a difference it cannot show.
  - **Persistence (`src/store/dataStore.ts`):** `addTestCase`, `updateTestCase`, `duplicateTestCase`, and `deleteTestCase` write through `repos.testCases` and refresh state from the stored record. Names are trimmed, non-empty, under 120 characters, and unique per prompt case-insensitively; the 50-case cap is enforced with an actionable message; a duplicate deep-copies `inputValues` (a shared object would let one edit change two cases) and names itself `Name (copy)`, `Name (copy 2)`, …; edits keep `createdAt` and advance `updatedAt`. `deletePrompt`'s existing cascade already removed a prompt's cases, so nothing new was needed there.
  - **Screen (`src/routes/lab/LabRoute.tsx`):** a permanent `Alert` states "Local rendering only. No AI model provider is connected; PromptForge does not execute prompts against a model." A version selector renders the stored prompt or any snapshot (cases are matched by variable name, so a case saved against another version still runs and reports what it could not resolve). A pre-run card lists document, prompt-schema, and per-case input checks before anything is pressed; results show one card per run with status, the character count (labelled characters), variable coverage, the unresolved count, problems grouped Document/Inputs/Rendering, the expected-structure verdict, the rendered text, and copy. Results are not persisted: reopening the laboratory starts with no runs rather than a stale claim.
  - **Components (`src/features/testCases/*`):** `CaseList` shows coverage, last update, expected schema, and run/edit/duplicate/delete/load-into-playground per case, with a confirmation dialog that says the prompt is unaffected; `CaseEditor` creates and edits a case with typed fields (text, decimal text with `inputMode="decimal"`, true/false select with an explicit "not answered", JSON text area), an expected-schema picker, live coverage, and a blank field treated as unanswered so editing cannot turn "no answer" into an empty string; `RunResults` renders the run cards and a `RunSummaryLine`; `VariantComparison` offers two selectors, the diff rows with `+`/`-` marks *and* screen-reader words, the identical verdict, and a copy button; `playgroundBridge` converts between case values and this tab's playground text in both directions, reporting values it cannot parse instead of dropping them.
  - **Integration:** the router gained `/prompts/:promptId/lab`; the palette gained `lab.open` and `lab.new-case` (the latter accepts `?new=1` and, from the playground, `?from=playground` to seed the form with this tab's inputs); the playground header gained "Save as a test case" and "Laboratory" links, and the editor's Preview tab gained the same two; `src/domain/index.ts` and `purity.test.ts` register both new domain modules.
  - **Tests added (67 cases; whole suite 94 files / 1,456 tests):** `src/domain/lab.test.ts` 21, `src/domain/renderDiff.test.ts` 13, `src/features/testCases/playgroundBridge.test.ts` 6, `src/routes/lab/LabRoute.test.tsx` 19, `src/store/dataStore.test.ts` +7, `src/lib/commands/coreCommands.test.ts` +1.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **94 files / 1,456 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 96.18/90.97/97.32/97.09; `src/domain` 96.38/92.61/98.69/96.96 with `lab.ts` at 97.24/86.76/88.46/97.02 and `renderDiff.ts` at 93.57/95.31/100/93.87; `src/store` 96.14/89.4/97.59/97.67; `src/data` 96.51/87.03/100/97.22); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 59.23 kB (13.88 kB gzip), app JS 1,047.77 kB (300.48 kB gzip, +42.6 kB over TASK-021's 1,005.20 kB), lazy `JsonEditor` chunk 427.66 kB (138.58 kB gzip). The no-network requirement is a test, not a claim: `LabRoute.test.tsx` replaces `fetch` with a function that throws and asserts a full run never calls it (and that a run writes nothing to `sessionStorage`).
  - **Not performed (stated honestly):** no browser binary exists in this environment, so the requested manual mobile check did not happen — there is no 390 px walkthrough, no keyboard or pointer pass on a real device, and no screenshot. Responsive and keyboard claims rest on the stacked `xl` layout, wrapping monospace output, labelled native controls, and jsdom tests against the real route.
  - **Deviations recorded:** (1) the scope said "reuse TASK-020 text comparison", but TASK-020's `diff.ts` compares *documents* by JSON pointer and `textDiff.ts` is a line-count summary for the save pipeline; neither produces a rendered-text diff, so `renderDiff.ts` implements one with the same visual language (ADR-107). (2) The case stores an *expected structure* (a schema id) rather than expected text, because a stored expected output would go stale on every edit and could not be checked without pretending to know what a model would say. (3) Prompt-schema conformance is part of the pre-run gate and the pre-run card, not only of the run. (4) Case changes record no `ActivityEvent`: the `ActivityType` union has no lab member and widening it is a dashboard decision (TASK-025).
  - **Known limitations:** a structure check on a prose prompt usually ends in `not-json` (reported as a skipped check with its reason); cases go stale when a document's variables change (warnings, no auto-prune); results are per mount and deliberately not stored; the 50-case and 120-character caps are fixed; the +42.6 kB bundle growth is the new route and components, which are not code-split.
  - **Docs:** `docs/DECISIONS.md` gained ADR-107 and a TASK-022 verification log, and ADR-04's stale "Planned" status was corrected to "Accepted"; `docs/ARCHITECTURE.md` gained a "Prompt laboratory and saved test cases (TASK-022)" section, the `/prompts/:promptId/lab` route row, and an updated playground note about the hand-off; `README.md` gained a "Prompt laboratory with saved test cases" section, updated editor and playground bullets, and structure entries; `tasks.md` updated.


---

### TASK-023 — Blueprint dependency graph

- **Status:** Completed
- **Priority:** Medium
- **Dependencies:** TASK-016, TASK-019
- **Objective:** Visualize how a prompt is assembled — sections, variables, schema references, and snippets — with unresolved references highlighted and full keyboard/list fallbacks.
- **Scope:**
  - Graph derivation (`src/domain/graph.ts`): nodes for document sections, declared variables, referenced snippets (`includes`), attached schema, and template origin when known; edges for containment/reference with direction; unresolved-reference nodes flagged; deterministic ordering/coordinates.
  - Layout: deterministic layered SVG (columns: inputs → structure → output), no external graph library; pan/zoom limited to fit-to-view and modest zoom; responsive compact mode; collapse/expand section nodes.
  - Interaction: click node → inspector showing value/details with "Open source" navigation (variable → playground, snippet → snippets page, schema → validation studio, section → editor tree path); unresolved node → actionable fix link; legend; reduced-motion safe transitions.
  - Fallback: semantic ordered list representation (`role="list"`) is the default on narrow screens and available via a "List view" toggle; graph is `aria-hidden` with the list supplying accessible content.
  - Suppression: prompts with fewer than 3 meaningful nodes show a concise "This prompt is simple — no blueprint needed" message with an option to view anyway.
  - Editor "Blueprint" tab plus palette command.
- **Acceptance criteria:**
  - Derived nodes/edges match fixtures for prompts with variables, snippets, schema, and unresolved references.
  - Unresolved references are visually distinct (icon + label) and provide navigation to the resolution path.
  - Graph is deterministic across renders and does not overflow its container; zoom/pan never traps scroll on mobile.
  - List fallback exposes the same information and is keyboard navigable; graph nodes are reachable via buttons in the list.
  - Simple prompts get the suppression message rather than a noisy graph.
- **Validation:** Unit tests for derivation and layout coordinates; component tests for fallback list and unresolved styling; manual pan/zoom and mobile checks; typecheck/lint/tests/build.
- **Deliverables:** `src/domain/graph.ts`, `src/features/blueprint/{BlueprintGraph,GraphList,GraphInspector}.tsx`, editor tab integration, tests.
- **Out of scope:** Editing directly in the graph, external graph libraries, cross-prompt global dependency map.

- **Completion record (2026-10-25):** Completed after explicit user authorization.
  - **Derivation (`src/domain/graph.ts`):** `buildBlueprint({ document, promptId, attachedSchema, attachedSchemaId, snippets, templates, metadata })` is pure and returns `{ nodes, edges, width, height, unresolvedCount, truncated, droppedNodes, droppedEdges }`. Nodes are drafted in a fixed order — filled sections (document order), declared variables (declaration order), snippets (`includes`, sorted by name), undeclared placeholders, unusable placeholders, the template origin, then the output nodes (format, attached schema, missing schema, `schemaRef`) — and the 60-node cap therefore drops placeholders before it can drop structure. Node kinds are `variable | snippet | reference | section | format | schema | origin`; edges are `reference` (variable/snippet/undeclared token → the section that uses it) or `contains` (section → its output nodes), so direction is explicit. `BlueprintTarget` values (`section`, `playground`, `snippets`, `validation`, `templates`) are emitted instead of hrefs, because the domain must not know the route table.
  - **Unresolved references:** an undeclared placeholder, an unusable placeholder (`{{1 + 1}}`, `{{#each}}`), an included snippet that no longer exists, a snippet whose `targetPath` has no section (`SNIPPET_TARGET_SECTIONS`, test-enforced against `SNIPPET_TARGETS`), an attachment pointing at a deleted schema, a document `schemaRef` that disagrees with the attachment, and a dangling `metadata.templateId` all produce `unresolved: true` plus a `Problem` meta row and a destination where the reference is fixed.
  - **Layout:** three fixed columns (inputs → structure → output) with `x = padding + index * (nodeWidth + columnGap)`, rows stacked by index and each column vertically centred, integer coordinates, and canvas size computed from the grid — so geometry is a function of ordering alone and a test builds the graph twice to prove identical coordinates. No layout library, no randomness, no measurement.
  - **Screen (`src/features/blueprint/BlueprintPanel.tsx`):** the tab shows a one-line summary (`describeBlueprint`), a Graph/List toggle, five bounded zoom steps (70 %–130 %, disabled at the ends, percentage announced politely), a legend, the truncation notice when the cap bites, and the inspector. Below three meaningful nodes it shows "This prompt is simple — no blueprint needed" with "View the blueprint anyway". The drawing lives in a horizontally scrollable container; no wheel or drag handlers exist, so page scroll is never trapped.
  - **Drawable vs. readable (`BlueprintGraph` / `GraphList`):** the SVG is `aria-hidden`, unfocusable, and deterministic (`viewBox` from the graph, `data-node-id`/`data-selected` attributes, dashed containment edges, a `!` badge on unresolved nodes). Every node is also a `<button aria-pressed>` in a labelled per-column region of a semantic list, rendered compactly under the drawing on wide screens and as the only representation below `md`; the list is the keyboard path and carries the same labels, kinds, and details.
  - **Inspector (`GraphInspector`):** the selected node's kind, label, resolved state, meta rows, a "What needs fixing" warning for unresolved nodes, and one concrete action per target — section → that field in the JSON editor, variable → `/prompts/:id/playground`, snippet → `/prompts/:id/compose`, schema → `/validation?prompt=:id`, template → `/templates`.
  - **Integration:** the editor gained a "Blueprint" tab (with a note that it follows the draft, not the saved prompt) and an invalid-draft explanation; `?panel=blueprint` selects the tab and is then cleared from the URL; the palette gained `blueprint.open`; the domain barrel and `purity.test.ts` register `graph.ts`.
  - **Tests added (49 cases; whole suite 96 files / 1,505 tests):** `src/domain/graph.test.ts` 32, `src/features/blueprint/BlueprintPanel.test.tsx` 12, `src/routes/editor/EditorRoute.test.tsx` +4, `src/lib/commands/coreCommands.test.ts` +1.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **96 files / 1,505 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 96.29/90.39/97.29/97.17; `src/domain` 96.54/91.66/98.46/97.11 with `graph.ts` at 97.6/80.43/96.66/97.81); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 59.48 kB (13.93 kB gzip), app JS 1,072.69 kB (307.24 kB gzip, +24.9 kB over TASK-022's 1,047.77 kB) with the pre-existing >500 kB chunk warning.
  - **Not performed (stated honestly):** no browser binary exists in this environment, so the requested **manual pan/zoom and mobile checks did not happen** — no 390 px walkthrough, no pointer, pinch, or wheel pass on a device, and no screenshot. There is nothing to pan: the component implements no drag or wheel handlers by design. The responsive and scroll claims rest on the `md` breakpoint, the `overflow-x-auto` container, and jsdom tests against the real panel and route.
  - **Deviations recorded:** (1) the scope's "collapse/expand section nodes" is **not implemented**: a collapsed section node has nothing meaningful to hide (its children are the output and referenced-snippet nodes, which are already reachable in one hop and are shared with other sections), so no control was added rather than a control that only rearranges the drawing (ADR-108). (2) The scope said "snippet → snippets page"; there is no `/snippets` route, so the action opens the composer, where snippets are managed. (3) "Pan/zoom limited to fit-to-view and modest zoom" is implemented as fit + five button steps with horizontal scrolling, not a pannable canvas. (4) The graph is **not** a second source of truth: it re-derives on every render and has no persistence, unlike the stored test cases of TASK-022.
  - **Known limitations:** the edge cap (120) is enforced but unreachable in tests; two guards in `graph.ts` (lines 386-388, 456) are uncovered because the draft ordering makes them unreachable; template origin appears only when `metadata` names a template (a prompt created another way shows none); zoom is not persisted and there is no "centre on node"; the view toggle does not follow the breakpoint; the summary counts nodes, not importance.
  - **Docs:** `docs/DECISIONS.md` gained ADR-108 and a TASK-023 verification log; `docs/ARCHITECTURE.md` gained a "Prompt blueprint (TASK-023)" section and an updated workspace route row; `README.md` gained a "Prompt blueprint" section and a `features/` entry; `tasks.md` updated.


---

### TASK-024 — Quality inspector

- **Status:** Completed
- **Priority:** Medium
- **Dependencies:** TASK-016, TASK-021
- **Objective:** Offer transparent, rule-based structural feedback that explains itself, separates deterministic from heuristic findings, and never rewrites content.
- **Scope:**
  - Rules engine (`src/domain/quality.ts`) with individually documented rules: missing description/name/objective, empty required sections, undefined variable references, unused declared variables, duplicate metadata keys, unexpected properties, conflicting output format vs. example, oversized content thresholds, missing output format, incomplete snippet references, duplicate instructions.
  - Each finding: id, ruleId, severity (`info | warning | error`), classification (`deterministic | heuristic`), JSON path, title, explanation ("why flagged"), suggestion, and evidence excerpt.
  - UI: inspector tab/route with grouped findings, filters, classification badges, expandable explanations, dismiss-with-reason (persisted per prompt + rule + content hash so a changed document re-surfaces it), "copy finding", and navigation to the relevant editor path.
  - Explicit scope banner: heuristic suggestions are not guarantees of prompt quality; no automatic edits.
  - Summary chip in editor header and dashboard attention list extension.
  - Palette command: run inspector.
- **Acceptance criteria:**
  - Every rule has positive and negative unit tests; deterministic vs. heuristic labels are accurate and documented.
  - Findings include paths and evidence that match the actual document.
  - Dismissals persist, do not hide unrelated findings, and re-surface when the relevant content changes.
  - No inspector action mutates the prompt.
  - Oversized-content thresholds are stated in the UI.
- **Validation:** Unit tests for the full rule set; integration test for a document with three known issues (present, dismiss, resolve, re-run); manual accessibility pass over the findings list; typecheck/lint/tests/build.
- **Deliverables:** `src/domain/quality.ts` + tests, quality rules documentation (`docs/QUALITY-RULES.md`), `src/features/quality/*`, editor tab, dashboard integration.
- **Out of scope:** ML scoring, automatic prompt rewriting, cross-prompt style guide enforcement.

- **Completion record (2026-10-25):** Completed after explicit user authorization.
  - **Rules engine (`src/domain/quality.ts`):** `inspectQuality({ document, record?, snippetIds?, schemaIds?, rawText? })` is pure and returns `{ findings, counts, ran, skipped, dropped, thresholds }`. Fifteen rules are declared once in `QUALITY_RULES` (id, title, severity, classification, what it checks, why, caveat, and the inputs it needs) and documented in `docs/QUALITY-RULES.md`. Twelve are **deterministic** (a fact about the document): `name-missing`, `objective-missing`, `instructions-empty`, `description-missing`, `undefined-variable`, `unused-variable`, `duplicate-instruction`, `duplicate-json-key`, `unexpected-property`, `output-example-mismatch`, `missing-snippet`, `missing-schema-reference`. Three are **heuristic**: `role-missing`, `examples-missing`, `oversized-content`. A heuristic is never an `error`, and a test enforces it.
  - **Honesty in the engine:** a rule whose input was not supplied is reported in `skipped` with the reason instead of firing on an assumption; findings past the 20-per-rule cap are counted in `dropped`; every finding carries a path, whether that path is inside the document, a clipped evidence excerpt, an explanation, and a suggestion. Findings are sorted by severity, rule, and path, and the document is never mutated.
  - **Raw-text rule:** `duplicate-json-key` cannot be answered from a parsed document (`JSON.parse` keeps the last value), so it scans the draft text with a small key scanner and only when that text already parses; without text it is skipped.
  - **Dismissals:** `createDismissal` requires a reason (3–300 characters) and builds `{ ruleId, fingerprint, reason, dismissedAt }`, where the fingerprint hashes the rule, the path, and the **full** offending content. `applyDismissals` returns visible findings, dismissed findings with their reasons, and *orphaned* dismissals whose content changed — so an edit to the field brings the finding back and the stale dismissal is reported, never silently dropped. Stored per prompt in `localStorage` (`promptforge.quality.dismissals.<id>`), capped at 200, validated on read, and a refused write is surfaced instead of pretending success.
  - **Screen (`src/features/quality/*`):** `QualityPanel` renders a permanent "Rule-based review, not a score" banner with both classification promises, a summary line, severity and rule-kind filters with a way back, findings grouped into Errors/Warnings/Suggestions, an expandable "why this was flagged" with a suggested fix, "Go to the field", "Copy finding", and "Dismiss…". Dismissing opens `DismissDialog` (reason required, dialog stays open and reports a refused write). A dismissed list keeps the reasons with `Restore` and `Restore all`; stale dismissals are reported with a button to forget them; skipped checks and the fifteen rules with their thresholds are in disclosures; an empty state links to the validation studio.
  - **Integration:** the workspace gained a **Quality** tab (a fifth tab, with a note that it follows the draft) and a header chip (`Quality · 2 errors`) that opens it; `?panel=quality` selects the tab and is cleared from the URL; the palette gained `quality.inspect`; the dashboard's attention list gained a `quality-findings` kind that escalates only the five *defect* rules (`undefined-variable`, `duplicate-json-key`, `output-example-mismatch`, `missing-snippet`, `missing-schema-reference`) and links to `?panel=quality` — an unfinished draft and a suggestion never reach it.
  - **Tests added (100 cases; whole suite 100 files / 1,601 tests):** `src/domain/quality.test.ts` 56, `src/features/quality/QualityPanel.test.tsx` 15, `qualityAttention.test.ts` 9, `dismissalStorage.test.ts` 8, `src/routes/editor/EditorRoute.test.tsx` +4, `src/store/dashboard.test.ts` +2, `src/routes/dashboard/DashboardRoute.test.tsx` +2, `src/lib/commands/coreCommands.test.ts` +1.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **100 files / 1,601 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 96.33/90.33/97.39/97.29; `src/domain` 96.58/91.44/98.58/97.31 with `quality.ts` at 96.93/89.25/100/99.21; `src/store` 96.16/89.51/97.6/97.68; `src/data` 96.51/87.03/100/97.22); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 59.89 kB (14.01 kB gzip), app JS 1,111.77 kB (318.32 kB gzip, +39.08 kB over TASK-023's 1,072.69 kB) with the pre-existing >500 kB chunk warning. The no-mutation requirement is a test: after a dismissal and a "go to the field" jump the stored prompt's `version`, `objective`, and `role` are unchanged.
  - **Not performed (stated honestly):** no browser binary exists in this environment, so the requested **manual accessibility pass over the findings list did not happen** — no screen-reader session, no keyboard walkthrough on a device, no visual contrast or zoom check. The claims rest on native `<select>`/`<details>`/`<summary>` controls, labelled filters, `<ul>`/`<article>`/`<section>` structure, word-plus-icon statuses, and jsdom tests that drive them.
  - **Deviations recorded:** (1) the scope's "duplicate metadata keys" cannot be observed on a parsed document — `JSON.parse` keeps the last value and the parser normalizes tag duplicates — so the rule was implemented as `duplicate-json-key` over the raw draft text, which is where a duplicate actually survives. (2) `description-missing` is about the **prompt record**, not the document (which has no description field), so it only runs where a record is supplied and has no "go to the field" action. (3) The dashboard escalates a five-rule **defect** subset rather than every finding, because otherwise every newly created prompt would appear in "Needs attention" for having no objective yet (ADR-109). (4) `alert`-style statuses stay `info`-toned rather than coloured by severity, because severity is carried by a text pill on each card.
  - **Known limitations:** `name-missing` can only fire on a corrupt row or a code-built document (the parser refuses an empty name); `duplicate-instruction` catches case/spacing variants only, not paraphrases; `unexpected-property` deliberately repeats the parser's own unknown-key warning; thresholds are fixed, not configurable; a dismissal is un-dismissed by a one-character edit to the field it named; the dashboard reads `localStorage` for every live prompt on each render of its data hook.
  - **Docs:** `docs/QUALITY-RULES.md` added (the full rule reference, thresholds, findings, and dismissal semantics); `docs/DECISIONS.md` gained ADR-109 and a TASK-024 verification log; `docs/ARCHITECTURE.md` gained a "Quality inspector (TASK-024)" section; `README.md` gained a "Quality inspector" section and a `features/` entry; `tasks.md` updated.


---

### TASK-025 — Health dashboard and activity timeline

- **Status:** Completed
- **Priority:** Medium
- **Dependencies:** TASK-016, TASK-019
- **Objective:** Give an accurate operational view of the library: invalid documents, unresolved variables, stale prompts, collection distribution, and recent activity — all traceable to records.
- **Scope:**
  - Metrics service (`src/domain/health.ts`): totals (active/archived), per-collection and per-folder counts, prompts with invalid JSON, prompts with schema-invalid content, prompts with unresolved/unused variables, prompts without descriptions, prompts untouched for 30/60/90 days (thresholds configurable in settings), revision counts, storage estimate where the API is available.
  - Health route `/health`: summary cards, distribution bars (real counts with accessible tables beneath), attention lists with links into prompts/filters, "last updated" timestamps, and refresh-on-navigation (no fake live polling).
  - Activity timeline: paginated recent events from `ActivityEvent`, grouped by day, icon + text + prompt link, filter by event type; capped/pruned with a documented limit; empty state.
  - Honest empty/loading/error states; "stale" definition displayed alongside the metric.
  - Palette commands: open health, filter invalid prompts.
- **Acceptance criteria:**
  - Every metric equals a recomputation from stored data for fixture libraries (property-style tests).
  - Each attention item links to the exact prompt/filter it refers to.
  - Stale thresholds and definitions are visible; no decorative or non-actionable chart appears.
  - Activity events reflect actual mutations and paginate without duplicates; prune limit documented.
  - Dashboard's validation attention list stays consistent with health data.
- **Validation:** Unit tests for metrics with seeded fixtures (0 prompts, mixed valid/invalid, archived excluded/included as specified); integration test for activity pagination; manual cross-check of one metric against raw IndexedDB records; typecheck/lint/tests/build.
- **Deliverables:** `src/domain/health.ts` + tests, `src/routes/health/*`, activity timeline components/repository pagination, dashboard consistency updates.
- **Out of scope:** Usage-based "popularity" analytics, cross-device reporting, charts without data.

- **Completion record (2026-10-25):** Completed after explicit user authorization.
  - **Metrics service (`src/domain/health.ts`):** `computeHealth({ prompts, collections, folders, revisions, schemas, activity, thresholds?, now })` is pure and returns totals (all/active/archived), per-collection and per-folder distributions with the "no collection" / "unfiled" remainders, invalid documents, schema mismatches, undeclared and unused variables, missing descriptions, three cumulative staleness buckets, revision statistics, activity statistics, the oldest/newest edit, the thresholds used, and the instant measured. `findDocumentProblems` and `scanStoredDocuments` are the single definition of "invalid document" in the build and are now shared with the dashboard (ADR-110).
  - **Thresholds in settings:** `Settings` gained `healthThresholds: { attentionDays, staleDays, dormantDays }` with defaults 30 / 60 / 90, `normalizeHealthThresholds` clamps each field to 1–3,650 days and falls back per field, the preferences store mirrors and writes them, and the Settings screen gained a "Health thresholds" card. A settings row written before this task has no field at all and keeps working through normalisation — no migration and no schema bump.
  - **Screen (`/health`):** a header that states the thresholds and the measured instant with a Recompute control (no polling), eight summary cards (only those with an exact filter are links), two attention lists with a filter link each, two more for variables, one for descriptions, collection and folder distributions as bars over real counts **with a full table beneath** (headers, share, links into the filtered library), three untouched groups (oldest first, each labelled with its own threshold and marked cumulative), a definitions block that prints the oldest/newest edit, newest revision, and newest activity, the activity timeline, and the storage card. Every empty state is real text with a way forward.
  - **Activity timeline:** `src/features/health/activityTimeline.ts` orders through `capActivityLog`, filters by type, groups by UTC day with Today/Yesterday labels, and pages by extending a prefix (`20` per page via "Load older"), so an event cannot appear twice; the 500-event cap and its pruning are stated on the screen. `src/features/health/activityMeta.ts` is the shared icon/label/description per type, now used by the dashboard rail too.
  - **Storage:** `navigator.storage.estimate` is read asynchronously and rendered as a number with its origin-wide caveat, as "this browser does not report storage usage", or as the browser's own error — never as an estimate of our own.
  - **Palette:** `library.invalid-prompts` opens `/library?validation=unparsable`; "open health" is the existing `navigation.health` command ("Go to Health", `G H`) which was verified rather than duplicated.
  - **Dashboard consistency:** the dashboard's `findDocumentProblems` is now the domain implementation re-exported, `STALE_AFTER_DAYS` is derived from the default `attentionDays`, and a test asserts the dashboard's invalid-document and archived/active counts equal the health report's.
  - **Tests added (81 cases; whole suite 104 files / 1,680 tests):** `src/domain/health.test.ts` 36, `src/features/health/activityTimeline.test.ts` 19, `src/routes/health/HealthRoute.test.tsx` 17, `src/routes/health/HealthRoute.records.test.tsx` 1, `src/store/preferencesStore.test.ts` +4, `src/routes/settings/SettingsRoute.test.tsx` +1, `src/store/dashboard.test.ts` +1, `src/lib/commands/coreCommands.test.ts` +2.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **104 files / 1,680 tests passed, 0 failures**; `npx vitest run --coverage` — thresholds pass (all files 96.43/90.47/97.48/97.36; `src/domain` 96.74/91.49/98.68/97.42 with `health.ts` at 100/92.47/100/100; `src/store` 96.11/89.8/97.59/97.65; `src/data` 96.51/88.88/100/97.22); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings pass in both themes; `npm run build` exit 0 — CSS 60.48 kB (14.11 kB gzip), app JS 1,143.88 kB (326.68 kB gzip, +32.11 kB over TASK-024's 1,111.77 kB) with the pre-existing >500 kB chunk warning.
  - **Not performed (stated honestly):** no browser binary exists in this environment, so the requested **manual cross-check of one metric against raw IndexedDB records was not done by hand**, and there was no manual accessibility or visual pass. The cross-check is instead automated: `HealthRoute.records.test.tsx` writes through the real IndexedDB adapter, reads the rows back raw from the repositories, compares them with the health report and with the number the screen renders.
  - **Deviations recorded:** (1) the deliverable's "repository pagination" is implemented as prefix paging over the store's capped log rather than a new repository offset method — the repository contract already owns the ordering and the 500-event cap, and an offset method would have no caller and could duplicate rows during a live append (ADR-110). (2) "Open health" is the existing `navigation.health` palette command, not a second one for the same destination. (3) Thresholds are independent day counts and are not forced into ascending order; the screen prints each group's own number instead of silently re-sorting.
  - **Known limitations:** the activity log is capped at 500 events and pruned on write, so older mutations are gone and the timeline says so; the dashboard's stale hint still says 30 days (the default) while health uses the configured value; health does not read the quality inspector's dismissals; storage figures cover the whole origin; day groups are UTC; the dashboard and health agree on definitions but the dashboard caps its attention list at five rows.
  - **Docs:** `docs/DECISIONS.md` gained ADR-110 and a TASK-025 verification log; `docs/ARCHITECTURE.md` gained a "Health dashboard (TASK-025)" section and updated route rows; `README.md` gained a "Health dashboard" section and two structure entries; `tasks.md` updated.

---

### TASK-026 — Import and export

- **Status:** Completed
- **Priority:** High
- **Dependencies:** TASK-012, TASK-019
- **Objective:** Make data portable and resilient: validated JSON import with conflict handling, and documented export for one prompt, a selection, or a full backup.
- **Scope:**
  - Versioned export bundle format (`promptforge.bundle@1`): prompts with metadata, revisions, folders, collections, schemas, snippets, templates, test cases; manifest with counts, app version, exported timestamp, and a metadata-fidelity note.
  - Export actions: single prompt (prompt document + app metadata envelope), selected prompts (library bulk action), full library backup (settings/data page); filename conventions; download via Blob; progress feedback for large bundles.
  - Import: file/size validation (2 MB default, JSON only), bundle format detection (prompt file vs. bundle vs. raw document with guided normalization), schema validation of imported records, preview screen listing items to import, conflict detection (same title / same content hash / matching ID), per-item resolution (skip, import as copy, overwrite only with explicit confirmation), transactional write with summary report of created/skipped/failed items.
  - Malformed input: clear error messages by category (not JSON, wrong shape, oversized, unsupported version, partially invalid bundle with details); never crashes or partially writes.
  - Documentation of what is preserved and what is regenerated (IDs, timestamps, activity).
  - Palette commands: export current prompt, import file.
- **Acceptance criteria:**
  - Round-trip export → import into an empty library reproduces prompts, content, metadata, folders, collections, relations, revisions, schemas, snippets, and templates (IDs may be remapped and the mapping is reported).
  - Conflicts are detected before writing and resolved per user choice; skipped items are reported.
  - Invalid/oversized/malformed files are rejected with actionable messages and zero data mutation.
  - Exported file never contains recovery drafts, preferences, activity logs, or anything undocumented.
  - Downloads work in the sandbox preview browser and filenames are safe.
- **Validation:** Unit tests for bundle serialization/deserialization, conflict detection, ID remapping; integration tests for full round-trip, partial-invalid bundle, oversized file, malformed JSON; manual export in browser with a seeded library; typecheck/lint/tests/build.
- **Deliverables:** `src/domain/transfer/{bundle,import,export}.ts`, import/export dialogs and flows, settings data page, tests, `docs/IMPORT-EXPORT.md`.
- **Out of scope:** ZIP archives, cloud import/export, drag-and-drop from other apps, share links.

- **Completion record (2026-10-25):** Completed after explicit user authorization.
  - **Format (`src/domain/transfer/bundle.ts`):** two envelopes read by one function — `promptforge.bundle` and `promptforge.prompt`, both `version: 1`, each with a `manifest` (app, appVersion, exportedAt, scope, counts, fidelity notes) and flat lists (`prompts`, `revisions`, `folders`, `collections`, `schemas`, `snippets`, `templates`, `testCases`). Serialization is deterministic (fixed key order, two-space indent). The reader validates every field, rebuilds records so unknown keys cannot ride along, re-parses each document with `parseDocument`, requires parseable timestamps, forces `isBuiltIn: false`, and rejects duplicate ids, duplicate `(promptId, revisionNumber)` pairs, and references that do not resolve inside the file; a manifest count mismatch is a warning because the lists are the truth.
  - **Export (`src/domain/transfer/export.ts`):** `exportPrompt`, `exportSelection`, `exportLibrary` return the bundle, its JSON text, the filename, and the byte size. A prompt export carries the prompt's folder chain, collections, schema, snippets, revisions, and test cases; a selection adds the same for each selected prompt with no uninvolved records; a backup adds every record including unreferenced folders, schemas, snippets, and all templates. Filenames are `promptforge-prompt-<slug>-<date>.json`, `promptforge-selection-<n>-prompts-<date>.json`, and `promptforge-backup-<date>.json`, with an NFKD ASCII slug capped at 48 characters.
  - **Import (`src/domain/transfer/import.ts`):** `readImportFile` enforces 2,000,000 bytes by UTF-8 length and JSON-only parsing (`JSON.parse`, never `eval`), detects bundle / prompt file / raw document (a document is wrapped as a one-prompt bundle with a warning), and fails with a category and message (`empty`, `too-large`, `not-json`, `unrecognised`, `unsupported-version`, `invalid-records`). `buildPreview` lists one row per prompt with its conflict (`same-id` → `same-content` → `same-title`), default decision (skip duplicates, import a title clash), allowed decisions, folder/collection/schema names, history and test-case counts. `buildImportPlan` is pure and materializes every record to write, keeping free ids, regenerating taken ones, continuing revision numbers after stored history, reusing same-name folders and collections, renaming clashing test-case names, skipping duplicate template names, and reporting an `IdRemap` for everything that changed.
  - **Transactional write (`src/store/dataStore.ts`):** `applyImport(plan)` writes in dependency order and pushes an undo closure per write; a failure unwinds in reverse, re-hydrates from the repositories, and rethrows a `StorageError` that says nothing was left behind. Undoing a prompt update re-reads the row and writes it at `current.version + 1` (replaying the old version trips `StaleWriteError`); revisions are removed with `deleteMany`. One `imported` activity event is recorded on success, built from `describePlanSummary`. `noteExport` records one `exported` event per export.
  - **UI:** `src/components/transfer/ImportDialog.tsx` (choose → preview with counts, per-prompt decisions, conflict details, overwrite warnings, confirm → result summary, error state with retry) driven by `ImportDialogProvider`; `src/features/transfer/useTransfer.ts` for the three exports with toasts and activity notes; the Settings data card (backup + import), the library bulk action (export selection), the editor toolbar (export prompt), and the palette commands `transfer.import` and `transfer.export-prompt`.
  - **Docs:** `docs/IMPORT-EXPORT.md` (markers, preserved/regenerated/never-exported tables, export actions, import steps, rejection categories, conflict table, plan semantics, rollback caveat, limits, verification table) and ADR-111 in `docs/DECISIONS.md`.
  - **Tests added (118 in `src/domain/transfer`; whole suite 109 files / 1,829 tests):** `bundle.test.ts` 37, `export.test.ts` 25, `import.test.ts` 56, `src/features/transfer/download.test.ts` 6, `ImportDialog.test.tsx` 12, `dataStore.test.ts` +4, `SettingsRoute.test.tsx` +2, `LibraryRoute.test.tsx` +2, `EditorRoute.test.tsx` +2, `coreCommands.test.ts` +2.
  - **Validation executed:** `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 with 0 warnings; `npx vitest run` — **109 files / 1,829 tests passed, 0 failures**; `npx vitest run --coverage` — exit 0, thresholds pass (all files 96.64/90.62/97.70/97.55; `src/domain/**` 91.49 flat and 91.95 in `domain/transfer` against the 90 branch gate; `bundle.ts` 98.01/94.97, `export.ts` 100/96.96, `import.ts` 97.75/87.79); `npx prettier --check .` clean; `npm run check:contrast` — 64 pairings verified in both themes; `npm run build` exit 0 — CSS 61.15 kB (14.21 kB gzip), app JS 1,190.57 kB (339.39 kB gzip), `JsonEditor` 427.66 kB, with the pre-existing >500 kB chunk warning.
  - **Not performed (stated honestly):** no browser binary exists here, so the requested **manual export/import in a browser with a seeded library was not done by hand**, and there was no manual accessibility or visual pass. Downloads are covered by tests that stub `URL.createObjectURL` and the anchor click in jsdom; real-browser download behaviour is unverified. The rollback tests force failures through the repository contract, not by killing a tab.
  - **Deviations recorded:** (1) a folder that is newly created no longer carries a `renamed` remap — the create path is only reached when no folder of that name exists under the parent, so the old `(imported)` suffix was unreachable and its branch was removed rather than left dead and untested; the documentation now describes reuse, which is what the code does. (2) The id allocator stops after 100 collisions and suffixes the id instead of looping forever, which is documented as a limitation. (3) Top-level envelope issue paths read `manifest.…` rather than `.manifest.…`.
  - **Known limitations:** ids are not stable across libraries (remaps are reported); snippets and schemas are matched by id only; compensating rollback can leave a bumped version on a restored prompt; import is not resumable; large libraries are serialized on the main thread; no ZIP, cloud transfer, drag-and-drop, or share links.
  - **Docs:** `docs/DECISIONS.md` gained ADR-111 and a TASK-026 verification log; `docs/IMPORT-EXPORT.md` is new; `tasks.md` updated.

---

### TASK-027 — Responsive refinement pass

- **Status:** In Progress (cycle 1 of the pass — see the progress record)
- **Priority:** High
- **Dependencies:** TASK-018, TASK-020, TASK-022, TASK-023, TASK-024, TASK-025, TASK-026
- **Objective:** Make every completed workspace genuinely usable from 360 px to 2560 px, replacing desktop shrink-wrap with deliberate small-screen layouts.
- **Scope:**
  - Audit every route at 360/390/768/1024/1280/1440/1920 px; fix overflow, truncated actions, unreachable controls, and cramped dialogs.
  - Editor: single-pane mode with tabbed inspector, condensed toolbar with overflow menu, sticky save status; CodeMirror horizontal scroll confined; soft-wrap toggle preference.
  - Library: filter collapse into a sheet, card grid tuning, sticky bulk bar safe-area aware.
  - Diff/lab/graph/validation: stacked layouts, table-to-card transformations, graph list fallback by breakpoint.
  - Touch targets ≥ 40 px; bottom sheets for dialogs at < 640 px; safe-area insets; no hover-only affordances.
  - Preference for density and sidebar collapse persisted.
  - Record known viewports in `docs/TESTING.md`.
- **Acceptance criteria:**
  - No horizontal page overflow at any tested breakpoint on any route (documented check).
  - All primary actions (create, save, validate, compare, export, restore) reachable on mobile.
  - Dialogs/sheets/dropdowns usable by touch; focus behavior intact after layout switches.
  - No control becomes invisible-only; nothing relies on hover.
  - Editor remains usable for real editing at 390 px.
- **Validation:** Scripted viewport screenshot review for each route; manual mobile emulation pass of the primary workflows; automated check for `document.documentElement.scrollWidth > clientWidth` in key routes; typecheck/lint/tests/build.
- **Deliverables:** responsive layout fixes across shell, routes, and feature components; documented breakpoint matrix in `docs/TESTING.md`; any new responsive helpers.
- **Out of scope:** Native mobile app, tablet-specific gestures, new features.

- **Progress record (2026-10-25, cycle 1):** partially implemented; the task is **not** complete.
  - **Done:** the responsive media-query hook (`src/lib/useMediaQuery.ts`, `useCompactLayout` / `useSinglePaneLayout`, SSR- and jsdom-safe, follows `change`, supports legacy `addListener`); dialogs become bottom sheets below 640 px with safe-area padding (`Dialog.tsx`); buttons and icon buttons grow to a 44 px target under `pointer: coarse` (`buttonVariants.ts`, `IconButton.tsx`); the shell's main column keeps clear of the home indicator (`Shell.tsx`); the editor keeps a single pane below 1024 px, rendering its inspector once inside the existing `Sheet` opened from an "Inspector" button (`EditorRoute.tsx`); `mockMatchMedia` answers only `prefers-color-scheme` so width queries default to the wide layout; a viewport matrix and the honest verification status recorded in the new `docs/TESTING.md`; ADR-112.
  - **Tests:** `src/lib/useMediaQuery.test.ts` (5) and `src/components/ui/responsive.test.tsx` (3): match/no-match, change events, unsubscribe, legacy API, missing `matchMedia`, the bottom-sheet class contract, coarse-pointer targets, safe-area padding, and the editor's single-pane inspector sheet.
  - **Still open in this task (not claimed as done):** library filters collapsed into a sheet; editor toolbar overflow menu; diff, laboratory, blueprint, and validation stacked layouts and table-to-card transformations; persisted rail-collapse and density preferences; the 360–1920 px audit itself, including a real horizontal-overflow measurement, which this environment cannot perform (no browser binary).
  - **Validation so far:** `npx tsc --noEmit` exit 0; targeted suites green (editor, ui, layout); full-suite and build results recorded in the completion record when the pass finishes.

---

### TASK-028 — Accessibility review and remediation

- **Status:** Not Started
- **Priority:** High
- **Dependencies:** TASK-027
- **Objective:** Meet the WCAG 2.2 AA target on all implemented surfaces, with verified keyboard and screen-reader semantics.
- **Scope:**
  - Automated audit: axe-core integration in component tests (no critical/serious violations on primary routes) plus manual browser audit tooling where available; retain results.
  - Keyboard audit: tab order, skip link, focus visible on all interactive elements, focus restoration for overlays, no traps outside dialogs, editor shortcuts not blocking standard navigation.
  - Screen-reader semantics: landmarks, headings, form labels, error announcements, live regions for save status/toasts, tree and list roles, graph fallback.
  - Contrast audit of token pairs in both themes; fix failures (including accent-on-surface and disabled states); document final ratios.
  - Motion: confirm reduced-motion coverage; remove non-essential animation.
  - Forms: all validation errors associated, summarized, and announced; required fields announced.
  - Document issues and remaining known gaps in `docs/ACCESSIBILITY.md` with honest status.
- **Acceptance criteria:**
  - axe reports zero critical/serious violations on dashboard, library, editor, composer, validation, templates, health, settings, and diff routes (documented run).
  - Every interactive element is reachable and operable with the keyboard; visible focus at all times.
  - Focus is trapped and restored correctly for dialogs, sheets, menus, and the palette.
  - Status is never conveyed by color alone; save/validation/diff states include text/icons.
  - Contrast checks documented; reduced motion honored globally.
- **Validation:** axe test suite run and reported; manual keyboard walkthrough of all primary workflows; contrast table recorded; screen-reader spot check (VoiceOver/NVDA if available, otherwise documented as a limitation); typecheck/lint/tests/build.
- **Deliverables:** accessibility fixes across components/routes, `src/test/a11y.ts` helpers, accessibility tests, `docs/ACCESSIBILITY.md`.
- **Out of scope:** WCAG AAA, full manual screen-reader certification, localization.

---

### TASK-029 — Automated test suite expansion

- **Status:** Not Started
- **Priority:** High
- **Dependencies:** TASK-027
- **Objective:** Consolidate unit, integration, and (if feasible) end-to-end coverage for the critical workflows, replacing ad-hoc tests with a coherent, documented suite.
- **Scope:**
  - Unit coverage targets per §10.1; fill gaps for domain modules (parse, render, diff, graph, quality, health, transfer, search, serialization, validation).
  - Integration flows per §10.2 using fake-indexeddb and Testing Library, including save failure, stale write, restore safety, import round-trip, undo.
  - Test utilities: repository factories, seeded library fixtures, fake clock/ID, render-with-providers helper, network spy guard.
  - Attempt Playwright chromium smoke suite for three primary workflows and a mobile viewport; if unavailable, document clearly and rely on integration + manual matrix.
  - CI-style single command `npm run test:run` plus coverage reporting (thresholds recorded honestly; do not gate on fabricated numbers).
  - Document test inventory and how to run in `docs/TESTING.md`.
- **Acceptance criteria:**
  - `npm run test:run` passes with a growing, meaningful suite; no skipped tests presented as coverage.
  - All domain modules from §10.1 have direct tests; critical integration flows from §10.2 are covered.
  - E2E status is reported honestly (implemented and passing, or explicitly not available with reason).
  - Tests are deterministic (no real timers/network), documented, and reasonably fast.
- **Validation:** Run full suite and record pass counts and coverage summary; re-run twice to confirm determinism; typecheck/lint/build; document results.
- **Deliverables:** expanded `src/**/*.test.ts(x)`, test utilities in `src/test/`, optional `e2e/` with config, `docs/TESTING.md`.
- **Out of scope:** 100% coverage as a vanity target, load/performance testing, visual regression service setup.

---

### TASK-030 — Integration verification and defect pass

- **Status:** Not Started
- **Priority:** High
- **Dependencies:** TASK-028, TASK-029
- **Objective:** Verify the application works as an integrated whole, fix defects found, and confirm no primary workflow is broken.
- **Scope:**
  - Execute the full manual matrix: routes, create-from-template, edit/validate/fix, save/autosave/recovery, folders/collections/tags, favorites/pins/archive, snapshots/restore, diff, variables/preview, lab/test cases, graph, inspector, health, import/export, settings, theme, ephemeral mode.
  - Cross-check persistence integrity after reload, after simulated failure, and after import/export round-trip.
  - Verify all links, palette commands, keyboard shortcuts, empty/loading/error states, and honesty banners.
  - Run full quality gate (`typecheck`, `lint`, `test:run`, `build`) and production preview smoke test.
  - Fix defects found, with regression tests for each fix; log any accepted limitations with rationale in `docs/LIMITATIONS.md`.
  - Produce an integration verification report (`docs/VERIFICATION.md`) with executed evidence, not claims.
- **Acceptance criteria:**
  - No known broken primary workflow remains; every defect is fixed or explicitly documented as an accepted limitation with impact.
  - Production build serves and all routes work in preview.
  - Persistence and data integrity verified across reload, failure simulation, and import/export.
  - Verification report lists actual commands run and results.
- **Validation:** The verification matrix itself plus recorded outputs of all quality scripts; production preview route check; typecheck/lint/tests/build.
- **Deliverables:** defect fixes + regression tests, `docs/VERIFICATION.md`, updated `docs/LIMITATIONS.md`.
- **Out of scope:** New features, redesigns, backend introduction.

---

### TASK-031 — Documentation and delivery

- **Status:** Not Started
- **Priority:** High
- **Dependencies:** TASK-030
- **Objective:** Deliver a complete, honest documentation set and a clean final repository state.
- **Scope:**
  - Root `README.md`: product summary, screenshots/feature map, prerequisites, install/dev/build/test commands, data storage and privacy statement, project structure, supported browsers, known limitations.
  - `docs/ARCHITECTURE.md`: layers, dependency rules, state/data flow, key modules, extension points, future backend path.
  - `docs/DATA-MODEL.md`: entity reference, relationships, document format spec with example, migrations.
  - `docs/PERSISTENCE.md`: IndexedDB schema, save semantics, failure handling, recovery, multi-tab behavior.
  - `docs/TESTING.md`: test inventory, commands, coverage summary, viewport matrix.
  - `docs/DECISIONS.md`: ADR log including deviations from this plan.
  - `docs/LIMITATIONS.md`: single-browser storage, no provider integration, heuristic quality rules, no real-time collaboration, browser support constraints, e2e status.
  - Deployment instructions for a static host (build output, SPA fallback rewrite requirement, base path configuration); no fabricated hosting setup.
  - Final tasks.md update: every authorized task marked Completed with verification evidence; final phase report.
- **Acceptance criteria:**
  - A new contributor can install, run, test, and build using only the README.
  - All docs match the implemented behavior; no feature is documented that does not exist.
  - Limitations are stated plainly and prominently.
  - No secrets, build artifacts, or node_modules are tracked; `.gitignore` correct.
  - Final quality gate passes from a clean install (`npm ci`).
- **Validation:** Follow the README from a clean checkout simulation (`npm ci && npm run build && npm run test:run`); link-check docs; verify git status cleanliness; record results.
- **Deliverables:** all documentation files, final `tasks.md` updates, `.gitignore` review, final verification record.
- **Out of scope:** Public hosting, marketing site, CI provider setup (documented as optional future work).

---

## 15. Milestones

| Milestone | Tasks | Demonstrable outcome |
| --- | --- | --- |
| M1 — Foundation | 001–007 | App boots, themed primitives gallery, typed domain, working IndexedDB persistence, seeded first run |
| M2 — Navigable shell | 008–010 | Real routes, command palette, dashboard from real data |
| M3 — Authoring core | 011–018 | Browse/organize prompts, edit JSON with save pipeline, validate against schemas, compose guided prompts, use templates |
| M4 — Insight & experimentation | 019–025 | Versions, diffs, variables, lab, blueprint, quality inspector, health |
| M5 — Portability | 026 | Import/export full library |
| M6 — Release quality | 027–031 | Responsive, accessible, tested, verified, documented |

---

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| CodeMirror integration weight/complexity | Editor latency, bundle size | Lazy-load editor chunk; isolate draft state; measure keystroke render cost in TASK-014/015 |
| IndexedDB quirks (Safari/private mode, quota) | Data loss perception | Capability probe, ephemeral mode banner, quota handling, recovery drafts, export guidance (TASK-006/015) |
| Autosave races and multi-tab writes | Silent overwrite | Single write queue, version-based optimistic concurrency, stale-write conflict UI, BroadcastChannel notices |
| Scope creep across 31 tasks | Delayed usable product | Strict one-task approval rule; each task independently verifiable; no feature smuggling |
| Graph/visual complexity reducing usability | Accessibility, clutter | Deterministic layout, list fallback, suppression for simple prompts, no external graph dependency |
| Broken preview in the sandbox environment | User cannot see progress | Dev server binds `0.0.0.0`, no host allowlist, relative URLs, SPA fallback documented for production preview |
| Font/asset external dependencies | Offline breakage, privacy | Self-host all fonts; no runtime network calls; verified by network-spy test |
| ValidationStudio implying semantic quality | Misleading users | Fixed disclaimers, separate error kinds, inspector labeled heuristic |
| Playwright unavailability | Weaker e2e coverage | Integration suite is primary; e2e optional and honestly reported |
| Overly large individual tasks | Unverifiable completions | Task sizes scoped to single-session implementation with explicit acceptance criteria |

---

## 17. Open Decisions and Planned Deviations

**Planned deviations from the supplied outline (documented per planning rules):**
1. Added a **Snippet** entity (not in the supplied model list) to satisfy reusable field snippets and the blueprint graph's "reusable instructions" requirement.
2. Added an **ActivityEvent** entity and capped log to satisfy the activity timeline and health dashboard requirements.
3. Autosave writes prompt records only; revisions are created on explicit snapshot/save-with-description and before restores (ADR-07). This keeps history meaningful.
4. v1 has no AI provider integration by explicit policy; the laboratory is local rendering only.
5. E2E testing with Playwright is conditional on environment support; integration tests are the guaranteed layer.
6. `/design` gallery is retained as an internal development route (documented, not part of the primary navigation).

**Decisions revised during execution:**
- Ajv (planned in §5 for TASK-016) was **not** adopted. It compiles a schema into JavaScript with
  `new Function`, which this project forbids for user-authored data and which a CSP without
  `unsafe-eval` would block. TASK-016 ships an in-house interpreter for a documented subset, and refuses
  every keyword it does not implement instead of ignoring it (ADR-83, ADR-84; support matrix in
  [`docs/VALIDATION.md`](./docs/VALIDATION.md)).

**Decisions that will be confirmed or revised during execution (and recorded in `docs/DECISIONS.md` if changed):**
- Whether to window the library list at 1,000+ prompts. TASK-011 profiled 500 prompts (search ~9 ms cold /
  ~1.5 ms warm; all cards rendered at once) and did **not** add virtualization, because it was not
  authorized and 500 is not 1,000. Revisit with measurements at the 1,000+ scale in TASK-029/030.
- Final accent color contrast pairings for light theme interactive text (TASK-002/028).
- Whether revision pruning is user-exposed or settings-only (TASK-019/025).
- Retention cap for activity events (default 500) and whether it becomes configurable (TASK-025).

---

## 18. Completion, Approval, and Workflow Rules

### 18.1 Per-Task Completion Rules

A task may be marked **Completed** only when:

1. Every acceptance criterion in its specification is satisfied and verified.
2. Its validation steps have actually been executed, with results recorded in the completion report (no invented results).
3. `npm run typecheck`, `npm run lint`, and `npm run test:run` pass (plus `npm run build` for tasks touching routing/build/lazy loading), unless a documented environment limitation prevents a step — in which case the limitation is stated, not hidden.
4. New domain logic has unit tests and new workflows have integration coverage.
5. Error, empty, and loading states for the delivered surface are checked.
6. `tasks.md` is updated: status set to Completed, checkbox checked, and a dated note added under the task with verification evidence.
7. No unrelated feature or refactor was included.

### 18.2 Approval-Required Workflow

- **One task per execution cycle.** After reporting a completed task, implementation stops completely.
- Valid approval examples: "Start the next task", "Proceed to TASK-016", "Continue with the next part", "Start Task 015".
- Invalid approval signals: a tool finishing, silence, an unrelated question, or the assistant's own judgment that it should continue. When in doubt, ask and stop.
- A task may be re-opened as **In Progress** if review reveals a defect; status must reflect reality, not optimism.
- Requirements changes: assess impact on tasks.md, update the plan, preserve completed work, and still implement only one authorized task.

### 18.3 Blocker Protocol

If a task cannot meet an acceptance criterion: set status to **Blocked**, record the blocking issue and affected criteria in this file, explain the technical reason, and ask for a decision. Never silently skip, partially mark complete, or proceed to a dependent task.

### 18.4 Phase 3 Entry Rule

Phase 3 (Final Integration and Verification) begins only after TASK-031 is authorized and completed — i.e., every planned task individually approved and completed — followed by an application-wide verification pass and the delivery documentation set.

### 18.5 Definition of Done (project)

All 31 tasks completed through explicit authorization; acceptance criteria verified; full quality gate green; integration matrix executed and recorded; accessibility and responsive targets met with honest gap reporting; documentation complete with limitations; no fake success states; no unverified claims.

---

**End of plan. No implementation has been performed. Awaiting explicit authorization to start TASK-001.**
