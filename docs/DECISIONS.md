# PromptForge — Decisions Log

**Maintained from:** TASK-001 (foundation) and TASK-002 (design system).
**Authority:** This file records _why_ the implementation looks the way it does. Planned decisions are
also summarized in [`../tasks.md`](../tasks.md) §5.3; entries here reflect what is actually built.

Status values: **Accepted** (in force), **Planned** (agreed, not yet built), **Superseded**.

| ADR    | Decision                                                                | Status     | Task         |
| ------ | ----------------------------------------------------------------------- | ---------- | ------------ |
| ADR-01 | Client-only, local-first v1 with no backend                             | Accepted   | —            |
| ADR-02 | Repository boundary between UI and persistence                          | Accepted   | TASK-006     |
| ADR-03 | Toolchain: Vite + React 19 + strict TypeScript                          | Accepted   | TASK-001     |
| ADR-04 | Variables resolved by a non-evaluating renderer                         | Planned    | TASK-021     |
| ADR-05 | In-house structural JSON diff                                           | Planned    | TASK-020     |
| ADR-06 | Purpose-built deterministic blueprint graph                             | Planned    | TASK-023     |
| ADR-07 | Autosave never spams revisions; restore creates a safety revision       | Planned    | TASK-015/019 |
| ADR-08 | Built-in templates are versioned, immutable seeds                       | Planned    | TASK-018     |
| ADR-09 | CSS custom properties as the single token source                        | Accepted   | TASK-002     |
| ADR-10 | Tailwind v4 `@theme inline` bridge over raw `--pf-*` tokens             | Accepted   | TASK-002     |
| ADR-11 | Dark-first default; `system` preference resolved before first paint     | Accepted   | TASK-002     |
| ADR-12 | Self-hosted typography with metric-adjusted fallbacks                   | Accepted   | TASK-002     |
| ADR-13 | Split accent tokens: `accent` (text/icon) vs `accent-fill` (surface)    | Accepted   | TASK-002     |
| ADR-14 | Contrast is an executable gate, not a spreadsheet                       | Accepted   | TASK-002     |
| ADR-15 | Token-backed layout, stacking, motion, and elevation scales             | Accepted   | TASK-002     |
| ADR-22 | Destructive confirmations are deliberately non-dismissible              | Accepted   | TASK-004     |
| ADR-23 | Toast queue with an 8 s error floor and pause-on-hover/focus            | Accepted   | TASK-004     |
| ADR-24 | Empty and error states require a real action; details are disclosed     | Accepted   | TASK-004     |
| ADR-25 | `aria-modal` is set explicitly on dialog and sheet content              | Accepted   | TASK-004     |
| ADR-26 | Overlays restore focus to the opener captured at mount                  | Accepted   | TASK-004     |
| ADR-27 | Context-menu keyboard shortcut handled in the wrapper                   | Accepted   | TASK-004     |
| ADR-28 | Domain operations return issue-bearing results, never throw             | Accepted   | TASK-005     |
| ADR-29 | Unknown document fields ride along in `extras`                          | Accepted   | TASK-005     |
| ADR-30 | Factories receive an injected clock and ID generator                    | Accepted   | TASK-005     |
| ADR-31 | Content identity uses a pure FNV-1a hash, not `crypto.subtle`           | Accepted   | TASK-005     |
| ADR-32 | `Prompt.variables` is a denormalized copy of the document's list        | Accepted   | TASK-005     |
| ADR-33 | One contract suite gates both storage adapters                          | Accepted   | TASK-006     |
| ADR-34 | Boolean flags are indexed through numeric `0                            | 1` mirrors | Accepted     | TASK-006 |
| ADR-35 | Prompt writes use optimistic concurrency plus a per-prompt queue        | Accepted   | TASK-006     |
| ADR-36 | Platform failures are mapped into a typed storage-error hierarchy       | Accepted   | TASK-006     |
| ADR-37 | Declarative, replayable migrations inside the versionchange transaction | Accepted   | TASK-006     |
| ADR-38 | Cross-tab writes are announced, never merged                            | Accepted   | TASK-006     |
| ADR-39 | The data layer has a lint-enforced boundary and one public entry point  | Accepted   | TASK-006     |
| ADR-40 | Stored state is copied with `structuredClone` on read and write         | Accepted   | TASK-006     |

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

## ADR-16 — Radix behavior with bespoke visuals

**Context.** Tabs, tooltips, switches, checkboxes, and radio groups are easy to get _almost_ right
and hard to get fully right: roving focus, Escape handling, `aria-*` relationships, portal
positioning, and touch behavior all have edge cases.

**Decision.** Use unstyled Radix UI primitives for behavior (`react-tabs`, `react-tooltip`,
`react-switch`, `react-checkbox`, `react-radio-group`) and own 100% of the visuals with token
utilities. Simple controls (`Button`, `Input`, `Textarea`, `Select`, `Badge`, `Separator`,
`ProgressBar`, `Kbd`) stay hand-written because the platform already provides the semantics.

**Consequences.** Keyboard and screen-reader behavior comes from a maintained implementation while
the design stays product-specific. Radix adds six small packages; nothing is used before the task
that needs it (dialog, dropdown, and toast arrive in TASK-004).

**Verified in tests:** tooltip opens on focus and closes on Escape; tabs move with arrow keys and
skip disabled tabs; radio group is one tab stop with roving focus; checkbox/switch expose state.

---

## ADR-17 — Variant recipes in dedicated modules

