# PromptForge — Decisions Log

**Maintained from:** TASK-001 (foundation) and TASK-002 (design system).
**Authority:** This file records _why_ the implementation looks the way it does. Planned decisions are
also summarized in [`../tasks.md`](../tasks.md) §5.3; entries here reflect what is actually built.

Status values: **Accepted** (in force), **Planned** (agreed, not yet built), **Superseded**.

| ADR    | Decision                                                             | Status   | Task         |
| ------ | -------------------------------------------------------------------- | -------- | ------------ |
| ADR-01 | Client-only, local-first v1 with no backend                          | Accepted | —            |
| ADR-02 | Repository boundary between UI and persistence                       | Planned  | TASK-006     |
| ADR-03 | Toolchain: Vite + React 19 + strict TypeScript                       | Accepted | TASK-001     |
| ADR-04 | Variables resolved by a non-evaluating renderer                      | Planned  | TASK-021     |
| ADR-05 | In-house structural JSON diff                                        | Planned  | TASK-020     |
| ADR-06 | Purpose-built deterministic blueprint graph                          | Planned  | TASK-023     |
| ADR-07 | Autosave never spams revisions; restore creates a safety revision    | Planned  | TASK-015/019 |
| ADR-08 | Built-in templates are versioned, immutable seeds                    | Planned  | TASK-018     |
| ADR-09 | CSS custom properties as the single token source                     | Accepted | TASK-002     |
| ADR-10 | Tailwind v4 `@theme inline` bridge over raw `--pf-*` tokens          | Accepted | TASK-002     |
| ADR-11 | Dark-first default; `system` preference resolved before first paint  | Accepted | TASK-002     |
| ADR-12 | Self-hosted typography with metric-adjusted fallbacks                | Accepted | TASK-002     |
| ADR-13 | Split accent tokens: `accent` (text/icon) vs `accent-fill` (surface) | Accepted | TASK-002     |
| ADR-14 | Contrast is an executable gate, not a spreadsheet                    | Accepted | TASK-002     |
| ADR-15 | Token-backed layout, stacking, motion, and elevation scales          | Accepted | TASK-002     |

---

## ADR-03 — Toolchain baseline

**Context.** The repository was empty; TASK-001 had to choose a stack without legacy constraints.

**Decision.** Vite 8 + React 19 + TypeScript 6 in strict mode, with `noUncheckedIndexedAccess`,
`noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax`. Vitest with jsdom and Testing
Library for tests; ESLint flat config and Prettier for quality gates.

**Consequences.** Domain logic can be written and tested before UI exists. Tailwind arrives through
its Vite plugin. No framework-level server rendering is available, which is acceptable because v1
is client-only (ADR-01).

---

## ADR-09 — CSS custom properties as the single token source

**Context.** Two themes, a dense developer UI, and a requirement that components contain no raw
color literals.

**Decision.** All theme-dependent values are `--pf-*` custom properties. Dark values live on
`:root, [data-theme='dark']`; light values override on `[data-theme='light']`. Theme-invariant
scales (spacing, radii, type, motion, layout, z-index) live in a second `:root` block.

**Consequences.** Switching themes re-resolves every dependent property without recompiling CSS.
Tests assert that both themes define the same token names, so a half-themed token cannot ship.

---

## ADR-10 — Tailwind v4 `@theme inline` bridge

**Context.** Tailwind v4 can either snapshot theme values into utilities or emit the variable
references. Snapshotting would freeze the palette at build time and break runtime theme switching.

**Decision.** `theme.css` maps every color, font, radius, type size, shadow, and easing with
`@theme inline`, e.g. `--color-surface-1: var(--pf-surface-1)`. Custom utilities in `global.css`
reference `--pf-*` directly rather than `--color-*`, because `inline` does not emit the
`--color-*` variables themselves.

**Consequences.** Utilities such as `bg-surface-1` compile to `background-color: var(--pf-surface-1)`
and follow the active theme. This behavior was verified against the production CSS bundle: every
referenced custom property is defined, and `@theme inline` variables are not left dangling.

---

## ADR-11 — Dark-first default with a pre-paint boot script

**Context.** "No flash of the wrong theme" must hold even before React mounts, and the persisted
preference must win over the OS preference.

**Decision.**

1. Dark is the product default and the fallback whenever the OS preference is unavailable.
2. A tiny inline script in `index.html` reads `promptforge.theme` from `localStorage` and sets
   `data-theme` plus `color-scheme` on `<html>` before the stylesheet paints.
3. `ThemeProvider` owns every later change, listens for OS changes only while the preference is
   `system`, and re-applies the same resolution on mount.

**Consequences.** The boot script duplicates a few lines of resolution logic because it cannot
import a module before paint. That duplication is guarded by tests that execute the real inline
script in a sandbox (`src/app/themeBoot.test.ts`) and by a test asserting the storage key matches
`src/styles/theme.ts`. Corrupt or unreadable storage falls back to dark without throwing.

