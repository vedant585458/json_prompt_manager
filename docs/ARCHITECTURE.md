# PromptForge Architecture

**Status:** Skeleton (TASK-001), design tokens and theming (TASK-002), design-system primitives
(TASK-003). Next expansions: TASK-005 (domain model), TASK-006 (persistence), TASK-031 (final
documentation).

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
- **ADR-09 — Token-driven styling.** All color, spacing, type, motion, elevation, and stacking
  values are `--pf-*` custom properties; components use Tailwind utilities generated from them.
- **ADR-11 — Pre-paint theming.** A minimal inline boot script resolves the stored/OS theme before
  the first paint; `ThemeProvider` owns all subsequent changes.
- **ADR-14 — Contrast gate.** `npm run check:contrast` parses the token file and fails on any
  pairing below WCAG AA thresholds.

## 9. Extension points for future work

- A server-backed repository implementation can replace IndexedDB adapters without touching UI.
- AI provider execution is intentionally absent; a future provider integration must live behind a
  server-side boundary so credentials are never shipped to the client.
- Collaboration features require a backend and access-control model before any UI is added.

## 10. Design system and theming (TASK-002)

### Token layers

| File                    | Responsibility                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/tokens.css` | Theme-dependent colors for dark (`:root, [data-theme='dark']`) and light (`[data-theme='light']`), plus theme-invariant scales: typography, spacing, radii, motion, layout, and z-index                                     |
| `src/styles/theme.css`  | Tailwind v4 `@theme inline` bridge mapping `--pf-*` tokens to `--color-*`, `--font-*`, `--text-*`, `--radius-*`, `--shadow-*`, and `--ease-*` namespaces; declares the `data-theme` based `dark:` variant and keyframes     |
| `src/styles/fonts.css`  | Bundled Inter Variable, JetBrains Mono Variable, Instrument Serif, plus metric-adjusted fallback faces                                                                                                                      |
| `src/styles/global.css` | Tailwind import, base element styles, focus ring, selection, scrollbars, reduced-motion guard, and custom utilities (`content-container`, `surface-panel`, `editor-surface`, `metadata-rail`, `tabular`, `skeleton`, `z-*`) |

Rules for later tasks:

1. **No raw color values in components.** Use utilities such as `bg-surface-1`, `text-ink-muted`,
   `border-line-control`, `text-accent`, `bg-accent-fill`. `tokens.css` is the only file allowed to
   contain color literals (enforced by a test).
2. **Accent has two jobs.** Use `--pf-accent` for text, icons, and focus; `--pf-accent-fill` for
   filled surfaces with `--pf-accent-foreground` on top. See ADR-13.
3. **Decorative vs. control borders.** `border-line` for separators; `border-line-control` or
   `border-line-strong` for interactive boundaries that must meet 3:1.
4. **State is never color-only.** Pair semantic color with an icon and a text label.
5. **Motion** uses `duration-fast` (120ms), `duration-base` (160ms), or `duration-slow` (240ms)
   with `ease-out-soft`, and must be covered by the reduced-motion guard.
6. **Custom utilities referencing tokens** must use `--pf-*` names directly, because `@theme inline`
   utilities inline values and do not emit `--color-*` variables.

### Theme resolution flow

```
index.html boot script ──▶ data-theme + color-scheme on <html>   (before first paint)
        │
ThemeProvider ──▶ usePreferencesStore (theme slice) ──▶ applyResolvedTheme()
        │                                   │
        └── OS media listener (system only) └── localStorage: promptforge.theme