**Context.** `class-variance-authority` recipes are naturally co-located with their component, but
exporting both a component and a constant from one module breaks React Fast Refresh and produced
four lint warnings during TASK-003.

**Decision.** Recipes live in `buttonVariants.ts`, `fieldVariants.ts`, `surfaceVariants.ts`,
`badgeVariants.ts`, plus `controlStyles.ts` for text-entry controls. Component files export only
components; the barrel re-exports recipes for consumers that need them (e.g. composing a custom
control with the standard button look).

**Consequences.** Lint is clean with zero warnings, recipes are reviewable in one place, and the
shared text-control treatment cannot drift between `Input`, `Textarea`, and `Select`.

---

## ADR-18 — `Field` uses a render prop for ARIA wiring

**Context.** Label association and error announcements are the most commonly broken accessibility
details in forms. Passing ids around by hand invites omissions.

**Decision.** `Field` generates the control id, hint id, and error id, then passes
`{ id, 'aria-describedby', 'aria-invalid', required }` into a render function that spreads them
onto the control.

**Consequences.** Association is structural rather than conventional. The trade-off is a slightly
less conventional API (render prop instead of children), which is documented in the architecture
guide. Tests assert label association, two-id `aria-describedby`, `aria-invalid`, `required`, and
that typed content survives an error.

---

## ADR-19 — Native `<select>` over a custom listbox

**Context.** A searchable combobox is attractive for long lists, but a correct custom listbox costs
a lot of keyboard and screen-reader work.

**Decision.** `Select` styles a native `<select>` with `appearance-none`, a chevron, and token
colors. Options support `disabled` and an optional placeholder.

**Consequences.** Platform keyboard behavior, form participation, and assistive-tech support come
for free; styling is limited to the closed control. If a later task needs searchable selection, it
will be a separate `Combobox` component with explicit ARIA, not a silent replacement of `Select`.

---

## ADR-20 — Loading announcements are sibling live regions

**Context.** Adding the loading message to the button's text changes its accessible name
("Saving" becomes "Saving Saving prompt"), which is noisy and breaks name-based queries.

**Decision.** The button keeps a stable label and `aria-busy`; when `loadingLabel` is supplied, a
sibling `role="status"` element announces the pending action.

**Consequences.** Screen-reader users hear a stable control name plus one clear status message.
The component returns a fragment in that case, which is documented in the reference table.

---

## ADR-21 — The design gallery is a real route component

**Context.** TASK-003 requires a `/design` gallery, but routing is intentionally scheduled for
TASK-008 and no router exists yet.

**Decision.** Build `DesignGallery` as a standalone route component and render it as the temporary
application root. TASK-008 mounts it at `/design` and links it from settings; no code rewrites.

**Consequences.** The gallery is reviewable now without inventing a fake navigation shell. The
deviation is recorded here and in `tasks.md`.

---

## TASK-003 scope notes

1. **Installed:** `class-variance-authority@0.7.1`, `@radix-ui/react-tooltip@1.4.1`,
   `@radix-ui/react-tabs@1.2.1`, `@radix-ui/react-switch@1.4.1`, `@radix-ui/react-checkbox@1.4.1`,
   `@radix-ui/react-radio-group@1.5.1`. Dialog/dropdown-menu were **not** installed: they are
   TASK-004 primitives and are not used anywhere yet.
2. **Not delivered (by design):** Dialog, Sheet, Toast, EmptyState, Skeleton, Alert/InlineError,
   ErrorState — all TASK-004. The gallery therefore contains no overlay demos.
3. **No product navigation, no mock data.** The single stateful specimen (snapshot list) is clearly
   labelled as a composition demo and uses in-memory React state only.
4. **`Input` size prop is renamed in type space** (`Omit<ComponentPropsWithRef<'input'>, 'size'>`)
   because the native attribute is numeric and the design scale is semantic.
5. **Copy behavior** uses `navigator.clipboard` with no legacy `execCommand` fallback: failure is
   announced instead of silently pretending to copy. Tests cover success, rejection, and a missing
   API.
6. **`sr-only` usage** relies on Tailwind's built-in utility; no custom visually-hidden class was
   added.

---

## Verification log — TASK-003

| Check        | Command                                 | Result (2026-10-24)                                                                                                                                                                |
| ------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types        | `npm run typecheck`                     | exit 0                                                                                                                                                                             |
| Lint         | `npm run lint`                          | exit 0, **0 warnings** (after ADR-17)                                                                                                                                              |
| Tests        | `npm run test:run`                      | 12 files / 92 tests passed                                                                                                                                                         |
| Formatting   | `npm run format:check`                  | clean                                                                                                                                                                              |
| Build        | `npm run build`                         | exit 0 — CSS 37.66 kB (10.34 kB gzip), JS 370.69 kB (115.91 kB gzip)                                                                                                               |
| Contrast     | `npm run check:contrast`                | 52 pairings pass                                                                                                                                                                   |
| Dev server   | `GET /` and gallery module              | HTTP 200; gallery compiles and serves                                                                                                                                              |
| Compiled CSS | inspection of `dist/assets/index-*.css` | all primitive utilities present (`size-4.5`, state variants, `aria-invalid`, `animate-spin`, `animate-fade-in`, `field-sizing-content`, `sr-only`); no undefined custom properties |

### Test inventory added in this task

