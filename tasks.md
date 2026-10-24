# PromptForge — Implementation Plan & Task Tracker

**Document version:** 1.0 (Phase 1 — Planning)
**Created:** 2026-10-24
**Repository:** `vedant585458/json_prompt_manager`
**Branch:** `arena/3b0d1d76-json-prompt-manager`
**Current phase:** Phase 1 — Planning and Task Definition (complete). No implementation has begun.
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
| Schema validation | **Ajv v8** + `ajv-formats` | Mature JSON Schema implementation; structured error output |
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
- [ ] TASK-003 — Core UI primitives and design gallery — High — deps: 002
- [ ] TASK-004 — Overlay, feedback, and form primitives — High — deps: 003
- [ ] TASK-005 — Domain model and prompt document specification — High — deps: 001
- [ ] TASK-006 — Persistence foundation with repositories and migrations — High — deps: 005
- [ ] TASK-007 — Seed data, application store, and first-run foundation — High — deps: 004, 006
- [ ] TASK-008 — Application shell, routing, and responsive navigation — High — deps: 004, 007
- [ ] TASK-009 — Keyboard shortcut registry and command palette — High — deps: 008
- [ ] TASK-010 — Dashboard with real library data — High — deps: 008, 009
- [ ] TASK-011 — Prompt library browsing, search, filters, and views — High — deps: 008
- [ ] TASK-012 — Prompt CRUD, folders, and collections — High — deps: 011
- [ ] TASK-013 — Tags, favorites, pins, archive, and bulk actions — Medium — deps: 012
- [ ] TASK-014 — JSON editor workspace (raw + tree views) — High — deps: 012
- [ ] TASK-015 — Save pipeline, autosave, and recovery — High — deps: 014
- [ ] TASK-016 — Validation engine and validation studio — High — deps: 015
- [ ] TASK-017 — Guided prompt composer with JSON synchronization — High — deps: 015
- [ ] TASK-018 — Template catalog and custom templates — Medium — deps: 012, 017
- [ ] TASK-019 — Version history and safe restoration — High — deps: 015
- [ ] TASK-020 — Structural diff explorer — High — deps: 019
- [ ] TASK-021 — Variable playground and prompt preview — High — deps: 015
- [ ] TASK-022 — Prompt laboratory with saved test cases — Medium — deps: 021
- [ ] TASK-023 — Blueprint dependency graph — Medium — deps: 016, 019
- [ ] TASK-024 — Quality inspector — Medium — deps: 016, 021
- [ ] TASK-025 — Health dashboard and activity timeline — Medium — deps: 016, 019
- [ ] TASK-026 — Import and export — High — deps: 012, 019
- [ ] TASK-027 — Responsive refinement pass — High — deps: 018, 020, 022, 023, 024, 025, 026
- [ ] TASK-028 — Accessibility review and remediation — High — deps: 027
- [ ] TASK-029 — Automated test suite expansion — High — deps: 027
- [ ] TASK-030 — Integration verification and defect pass — High — deps: 028, 029
- [ ] TASK-031 — Documentation and delivery — High — deps: 030

**Progress:** 2 of 31 tasks complete. TASK-001 and TASK-002 were authorized and completed on 2026-10-24. TASK-003 is next and has not been authorized.

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

- **Status:** Not Started
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

---

### TASK-004 — Overlay, feedback, and form primitives

- **Status:** Not Started
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

---

### TASK-005 — Domain model and prompt document specification

- **Status:** Not Started
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

---

### TASK-006 — Persistence foundation with repositories and migrations

- **Status:** Not Started
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

---

### TASK-007 — Seed data, application store, and first-run foundation

- **Status:** Not Started
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

---

### TASK-008 — Application shell, routing, and responsive navigation

- **Status:** Not Started
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

---

### TASK-009 — Keyboard shortcut registry and command palette

- **Status:** Not Started
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

---

### TASK-010 — Dashboard with real library data

- **Status:** Not Started
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

---

### TASK-011 — Prompt library browsing, search, filters, and views

- **Status:** Not Started
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

---

### TASK-012 — Prompt CRUD, folders, and collections

- **Status:** Not Started
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

---

### TASK-013 — Tags, favorites, pins, archive, and bulk actions

- **Status:** Not Started
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

---

### TASK-014 — JSON editor workspace (raw and tree views)

- **Status:** Not Started
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

---

### TASK-015 — Save pipeline, autosave, and recovery

- **Status:** Not Started
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

---

### TASK-016 — Validation engine and validation studio

- **Status:** Not Started
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

---

### TASK-017 — Guided prompt composer with JSON synchronization

- **Status:** Not Started
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

---

### TASK-018 — Template catalog and custom templates

- **Status:** Not Started
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

---

### TASK-019 — Version history and safe restoration

- **Status:** Not Started
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

---

### TASK-020 — Structural diff explorer

- **Status:** Not Started
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

---

### TASK-021 — Variable playground and prompt preview

- **Status:** Not Started
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

---

### TASK-022 — Prompt laboratory with saved test cases

- **Status:** Not Started
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

---

### TASK-023 — Blueprint dependency graph

- **Status:** Not Started
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

---

### TASK-024 — Quality inspector

- **Status:** Not Started
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

---

### TASK-025 — Health dashboard and activity timeline

- **Status:** Not Started
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

---

### TASK-026 — Import and export

- **Status:** Not Started
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

---

### TASK-027 — Responsive refinement pass

- **Status:** Not Started
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

**Decisions that will be confirmed or revised during execution (and recorded in `docs/DECISIONS.md` if changed):**
- Whether to window the library list at 1,000+ prompts (decided by profiling in TASK-011).
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