**Known limitation.** Theme persistence currently uses `localStorage`. TASK-007 moves the
preference into the settings repository; the storage key stays stable so existing users keep their
choice.

---

## ADR-12 — Self-hosted typography with metric-adjusted fallbacks

**Context.** A premium product should not depend on a font CDN, must work offline, and must not
shift layout when the webfont swaps in.

**Decision.** Inter Variable (UI), JetBrains Mono Variable (code/structure), and Instrument Serif
(editorial display) are bundled through `@fontsource` packages. Three fallback faces declare
`size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override`.

**Consequences.**

- No runtime network requests are made for fonts; the production build emits the font files.
- Only latin subsets are fetched by browsers because every `@font-face` carries a `unicode-range`;
  other subsets exist in the bundle for future localization.
- The metric overrides are approximations tuned by eye, not measured from the font binaries. They
  reduce, but do not mathematically eliminate, layout shift.
- Build weight: the font assets total roughly 360 kB, of which about 110 kB (Inter latin, JetBrains
  Mono latin, Instrument Serif latin) is fetched on a first English visit.

---

## ADR-13 — Split accent tokens for accessible light mode

**Context.** Chartreuse `#C9F25C` works as a fill and as text on dark surfaces, but as text on a
light canvas it fails WCAG AA by a wide margin.

**Decision.** Two tokens with different jobs per theme:

- `--pf-accent` — text, icons, focus ring. Dark `#C9F25C`; light `#44600B`.
- `--pf-accent-fill` — filled surfaces. Dark `#C9F25C`; light `#D7F27A`.
- `--pf-accent-foreground` — text on the fill. Dark `#0B0D10`; light `#121417`.

**Consequences.** Components must choose deliberately between accent text and accent fill.
`bg-accent` is never used with `text-accent-foreground` unless contrast is checked for that theme;
the contrast gate covers the intended combinations (`accent-fill` + `accent-foreground`,
`accent` on `surface-1`, `accent` on `accent-soft`).

---

## ADR-14 — Contrast is an executable gate

**Context.** A documented contrast table drifts from the CSS the moment a token changes.

**Decision.** `scripts/check-contrast.mjs` parses `src/styles/tokens.css`, computes WCAG 2.x
relative-luminance ratios for 26 pairings in both themes, and exits non-zero below the thresholds
(4.5:1 for text, 3:1 for UI boundaries and focus rings). `npm run check:contrast` runs it;
`--markdown` regenerates the table below.

**Consequences.** A token edit that breaks contrast fails a command rather than silently shipping.
The table below is generated from the same source, so it is an evidence artifact, not a promise.

**Scope limitation.** The gate covers the token pairs the design system intends to support. It does
not prove arbitrary color combinations are accessible; TASK-028 audits real screens and adds axe
checks.

---

## ADR-15 — Token-backed layout, stacking, motion, and elevation

**Context.** Later tasks need a shared vocabulary for dense workspaces without ad-hoc values.

**Decision.**

- Layout: `--pf-container-max` (1600px), `--pf-sidebar-width` (240px), `--pf-sidebar-collapsed`
  (64px), `--pf-topbar-height` (56px), `--pf-inspector-width` (320px), `--pf-editor-min-width`.
- Stacking: `--pf-z-*` from base to command palette, exposed as `z-*` utilities.
- Motion: 120/160/240ms with one easing curve, plus a reduced-motion guard for both the OS
  preference and a future in-app setting (`[data-reduced-motion='true']`).
- Elevation: `shadow-sm` and `shadow-panel` only; borders carry most separation.

**Consequences.** Panels, overlays, and the command palette can be layered predictably. Motion is
short and suppressed for reduced-motion users; no decorative animation loops exist.

---

## TASK-002 scope notes and deviations

1. **`clsx` and `tailwind-merge` were installed in TASK-002** (originally scheduled for TASK-003) so
   the theme control could use one class-composition helper. TASK-003 will build the remaining
   primitives on the same helper.
2. **A real `ThemeToggle` component was created** (`src/components/theme/ThemeToggle.tsx`) because
   the acceptance criteria require a working manual toggle and persisted preference. TASK-003
   restyles it with design-system primitives; its behavior and accessible naming are already final.
3. **The TASK-001 smoke screen was replaced** by a temporary token-proof page, as the task
   requires. It contains no product navigation and no fake controls; the only interactive element is
   the theme group.
4. **No browser is available in this sandbox**, so visual verification was performed against the
   compiled CSS bundle and behavior-level tests rather than screenshots. This is recorded honestly
   in `docs/ARCHITECTURE.md` and the TASK-002 completion record; visual QA is repeated in TASK-027.
5. **`--pf-ink-muted` was lightened/darkened** after the first contrast run failed on
   `surface-3` (4.42:1 dark, 4.36:1 light). Final values pass on every surface.