| File                     | Coverage                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button.test.tsx`        | accessible naming, click, keyboard activation, loading (`aria-busy`, blocked click, stable name), icon-slot hiding, variants/sizes, disabled                                                             |
| `Field.test.tsx`         | label association, described-by wiring, `aria-invalid`, required state, input preserved on error, hidden label, textarea support                                                                         |
| `Tooltip.test.tsx`       | hidden by default, opens on keyboard focus, `aria-describedby`, Escape dismissal, pointer hover                                                                                                          |
| `Tabs.test.tsx`          | tablist naming, selection/panel relationships, arrow navigation, wrap-around, disabled skipping, click                                                                                                   |
| `CopyButton.test.tsx`    | success + live region, rejection reported, missing API reported, callback timing, icon variant naming                                                                                                    |
| `controls.test.tsx`      | checkbox (label click, indeterminate), switch, radio group (roving focus, Space selection, label click), select, input/textarea, badge, status pill, progress bar, spinner, separator, kbd, surface/card |
| `DesignGallery.test.tsx` | all sections render, every button state present, invalid-field demo preserves input, labelled controls, composed specimen state, both themes with zero console warnings                                  |

### Known limitations at this stage

- Overlays, toasts, and loading skeletons are absent by design (TASK-004).
- No screenshot-level visual verification; see `docs/ARCHITECTURE.md` §12.
- `Toggle`-style button groups do not exist yet; the theme control is still a bespoke segmented
  control and will be restyled with primitives in TASK-008.

---

## ADR-22 — Destructive confirmations are deliberately non-dismissible

**Context.** A destructive confirmation can be dismissed by a stray Escape press or a click on the
overlay. For an irreversible operation (deleting a prompt, wiping the library) that dismissal is a
reliable way to lose the user's intent, and it also makes the outcome ambiguous: did the dialog
close because the action ran, or because the click missed?

**Decision.** `ConfirmDialog` with `tone="destructive"` renders with `dismissible={false}`: Escape and
outside-pointer events are cancelled, and the corner close button is hidden. Closing requires an
explicit choice — "Cancel" or the confirm button. When `confirmationPhrase` is supplied the confirm
button stays disabled until the trimmed, case-sensitive phrase matches. Non-destructive
confirmations keep normal dismissal.

**Consequences.** Destructive flows are harder to trigger accidentally at the cost of one extra
deliberate click. Every destructive dialog must therefore have a visible Cancel button, and the
banner states that the action cannot be undone. The intent is also protected defensively in the
domain layer once destructive operations exist (TASK-013/TASK-026).

---

## ADR-23 — Toast queue with an 8 s error floor and pause-on-hover/focus

**Context.** Toasts report outcomes that the user may otherwise miss — an export written, an import
rejected, an undo now available. They also disappear, which is the point, but a single global
timeout makes errors vanish before they can be read, and rapid actions can flood the screen.

**Decision.** `ToastProvider` keeps one reducer state `{ visible, queued }`:

- At most **three** toasts are visible at once; the rest wait in a FIFO queue and are promoted as
  visible ones leave.
- Toasts are identified by an `id` (auto-generated when omitted); re-showing the same `id` replaces
  the existing toast instead of duplicating it.
- Errors never auto-dismiss before **8 s** (`TOAST_MIN_ERROR_DURATION_MS`); a caller-supplied
  `durationMs` is raised to that floor, never lowered below it. `resolveToastDuration` is exported
  and unit-tested so the rule is verifiable without fake UI.
- The countdown pauses while the toast is hovered or contains keyboard focus, and resumes after.
- Announcements use a polite live region for `success`/`info` and an assertive one for `error`.

**Consequences.** Tones are limited to `success | error | info`; anything else is an alert. Undo is
modelled as an ordinary `action` (`{ label, onClick }`) so it is a real button in the tab order — no
hover-only affordance, and activation dismisses the toast.

---

## ADR-24 — Empty and error states require a real action; details are disclosed

**Context.** "No results" and "something went wrong" screens are easy to ship as dead ends. The brief
also requires that error states expose technical detail without drowning the primary message.

**Decision.** `EmptyState` and `ErrorState` take `action` as a **required** prop (`EmptyState` also
accepts an optional secondary `hint`). `ErrorState` renders its `detail` (stack, validation output,
raw message) inside a collapsed `<details>` block set in monospace on the sunken editor surface.
`AsyncBoundary` composes both: it owns the `idle | loading | error | success` switch, shows labelled
skeletons while loading, and requires `onRetry` for the error branch.

**Consequences.** Every state ships with a next step, and a reviewer can see it in the type system.
Server or parser detail stays one interaction away rather than in the primary message.

---

## ADR-25 — `aria-modal` is set explicitly on dialog and sheet content

**Context.** Radix `DialogContent` provides the modal focus trap, `aria-hidden` on the rest of the
document, and `role="dialog"`, but it does not emit `aria-modal`. Some assistive technology uses
`aria-modal` to decide whether a dialog is modal at all.

**Decision.** `DialogContent` and `SheetContent` pass `aria-modal="true"` explicitly. The value is
asserted in `Dialog.test.tsx` and `DesignGallery.test.tsx`.

**Consequences.** One duplicated attribute in exchange for correct modality announcements. If a
non-modal dialog variant is ever needed, it must set `aria-modal={undefined}` deliberately.

---

## ADR-26 — Overlays restore focus to the opener captured at mount

**Context.** Radix restores focus to its own `DialogTrigger`. PromptForge opens most overlays from
external state (a row action, a command-palette entry, a toast action), so there is no trigger.
In that case Radix's modal content handler calls `preventDefault()` and focuses nothing, leaving
focus on `<body>`; a keyboard user loses their place entirely.

**Decision.** Each overlay renders an internal `FocusCapture` inside its portal. Its layout effect
records the element that had focus before Radix moved it, and `onCloseAutoFocus` calls
`restoreFocus(opener)`. If the opener is no longer in the document — including the case where an
overlay's own `autoFocus` field had already taken focus before the layout effect ran — focus returns
to the last element focused outside any overlay, tracked by `src/components/ui/focus-return.ts` via a
capture-phase `focusin` listener that ignores content marked `data-pf-overlay`.
As a related choice, `ConfirmDialog` no longer auto-focuses its confirm button; focus lands on the
safest control instead.

**Consequences.** Focus returns to the exact opener for trigger-driven and programmatic opens alike,
and nested overlays (a dialog opened from a sheet) return to the control inside the parent overlay.
The tracker is a module-level singleton, so tests reset document state per file.

---

## ADR-27 — Context-menu keyboard shortcut handled in the wrapper

**Context.** Browsers translate Shift+F10 and the Menu key into a `contextmenu` event, but the
translation is not universal and jsdom never performs it, so the shortcut was untestable and could
silently fail in embedded webviews.

**Decision.** `ContextMenuTrigger` wraps the Radix trigger and, on Shift+F10 / `ContextMenu`, cancels
the key event and dispatches a synthetic `contextmenu` event anchored to the element's centre.

**Consequences.** The keyboard path is real rather than assumed, and the test presses the actual
shortcut. Shift+F10 is Shift+Fn+F10 on some laptop keyboards; the Menu key and the long-press path
remain available, and every context menu action also exists in a visible menu (TASK-013).

---

## Verification log — TASK-004

| Check        | Command                                 | Result (2026-10-24)                                                                                                                                                                                                                                                                             |
| ------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types        | `npm run typecheck`                     | exit 0                                                                                                                                                                                                                                                                                          |
| Lint         | `npm run lint`                          | exit 0, **0 warnings**                                                                                                                                                                                                                                                                          |
| Tests        | `npm run test:run`                      | 16 files / 135 tests passed, no React `act(...)` warnings                                                                                                                                                                                                                                       |
| Formatting   | `npm run format:check`                  | clean                                                                                                                                                                                                                                                                                           |
| Build        | `npm run build`                         | exit 0 — CSS 42.92 kB (11.26 kB gzip), JS 433.64 kB (133.38 kB gzip)                                                                                                                                                                                                                            |
| Contrast     | `npm run check:contrast`                | 52 pairings pass                                                                                                                                                                                                                                                                                |
| Dev server   | `GET /`                                 | HTTP 200 on `0.0.0.0:5173`                                                                                                                                                                                                                                                                      |
| Compiled CSS | inspection of `dist/assets/index-*.css` | `z-modal`/`z-overlay`/`z-popover`/`z-toast`, `shadow-panel`, `skeleton` (with `prefers-reduced-motion` guard), `text-2xs`, `rounded-xs`, `bg-danger-soft`, `border-line-strong`, `bg-surface-3`, `editor-surface`, `animate-fade-in`, and the `max-sm:` bottom-sheet classes all generate rules |

### Test inventory added in this task

| File                     | Coverage                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog.test.tsx`        | hidden until opened, `role="dialog"` + `aria-modal`, title/description wiring, focus trap, focus restore, Escape and overlay dismissal, non-dismissible dialog, sheet side/bottom classes and close                           |
| `ConfirmDialog.test.tsx` | confirm/cancel callbacks, destructive non-dismissibility, required phrase (case-sensitive, trimmed), wrong-case rejection, pending state blocking a second submit, phrase reset on reopen, focus restore                      |
| `states.test.tsx`        | `EmptyState`/`ErrorState` actions and `<details>` detail, alert tones + dismissal, `AsyncBoundary` states and retry, skeleton label hiding, dropdown items (disabled/destructive), context menu via right-click and Shift+F10 |
| `ToastProvider.test.tsx` | duration floors and overrides, queue cap and promotion, id dedupe, hover/focus pause, dismiss/dismiss-all, keyboard undo, live-region politeness                                                                              |
| `DesignGallery.test.tsx` | (extended) gallery still renders every section with overlay and feedback demos mounted                                                                                                                                        |