```

- Default is dark. `system` follows `prefers-color-scheme`; an explicit choice wins over the OS.
- OS changes update the UI only while the preference is `system`.
- Storage failures are non-fatal; the theme still applies for the session.
- TASK-007 replaces `localStorage` persistence with the settings repository, keeping the key stable.

### Verification of the visual layer

No browser is available in the development sandbox, so TASK-002 validated the visual layer through
executable evidence rather than screenshots:

- `src/styles/tokens.test.ts` — both themes define the same tokens; every Tailwind color mapping
  resolves; no color literals outside `tokens.css`; reduced-motion guards exist.
- `src/app/themeBoot.test.ts` — executes the real inline boot script in a sandbox across OS/stored/
  corrupt/throwing-storage cases and asserts it runs before the app module.
- `src/app/providers/ThemeProvider.test.tsx` — OS following, explicit override, listener teardown,
  persistence failure tolerance, and accessible pressed state.
- `scripts/check-contrast.mjs` — 26 pairings × 2 themes against WCAG thresholds, run in the build
  quality gate.
- Compiled CSS inspection — confirms utilities emit `var(--pf-*)` references and no referenced
  custom property is missing.

Screenshot-level visual QA is deferred to TASK-027 (responsive refinement) and TASK-028
(accessibility review), which are planned to capture viewport evidence.

## 11. Component usage notes (TASK-003)

Every primitive lives in `src/components/ui/` and is imported from the barrel:

```tsx
import { Button, Field, Input, StatusPill } from '@/components/ui';
```

### Rules that apply to all primitives

1. **No domain knowledge.** Nothing here imports stores, repositories, or prompt types. A
   component that needs data receives it as props.
2. **Accessible name is mandatory.** Text buttons use their label; `IconButton` requires a `label`
   prop that becomes `aria-label` and `title`; `Field` supplies a real `<label>`.
3. **State is never color-only.** Status colors arrive with an icon and text (`StatusPill`), and
   selection is exposed through `role`/`aria-*` as well as visuals.
4. **Tokens only.** No component contains a color literal; utilities come from `tokens.css`
   (ADR-09/10).
5. **Component files export components only.** Variant recipes live in `*Variants.ts` modules so
   Fast Refresh keeps working and recipes can be reviewed in isolation.
6. **One tab stop per composite.** Tabs, radio groups, and menus use roving focus; never add
   `tabIndex` inside a primitive to "fix" navigation.

### Primitive reference

| Primitive                       | Key props                                                                                                     | Notes                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                        | `variant` (`primary`/`secondary`/`ghost`/`danger`), `size`, `loading`, `leadingIcon`, `trailingIcon`, `block` | Loading sets `aria-busy`, disables activation, and announces `loadingLabel` in a sibling `role="status"` so the button's name stays stable |
| `IconButton`                    | `label` (required), `variant`, `size`                                                                         | Label becomes `aria-label`; the glyph is `aria-hidden`                                                                                     |
| `Spinner`                       | `size`, `label`                                                                                               | Decorative unless `label` is provided, then `role="status"`                                                                                |
| `Field`                         | `label`, `hint`, `error`, `required`, `hideLabel`, render-prop children                                       | Generates ids and hands the control `id`, `aria-describedby`, `aria-invalid`, `required`                                                   |
| `Input` / `Textarea`            | `size`, `invalid`, `mono` (textarea), `autoResize`, `adornment` (input)                                       | `invalid` sets `aria-invalid` and the danger border; values are never cleared by validation                                                |
| `Select`                        | `options`, `placeholder`, `invalid`                                                                           | Styled native `<select>`: platform keyboard and form semantics are kept                                                                    |
| `Checkbox`                      | `label`, `hint`, `checked` (incl. `'indeterminate'`)                                                          | Radix state machine; label click toggles                                                                                                   |
| `Switch`                        | `label`, `hint`, `checked`, `onCheckedChange`                                                                 | `role="switch"` with `aria-checked`                                                                                                        |
| `RadioGroup`                    | `label` (required), `options`, `orientation`                                                                  | Arrow keys move roving focus; Space/click selects                                                                                          |
| `Badge`                         | `tone`, `count`                                                                                               | Metadata chip; uppercase monospace                                                                                                         |
| `StatusPill`                    | `tone` (semantic only), `icon`, children                                                                      | Always icon + text                                                                                                                         |
| `Surface` / `Card`              | `variant` (`flat`/`panel`/`sunken`/`interactive`), `padding`; `Card` also `as`                                | `Card` renders `article`/`section` when the content is self-contained                                                                      |
| `Separator`                     | `orientation`, `decorative`                                                                                   | Decorative separators are hidden from AT                                                                                                   |
| `Tooltip` / `TooltipProvider`   | `content`, `side`, `align`                                                                                    | Opens on focus and hover, closes on Escape, wired via `aria-describedby`; requires `TooltipProvider` near the root (mounted in `App`)      |
| `Kbd` / `ShortcutHint`          | `keys`                                                                                                        | Renders real `<kbd>` elements                                                                                                              |
| `Tabs` / `SimpleTabs`           | `label`, `items` (`disabled` per item)                                                                        | Arrow-key navigation, one tab stop, `tab`/`tabpanel` relationships                                                                         |
| `CopyButton` / `CopyIconButton` | `value`, `label`, `copiedLabel`, `onCopied`                                                                   | Reports the real clipboard outcome; failure is announced, never shown as success                                                           |
| `ProgressBar`                   | `value`, `max`, `label`, `caption`, `tone`                                                                    | Determinate only; use a labelled `Spinner` for unknown progress                                                                            |

### Wiring a validated field

```tsx
<Field label="Prompt name" hint="Shown in the library." error={error} required>
  {(control) => (
    <Input
      {...control}
      value={name}
      onChange={(event) => setName(event.target.value)}
      invalid={Boolean(error)}
    />
  )}
</Field>
```

The render-prop shape exists so `aria-describedby`/`aria-invalid` cannot be forgotten. Errors
annotate the control; they never clear or replace its value.

### Notification and overlay patterns that belong to TASK-004

Dialogs, sheets, dropdown menus, toasts, empty states, and skeletons are intentionally absent. Do
not fake them with ad-hoc components: TASK-004 adds them with focus management and announcements.

### Gallery

`src/routes/design/DesignGallery.tsx` renders every primitive in every state. It is the visual
reference for later tasks. Routing lands in TASK-008, which mounts the gallery at `/design`; until
then it is the application root, and it contains a single real interaction (the composed snapshot
specimen) rather than simulated product UI.

## 12. Known limitations at this stage

The repository has tooling, a token/theme foundation, and a complete primitive layer. It has no
routing, no data model, no persistence, no overlays/toasts, and no product feature. `App.tsx`
renders the design gallery; TASK-008 replaces that root with real routing. The `src/` skeleton
still uses `.gitkeep` markers for modules later tasks fill in.

Verification limits at this stage: TASK-003 was validated through component tests (92 at the time
of writing), the production CSS bundle, and dev-server responses. No browser is available in the
development sandbox, so the "manual pass in both themes" was executed as an automated DOM pass
(theme toggling with zero console warnings) plus compiled-CSS inspection rather than screenshots.
Screenshot QA remains scheduled for TASK-027/028.