6. **`line` vs `line-control` vs `line-strong`.** Decorative hairlines (`--pf-line`) are not held to
   the 3:1 UI-boundary rule; interactive boundaries (`--pf-line-control`, `--pf-line-strong`) are,
   and both are gated.

---

## Contrast evidence (generated from `src/styles/tokens.css`)

Run `npm run check:contrast` to reproduce. Thresholds: 4.5:1 for text, 3:1 for UI boundaries.

| --- | --- | --- | --- | --- |
| Primary text on canvas | Text | 16.80:1 ✓ | 17.52:1 ✓ | 4.5:1 |
| Primary text on surface-1 | Text | 16.07:1 ✓ | 18.45:1 ✓ | 4.5:1 |
| Primary text on surface-2 | Text | 15.16:1 ✓ | 16.35:1 ✓ | 4.5:1 |
| Primary text on surface-3 | Text | 13.97:1 ✓ | 14.94:1 ✓ | 4.5:1 |
| Secondary text on surface-1 | Text | 8.22:1 ✓ | 7.90:1 ✓ | 4.5:1 |
| Secondary text on surface-2 | Text | 7.75:1 ✓ | 7.00:1 ✓ | 4.5:1 |
| Secondary text on surface-3 | Text | 7.14:1 ✓ | 6.40:1 ✓ | 4.5:1 |
| Muted text on surface-1 | Text | 5.65:1 ✓ | 5.81:1 ✓ | 4.5:1 |
| Muted text on surface-2 | Text | 5.33:1 ✓ | 5.14:1 ✓ | 4.5:1 |
| Muted text on surface-3 | Text | 4.91:1 ✓ | 4.70:1 ✓ | 4.5:1 |
| Accent text on surface-1 | Text | 14.82:1 ✓ | 7.18:1 ✓ | 4.5:1 |
| Accent text on canvas | Text | 15.50:1 ✓ | 6.82:1 ✓ | 4.5:1 |
| Accent text on accent-soft | Text | 12.38:1 ✓ | 6.38:1 ✓ | 4.5:1 |
| Accent-fill label | Text | 15.14:1 ✓ | 14.82:1 ✓ | 4.5:1 |
| Success text on surface-1 | Text | 10.93:1 ✓ | 5.35:1 ✓ | 4.5:1 |
| Success text on success-soft | Text | 9.17:1 ✓ | 4.75:1 ✓ | 4.5:1 |
| Warning text on surface-1 | Text | 10.72:1 ✓ | 5.93:1 ✓ | 4.5:1 |
| Warning text on warning-soft | Text | 8.93:1 ✓ | 5.24:1 ✓ | 4.5:1 |
| Danger text on surface-1 | Text | 6.56:1 ✓ | 6.52:1 ✓ | 4.5:1 |
| Danger text on danger-soft | Text | 5.95:1 ✓ | 5.49:1 ✓ | 4.5:1 |
| Info text on surface-1 | Text | 7.67:1 ✓ | 6.60:1 ✓ | 4.5:1 |
| Info text on info-soft | Text | 6.78:1 ✓ | 5.66:1 ✓ | 4.5:1 |
| Control boundary on surface-1 | UI | 3.26:1 ✓ | 3.22:1 ✓ | 3:1 |
| Strong boundary on surface-1 | UI | 4.11:1 ✓ | 4.79:1 ✓ | 3:1 |
| Focus ring on canvas | UI | 15.50:1 ✓ | 6.82:1 ✓ | 3:1 |
| Focus ring on surface-1 | UI | 14.82:1 ✓ | 7.18:1 ✓ | 3:1 |

**Result:** 52 pairings verified across both themes; the gate exits 0.

---

## Verification log — TASK-002

| Check            | Command                                 | Result (2026-10-24)                                                                                      |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Types            | `npm run typecheck`                     | exit 0                                                                                                   |
| Lint             | `npm run lint`                          | exit 0                                                                                                   |
| Tests            | `npm run test:run`                      | 6 files / 47 tests passed                                                                                |
| Contrast         | `npm run check:contrast`                | 52 pairings pass, exit 0                                                                                 |
| Build            | `npm run build`                         | exit 0, CSS 31.06 kB (9.17 kB gzip)                                                                      |
| Token discipline | grep for hex outside `tokens.css`       | none found                                                                                               |
| Compiled CSS     | inspection of `dist/assets/index-*.css` | all custom properties referenced by utilities are defined; no dangling `--color-*`/`--text-*` references |
| Dev server       | `GET /`                                 | HTTP 200 on `0.0.0.0:5173`                                                                               |

## Known limitations at this stage

- Theme preference is stored in `localStorage`, not the settings repository (TASK-007).
- Component primitives, the gallery route, and the application shell do not exist yet.
- Contrast coverage is limited to the pairings listed above; real-screen auditing is TASK-028.
- No automated visual regression or screenshot diffing exists; none is planned in v1.