### Known limitations at this stage

- No screenshot-level visual verification; see `docs/ARCHITECTURE.md` §12.
- Focus restoration relies on Radix's close-auto-focus event; if a future primitive bypasses
  `DialogContent`/`SheetContent` it must handle restoration itself.
- Toast timers are real timers; the pause behaviour is tested with synthetic pointer events rather
  than a real pointer, and timer-driven dismissal is verified with fake timers in isolation.

---

## ADR-28 — Domain operations return issue-bearing results, never throw

**Context.** Prompt documents arrive from the clipboard, from imports, and from the editor's raw
text. Parsing and validation are therefore the most failure-prone code in the product, and every
failure has to reach the user as an explanation next to the field that caused it.

**Decision.** Anything that can fail on user data returns
`DomainResult<T> = { ok: true, value, issues } | { ok: false, issues }`, where each issue carries
`{ path, message, severity }` and `path` is a JSON path (`variables[2].name`). Errors block
persistence and import; warnings describe normalization (trimmed strings, removed duplicates,
non-JSON unknown fields) and never block. The parser additionally converts engine syntax errors into
a single “Invalid JSON at line N, column M — reason” message.

**Consequences.** The UI never wraps domain calls in `try/catch`, and a partially valid document can
still be inspected and repaired. Exceptions remain only where a failure is a programmer error
(`stableStringify` on a cyclic object) and those helpers have issue-returning twins
(`tryStableStringify`, `tryContentHash`) for untrusted input.

---

## ADR-29 — Unknown document fields ride along in `extras`

**Context.** Import/export (TASK-026) moves documents between installations that may run different
versions. Dropping fields the current build does not know about would quietly destroy user data.

**Decision.** Unknown **top-level** keys are captured into `PromptDocument.extras` (JSON values
only), reported as warnings, and written back after the canonical sections on export. Unknown
**nested** keys are reported as warnings and dropped, because section shapes are fixed and a
half-understood nested value is more dangerous than an explicit warning.

**Consequences.** Import → edit → export is lossless for top-level extensions, while nested drift is
visible. `documentHash` includes `extras`, so a preserved field still counts as a content change.

---

## ADR-30 — Factories receive an injected clock and ID generator

**Context.** UI tests, seed data (TASK-007), and import/export round-trips all need identical
entities across runs. Calling `Date.now()` and `crypto.randomUUID()` inside factories makes that
impossible and makes assertions on timestamps brittle.

**Decision.** Every factory takes `DomainDependencies { now, newId }`, defaulting to
`systemDependencies` for the running app. Timestamps derive from `now()` only; IDs from `newId()`
only. Tests pass a fixed clock and a counter; `createRevision` deep-copies the document so a
snapshot cannot be mutated later.

**Consequences.** Deterministic tests and reproducible seed data, with a single documented place
where real time and randomness enter the domain.

---

## ADR-31 — Content identity uses a pure FNV-1a hash, not `crypto.subtle`

**Context.** Import conflict detection and autosave diffing need a cheap “did this content change?”
signal. `crypto.subtle.digest` is asynchronous, unavailable in some non-secure contexts, and pushes
the domain toward an environment-specific API.

**Decision.** `hashString` implements FNV-1a 64-bit in plain TypeScript and returns 16 hex
characters; `contentHash` hashes the stable (key-sorted) JSON of a value, and `documentHash` hashes
a document including preserved extras. It is explicitly documented as a change detector, never a
security primitive.

**Consequences.** Synchronous, dependency-free, deterministic across platforms — at the cost of
collision resistance that a cryptographic digest would provide. Nothing security-relevant relies on
it; a future signed export would use Web Crypto at the persistence boundary instead.

---

## ADR-32 — `Prompt.variables` is a denormalized copy of the document's list

**Context.** The library, the search filters, and the dashboard need variable information without
parsing every document. The document is the source of truth, but it is nested inside `content`.

**Decision.** `Prompt.variables` is written from `content.variables` at creation time (and by the
editor when the document changes), while `PromptDocument.variables` remains authoritative for
rendering. `createPrompt` defaults the copy to the document's list, and an explicit override exists
for import paths that carry a separate declaration.

**Consequences.** Fast list rendering without document parsing; the two copies must be updated in
the same write (TASK-015 own that), and a mismatch is a repair candidate for the health dashboard
(TASK-025).

---

## ADR-33 — One contract suite gates both storage adapters

**Context.** Two implementations of the same eleven repositories invite drift: the in-memory adapter
is used by tests and by the ephemeral mode, so a divergence would make tests pass while the real app
misbehaves (or the reverse).

**Decision.** `src/data/repositories/contract.ts` exports `describeRepositoryContract(label,
createRepositories)` — 25 cases covering CRUD, ordering, queries, revisions, activity, settings,
seed metadata, stale writes, and copying. The IndexedDB suite and the in-memory suite both call it
and add only their adapter-specific tests.

**Consequences.** A behavioural change must be made twice or fail; the ephemeral mode is credible
because it is verified against the durable one. The contract is deliberately semantic, not
implementation-shaped: it never inspects stores or transactions.

---

## ADR-34 — Boolean flags are indexed through numeric `0 | 1` mirrors

**Context.** IndexedDB silently skips index entries whose key is not a valid key type, and booleans
are not valid keys. An `archived` index over a boolean field would exist, report success, and match
nothing — a bug that only appears at runtime with data.

**Decision.** Rows store the domain booleans plus derived `archivedFlag`, `favoriteFlag`,
`pinnedFlag`, and `builtInFlag` mirrors (`flag()`). Index definitions target the mirrors while
keeping the specification's index names (`archived`, `favorite`, `pinned`, `isBuiltIn`). The adapter
recomputes mirrors on every write; the booleans stay authoritative.

**Consequences.** Filters work in both adapters, and the compound query path stays index-friendly.
The cost is a derived value in the row, which is asserted by the contract suite and repairable by
rewriting the record.

---

## ADR-35 — Prompt writes use optimistic concurrency plus a per-prompt queue

**Context.** Autosave, explicit saves, and revision creation can target the same prompt within
milliseconds. Without ordering, a slow write can land after a fast later one and resurrect older
content; without a version check, two tabs can silently overwrite each other.

**Decision.** `prompts.update` requires `expectedVersion` to equal the stored version, and the
incoming record must carry `expectedVersion + 1`; mismatches raise `StaleWriteError` (stale base) or
`InvalidWriteError` (bad counter) inside a single `readwrite` transaction, mutating nothing. In
addition, `createWriteQueue()` serializes tasks per prompt id (different prompts stay concurrent),
survives a rejected task, and exposes `isBusy`, `size`, and `drain`.

**Consequences.** The invariant "a version number only moves forward, by exactly one" is enforced at
the storage boundary, not by UI discipline. The queue is scheduling only — never the enforcement —
so a caller that skips it still cannot corrupt data. TASK-015 composes both.

---

## ADR-36 — Platform failures are mapped into a typed storage-error hierarchy

**Context.** A raw `DOMException` tells the UI nothing actionable: `AbortError`, `DataError`, and
`QuotaExceededError` need completely different recovery.

**Decision.** Every repository call is wrapped in `withStorageErrors(context, operation)` and
`mapStorageError` converts platform failures into `StorageError` subclasses with a stable `code`
(`unavailable`, `quota-exceeded`, `stale-write`, `migration`, `corrupt-data`, `duplicate-record`,
`not-found`, `invalid-write`, `unknown`), a user-safe message that includes the operation context, and
the original error as `cause`. Already-typed errors pass through untouched.

**Consequences.** The UI can branch on `code` without string matching, logs stay diagnosable, and no
prompt content is ever embedded in a message. The mapping table is covered exhaustively by
`errors.test.ts`.

---

## ADR-37 — Declarative, replayable migrations inside the versionchange transaction

**Context.** IndexedDB only permits schema changes inside a `versionchange` transaction, and a
half-applied upgrade would leave a database that looks fine until a query fails.

**Decision.** Migrations form a gapless, ascending list, each with an `apply` that checks before it
creates. The whole list runs inside `openDB`'s `upgrade`; any throw aborts the transaction, so the
database stays at its previous version. The original error is captured and remapped, because the
platform otherwise reports a generic `AbortError`. After opening, `meta` records the schema version
(preserving `seedVersion`) and the layout is verified against `expectedIndexes()` /
`missingStores()`. A database from a newer build is refused with `MigrationError('newer-database')`.

**Consequences.** Upgrades are atomic and repeatable; a failed migration is recoverable by fixing the
code and reopening. The integrity check turns a structurally wrong database into one clear
`CorruptDataError` instead of scattered `NotFoundError`s, and no upgrade ever re-seeds user data.

---

## ADR-38 — Cross-tab writes are announced, never merged

**Context.** Two tabs editing the same prompt is a real workflow on a local-first app. Merging
structured prompt documents automatically is not tractable and would hide data loss.

**Decision.** `createWriteBroadcaster()` posts `prompt-written`, `prompt-deleted`, and
`settings-written` announcements on `BroadcastChannel('promptforge')`; receivers validate with
`isWriteAnnouncement` and drop anything else. Version checks remain the enforcement; no merge exists.
Missing or throwing channel implementations degrade to a no-op with `supported: false`.

**Consequences.** A dirty tab can warn about an out-of-date draft and offer reload/diff (TASK-015).
The channel carries no prompt content — only ids, versions, and timestamps — so it cannot leak drafts.

---

## ADR-39 — The data layer has a lint-enforced boundary and one public entry point

**Context.** A storage layer that quietly imports React or components becomes untestable and
circular, and screens that import the IndexedDB adapter directly make the ephemeral mode impossible
to swap in.

**Decision.** ESLint blocks UI/framework imports inside `src/data/**` and blocks deep adapter/database
imports from everywhere else; `src/data/index.ts` is the only sanctioned surface. `src/data` also
avoids `any` in its public types.

**Consequences.** The layer stays DOM-free and can be exercised without a browser renderer. Both rules
were verified by temporarily adding violating files and confirming ESLint rejected them.

---

## ADR-40 — Stored state is copied with `structuredClone` on read and write

**Context.** Handing out live references to stored objects makes accidental mutation invisible — a UI
component editing a field would "save" it without a write, and the version counter would be a lie.

**Decision.** Both adapters clone on the way in and on the way out. Rows are also validated on read
(`assertStoredPrompt`, `assertStoredRevision`, `assertStoredEntity`), so a malformed record surfaces
as `CorruptDataError`.

**Consequences.** Storage is isolated from caller mutation in both modes, which the contract suite
asserts. The cost is a copy per read/write; prompts are small and list queries dominate, so this is
acceptable for v1.

---

## ADR-41 — First-run data is versioned and resumable, never transactional

**Context.** A useful first run needs a welcome prompt, starter templates, a folder, a collection, and
default settings — which means writes to five different object stores. The repository interface has
no cross-store transaction, and a partial seed must not leave duplicates or reset user edits.

**Decision.** `SEED_VERSION` gates the run through `meta.seedVersion`. Every seeded row has a fixed
id and is created only if missing (`ensure`), settings are updated in place (only `seedVersion`
moves), and the version is written last. Seeded rows produce no activity events.

**Consequences.** An interrupted seed is retried safely on the next boot, a shipped seed never
overwrites the user's edits, and a second boot does nothing but one read. The trade-off is that
seeding is idempotent rather than atomic; the seed suite covers the resume case explicitly.

---

## ADR-42 — Storage selection lives in the data layer; ephemeral mode is labelled

**Context.** Browsers deny, block, or corrupt IndexedDB often enough that a local-first app must
degrade gracefully — but a degraded app that looks durable is worse than one that admits it.

**Decision.** `openStorage()` probes storage (open, write, read, delete), tries the durable adapter,
and falls back to the in-memory adapter on any failure. It returns a `mode` and a plain-language
`notice` that `DataBootstrap` renders as a warning banner saying changes are not saved. The choice
lives in `src/data`, so no component can couple itself to an adapter.

**Consequences.** The app always starts, the demo is still fully usable, and the limitation is
stated in the UI rather than implied by a spinner. The notice is the only user-facing artefact of a
failure; technical detail stays in logs.

---

## ADR-43 — Store actions adopt the repository's write result, never a guess

**Context.** Optimistic UI is normal, but in a local-first editor an optimistic "saved" state can
misrepresent what storage accepted — especially with version checks and quota failures.

**Decision.** Every `dataStore` mutation awaits the repository and then stores the returned entity.
Prompt edits read the current row first, build the next version, and pass the read version as
`expectedVersion`. Failures are stored on `error` for inline display **and** rethrown so dialogs can
react.

**Consequences.** In-memory state always matches storage, stale writers are rejected instead of
clobbering, and the UI has a typed error to show. The cost is one extra read per prompt edit, which
is negligible against the safety it buys.

---

## ADR-44 — Activity logging is secondary to the mutation it describes

**Context.** Activity events are useful context, not data the user asked to save. Failing a
successful write because its log line could not be appended would be user-hostile; silently dropping
the failure would hide a degraded timeline.

**Decision.** Mutations record activity after the repository returns. If the append fails, the
mutation stands and `error` explains that the change was saved but its activity entry was not.
Mutations record `created`, `updated`, `archived`, `deleted`, `snapshot`, and `settings`; deletions
snapshot the prompt title so the timeline stays readable.

**Consequences.** Saving never fails because of logging, and the user is told when the timeline is
incomplete. The store caps the in-memory log with the domain's `capActivityLog` rather than
re-reading the repository.

---

## ADR-45 — One preferences store; the theme slice became a re-export

**Context.** TASK-002 shipped a theme-only preference store; TASK-007 needs density, indentation,
autosave, and reduced motion in the same place, and settings must round-trip through the repository.

**Decision.** `src/store/preferencesStore.ts` owns the full preference set and can `applySettings`
/ `toSettings`. `src/store/preferences.ts` remains as a re-export so the theme provider and its
tests keep their import path. The theme still mirrors into `localStorage` for the pre-paint script.

**Consequences.** One source of truth for preferences, no duplicated theme state, and the pre-paint
theme behaviour is untouched. `toSettings` preserves fields the store does not own.

---

## ADR-46 — Selectors are pure functions with single-entry memoization

**Context.** Library filtering, ordering, and dashboard aggregates are needed by several screens
(TASK-010, TASK-011) and must be testable without a renderer.

**Decision.** `src/store/selectors.ts` exports pure functions plus `createLibrarySelector()`, which
caches the last `(prompts, query)` result by array identity and a serialized query. No selector
library is added.

**Consequences.** Components can call the memoized selector during render without re-sorting on
unrelated re-renders, tests assert behaviour directly, and there is no cache-invalidation logic to
get wrong. The trade-off is a one-entry cache, which matches how a single screen queries.

---

## Verification log — TASK-005

| Check              | Command                                               | Result (2026-10-24)                                                                        |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Types              | `npm run typecheck`                                   | exit 0                                                                                     |
| Lint               | `npm run lint`                                        | exit 0, **0 warnings**                                                                     |
| Tests              | `npm run test:run`                                    | 21 files / 246 tests passed                                                                |
| Domain tests       | `npm run test:run -- domain`                          | 5 files / 111 tests passed                                                                 |
| Coverage           | `npm run test:coverage` (domain only, thresholds 90%) | 98.69% statements, 96.21% branches, 100% functions, 98.58% lines — gate passes             |
| Coverage by module | —                                                     | factories 100% / invariants 100% / promptDocument 99.6% / serialization 94.4% / types 100% |
| Formatting         | `npm run format:check`                                | clean                                                                                      |
| Build              | `npm run build`                                       | exit 0 — CSS 42.98 kB (11.27 kB gzip), JS 433.64 kB (133.38 kB gzip)                       |
| Purity             | `src/domain/purity.test.ts`                           | domain imports only itself; no React/storage/DOM globals; no `any`                         |

### Test inventory added in this task

| File                     | Coverage                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `promptDocument.test.ts` | value guards (cycles, non-JSON values), schema version, required/optional fields, list and variable validation, output/context/examples/metadata, extras preservation, normalization idempotence, blank/sample documents, section helpers, statistics |
| `serialization.test.ts`  | stable key sorting and pretty printing, undefined handling, unsupported values, document conversion and extras, format → parse round-trip, syntax-error messages with location, hashing determinism                                                   |
| `factories.test.ts`      | determinism under injected clock/IDs, every factory, defaults, normalization, deep-copied revision snapshots, settings clamping, `crypto` fallback                                                                                                    |
| `invariants.test.ts`     | tag normalization, title keys, variable-name rules, autosave clamping, folder depth/paths/cycles/depth limits/name uniqueness, revision numbering and sorting, activity capping                                                                       |
| `purity.test.ts`         | module inventory, import allowlist, no framework/storage/DOM usage, no `any`, complete barrel re-export                                                                                                                                               |

### Known limitations at this stage

- `Prompt.variables` and `PromptDocument.variables` can diverge until the save pipeline (TASK-015)
  keeps them in step; ADR-32 records the trade-off.
- Nested unknown document fields are dropped with a warning rather than preserved (ADR-29).
- Hashing is a change detector only; it is not cryptographically collision resistant (ADR-31).
- No persistence, seeding, or UI consumes these modules yet (TASK-006/TASK-007).

---

## Verification log — TASK-006

| Check            | Command                                         | Result (2026-10-24)                                                                               |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Types            | `npm run typecheck`                             | exit 0                                                                                            |
| Lint             | `npm run lint`                                  | exit 0, **0 warnings**                                                                            |
| Tests            | `npm run test:run`                              | 27 files / 353 tests passed                                                                       |
| Data tests       | `npm run test:run -- data`                      | 6 files / 107 tests passed                                                                        |
| Coverage         | `npm run test:coverage`                         | combined 96.12% statements, 91.55% branches, 94.25% functions, 97.20% lines — gate passes         |
| Coverage (data)  | —                                               | 94.54% statements, 84.88% branches, 92.25% functions, 96.34% lines against its own floor          |
| Formatting       | `npm run format:check`                          | clean                                                                                             |
| Contrast         | `npm run check:contrast`                        | 52 pairings pass, exit 0                                                                          |
| Build            | `npm run build`                                 | exit 0 — CSS 43.08 kB (11.30 kB gzip), JS 433.64 kB (133.38 kB gzip)                              |
| Boundaries       | temporary violating files + `npm run lint`      | both rules fired (`react` inside `src/data`, deep adapter import outside it); files then removed  |
| Coverage floors  | threshold raised to 99% on data branches        | gate failed as expected (`84.88% < 99%`), proving per-glob thresholds are enforced, then reverted |
| Unhandled errors | `npx vitest run src/data/db/migrations.test.ts` | zero unhandled rejections after the `transaction.done` guard was added                            |

### Test inventory added in this task

| File                                               | Cases | Focus                                                                                                |
| -------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| `src/data/repositories/contract.ts` (shared suite) | 25    | CRUD, ordering, queries, revisions, activity, settings, meta, stale writes, isolation                |
| `src/data/repositories/indexedDb.contract.test.ts` | 37    | schema, unique index, row conversion, lifecycle, quota, unavailability, corruption, migration errors |
| `src/data/adapters/inMemory.contract.test.ts`      | 27    | the same contract plus seeding and post-`close()` behaviour                                          |
| `src/data/db/migrations.test.ts`                   | 12    | v0→v2, idempotency, v1→v2 upgrade, meta preservation, atomic abort, newer DB, incomplete schema      |
| `src/data/db/errors.test.ts`                       | 13    | full mapping table, cause retention, typed pass-through, context strings                             |
| `src/data/writeQueue.test.ts`                      | 7     | ordering, concurrency, failure recovery, depth, drain                                                |
| `src/data/broadcast.test.ts`                       | 11    | announcements, validation, subscriptions, no-op fallback                                             |

### Known limitations at this stage

- No browser is available in this workspace, so the manual DevTools inspection of stores and indexes
  was **not** performed; an automated `expectedIndexes()` assertion is the documented substitute
  (`docs/PERSISTENCE.md` §9).
- Quota behaviour is injected at the object-store boundary rather than produced by a real full disk.
- Blocked/terminated upgrades are wired through callbacks but cannot be simulated faithfully in
  `fake-indexeddb`.
- Seeding, store wiring, autosave UI, and import/export remain out of scope (TASK-007, TASK-015,
  TASK-026).

---

## Verification log — TASK-007

| Check       | Command                                     | Result (2026-10-24)                                                                                      |
| ----------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Types       | `npm run typecheck`                         | exit 0                                                                                                   |
| Lint        | `npm run lint`                              | exit 0, **0 warnings**                                                                                   |
| Tests       | `npm run test:run`                          | 36 files / 418 tests passed                                                                              |
| Data tests  | `npm run test:run -- src/data`              | 8 files / 119 tests passed                                                                               |
| Store tests | `npm run test:run -- src/store`             | 5 files / 43 tests passed                                                                                |
| App tests   | `npm run test:run -- src/app`               | 7 files / 40 tests passed                                                                                |
| Coverage    | `npm run test:coverage`                     | domain 98.69/96.65/100/98.58 · data 94.78/84.65/93.27/96.44 · store 96.20/92.89/96.62/96.64 — gates pass |
| Formatting  | `npm run format:check`                      | clean                                                                                                    |
| Build       | `npm run build`                             | exit 0                                                                                                   |
| Contrast    | `npm run check:contrast`                    | 52 pairings pass                                                                                         |
| Boundary    | `npm run lint` after adding adapter imports | blocked until tests imported `@/data` instead                                                            |

### Test inventory added in this task

| File                                 | Cases | Focus                                                                                                     |
| ------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------- |
| `src/data/db/seed.test.ts`           | 7     | first run, second run, version gate, resume, settings preservation, edited rows, durable idempotency      |
| `src/data/storage.test.ts`           | 5     | durable path, missing IndexedDB, failed open with notice, throwing probe                                  |
| `src/store/dataStore.test.ts`        | 16    | hydration, create/update/archive/restore/delete, snapshots, settings, folders, activity, failure handling |
| `src/store/selectors.test.ts`        | 11    | filters, ordering, search, memoization, counts, tags, dashboard aggregates                                |
| `src/store/uiStore.test.ts`          | 5     | panel toggles, palette, selection semantics                                                               |
| `src/store/preferencesStore.test.ts` | 6     | defaults, clamping, `applySettings`, `toSettings`, theme pairs                                            |
| `src/app/dataBoot.test.ts`           | 5     | boot order, seed-once, notice passthrough, failure cleanup, hydration error                               |
| `src/app/DataBootstrap.test.tsx`     | 5     | loading state, ready state, ephemeral banner, boot retry, load error                                      |
| `src/app/ErrorBoundary.test.tsx`     | 5     | recovery screen, disclosure, local logging, retry, reload action                                          |

### Known limitations at this stage

- The design gallery is still the only screen; the seeded data has no real surface yet (TASK-008+).
- Onboarding is a data flag only (`Settings.onboardedAt`); the flow itself is TASK-010.
- Activity pruning runs only when a caller asks (`activity.prune`); no schedule exists yet.
- The ephemeral banner cannot offer export until TASK-026.

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
