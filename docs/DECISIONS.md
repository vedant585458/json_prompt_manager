# PromptForge — Decisions Log

**Maintained from:** TASK-001 (foundation) and TASK-002 (design system).
**Authority:** This file records _why_ the implementation looks the way it does. Planned decisions are
also summarized in [`../tasks.md`](../tasks.md) §5.3; entries here reflect what is actually built.

Status values: **Accepted** (in force), **Planned** (agreed, not yet built), **Superseded**.

| ADR    | Decision                                                                  | Status     | Task         |
| ------ | ------------------------------------------------------------------------- | ---------- | ------------ |
| ADR-01 | Client-only, local-first v1 with no backend                               | Accepted   | —            |
| ADR-02 | Repository boundary between UI and persistence                            | Accepted   | TASK-006     |
| ADR-03 | Toolchain: Vite + React 19 + strict TypeScript                            | Accepted   | TASK-001     |
| ADR-04 | Variables resolved by a non-evaluating renderer                           | Planned    | TASK-021     |
| ADR-05 | In-house structural JSON diff                                             | Planned    | TASK-020     |
| ADR-06 | Purpose-built deterministic blueprint graph                               | Planned    | TASK-023     |
| ADR-07 | Autosave never spams revisions; restore creates a safety revision         | Planned    | TASK-015/019 |
| ADR-08 | Built-in templates are versioned, immutable seeds                         | Accepted   | TASK-018     |
| ADR-09 | CSS custom properties as the single token source                          | Accepted   | TASK-002     |
| ADR-10 | Tailwind v4 `@theme inline` bridge over raw `--pf-*` tokens               | Accepted   | TASK-002     |
| ADR-11 | Dark-first default; `system` preference resolved before first paint       | Accepted   | TASK-002     |
| ADR-12 | Self-hosted typography with metric-adjusted fallbacks                     | Accepted   | TASK-002     |
| ADR-13 | Split accent tokens: `accent` (text/icon) vs `accent-fill` (surface)      | Accepted   | TASK-002     |
| ADR-14 | Contrast is an executable gate, not a spreadsheet                         | Accepted   | TASK-002     |
| ADR-15 | Token-backed layout, stacking, motion, and elevation scales               | Accepted   | TASK-002     |
| ADR-22 | Destructive confirmations are deliberately non-dismissible                | Accepted   | TASK-004     |
| ADR-23 | Toast queue with an 8 s error floor and pause-on-hover/focus              | Accepted   | TASK-004     |
| ADR-24 | Empty and error states require a real action; details are disclosed       | Accepted   | TASK-004     |
| ADR-25 | `aria-modal` is set explicitly on dialog and sheet content                | Accepted   | TASK-004     |
| ADR-26 | Overlays restore focus to the opener captured at mount                    | Accepted   | TASK-004     |
| ADR-27 | Context-menu keyboard shortcut handled in the wrapper                     | Accepted   | TASK-004     |
| ADR-28 | Domain operations return issue-bearing results, never throw               | Accepted   | TASK-005     |
| ADR-29 | Unknown document fields ride along in `extras`                            | Accepted   | TASK-005     |
| ADR-30 | Factories receive an injected clock and ID generator                      | Accepted   | TASK-005     |
| ADR-31 | Content identity uses a pure FNV-1a hash, not `crypto.subtle`             | Accepted   | TASK-005     |
| ADR-32 | `Prompt.variables` is a denormalized copy of the document's list          | Accepted   | TASK-005     |
| ADR-33 | One contract suite gates both storage adapters                            | Accepted   | TASK-006     |
| ADR-34 | Boolean flags are indexed through numeric `0                              | 1` mirrors | Accepted     | TASK-006 |
| ADR-35 | Prompt writes use optimistic concurrency plus a per-prompt queue          | Accepted   | TASK-006     |
| ADR-36 | Platform failures are mapped into a typed storage-error hierarchy         | Accepted   | TASK-006     |
| ADR-37 | Declarative, replayable migrations inside the versionchange transaction   | Accepted   | TASK-006     |
| ADR-38 | Cross-tab writes are announced, never merged                              | Accepted   | TASK-006     |
| ADR-39 | The data layer has a lint-enforced boundary and one public entry point    | Accepted   | TASK-006     |
| ADR-40 | Stored state is copied with `structuredClone` on read and write           | Accepted   | TASK-006     |
| ADR-41 | First-run data is versioned and resumable, never transactional            | Accepted   | TASK-007     |
| ADR-42 | Storage selection lives in the data layer; ephemeral mode is labelled     | Accepted   | TASK-007     |
| ADR-43 | Store actions adopt the repository's write result, never a guess          | Accepted   | TASK-007     |
| ADR-44 | Activity logging is secondary to the mutation it describes                | Accepted   | TASK-007     |
| ADR-45 | One preferences store; the theme slice became a re-export                 | Accepted   | TASK-007     |
| ADR-46 | Selectors are pure functions with single-entry memoization                | Accepted   | TASK-007     |
| ADR-47 | One layout route owns the shell; the error screen sits outside it         | Accepted   | TASK-008     |
| ADR-48 | One navigation model drives rail, drawer, breadcrumbs, and title          | Accepted   | TASK-008     |
| ADR-49 | Route focus moves to `main`; drawer navigation skips focus restoration    | Accepted   | TASK-008     |
| ADR-50 | Unbuilt destinations are scaffolds, not mock-ups                          | Accepted   | TASK-008     |
| ADR-51 | Settings expose only preferences whose features exist                     | Accepted   | TASK-008     |
| ADR-52 | One command registry rejects duplicate ids and shortcut conflicts         | Accepted   | TASK-009     |
| ADR-53 | Shortcut matching is pure, platform-aware, and sequence-capable           | Accepted   | TASK-009     |
| ADR-54 | Palette keeps focus in the search field and guards double execution       | Accepted   | TASK-009     |
| ADR-55 | The shortcut reference is generated from the registry                     | Accepted   | TASK-009     |
| ADR-56 | Dashboard numbers come from one pure selector; "invalid" means unparsable | Accepted   | TASK-010     |
| ADR-57 | The dashboard owns the `?filter=` library link contract                   | Accepted   | TASK-010     |
| ADR-58 | First-run dismissal is a settings write, never an optimistic hide         | Accepted   | TASK-010     |
| ADR-59 | Screens read the data store from context, not the module singleton        | Accepted   | TASK-010     |
| ADR-60 | Archived prompts are outside the dashboard's working set                  | Accepted   | TASK-010     |
| ADR-61 | The library's filter state lives in the URL, and only there               | Accepted   | TASK-011     |
| ADR-62 | One pure search module serves filtering, counts, and highlighting         | Accepted   | TASK-011     |
| ADR-63 | Pinned prompts are a separate section, not a separate result set          | Accepted   | TASK-011     |
| ADR-64 | Selection and view preference are presentation state, never prompt data   | Accepted   | TASK-011     |
| ADR-65 | Container mutations report the changes they actually made                 | Accepted   | TASK-012     |
| ADR-66 | Prompt deletion is one cascading transaction, not three calls             | Accepted   | TASK-012     |
| ADR-67 | Deleting a folder or collection never deletes a prompt                    | Accepted   | TASK-012     |
| ADR-68 | Dialogs are URL-addressable and metadata-only                             | Accepted   | TASK-012     |

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

## ADR-47 — One layout route owns the shell; the error screen sits outside it

**Context.** Every screen needs the same landmarks, navigation, skip link, and route chrome. A route
that fails to render must still produce something readable, which a shared shell cannot guarantee if
the shell is what failed.

**Decision.** `src/app/router.tsx` defines a single `/` layout route whose element is `Shell` and
whose children are the screens; `*` is a child too, so a mistyped URL keeps its navigation. The
layout's `errorElement` is a standalone `RouteErrorScreen` that renders no shell.

**Consequences.** Landmarks and focus handling exist once, and adding a screen is one line in the
table. The error screen duplicates a small amount of layout — accepted, because dependence on the
shell would defeat its purpose.

---

## ADR-48 — One navigation model drives rail, drawer, breadcrumbs, and title

**Context.** Navigation duplicated in a desktop rail, a mobile drawer, breadcrumbs, and document
titles drifts: a route gets added to one list and forgotten in another.

**Decision.** `src/components/layout/navigation.ts` declares each destination once (path, label,
description, icon, `end`), and exposes `routeLabel`/`crumbsForPath`. Both navigation surfaces render
the same `NavList`; `NavLink` supplies `aria-current="page"`.

**Consequences.** A new screen appears everywhere at once and the active state cannot disagree with
the URL. Screens not in the list (`/prompts/:promptId`) get explicit breadcrumb handling rather than
a generic fallback that would display a raw id.

---

## ADR-49 — Route focus moves to `main`; drawer navigation skips focus restoration

**Context.** In a single-page app, a route change is silent to screen readers unless focus or a live
region announces it. Meanwhile a modal drawer normally returns focus to the button that opened it —
which, after navigating, would drag the user back to the menu.

**Decision.** `useRouteChrome` focuses the `main` landmark on navigation (never on first render) and
resets scroll. `Sheet` gained `restoreFocusOnClose`, and the drawer sets it to `false` when it closes
because a destination was chosen; Escape, the close button, and the overlay still restore focus to
the menu button.

**Consequences.** The destination wins over the trigger, and the keyboard model is deterministic on
both breakpoints. The cost is one extra boolean threaded through `Sheet`.

---

## ADR-50 — Unbuilt destinations are scaffolds, not mock-ups

**Context.** TASK-008 must make every route reachable without implementing the screens behind them.
Fake controls (a save button that does nothing, a search box that returns nothing) would demonstrate
the opposite of the project's honesty constraint.

**Decision.** Each unbuilt route renders `RouteScaffold`: the screen name, what it will do, the task
that will build it, and a statement that nothing there reads or changes prompts. The top bar's search
is a disabled button with a written explanation and no ⌘K hint, because the palette ships in
TASK-009.

**Consequences.** Reviewers can navigate the whole application and see exactly what is real. The
scaffolds are throwaway by design; each is replaced wholesale by its task.

---

## ADR-51 — Settings expose only preferences whose features exist

**Context.** The preferences store already holds indentation and reduced motion, but neither has a
consumer yet. Presenting controls for them would produce a saved value with no observable effect.

**Decision.** `/settings` exposes theme, editor density, and autosave (enabled plus delay). Values
apply immediately, persist through `dataStore.saveSettings`/`preferencesStore.toSettings`, and report
the outcome — including the ephemeral "session only" wording when storage is memory-only.

**Consequences.** Every control on the screen does something observable. Indentation and reduced
motion are named in copy as arriving with the editor (TASK-014) rather than silently omitted.

---

## ADR-52 — One command registry rejects duplicate ids and shortcut conflicts

**Context.** Shortcuts accumulate across features: navigation here, save and format in TASK-015,
validation in TASK-016. Two commands bound to the same chord means one of them silently never runs,
and a duplicated id makes the palette ambiguous.

**Decision.** `createCommandRegistry()` validates every definition at registration — non-empty
namespaced id, known group, valid shortcut syntax — and throws on a duplicate id or a shortcut
already bound to another command. A batch registration rolls back on failure. `ensureCoreCommands()`
registers the core set once per session so a remount (StrictMode, HMR, tests) cannot double-register.

**Consequences.** Conflicts surface at development time with the two ids in the message. A feature
cannot quietly claim a chord; it must pick another or rename. The strictness is deliberate: the
alternative is a shortcut that works only sometimes.

---

## ADR-53 — Shortcut matching is pure, platform-aware, and sequence-capable

**Context.** `Mod` means ⌘ on macOS and Ctrl elsewhere, layouts encode Shift inside punctuation
(`?`), and the task calls for optional `G`-then-`L` sequences. Browsers expose none of this
uniformly, and DOM-level tests cannot exercise a real keyboard matrix.

**Decision.** `src/lib/commands/shortcuts.ts` parses `Mod+K` / `Shift+?` / `G L` strings into chords,
matches them against a `KeyStroke`-shaped object plus an explicit platform, and provides a small
stateful matcher for sequences. Modifier state must match exactly. Shift is ignored only for
non-alphanumeric single characters. Multiple commands may share a first chord (`G`); the second key
picks the candidate, a mismatch or 1.5 s timeout clears the prefix, and a completed single chord wins
over a pending prefix.

**Consequences.** Every rule is unit-testable without a browser, and the UI only builds a `KeyStroke`
from the event. Behaviour is deliberately conservative: `Ctrl+Shift+K` does not fire `Ctrl+K`, and a
sequence never fires from a partially typed one.

---

## ADR-54 — Palette keeps focus in the search field and guards double execution

**Context.** A command palette is used at speed: typing, arrowing, and hitting Enter. Moving DOM
focus onto each option breaks typing, and Radix's default list behaviour would focus the first
option. Running a command twice (two keydowns, a double click) is a real hazard once commands have
side effects.

**Decision.** The palette is a Radix dialog containing a combobox input and a `role="listbox"`; DOM
focus stays in the input and the arrow keys move `aria-activedescendant` between options, which is
the pattern assistive technology expects. Running a command closes the palette first (so focus
returns to the opener) and is guarded twice: a per-open ref inside the palette and the shared
`commandRunner`'s in-flight set. Auto-repeated keydown events are ignored by the global listener.

**Consequences.** Typing, arrowing, and Enter compose predictably, and a command with a slow or
asynchronous body cannot be started twice. The palette closes before the command runs, so a command
that fails cannot leave a stale modal open over the page.

---

## ADR-55 — The shortcut reference is generated from the registry

**Context.** Hand-maintained shortcut lists go stale the first time a feature lands. The task also
requires that every shortcut be documented in the help overlay.

**Decision.** `ShortcutHelpDialog` renders `commandRegistry.list()` filtered to commands that
currently have a shortcut and are available, grouped by the same `COMMAND_GROUPS` the palette uses.
The palette renders its hints from the same parsed shortcuts. Core commands are the only commands
registered, so unimplemented actions (save, format, validate) appear nowhere.

**Consequences.** A shortcut cannot be documented without being bound, and cannot be bound without
appearing in the help overlay. A command that is unavailable in the current context (`when` returns
false) disappears from both surfaces.

---

## ADR-56 — Dashboard numbers come from one pure selector, and "invalid" means unparsable

**Context.** The dashboard's job is to be trustworthy at a glance: a count that disagrees with the
library, or a "valid" badge that only means "the braces close", would teach the user to distrust the
screen. TASK-010 forbids hard-coded numbers and forbids equating valid JSON with prompt quality.

**Decision.** `src/store/dashboard.ts` exposes `selectDashboardData(input)`, a pure function over the
stored records (`prompts`, `collections`, `templates`, `revisions`, `activity`, `now`). It returns the
counts, the capped lists, and the attention items in one pass. Components never compute a count; they
render what the selector returned. `findDocumentProblems()` is the single definition of a broken
document: it passes each stored `content` — typed `unknown`, because storage is untrusted — through
`parseDocument()` and keeps the first issue's path and message. The UI says **"will not parse"** and
"Every stored document parses", never "valid prompt" or anything about quality; the first-run guide
states the same limit in words.

**Consequences.** Adding a statistic means extending `DashboardCounts`, the selector, and its tests,
which is the intended friction. Parsing cost is O(live prompts) per store change, memoised by
`useDashboardData` on the store slices; the revision total is read from the `revisions` slice that
`hydrate()` now populates (one `listByPrompt` per prompt — an N+1 the repository contract forces).

---

## ADR-57 — The dashboard owns the `?filter=` library link contract

**Context.** Every dashboard tile is supposed to be a shortcut into a filtered view, but the library
does not filter anything until TASK-011. Building links to nowhere would be a dead end; inventing a
second vocabulary in TASK-011 would break the links the dashboard ships.

**Decision.** `src/lib/libraryLinks.ts` declares the filter vocabulary once
(`all | active | draft | deprecated | favorites | archived | collections | snapshots`),
`libraryFilterHref()` builds `/library?filter=…` (with `all` keeping a clean URL), and
`readLibraryFilter()` parses it, falling back to `all` for unknown or missing values. The dashboard's
stat tiles and section actions use those helpers. Until TASK-011 applies filters, `LibraryRoute`
echoes the requested view in an info alert instead of silently dropping it.

**Consequences.** TASK-011 must honour these values (or amend this ADR and the helper together);
`collections` and `snapshots` are named now because the dashboard counts them now. A hand-typed or
stale filter never produces an empty screen — it produces the whole library.

---

## ADR-58 — First-run dismissal is a settings write, never an optimistic hide

**Context.** The guide must appear only while `settings.onboardedAt` is null and disappear
permanently once dismissed. A local flag, or hiding before storage confirms, would let a failed write
look like a saved preference.

**Decision.** `FirstRunPanel` receives `onDismiss(): Promise<void>` and shows while
`settings.onboardedAt === null`. The dashboard's handler merges `preferencesStore.toSettings(base)`
(so theme, density, and autosave survive; `seedVersion` is preserved) with a fresh `onboardedAt` and
awaits `saveSettings`. The panel disappears only after the repository accepted the record; a rejection
renders `role="alert"` copy that says the guide will return, and re-enables the button. A null settings
record hides the panel, because there is nothing to persist against.

**Consequences.** Dismissal costs one settings write and one activity entry ("Updated preferences").
The preference lives with the rest of the settings, so it survives reloads for the same reason theme
does, and cannot drift from storage.

---

## ADR-59 — Screens read the data store from context, not the module singleton

**Context.** `DataBootstrap` has accepted a `store` prop since TASK-008, but screens called
`useDataStore` directly, so the injection stopped at the bootstrap. That made the dashboard's required
integration tests impossible to write honestly: seeded in-memory repositories could not reach the
component being tested.

**Decision.** `src/store/dataStoreContext.ts` provides `DataStoreContext` and `useDataStoreApi()`,
which returns the nearest provided store and falls back to the application singleton. `DataBootstrap`
wraps its children in `DataStoreProvider`. The dashboard (`useDashboardData`, `DashboardRoute`) reads
through the hook; non-React code (boot, command context) keeps using the singleton.

**Consequences.** Tests mount the real shell, route table, store, and in-memory repositories together
and assert what a user would see. Later screens should adopt the hook; the singleton remains the
production default, so no existing behaviour changes.

---

## ADR-60 — Archived prompts are outside the dashboard's working set

**Context.** The dashboard shows "recently edited", "pinned", "favorites", and "needs attention".
Archived prompts are deliberately set aside, so mixing them in would contradict the archive.

**Decision.** Recents, pinned, favorites, unreadable-document counts, and the attention list consider
only non-archived prompts. `counts.total` is the non-archived count; `archived` is counted separately.
Collections, snapshot revisions, and templates are counted across the whole store. `isEmpty` means the
store holds no prompts at all (archived included), so an archive-only library is reported as "nothing
edited yet" rather than "empty library".

**Consequences.** Archiving a broken document removes it from attention — deliberate, because archiving
is the user saying "set this aside". Restoring it brings it back on the next render.

---

## ADR-61 — The library's filter state lives in the URL, and only there

**Context.** Search, tag, folder, collection, status, validation, archive, date, sort, and view all
have to survive navigation, work with browser back/forward, and be shareable as an in-app link.
Keeping a copy in a store would create a second source of truth that can disagree with the address
bar after a reload.

**Decision.** `src/routes/library/libraryQuery.ts` owns the whole contract: `readLibraryState()` turns
a query string into an immutable `LibraryState`, `writeLibraryState()` turns it back into a string
(dropping defaults and empty values), and `toggleTag`/`editedAfter`/`hasActiveFilters` sit beside
them. `LibraryRoute` derives every filter from `useSearchParams()` and never stores it elsewhere.

- Typing in the search box is debounced by `SEARCH_DEBOUNCE_MS` (250 ms) and written with
  `replace: true`, so one pause produces one history entry rather than one per keystroke. Every
  deliberate control (tag, folder, collection, status, validation, archived, favorites, date, sort,
  clear-all) pushes a new entry.
- The dashboard's `?filter=` shorthand (ADR-57) is read as a **base layer**; explicit parameters
  override it. `?filter=favorites&archived=0` therefore means "favorites, live prompts", and the chip
  row shows the expanded result rather than the shorthand.
- Unknown or invalid values fall back to the default instead of throwing, so a hand-edited URL cannot
  break the screen. `search` is capped at `SEARCH_MAX_LENGTH` (120) on read.
- A `?view=` parameter beats the stored view preference for that navigation, so a link can force a
  view without overwriting the preference.

**Consequences.** Reload, back/forward, and pasted in-app links reproduce the exact view; there is no
hydration path to get wrong. Long tag lists make long URLs, which is acceptable for an in-app link.
Debounced search means the address bar lags a keystroke by design — the result count follows the URL,
so what is displayed always matches what is shareable.

---

## ADR-62 — One pure search module serves filtering, counts, and highlighting

**Context.** "Why is this prompt in the results?" has to be answerable, and a result must never be
counted by one implementation and highlighted by another.

**Decision.** `src/domain/search.ts` is the only definition of a match.

- `parseSearchQuery()` lowercases, splits on whitespace, and de-duplicates; terms are **ANDed** across
  a prompt, while the four fields (title, description, tags, serialized JSON document) are **ORed**
  for each term. Searching `json schema` therefore requires both words, not just one.
- `haystackFor()` caches each prompt's lowercased fields and pretty-printed document in a `WeakMap`
  keyed on object identity. Prompts are immutable values that are replaced on save, so a cached entry
  can never be stale, and typing does not re-stringify hundreds of documents per keystroke.
- `matchPrompt()` returns `{ fields, excerpt }`; the excerpt is the first line of the JSON containing
  a term, trimmed to `SEARCH_EXCERPT_LIMIT` (96) characters, so a card can show _why_ it matched.
- `highlightSegments()` builds literal, case-insensitive ranges — no regular expression is ever
  composed from user input — and merges overlapping hits so `<mark>` elements never nest.
- The selector (`selectLibrary` → `matchPrompt`), the result count, and `HighlightedText` all call this
  module, so matches, counts, and highlights cannot drift apart.

**Consequences.** Results are ordered by the sort control, never by relevance: a search only narrows
the set, which keeps the list predictable. Search covers the stored document as text, not as
structure — it cannot ask "prompts whose `constraints` array is empty" (that is TASK-016/025
territory). The 500-prompt spot check runs at ~9 ms cold and ~1.5 ms warm per query in this workspace.

---

## ADR-63 — Pinned prompts are a separate section, not a separate result set

**Context.** A pinned section must be visible at the top, but duplicating prompts between "pinned" and
"all results" would double the count and let "select all shown" select one prompt twice.

**Decision.** The filtered set is computed once. Prompts with `pinned === true` are rendered in a
`Pinned` section above the main list and removed from the main `Matching prompts` list; filters,
search, sorting, and the archive toggle apply to both. The header count (`N of M prompts`) and the
`N shown` label each count a prompt exactly once. When every result is pinned, the results section
says so instead of vanishing. Both collections carry distinct accessible list names ("Pinned
prompts" / "Matching prompts"), and the pinned heading is a real `h3` tied to the section.

**Consequences.** No duplicated cards and no double-counted selection; "select all shown" covers pinned
and unpinned results together, matching what the user can see. Pinning itself remains a TASK-013
mutation — this task only renders the flag.

---

## ADR-64 — Selection and view preference are presentation state, never prompt data

**Context.** TASK-011 must lay the foundation for TASK-013's bulk actions and remember grid/list
without pretending either is a persisted change to a prompt.

**Decision.** Checkbox selection lives in `uiStore.selectedPromptIds` (a string array with
`setSelection`, `toggleSelection`, `clearSelection`). It survives filter changes — a bulk action should
be able to span several searches — but it is session-only and is reset explicitly by tests' `afterEach`.
The view preference is written to `localStorage` under `promptforge.library.view` through
`src/lib/viewPreference.ts`, which validates stored values and falls back to `grid`; the URL `view`
parameter takes precedence per navigation (ADR-61). Neither path touches a repository, writes an
activity event, or mutates a prompt.

**Consequences.** Nothing here can lose user data, and the selection bar can honestly say that bulk
actions arrive in TASK-013. A blocked `localStorage` (private mode, ephemeral storage) leaves the
in-session toggle working even though the preference will not survive a reload.

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

## Verification log — TASK-008

| Check          | Command                                       | Result (2026-10-24)                                                          |
| -------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Types          | `npm run typecheck`                           | exit 0                                                                       |
| Lint           | `npm run lint`                                | exit 0, **0 warnings**                                                       |
| Tests          | `npm run test:run`                            | 39 files / 451 tests passed                                                  |
| Router tests   | `npm run test:run -- src/app/router.test.tsx` | 21 tests passed                                                              |
| Drawer tests   | `npm run test:run -- src/components/layout`   | 7 tests passed                                                               |
| Settings tests | `npm run test:run -- src/routes/settings`     | 4 tests passed                                                               |
| Formatting     | `npm run format:check`                        | clean                                                                        |
| Build          | `npm run build`                               | exit 0 (Vite warns the single JS chunk exceeds 500 kB)                       |
| Contrast       | `npm run check:contrast`                      | 52 pairings pass                                                             |
| Dev server     | `GET http://127.0.0.1:5173/`                  | HTTP 200                                                                     |
| Visual review  | —                                             | **not performed** — no browser or screenshot tool exists in this environment |

### Test inventory added in this task

| File                                         | Cases | Focus                                                                                                                                                                                        |
| -------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/router.test.tsx`                    | 21    | every route renders, not-found recovery, `aria-current`, titles, theme across navigation, skip link, focus, rail collapse, prompt id, breadcrumbs, disabled search, storage wording, unmount |
| `src/components/layout/MobileNav.test.tsx`   | 7     | drawer open + focus, Tab trap, Escape restore, close-button restore, close-on-navigate focus policy, parity with rail, in-drawer hints                                                       |
| `src/routes/settings/SettingsRoute.test.tsx` | 4     | theme applies + persists, density persists, autosave switch disables delay, no save button                                                                                                   |

### Known limitations at this stage

- No browser binary is available, so responsive screenshots at 360/768/1024/1440 px and a manual
  keyboard-only pass could not be performed. Layout is asserted only through DOM tests and Tailwind's
  responsive classes.
- Routes other than `/settings` and `/design` are scaffolds; their content arrives in TASK-010 onward.
- Search and the command palette are deliberately absent (disabled control with explanation) until
  TASK-009.
- Code is not split by route yet: one JS chunk is 592 kB (183 kB gzip), which trips Vite's 500 kB
  advisory. Splitting belongs to the performance pass (`src/routes` lazy loading), not this task.
- The mobile drawer is exercised in jsdom only; its visual slide-over behaviour is untested visually.

---

## Verification log — TASK-009

| Check         | Command                                                        | Result (2026-10-24)                                     |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Types         | `npm run typecheck`                                            | exit 0                                                  |
| Lint          | `npm run lint`                                                 | exit 0, **0 warnings**                                  |
| Tests         | `npm run test:run`                                             | 46 files / 526 tests passed                             |
| Command tests | `npm run test:run -- src/lib/commands`                         | 5 files / 55 tests passed                               |
| Palette tests | `npm run test:run -- src/components/command-palette`           | 14 tests passed                                         |
| Help tests    | `npm run test:run -- src/components/layout/ShortcutHelpDialog` | 6 tests passed                                          |
| Formatting    | `npm run format:check`                                         | clean                                                   |
| Build         | `npm run build`                                                | exit 0 (single-chunk advisory unchanged from TASK-008)  |
| Contrast      | `npm run check:contrast`                                       | 52 pairings pass                                        |
| Dev server    | `GET http://127.0.0.1:5173/`                                   | HTTP 200                                                |
| Keyboard pass | manual, browser                                                | **not performed** — no browser binary in this workspace |

### Test inventory added in this task

| File                                                     | Cases | Focus                                                                                                                                                                           |
| -------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/commands/shortcuts.test.ts`                     | 20    | parsing, modifier/platform matrix, punctuation Shift, display tokens, typing targets, sequence matcher                                                                          |
| `src/lib/commands/registry.test.ts`                      | 11    | duplicate id/shortcut rejection, validation, disposal, batch rollback, subscriptions, availability, runner guards                                                               |
| `src/lib/commands/filter.test.ts`                        | 11    | fuzzy scoring, availability filtering, ranking, grouping, recents                                                                                                               |
| `src/lib/commands/coreCommands.test.ts`                  | 10    | catalogue completeness, no unimplemented commands, bindings, dev gate, run delegation                                                                                           |
| `src/lib/commands/useCommand.test.tsx`                   | 3     | hook runs with live context, unknown id, unavailable command                                                                                                                    |
| `src/components/command-palette/CommandPalette.test.tsx` | 14    | Mod+K open/close, focus, grouping, filtering, arrows, Enter, Escape + focus return, empty state, double activation, recents, typing guard, sequences, theme toggle, auto-repeat |
| `src/components/layout/ShortcutHelpDialog.test.tsx`      | 6     | generated list, registry additions, unavailable/unscheduled commands omitted, top-bar trigger, Escape, palette priority                                                         |

### Known limitations at this stage

- **No manual keyboard-only pass was performed** — there is no browser or input device in this
  environment. Keyboard behaviour is covered by jsdom tests that dispatch real key events through
  `user-event`, not by human interaction.
- **"Focus library search" is not registered.** The library has no search field until TASK-011, and
  listing a command that cannot do anything would violate the availability rule. It will be
  registered by TASK-011 together with the field.
- Two-step sequences are limited to two chords by design; deeper chains would need a clearer UI.
- Recent commands are session-only (deliberately not persisted); "search history" is out of scope.
- The palette is rendered inside the shell, so it is unavailable on the standalone route-error
  screen — that screen intentionally owns no application chrome.

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

## ADR-69 — Selection is route state; only writes are store state

**Status:** Accepted (TASK-013)

**Context.** Bulk actions need a set of targets that the user can see and change, and that must never
apply to a row they cannot see. Storing the selection in `uiStore` would have made it survive
navigation and leak across screens; storing it in `dataStore` would have mixed presentation state into
the persisted data model.

**Decision.** The selection is a `Set<string>` in `LibraryRoute`, derived from and cleared by the URL:
any change to the search, filters, sort, scope, folder, or archive toggle clears it. `Select all shown`
selects exactly the ids the current query rendered and reports that scope in the bar. A row that leaves
the view is not in the set, so it cannot be modified by a later action.

**Consequences.** Bulk actions can only ever touch visible, selected rows. The trade-off is that
selection is lost on an accidental filter change; that is preferable to silently acting on hidden
records, and it is stated in the UI ("All N prompts shown").

## ADR-70 — Bulk writes are one all-or-nothing transaction

**Status:** Accepted (TASK-013)

**Context.** Favoriting, tagging, archiving, and deleting a selection each touch many prompt rows. The
first version of the store looped over the selection and awaited `prompts.update` per row, so a failure
half-way left the library partly changed and the toast could not honestly describe the result.

**Decision.** The repository contract gained two batch operations, implemented by both adapters and
proven by the shared contract suite:

- `prompts.updateMany(writes)` — validates each `expectedVersion` and the exact +1 version step, aborts
  the IndexedDB transaction on the first stale/missing/invalid write, and resolves with the saved rows.
- `prompts.deleteManyCascade(ids)` — removes every listed prompt with its revisions and test cases inside
  one transaction.

The store's `bulkWrite()` helper composes the updated rows, calls `updateMany`, then re-reads storage.
Only after that does it touch in-memory state.

**Consequences.** A bulk action either lands completely or not at all, and the toast can report the rows
the store actually returned. Cost: a very large selection is one longer transaction instead of many
short ones — acceptable at the library sizes this app targets, and it keeps the version checks in one
place.

## ADR-71 — Undo restores a snapshot of the reversible fields

**Status:** Accepted (TASK-013)

**Context.** Archive, restore, favorite, unpin, and tag edits are reversible; deletion is not. An inverse
operation (e.g. "unfavorite the same ids") would overwrite changes made after the bulk action, and a
"reload the old rows" approach would discard edits the user made in between.

**Decision.** Every reversible bulk action returns `{ prompts, previous }`, where `previous` holds the
affected rows _before_ the write. Undo passes those snapshots to `restorePrompts`, which writes only
`favorite`, `pinned`, `archived`, and `tags`, keeps the current title/description/content, and advances
the version like any other write. Undo for a bulk delete uses the full `{ prompts, revisions, testCases }`
snapshot returned by `deletePrompts` and re-creates those records.

Both paths are wrapped: a failure shows `That change could not be undone` (or `Those prompts could not be
restored`) with the storage message, and nothing is claimed.

**Consequences.** Undo is honest under concurrent edits and never invents success. It cannot resurrect a
row deleted in another tab — the store skips it, which is documented in the code and the report.

## ADR-72 — Tag rename happens in place, and removals win over additions

**Status:** Accepted (TASK-013)

**Context.** Two tag operations interact: renaming a tag across the library (possibly merging into an
existing tag) and editing tags on a selection (adding and removing at once). Rebuilding a tag list from a
set reordered tags and produced surprising duplicates when a rename merged into an existing tag.

**Decision.** `normalizeTags` is the single tag rule (trim, enforce display case, de-duplicate preserving
first occurrence). `renameTag` maps existing tags in place, then normalizes and de-duplicates, so order
survives and a merge collapses. `applyTagEdit` applies the removal set first and filters additions
through it, so an id that is both added and removed ends up removed.

**Consequences.** Tag order is stable across a rename, and the "add and remove the same tag" case has one
predictable answer instead of two.

## ADR-73 — The editor locates syntax errors with its own scanner

**Status:** Accepted (TASK-014)

**Context.** The editor has to say _where_ a document stopped being JSON, precisely enough to move the
caret there. `JSON.parse` was the obvious oracle, but V8's message shape depends on the input: some
failures report a character offset, some a `(line X column Y)` suffix, and some only a truncated
snippet. A long document with a bare word reports `Unexpected token 'o'` and points past the mistake.

**Decision.** `src/domain/jsonText.ts` contains `scanJson`, a recursive-descent JSON parser that tracks
its own cursor. It returns either the parsed value or `{ message, line, column, offset }`, with messages
written for a person ("Expected “,” or “}” after the property value, found “””."). It also refuses two
things the engine accepts silently: nesting past `MAX_JSON_DEPTH` (200) and numbers that overflow to
`Infinity`.

**Consequences.** Every surface — the error panel, the toolbar's enabled state, the status badge, the
tree view's fallback, format and minify — reads one location, and the numbers agree. The cost is a
parsed copy of the document in the domain layer; at these sizes (and behind a debounce) that is cheaper
than a wrong caret.

## ADR-74 — Editor syntax colors are tokens, not literals

**Status:** Accepted (TASK-014)

**Context.** CodeMirror themes usually hard-code colors, which would have produced a third palette and
no contrast guarantee in either theme.

**Decision.** The editor's chrome and its JSON token colors are defined in `tokens.css` (`--pf-editor-*`)
for both themes and consumed through `var(...)` in `editorTheme.ts`. `npm run check:contrast` gained a
pairing per syntax color against `--pf-editor-bg`, so a token that becomes unreadable fails the build
rather than shipping.

**Consequences.** The editor re-themes when `data-theme` changes without re-mounting, and the contrast
gate now covers 64 pairings. Cost: six more tokens per theme to maintain, and a dark-first palette that
must stay legible in the light theme too.

## ADR-75 — CodeMirror is a lazy chunk, and the route owns the document

**Status:** Accepted (TASK-014)

**Context.** CodeMirror is the single heaviest dependency in the project, and only one route needs it.
The editor also has to stay testable in jsdom, where content measurement is faked.

**Decision.** `EditorRoute` imports `JsonEditor` with `React.lazy` behind a `Suspense` fallback, so the
editor and its CodeMirror dependencies build to their own asset (≈428 kB, ≈139 kB gzip). The document
text, the parse, and the draft live in the route (`useDocumentDraft`); the editor component only mounts
CodeMirror, exposes an imperative handle (`jumpToOffset`, `selectAll`, `openSearch`, `undo`, `redo`), and
reports the caret. `JsonEditor` is also exported directly, which is how its own tests drive real
CodeMirror transactions.

**Consequences.** The initial bundle excludes CodeMirror (the app ships ≈227 kB gzip without it). The
editor unmounts when the tree tab is active, so CodeMirror's undo history resets on a tab switch — the
draft text does not. Switching tabs is not treated as an edit.

## ADR-76 — A draft is a recovery copy, never a save

**Status:** Accepted (TASK-014)

**Context.** Autosave is TASK-015, but people lose work to reloads long before a save pipeline exists.
The product must not imply that editing here persists anything.

**Decision.** Edits live in component state and are mirrored to `localStorage` under
`promptforge.editor.draft.<promptId>` after a 300 ms pause: namespaced, size-capped (2 MB), and parsed
defensively on read. The copy is removed as soon as the text matches the stored document. A dirty draft
installs a `beforeunload` handler and a `useBlocker` guard that asks before an in-app navigation. The
status bar, the footer, and the summary card each say the text is a draft and that saving arrives in
TASK-015; no save command is registered and `Mod-S` stays unbound.

**Consequences.** A reload can lose the tab's undo history but not the text. Because the draft is not a
save, there is no conflict handling here — TASK-015 owns versions, conflict resolution, and the real
status indicator.

## ADR-77 — The tree view is read-only, flattened, and announced through one active row

**Status:** Accepted (TASK-014)

**Context.** A tree of nested `role="group"` nodes is hard to render performantly and fiddly to focus,
while a list of divs usually loses the hierarchy for screen readers.

**Decision.** `buildJsonTree` produces the whole model once, `visibleJsonTreeRows` flattens it for the
current expansion set, and the container is a single tab stop with `aria-activedescendant` naming the
active row. Rows carry `role="treeitem"`, `aria-level`, `aria-expanded`, and `aria-selected`; arrow keys
are resolved by `treeKeyboardAction` (a pure function over the visible rows, following the WAI-ARIA tree
pattern). The view is read-only: authoring happens in the raw editor, so there is exactly one write path.

**Consequences.** Keyboard behavior is unit-tested without a DOM, and the tree cannot drift from the text
because both come from the same parse. Cost: a very large document produces a large row list — the panel
scrolls and the model is rebuilt only when the parsed value changes.

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

---

## Verification log — TASK-010

| Check                 | Command                                                       | Result (2026-10-24)                                                  |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Types                 | `npm run typecheck`                                           | exit 0                                                               |
| Lint                  | `npm run lint`                                                | exit 0, **0 warnings**                                               |
| Tests                 | `npm run test:run`                                            | 50 files / **572 tests passed** (46 new)                             |
| Dashboard integration | `npx vitest run src/routes/dashboard/DashboardRoute.test.tsx` | 15 tests passed                                                      |
| Dashboard selectors   | `npx vitest run src/store/dashboard.test.ts`                  | 16 tests passed                                                      |
| Date helpers          | `npx vitest run src/lib/dates.test.ts`                        | 10 tests passed                                                      |
| Library link contract | `npx vitest run src/lib/libraryLinks.test.ts`                 | 5 tests passed                                                       |
| Formatting            | `npm run format:check`                                        | clean                                                                |
| Build                 | `npm run build`                                               | exit 0 — CSS 49.38 kB (12.33 kB gzip), JS 645.20 kB (197.38 kB gzip) |
| Contrast              | `npm run check:contrast`                                      | 52 pairings pass                                                     |
| Visual checks         | both themes, 390 px / 1440 px                                 | **not performed** — no browser binary in this workspace              |

### Test inventory added in this task

| File                                           | Cases | Focus                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/dates.test.ts`                        | 10    | long/short/date-time formatting, relative buckets, future skew, greeting boundaries, ISO day                                                                                                                                                                                                          |
| `src/store/dashboard.test.ts`                  | 16    | counts from records, empty and 250-prompt libraries, recents/pinned/favorites caps, template order, activity cap, real parse failures, staleness, attention ordering, summary copy                                                                                                                    |
| `src/lib/libraryLinks.test.ts`                 | 5     | clean default URL, every filter round-trip, label coverage, unknown-value fallback, leading `?` handling                                                                                                                                                                                              |
| `src/routes/dashboard/DashboardRoute.test.tsx` | 15    | seeded repositories → rendered numbers and hrefs, summary sentence, filter navigation, recents ordering + editor navigation, pinned/favorites separation, template previews, activity cap, broken-document reporting, empty states, first-run show/persist/re-hide, failed dismissal, palette trigger |

### Known limitations at this stage

- **No visual verification was performed.** There is no browser in this workspace, so the required
  390 px / 1440 px and both-theme pass is deferred to TASK-027/028. Layout relies on wrapping grid
  utilities and `min-w-0`/`truncate` rather than measured screenshots.
- Dashboard tiles that map to a filter resolve to the library **scaffold** until TASK-011; the scaffold
  says so and echoes the requested view (ADR-57) instead of pretending to filter.
- Template previews link to `/templates` and do not instantiate a prompt; creating from a template is
  TASK-018.
- `counts.snapshots` counts every stored revision, but nothing creates revisions yet (TASK-015/019), so
  it is 0 on a fresh install and only moves when a snapshot is taken.
- `hydrate()` fetches revisions per prompt (N+1) because `RevisionRepository` exposes no list-all
  method. Acceptable for the dashboard total; revisit if a repository-level list is authorized.
- The single-chunk build advisory (645 kB / 197 kB gzip) is unchanged in kind and still accepted;
  route-level code splitting is not part of any authorized task yet.

### Deliberate deviations recorded for TASK-010

- Added `src/components/dashboard/{DashboardSection,PromptRow,TemplatePreview}.tsx`,
  `src/components/dashboard/useDashboardData.ts`, `src/store/dataStoreContext.ts`, and
  `src/app/providers/DataStoreProvider.tsx` beyond the deliverables list: the shared card shell and row
  keep six sections consistent, the template preview needed a name, and the context is what makes the
  required integration tests honest (ADR-59).
- `src/store/dataStore.ts` gained a `revisions` slice (hydration, snapshot, delete) because the
  snapshot statistic has no other source; `hydrate()` therefore performs one revision query per prompt.
- `BadgeTone` is now exported from `src/components/ui/index.ts` so the shared prompt row can type its
  status→tone table instead of re-deriving the union.

## Verification log — TASK-011

| Check                | Command                                                        | Result (2026-10-24)                                                  |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Types                | `npm run typecheck`                                            | exit 0                                                               |
| Lint                 | `npm run lint`                                                 | exit 0, **0 warnings**                                               |
| Tests                | `npm run test:run`                                             | 55 files / **658 tests passed** (86 new)                             |
| Library integration  | `npx vitest run src/routes/library/LibraryRoute.test.tsx`      | 25 tests passed                                                      |
| Search domain        | `npx vitest run src/domain/search.test.ts`                     | 22 tests passed                                                      |
| Library URL contract | `npx vitest run src/routes/library/libraryQuery.test.ts`       | 16 tests passed                                                      |
| Selectors            | `npx vitest run src/store/selectors.test.ts`                   | 20 tests passed                                                      |
| Folder tree          | `npx vitest run src/lib/folderTree.test.ts`                    | 9 tests passed                                                       |
| View preference      | `npx vitest run src/lib/viewPreference.test.ts`                | 5 tests passed                                                       |
| Dashboard (regress)  | `npx vitest run src/routes/dashboard/DashboardRoute.test.tsx`  | 15 tests passed                                                      |
| Formatting           | `npm run format:check`                                         | clean                                                                |
| Contrast             | `npm run check:contrast`                                       | 52 pairings pass                                                     |
| Build                | `npm run build`                                                | exit 0 — CSS 50.52 kB (12.54 kB gzip), JS 678.65 kB (206.09 kB gzip) |
| Visual checks        | 360 px / 390 px / 1440 px, both themes                         | **not performed** — no browser binary in this workspace              |
| Keyboard pass        | scripted: `/` focuses search, Enter on a card opens the prompt | jsdom only                                                           |

### Test inventory added in this task

| File                                       | Cases | Focus                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/search.test.ts`                | 22    | query parsing, per-field matches, AND across terms, tag/content matching, excerpts and their limit, highlight merging and literal input, 500-prompt timing and order stability                                                                                                                                                                                                                                       |
| `src/routes/library/libraryQuery.test.ts`  | 16    | every parameter round-trip, default omission, `?filter=` base layering, tag toggling, edited windows, `hasActiveFilters`, length cap, unknown-value fallback                                                                                                                                                                                                                                                         |
| `src/routes/library/LibraryRoute.test.tsx` | 25    | seeded repositories through the real shell: count parity, pinned separation, grid/list parity, parse-failure badge, debounce→URL→results, highlighting and JSON excerpt, tag/folder/status/archive filtering, dashboard shorthand, back/forward, sorting, persisted view, empty library vs no matches, loading skeleton, failed read with recovery detail, selection, Enter-to-open, `/` shortcut, 500-prompt filter |
| `src/store/selectors.test.ts`              | 9 new | folder subtree, OR/AND tag filters, collection membership, parse-state filter, snapshot filter, edited-after window, combined filters, sort stability                                                                                                                                                                                                                                                                |
| `src/lib/folderTree.test.ts`               | 9     | ordering, orphan handling, nesting, cycle rejection, subtree ids, flattening                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/viewPreference.test.ts`           | 5     | validation, default, read/write through a storage stub, failure tolerance                                                                                                                                                                                                                                                                                                                                            |

### Known limitations at this stage

- **No visual verification was performed.** There is no browser in this workspace, so the 360 px /
  390 px / 1440 px and both-theme pass is deferred to TASK-027/028. Overflow safety rests on
  `min-w-0`, wrapping grids, `truncate`, and a rail that becomes a full-width block below `lg`; nothing
  was measured.
- **Timings are jsdom numbers, not browser numbers.** The search spot check measures the pure
  filtering pipeline for 500 prompts (~9 ms cold, ~1.5 ms warm), not paint or layout.
- **No virtualization.** 500 cards render at once. Correct and responsive at that size in this
  workspace, but windowing is deliberately deferred until it is authorized with evidence.
- **Bulk actions do not exist yet.** The selection bar counts checkboxes and says that TASK-013 adds
  the actions; nothing is mutated from the library.
- **Organization is read-only.** Folders and collections can be navigated but not created or edited
  (TASK-012), and the rail says so when they are empty. Tags, favorites, pins, and archive are
  displayed from stored data without mutation controls (TASK-013).
- **`?filter=` is expanded on arrival.** A shared link using the dashboard's shorthand is rewritten into
  explicit parameters by the chip row; the shorthand itself is still accepted.
- The single-chunk build advisory (678 kB / 206 kB gzip) is accepted; route-level code splitting is not
  authorized yet.

### Deliberate deviations recorded for TASK-011

- Added `src/lib/folderTree.ts`, `src/lib/viewPreference.ts`, `src/routes/library/libraryQuery.ts`, and
  `src/lib/commands/librarySearchFocus.ts` beyond the deliverables list so the rail's tree maths, the
  view preference, the URL contract, and the `/` command each have one testable home instead of living
  inside a component.
- Added `src/components/library/{PromptBadges,HighlightedText}.tsx` as the shared pieces of the card and
  row, so the validation pill and the highlight rendering cannot diverge between the two views.
- `PromptGrid`/`PromptList` gained a `label` prop: the route renders two lists (pinned and results) and
  both need distinct accessible names.
- `RouteScaffold` lost its `note` prop and its `Alert` import: the library's "requested filter" note is
  gone because filters are now real. This removed the dashboard-era assertion on that copy.
- `src/test/renderAppWithData.tsx` is a new shared harness (real router, shell, store, in-memory
  repositories) used by both the dashboard and the library integration tests, so neither has to boot
  storage twice or mock the store.

## ADR-65 — Every container mutation reports what it actually changed

**Context.** Deleting a folder has to move prompts and subfolders; deleting a collection has to clear
membership on every prompt that referenced it. A component that re-derives those counts from the
store it holds can disagree with storage after a partial write, and the confirmation could promise
something the transaction did not do.

**Decision.** The cascade lives in `dataStore`: `deleteFolder` returns `{ promptsMoved, foldersMoved }`
and `deleteCollection` returns `{ promptsDetached }`, derived from the entities the store actually
rewrote. Callers render those numbers in the success toast and the confirmation's copy; nothing in the
UI recomputes a count it could get from the mutation.

**Consequences.** The dialogs need the counts _before_ the write (to state the consequence), which is
why `countFolderContents` and `countCollectionMembers` are pure helpers over the same store slices, and
why the toast uses the returned values instead. If hydration races a deletion, the toast is still true
about what the store wrote.

---

## ADR-66 — Prompt deletion is one cascading transaction, not three calls

**Context.** A prompt owns its revisions and test cases. Deleting through `prompts.delete()` alone
would leave snapshots and cases behind, and sequential deletes could fail halfway, producing exactly
the silent data damage the task forbids.

**Decision.** `PromptRepository.deleteCascade(id)` is part of the repository contract. The IndexedDB
adapter opens one `readwrite` transaction over `prompts`, `revisions`, and `testCases` and deletes the
prompt and every dependent row inside it; the in-memory adapter checks that the prompt exists and
throws before mutating, so both implementations are all-or-nothing. `dataStore.deletePrompt` calls only
that method, records activity, and re-hydrates.

**Consequences.** The contract suite asserts success, missing-id, and atomicity for both adapters, and
the route test stubs the method to fail and asserts the prompt, its revision, and its test case are all
still there. Bulk deletion in TASK-013 must reuse the same method rather than loop over `delete()`.

---

## ADR-67 — Deleting a container never deletes a prompt

**Context.** The scope says deleting a folder moves its contents to the parent and deleting a
collection only removes membership. A user who confirms "delete folder" may still expect the prompts
inside to survive, and the confirmation is the last place to say so.

**Decision.** `DeleteContainerDialog` states the destination by name ("3 prompts move to Work."), the
number of re-parented subfolders, and an explicit "No prompts or documents are deleted." The folder
cascade writes the removed folder's `parentId` (not `null`) onto child folders and prompts, so deleting
a nested folder keeps the tree's shape. Both cascade paths subtract the rewritten entities from state
before prepending, so no prompt appears twice.

**Consequences.** A root-level folder delete does move prompts to the top level, which the same dialog
calls "the top level". Folder deletion can therefore never shrink the prompt count; only the prompt
delete dialog can.

---

## ADR-68 — Dialogs are URL-addressable and metadata-only

**Context.** The palette must be able to open "New prompt" and "New folder", and both dialogs must be
reachable from a link and survive a reload — but a dialog is transient UI, not a route.

**Decision.** `libraryQuery` owns `LIBRARY_DIALOGS = ['prompt', 'folder', 'collection']` and the
`?new=` parameter. Opening a dialog replaces nothing else in the URL; closing it removes only `new`,
and the route applies a dialog-only patch as a `replace` so the back button is not filled with dialog
open/close steps. Unknown dialog names are ignored. `PromptFormDialog` edits metadata (title,
description, folder, collections, tags, status, schema) and, on create, chooses a template or a blank
document; it never edits the document body, which belongs to the editor (TASK-014).

**Consequences.** Palette commands and deep links share one code path, and the dialog cannot become a
second editor with unsaved-state problems of its own. A create from a template navigates to
`/prompts/:id` once the store confirms the write, so the editor opens on stored data rather than a
draft.

---

## Verification log — TASK-012

**Executed 2026-10-24, after explicit authorization ("Start Task 012").**

### Test inventory (75 new cases; whole suite 733 across 57 files)

| Area                | File                                             | Cases | Covers                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain errors       | `src/domain/errors.test.ts`                      | 5     | one message per field, `issueFor` for unknown paths, name/message preservation                                                                                                                                                                                                                                                                                            |
| Domain rules        | `src/domain/invariants.test.ts`                  | +3    | collection name uniqueness and length, new-folder sibling scope and `parentId` default                                                                                                                                                                                                                                                                                    |
| Domain search       | `src/domain/search.test.ts`                      | +1    | 500 prompts matched five times, slowest keystroke < 100 ms                                                                                                                                                                                                                                                                                                                |
| Repository contract | `src/data/**` suites                             | +13   | `deleteCascade` success, missing id, dependent rows removed, atomicity in both adapters                                                                                                                                                                                                                                                                                   |
| Store               | `src/store/dataStore.test.ts`                    | +15   | duplicate independence and `(copy)` naming, folder create/rename/move/delete with prompts and subfolders, collection CRUD, failure paths leave state unchanged                                                                                                                                                                                                            |
| Organization        | `src/features/organization/organization.test.ts` | 17    | indented folder options with subtree exclusion, counts, labels, move issues, tag input round-trip                                                                                                                                                                                                                                                                         |
| Query               | `src/routes/library/libraryQuery.test.ts`        | +2    | `?new=` round-trip, unknown dialog ignored                                                                                                                                                                                                                                                                                                                                |
| Library integration | `src/routes/library/LibraryRoute.test.tsx`       | +18   | create from template → editor, missing title, edit details, duplicate, archive + Undo, delete cascade counts, failed delete, folder create + duplicate error, rename/re-parent, cycle-safe parent list, folder delete moves prompts, failed folder delete, collection delete clears membership, collection create, both `?new=` dialogs, 320-prompt search, Enter-to-open |
| Commands            | `src/lib/commands/coreCommands.test.ts`          | +1    | `prompt.new`/`folder.new` navigate to `/library?new=…`                                                                                                                                                                                                                                                                                                                    |

### Gates

| Command                                        | Result                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `npx tsc --noEmit`                             | exit 0                                                               |
| `npx eslint .`                                 | exit 0, 0 warnings                                                   |
| `npx vitest run`                               | **57 files / 733 tests passed**                                      |
| `npx prettier --check "src/**/*.{ts,tsx,css}"` | clean                                                                |
| `npm run check:contrast`                       | 52 pairings pass in both themes                                      |
| `npm run build`                                | exit 0 — CSS 51.10 kB (12.60 kB gzip), JS 707.54 kB (213.11 kB gzip) |

### Known limitations and honesty notes

- No browser binary exists in this environment, so there was **no** visual pass at 360/390/1440 px, no
  pointer-driven layout inspection, and no manual keyboard walkthrough. Keyboard paths and layout
  classes are covered by scripted jsdom tests and review only.
- The single-chunk build advisory (707.54 kB / 213.11 kB gzip) is accepted; route splitting is still
  unauthorized.
- Undo exists for archive/restore only. Deleting a prompt or container asks for confirmation and is
  final — a restore window is not part of this task's scope.
- Radix's checkbox input needs `ResizeObserver`, which jsdom lacks; the test setup installs a no-op
  observer. That stub is test infrastructure and does not affect the shipped bundle.

### Deliberate deviations recorded for TASK-012

- Added `src/domain/errors.ts` (a new domain module, so the purity guard's expected module list and
  barrel export were extended) instead of throwing strings from the store.
- Reused the existing `ConfirmDialog` for prompt and container deletion rather than adding another
  confirmation primitive; its destructive variant is already non-dismissible.
- Folder and collection dialogs suppress the form-level alert when the error is a field rule, because
  the same sentence rendered twice reads as two problems.
- Container-delete copy was corrected to agree with counts ("1 prompt moves to Work", "1 prompt keeps
  its place") — the plural-only helper produced ungrammatical sentences for a single item.
- `src/test/setup.ts` gained the `ResizeObserver` no-op described above.

---

## Verification log — TASK-013

**Executed 2026-10-24, after explicit authorization ("Start Task 013").**

### Test inventory (58 new cases; whole suite 791 across 59 files)

| Area                | File                                                                                              | Cases        | Covers                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository contract | `src/data/repositories/indexedDb.contract.test.ts`, `src/data/adapters/inMemory.contract.test.ts` | +10 (5 each) | `updateMany` writes a batch and returns the saved rows; a stale write applies none of the batch; a missing prompt rejects and changes nothing; an empty batch is a no-op; `deleteManyCascade` removes prompts with revisions and test cases and is idempotent — the same suite runs against both adapters                                                         |
| Store               | `src/store/dataStore.test.ts`                                                                     | +14          | favorite/pin toggles persist, bulk favorite/archive/tag edits with snapshots, `renameTag`/`deleteTag` report real counts, undo restores only the reversible fields, all-or-nothing bulk write, failed bulk write and failed bulk delete leave storage untouched, failed undo and failed delete-restore surface the error and keep the change                      |
| Library integration | `src/routes/library/LibraryRoute.test.tsx`                                                        | +17          | menu favorite/pin/archive with persistence, pinned section A→Z, archive scope, archive empty state, bulk restore, bulk favorite/archive/delete with Undo, select-all scope under `?tag=finance`, Shift range + clearing on filter change, bulk tag dialog, failed bulk write keeps the selection, failed undo, failed delete-restore, keyboard-only bulk favorite |
| Domain rules        | `src/domain/invariants.test.ts`                                                                   | +3           | `applyTagEdit` additions, removals, and removals winning over additions                                                                                                                                                                                                                                                                                           |
| Selectors           | `src/store/selectors.test.ts`                                                                     | +2           | `sortPinnedByTitle` ordering and tie-break                                                                                                                                                                                                                                                                                                                        |
| Bulk helpers        | `src/features/bulk/bulkActions.test.ts`                                                           | 6 (new file) | `rangeIds` in both directions, `tagCensus` ordering, `countPrompts`, `isEmptyTagEdit`                                                                                                                                                                                                                                                                             |
| Editor route        | `src/routes/editor/EditorRoute.test.tsx`                                                          | 4 (new file) | header metadata, favorite/pin write-through, archive + Undo, missing-prompt empty state                                                                                                                                                                                                                                                                           |
| Commands            | `src/lib/commands/coreCommands.test.ts`                                                           | +2           | `library.favorites`/`library.archived` and the editor-only `prompt.toggle-favorite` availability                                                                                                                                                                                                                                                                  |

### Gates

| Command                                        | Result                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `npx tsc --noEmit`                             | exit 0                                                               |
| `npx eslint .`                                 | exit 0, 0 warnings                                                   |
| `npx vitest run`                               | **59 files / 791 tests passed, 0 failures**                          |
| `npx vitest run --coverage`                    | thresholds pass for `src/domain`, `src/data`, `src/store`            |
| `npx prettier --check "src/**/*.{ts,tsx,css}"` | clean                                                                |
| `npm run check:contrast`                       | 52 pairings pass in both themes                                      |
| `npm run build`                                | exit 0 — CSS 51.21 kB (12.65 kB gzip), JS 733.01 kB (218.78 kB gzip) |

### Known limitations and honesty notes

- No browser binary exists in this environment, so there was **no** visual pass at 360/390/1440 px, no
  pointer-driven layout inspection, and no manual keyboard walkthrough. Keystroke and focus paths are
  covered by scripted jsdom tests; no screenshot is claimed.
- Bulk delete's Undo is an in-memory snapshot held by the toast. It is honest in-session and does not
  survive a reload; the confirmation copy states that nothing is guaranteed to survive.
- A failed bulk write cannot be "rolled back" in the UI if the transaction itself partially committed —
  instead the store re-reads storage and displays exactly what is stored, and the toast says the change
  was not saved. The transaction guarantee is tested at the repository contract level.
- Undo skips a prompt that another tab deleted after the bulk action; the toast reports the rows the
  store actually restored.
- The single-chunk build advisory (733.01 kB / 218.78 kB gzip) is accepted; route splitting remains
  unauthorized.

### Deliberate deviations recorded for TASK-013

- Bulk semantics moved into the repository contract (`updateMany`, `deleteManyCascade`) instead of
  staying composed in the store, so "all or nothing" is a storage guarantee rather than a convention
  (ADR-70). This added two methods to `Repositories.prompts`; both adapters implement them and the
  shared contract suite proves parity.
- `hydrate` no longer resets `status` to `loading` on a re-sync. Bulk actions re-read storage to adopt
  what was written; resetting the status blanked the library (and the selection) mid-interaction.
- Pinned ordering uses title A→Z (`sortPinnedByTitle`) rather than pin recency: the task allowed either,
  and title order does not reshuffle when a prompt is favorited or edited.
- `renameTag` rewrites tags in place and de-duplicates after normalizing, instead of rebuilding a set.
  This keeps tag order stable, which the tag tests assert.
- Tag removal from the manager requires a confirmation that names the affected count; tag rename shows
  the count but does not require confirmation because it is reversible by renaming back.

---

## Verification log — TASK-014

**Executed 2026-10-24, after explicit authorization ("Start Task 014").**

### Test inventory (71 new cases; whole suite 862 across 63 files)

| Area            | File                                        | Cases         | Covers                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JSON text       | `src/domain/jsonText.test.ts`               | 33 (new file) | line/column conversion and clamping, every scanner failure (trailing comma, missing comma, unterminated string, raw newline, truncated input, extra content, unquoted key, missing colon, bad escape, control character, malformed and out-of-range numbers, depth limit), format idempotence at 2 and 4 spaces, key-order preservation, minify stability, status statistics, large-document threshold |
| JSON tree       | `src/domain/jsonTree.test.ts`               | 19 (new file) | node kinds, path formatting with escaping, summaries, depth, expansion, visible rows, node lookup, every arrow/Home/End action including collapse-then-climb, value previews                                                                                                                                                                                                                           |
| Draft storage   | `src/features/editor/draftStorage.test.ts`  | 7 (new file)  | round-trip, clearing, size cap, corrupt/foreign/incomplete records, blocked storage, probe cleanup                                                                                                                                                                                                                                                                                                     |
| CodeMirror host | `src/components/editor/JsonEditor.test.tsx` | 4 (new file)  | real mount with an accessible name, a real transaction reaching `onChange`, `jumpToOffset` moving the caret, `selectAll`                                                                                                                                                                                                                                                                               |
| Editor route    | `src/routes/editor/EditorRoute.test.tsx`    | +8            | stored document rendered, no save claim, typed syntax error with location and caret jump, format/minify idempotence through the toolbar, tree view keyboard navigation, invalid-document guidance, leave guard dialog, clipboard copy, localStorage recovery draft without a database write                                                                                                            |

### Gates

| Command                     | Result                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`          | exit 0                                                                                                                 |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                     |
| `npx vitest run`            | **63 files / 862 tests passed, 0 failures**                                                                            |
| `npx vitest run --coverage` | thresholds pass (`src/domain` 90.48 % branches, `src/data`, `src/store`)                                               |
| `npx prettier --check .`    | clean                                                                                                                  |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                        |
| `npm run build`             | exit 0 — CSS 53.21 kB (13.10 kB gzip), app JS 760.90 kB (227.29 kB gzip), lazy editor chunk 427.59 kB (138.55 kB gzip) |

### Known limitations and honesty notes

- No browser binary exists in this environment, so there was **no** visual pass at 360/390/1440 px, no
  pointer-driven layout inspection, and no manual keyboard walkthrough (including `Mod-F` on a real
  keyboard). Keyboard paths are covered by jsdom tests over real CodeMirror instances and code review
  only; no screenshot is claimed.
- jsdom has no layout, so `Range.getClientRects`/`getBoundingClientRect` return empty rects in the test
  setup. That is test infrastructure; it is why caret measurement is asserted through `EditorView`
  state rather than pixels.
- Switching to the tree tab unmounts CodeMirror, which resets its undo history for this tab. The text
  and the recovery draft survive; undo does not span a tab switch.
- The large-document guard slows the parse and says so in the status bar; it does not paginate or
  virtualize the document, and documents beyond `LARGE_DOCUMENT_CHARS` (500 000) still load.
- Drafts are `localStorage` copies: clearing site data, or using a browser that blocks storage, means no
  recovery. Nothing in this task writes to IndexedDB, and no control claims otherwise.
- The search/replace panel is CodeMirror's own, restyled through tokens. Its internal markup is not part
  of this project's accessibility review (that arrives with TASK-028).

### Deliberate deviations recorded for TASK-014

- Added the dependencies the plan already named for this task: `@uiw/react-codemirror`,
  `@codemirror/lang-json`, and the CodeMirror packages the host configures directly (`@codemirror/search`,
  `@codemirror/language`, `@codemirror/commands`, `@codemirror/view`, `@codemirror/state`,
  `@lezer/highlight`). No other dependency changed.
- `src/domain/jsonText.ts` and `src/domain/jsonTree.ts` are new domain modules, so the purity guard's
  module list and the barrel export list were extended to include them.
- `src/test/setup.ts` gained the `Range` rect stubs described above; they are test-only.
- The route's breadcrumb landmark is labelled "Prompt location" rather than "Breadcrumb", because the
  shell already exposes a "Breadcrumb" landmark and duplicate landmark names are an accessibility bug.
- The toolbar stays enabled while a parse is pending and disables only on a known error: formatting
  re-scans the text itself, so a pending parse is not a reason to block it (and blocking it made the
  second click in the idempotence test a no-op).
- The canonical stored text is formatted with two spaces regardless of the indent preference; the
  preference belongs to the Format action, so changing it does not rewrite the draft's baseline.
- `PromptSummaryCard`'s "not yet" copy was corrected: the editor now exists, and the card says
  validation (TASK-016) and history (TASK-019) are what remain, and that the editor is a draft.

## ADR-78 — A save carries the version it was based on, and conflicts are detected by storage

**Context.** TASK-014 left the editor as a draft: nothing was written, so nothing could be lost or
overwritten. TASK-015 makes writes real. `editPrompt` used to re-read the record and write at
`current.version`, which is last-writer-wins: a second tab's write would be replaced without a word.
The TASK-006 concurrency helpers (write queue, `expectedVersion`) existed but the save path did not
use them.

**Decision.** `DataStore.editPrompt(id, changes, { expectedVersion })` passes the guard through to
`PromptRepository.update`. The save pipeline always sends the version its draft was based on, so a
write that lost the race fails with `StaleWriteError` and becomes a conflict. The store also gained
`readStoredPrompt(id)`: a read straight from the repository that does **not** update state, because
the conflict dialog must show what storage holds now while the editor still holds the draft.
`hydrate()` would have replaced the very thing the dialog protects.

**Consequences.** Ordinary edits (favorite, title, archive) keep working without a guard. A stale
write can no longer silently overwrite; it is reported. The store now has one read-only escape hatch,
documented as such and used only by the pipeline.

## ADR-79 — A conflict freezes saving and asks; the editor never resolves it on a timeout

**Context.** The task requires three explicit outcomes: reload the stored version, keep the draft as
new content, or view the stored version. Both destructive outcomes lose something — one drops the
draft, the other replaces someone else's write.

**Decision.** When a write fails with `StaleWriteError` (or the user opens the dialog from a
cross-tab notice) the pipeline records a `SaveConflict`, stops autosave, and renders a dialog. It
reads the stored record through `readStoredPrompt` to fill the preview. _Reload_ replaces the text
and baseline with the stored version and clears the recovery copy; _Keep_ writes the draft on top of
the freshly read version, explicitly labelled as replacing the other write; _View_ expands an
in-dialog preview. Nothing is hydrated, overwritten, or dismissed automatically.

**Consequences.** A user who ignores the dialog keeps a dirty draft and a disabled Save button, which
is visible and reversible. The dialog is the only path to either resolution, so both are testable and
neither is a surprise.

## ADR-80 — Exactly one writer owns the recovery draft, and it is cleared only after a write lands

**Context.** TASK-014's `useDocumentDraft` mirrored drafts and cleared them whenever the text matched
the saved text. With real saving, "matches the saved text" is exactly the state the pipeline creates
after a successful write — but a _failed_ write must not leave the user without the copy, and the
draft now needs to record the version it was typed over.

**Decision.** The pipeline owns recovery. `useDocumentDraft` gained `manageRecovery: false` (and
`resetOnSavedChange: false`, because resetting the text from a store echo would drop characters typed
while a write was in flight) and stops touching storage when the pipeline is in charge. The pipeline
mirrors dirty text after a 400 ms debounce, records `baseVersion`, and clears the copy only after a
confirmed write, an explicit discard, or a reload of the stored version.

**Consequences.** There is one code path that can write or delete a draft, so there is one place to
reason about data loss. `draftStorage`'s TASK-014 tests still cover the storage primitives; the new
`recoveryStorage` tests cover the version-aware semantics.

## ADR-81 — Save state is derived from resolved outcomes, never optimistic

**Context.** "Saved" is the one status in this application that must never be wrong. The task says so
explicitly, and a wrong "Saved" is how people lose work.

**Decision.** The pipeline keeps _facts_ (text, baseline, in-flight promise, last result, conflict,
saving) and derives the state in one expression: `disabled` when storage is ephemeral, then
`conflict`, then `saving`, then `error`, then `dirty`, then `saved`, then `clean`. `saved` is only
reachable after the write promise resolved, and any newer text makes the state `dirty` again because
the baseline moved, not the text. A failure stays visible until a write succeeds, and the failed text
is remembered so autosave does not retry a document that is known to be rejected.

**Consequences.** The status component has no internal state and cannot disagree with the pipeline.
Validation failures (invalid JSON, invalid document) are reported as errors _before_ a write is
attempted, with the field path or line/column in the detail.

## ADR-82 — Another tab's write is an announcement, never an applied edit

**Context.** Two tabs can hold the same prompt. Applying a remote write automatically would destroy a
dirty draft; ignoring it lets two people overwrite each other silently.

**Decision.** A confirmed write is announced through `WriteBroadcaster` (TASK-006). A tab that sees an
announcement for the same prompt at a higher version shows a passive banner with _Review both
versions_ (the conflict dialog) and _Keep editing_. Store-side changes are treated separately: a
version bump with unchanged content is adopted silently, a content change over an unchanged draft is
adopted and the text moves to what is stored, and a content change over a dirty draft becomes the same
passive notice. The browser's own `BroadcastChannel` is unavailable in some environments, so the
broadcaster degrades to a no-op and the version guard on writes remains the enforcement.

**Consequences.** Multi-tab editing is honest and lossy only by explicit choice. The announcement is a
notification channel, not a merge strategy — PromptForge still does not merge documents.

## Verification log — TASK-015

**Scope verified:** autosave debounce and version/`updatedAt` bumps, explicit `Mod+S`, retry after a
failed write, syntax/document validation before saving, serialized writes and rapid-edit coalescing,
stale-write detection with both destructive outcomes, recovery mirroring/restore/discard/clearing,
recovery persistence across a remount, ephemeral mode, cross-tab announcements, and the save-status
component's states.

### Tests added (48 cases)

| File                                                | Cases | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/save/useSavePipeline.test.tsx`        | 16    | autosave debounce + version/updatedAt, autosave off, `Mod+S`, snapshot enablement, one ordered write for rapid edits, ordered sequential saves, invalid JSON, invalid document with field path, failure/retry with the draft and recovery copy intact, stale-write conflict + reload, stale-write conflict + keep draft, recovery mirror/restore, recovery discard, recovery cleared after save, ephemeral mode, announce + remote notice |
| `src/features/save/savePipeline.indexedDb.test.tsx` | 2     | confirmed write reopened from a second real IndexedDB connection; refused write leaves no version bump and no content change                                                                                                                                                                                                                                                                                                              |
| `src/features/save/recoveryStorage.test.ts`         | 9     | round-trip with `baseVersion`, hint text, identical-text suppression, older-version flag, pre-version drafts, foreign/unparsable storage, clearing, blocked storage, capability probe                                                                                                                                                                                                                                                     |
| `src/components/editor/SaveStatus.test.tsx`         | 7     | live-region attributes, saving without claiming success, saved timestamp, dirty + autosave copy, error + retry, ephemeral, explicit save button                                                                                                                                                                                                                                                                                           |
| `src/domain/textDiff.test.ts`                       | 9     | identical text, edited line, inserted/removed lines with their comma, untouched tail, empty draft, sentence output, line splitting                                                                                                                                                                                                                                                                                                        |
| `src/routes/editor/EditorRoute.test.tsx` (extended) | +5    | ephemeral saving-off copy, `Mod+S` save, autosave, conflict keep-draft, conflict reload, recovery hint                                                                                                                                                                                                                                                                                                                                    |

### Gates

| Gate                        | Result                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`          | exit 0                                                                                                                                                             |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                                                                 |
| `npx vitest run`            | **68 files / 910 tests passed, 0 failures**                                                                                                                        |
| `npx vitest run --coverage` | thresholds pass — `src/domain` 98.02/93.96/100/98.05, `src/data` 96.51/87.03/100/97.22, `src/store` 95.71/90.16/96.8/97.21; `dataStore.ts` 94.82/82.58/97.26/97.41 |
| `npx prettier --check .`    | clean                                                                                                                                                              |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                                                                    |
| `npm run build`             | exit 0 — CSS 53.89 kB (13.18 kB gzip), app JS 779.30 kB (232.69 kB gzip), lazy editor chunk 427.59 kB (138.55 kB gzip)                                             |

### Known limitations and honesty notes

- **The task's manual reload test was not performed.** No browser binary exists in this environment.
  Reload recovery is covered by tests that unmount and remount the pipeline over the same storage and
  by the IndexedDB reopen test; no screenshot or manual pass is claimed.
- The cross-tab banner is exercised with an injected broadcaster in tests. A real `BroadcastChannel`
  between two browser tabs was not exercised (no browser), and environments without it get a no-op.
- Saving writes the **content** only: title, tags, filing, and status still change through their own
  store mutations. A title edit bumps the version; the pipeline adopts metadata-only bumps silently so
  that it does not turn into a false conflict.
- Autosave stops for a document that is not a valid prompt document (missing `schemaVersion`, etc.).
  The status says why, with the field path, instead of retrying forever.
- Recovery drafts are `localStorage` copies capped at 2 000 000 characters. Beyond that, or with site
  data blocked, there is no recovery — the status and banner never claim otherwise.

### Deliberate deviations recorded for TASK-015

- `editPrompt` gained an optional expected-version guard and `readStoredPrompt` was added (ADR-78).
- Recovery is owned by the pipeline rather than `useDocumentDraft` (ADR-80); the older hook keeps its
  TASK-014 behaviour through default-true flags.
- `SnapshotService` defaults to the store's existing `snapshotPrompt` rather than a no-op; TASK-019
  replaces the presentation, not the write.
- `src/domain/textDiff.ts` is a new domain module, so the purity guard's module list and the barrel
  export list were extended.
- The recovery mirror delay is 400 ms (slightly longer than TASK-014's 300 ms) so it never competes
  with the shorter autosave delays (minimum 300 ms) for the same keystroke.

## ADR-83 — JSON Schema is interpreted by a documented subset, never compiled to code

**Context.** The plan named Ajv for TASK-016. Ajv compiles a schema into JavaScript and instantiates it
with `new Function`. A schema here is user data, typed or pasted into a dialog, so handing it to a code
generator is exactly the eval-shaped path the project forbids; a strict CSP without `unsafe-eval` would
also refuse to run the compiled validator at all.

**Decision.** `src/domain/jsonSchema.ts` is an **interpreter** for a documented subset of JSON Schema
(draft 2020-12 surface): `type`, `enum`, `const`, `multipleOf`, `minimum`/`maximum` and their exclusive
forms, `minLength`/`maxLength`/`pattern`/`format`, `items`/`prefixItems`/`minItems`/`maxItems`/
`uniqueItems`, `properties`/`patternProperties`/`additionalProperties`/`required`/
`minProperties`/`maxProperties`, `allOf`/`anyOf`/`oneOf`/`not`, `$defs`/`definitions`/`$ref`, and the
annotation keywords (`$schema`, `title`, `description`, `default`, …). Formats checked are `email`,
`uri`, `date`, `date-time`, `time`, `uuid`, `ipv4`, and `hostname`; any other format name is a **note on
the schema**, not a pass on the document.

**Consequences.** No dependency was added, no `eval`, no `new Function`, no network, and the validator
runs identically under a CSP that forbids dynamic code. The cost is a smaller dialect: a user who wants
`if`/`then`, `propertyNames`, `unevaluatedProperties`, `contains`, or `contentEncoding` is told the
keyword is unsupported instead of receiving an unearned "valid". `docs/VALIDATION.md` is the support
matrix, and it is the file to read before writing a schema here.

## ADR-84 — Unknown and unimplemented keywords stop the check instead of passing it

**Context.** A validator that ignores what it does not understand turns a typo (`requird`) or an
unimplemented keyword (`if`) into a confident pass. That is worse than no validation, because the user
believes something was checked.

**Decision.** Compilation walks every keyword and fails on anything outside the supported set, naming
the keyword and pointing at it (`$/requird`). Valid keywords this build does not implement are a
distinct message: "this validator does not implement `if`; the document was not checked against it,
because a partial answer could look like a pass". Malformed values for supported keywords (`type: []`,
`multipleOf: 0`, `required: [1]`, a 600-character `pattern`, a schema past the depth limit, a `$ref`
that is not a local string, a `$ref` that resolves to nothing) are compile problems too. A compile
failure produces `schemaStatus: 'rejected'`: the report says the **schema** is unusable and checks
nothing about the document, so a bad schema can never look like a bad prompt.

**Consequences.** Validating a prompt against a schema with one misspelled keyword produces a schema
error and zero schema findings on the document. The editor's schema dialog runs the same compile before
saving, so an unsupported schema is refused at authoring time rather than discovered later.

## ADR-85 — "Valid" means syntax and structure, and the scope sentence is not dismissible

**Context.** The task requires an explicit statement that valid JSON is not prompt quality. A one-time
toast or a tooltip would be easy to miss, and a percentage score would imply a judgement the engine
cannot make.

**Decision.** `ValidationScopeNote` is rendered on every validation surface — the studio header, the
editor's Validation tab, and the dashboard/library wording — as plain, non-dismissible text: validation
checks syntax and, when a schema is attached, structure; it is not a judgement of prompt quality,
clarity, or whether a model will follow it. No surface displays a score, grade, or percentage. The
summary sentence produced by `describeValidation` only ever states what was checked (`Valid JSON — 1
schema error, 4 document warnings.`), never that a prompt is good. `docs/VALIDATION.md` repeats the same
limit in writing.

**Consequences.** There is no "quality" number to trend, and TASK-024's heuristics will have to introduce
their own words rather than borrowing these. Copy review has one rule: no synonym for "good".

## ADR-86 — Document-shape findings are warnings; schema non-conformance is an error

**Context.** Two different authorities produce findings. The PromptForge document rules describe the shape
this app stores and expects, and the editor already refuses to save text that breaks them. An attached
JSON Schema is a rule the user opted into, and failing it means the document does not meet its own
contract.

**Decision.** `ValidationIssue.kind` is `syntax`, `schema`, or `document`. Syntax findings and schema
findings (both compile problems and conformance failures) are `severity: 'error'`. Document-shape
findings are always `severity: 'warning'`, never block a save, and are presented as a separate group with
their own count and filter. `ValidationStatus` is one of `valid`, `warning`, `invalid`, `skipped`;
`valid` requires syntax to pass, no schema errors, no document warnings, and a schema check that actually
ran (`schemaStatus: 'checked'` or `'none'`).

**Consequences.** A stored document that parses but drifts from the canonical shape shows warnings rather
than an error, so the library and dashboard still count it as parsable. Validation never mutates or saves
anything: `validateJsonText` takes text and an optional schema and returns a report; the draft being
checked stays exactly where it was.

## ADR-87 — References are local to the schema and nothing is fetched

**Context.** JSON Schema allows `$ref` to a URL. Resolving one would mean a network request from a
local-first app, with the user's schema names and any remote fragments leaving the device.

**Decision.** Only local references (`#/…`) are accepted. Anything that looks external — `http://`,
`https://`, a bare file path — is a compile error that says why ("a remote reference would need a network
request"). Local pointer resolution covers `$defs` and the older `definitions` map. Reference chains are
followed to a depth of 32; past that the validator reports that the reference chain is too deep instead
of looping.

**Consequences.** Schemas that split definitions across files are not supported here and say so. Nothing
in the validation path performs I/O of any kind, which keeps the privacy claim in the README true without
an exception.

## ADR-88 — Every check is bounded, and a skipped check says it was skipped

**Context.** A pasted schema or a pathological document can be arbitrarily large. A validator that walks
one forever freezes the UI thread; one that silently gives up is dishonest.

**Decision.** Text longer than 2 000 000 characters is **skipped**: `status: 'skipped'`, a
`skippedReason` in words, and zero findings — not an empty pass. Schemas longer than 100 000 characters
are refused, and schema nesting beyond 64 levels, patterns longer than 512 characters, and `$ref` chains
deeper than 32 are compile errors. Validation stops after 100 errors and sets `truncated: true`, which the
summary and the issue list both print. Compiled schemas are memoised in an LRU of 32 entries keyed by
their serialised text.

**Consequences.** The studio and the editor respond in bounded time for any input, and every bound has a
sentence attached to it. The cost is that a very large document is not validated at all; the UI says so
instead of showing a green result.

## Verification log — TASK-016

**Scope verified:** JSON syntax with exact line/column, JSON Schema compilation and instance validation
over the supported subset, document-shape warnings, the `/validation` studio (selection, filters, schema
library CRUD, attachment, deletion with usage counts, missing-schema and unsupported-schema states),
editor integration (live report, Validation tab, jump to a finding's path, `?line=` deep links), the
palette command, library badge, and the dashboard mismatch count.

### Tests added (114 cases)

| File                                                  | Cases | Covers                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/jsonSchema.test.ts`                       | 54    | keyword acceptance and rejection, `type`/`enum`/`const`/numeric/string/array/object rules, `patternProperties`, combinators, local `$ref` (including a loop and a dangling pointer), error cap, boolean schemas, depth and size guards, formats |
| `src/domain/validation.test.ts`                       | 29    | syntax location, schema rejection vs conformance, document warnings, size skip, `checkDocument: false`, LRU bound, pointer/path round-trips, `findLineForPath`, summary sentences                                                               |
| `src/store/schemaStore.test.ts`                       | 10    | create, update, missing-record refusal, attach/detach with a version bump, deletion detaching every prompt atomically, stale-write rollback, unused-schema deletion, attach to a missing prompt                                                 |
| `src/routes/validation/ValidationRoute.test.tsx`      | 11    | scope statement, valid/schema/missing-schema/unsupported-schema states, filters, create-and-attach flow, keyword refusal, delete with counts, shape warnings, `?prompt=` selection                                                              |
| `src/routes/editor/EditorRoute.test.tsx` (extended)   | +4    | live report in the inspector, scope note, jump to a schema path, `?line=` deep link                                                                                                                                                             |
| `src/routes/library/LibraryRoute.test.tsx` (extended) | +1    | a parsable document with schema errors is badged separately from "Parses"                                                                                                                                                                       |
| `src/store/dashboard.test.ts` (extended)              | +4    | mismatch count, absent-schema behaviour, attention entry and order, summary sentence                                                                                                                                                            |
| `src/lib/commands/coreCommands.test.ts` (extended)    | +1    | `validation.validate-prompt` availability and dispatch, and that an unregistered workspace does not offer it                                                                                                                                    |

### Gates

| Gate                        | Result                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`          | exit 0                                                                                                                                                                                                  |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                                                                                                      |
| `npx vitest run`            | **72 files / 1024 tests passed, 0 failures**                                                                                                                                                            |
| `npx vitest run --coverage` | thresholds pass — `src/domain` 96.28/92.11/99.2/96.84, `src/store` 96.07/89/97.08/97.43, `src/data` 96.51/87.03/100/97.22; `jsonSchema.ts` 92.16/90.83/98/93.33, `validation.ts` 94.96/81.55/96.42/97.7 |
| `npx prettier --check .`    | clean                                                                                                                                                                                                   |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                                                                                                         |
| `npm run build`             | exit 0 — CSS 54.43 kB (13.26 kB gzip), app JS 823.13 kB (245.20 kB gzip), lazy `JsonEditor` chunk 427.59 kB (138.55 kB gzip)                                                                            |

### Known limitations and honesty notes

- **No browser binary exists in this environment.** There was no manual pass at 390/1440 px, no
  pointer-driven check, no real keyboard walkthrough, and no screenshot. Every UI claim above comes from
  jsdom tests against the real routes and store, or from review — not from looking at the app.
- **The schema dialect is a subset.** `if`/`then`/`else`, `contains`, `propertyNames`,
  `unevaluatedProperties`/`Items`, `dependentRequired`/`Schemas`, `additionalItems`, and the `content*`
  keywords are unimplemented and refused at compile time rather than ignored. The tuple form of `items`
  is accepted but noted as the legacy shape.
- **Formats are pattern checks, not a full RFC implementation.** `email`, `uri`, `date`, `date-time`,
  `time`, `uuid`, `ipv4`, and `hostname` are conservative; any other format is a schema note and the
  document is not tested against it.
- **The schema library is local.** Schemas live in this browser's storage; there is no import, export, or
  sharing yet (TASK-026). Deleting a schema detaches only prompts that are currently loaded in state.
- **`?line=` deep links move the caret, not the selection.** A syntax finding points at the exact
  line/column; a schema or document finding has no stored position, so "Find" locates the nearest line
  for its path (or the first occurrence of the key) and says nothing when it cannot.
- **A skipped document is not a valid document.** Above 2 000 000 characters the studio shows the skip
  reason and no findings, rather than an empty pass.

### Deliberate deviations recorded for TASK-016

- Ajv was planned and is **not** used; the validator is an in-house interpreter (ADR-83). The schema
  dependency set is unchanged.
- Success criteria that name Ajv behaviour ("compile caching", "error normalization") are met by the
  local equivalents: an LRU keyed by serialised schema text and one `ValidationIssue` shape.
- The studio is read-only over the prompt: it validates the stored document and an attached schema, and
  links to the editor rather than embedding a second CodeMirror instance. "Validate a draft without
  saving first" is satisfied in the editor, where the live report runs against the unsaved text.
- `src/domain/jsonSchema.ts` and `src/domain/validation.ts` are new domain modules, so the purity guard's
  module list and the barrel export list were extended.

## ADR-89 — The composer edits the raw JSON object, so an edit cannot drop a field it does not render

**Context.** A guided form usually works on a typed model: the form maps a struct to inputs, and saving
re-serializes the struct. That path silently deletes anything the struct does not have — an unknown
top-level field, an extra key inside `context`, a stray key on a variable. The task requires exactly the
opposite: fields the form cannot represent must be preserved and named.

**Decision.** `src/domain/composer.ts` treats the document as a **raw JSON object**. `readComposerView`
is a tolerant reader that never throws and never invents values; `applyComposerPatch` starts from the
current object and replaces only the key being edited, copying the surrounding section (`context`,
`output`, `metadata`) so keys it does not know survive. Variables and examples carry their unknown keys
(`extras`) and unreadable entries (a string where an object was expected) through the view and back. The
document is never normalized by a patch; normalization happens only when the text is validated or saved.

**Consequences.** Form ↔ JSON round-trips are lossless for everything the document contains, and the
"preserved fields" notice plus the JSON preview make the difference visible. The cost is that the form
can hold a document the domain model would reject (duplicate variable names, blank rows); that is
intentional, because hiding the user's input would be worse — the checks name the problem and saving is
gated (ADR-90).

## ADR-90 — The save pipeline accepts a caller-held write gate, and a composer draft is never normalized behind the user's back

**Context.** The pipeline validates a document before writing. Its validator treats duplicate variable
names and blank rows as **warnings** and normalizes them away, which is right for the editor (the text is
what it is) but wrong for a form: the write would store something different from what the form shows
without saying so.

**Decision.** `useSavePipeline` gained one optional input, `blockedReason`. When it is a non-empty string,
autosave is not scheduled and every explicit save returns `false` without writing; the draft stays
`dirty`, and the route renders the reason and disables the Save action. The default (`null`) preserves
every TASK-015 behaviour, and the pipeline tests were extended with a case that starts blocked, asserts no
version bump, then clears the gate and observes the write.

**Consequences.** A composer form with errors cannot persist a mutated document. The gate is the caller's
statement of intent, not a second validator inside the pipeline, so the editor's behaviour is untouched.
The trade-off is that the user must fix the row they typed instead of the app quietly cleaning it up.

## ADR-91 — A JSON field applies only when it parses, and a field that is not applied blocks saving

**Context.** Some sections are arbitrary JSON (`context.data`, an example, a variable default). Parsing
on every keystroke is necessary for live feedback, but applying a half-typed value is not possible: the
document would hold something nobody wrote.

**Decision.** `JsonValueField` parses as you type. A parseable value is applied immediately; an empty
field removes the key. An unparseable one is **not** applied — the field shows "Not applied — …" and the
parent marks the field key as invalid, which contributes to the write gate. The check list names the
field ("Variable 1 default value", "Example 2 input") so the error is actionable without hunting.

**Consequences.** The document is always valid JSON while the form may hold a broken draft, and neither
the broken text nor a stale value is ever lost silently: the text stays in the field, the document keeps
its previous value, and saving is refused until the two agree.

## ADR-92 — One document, two surfaces: the form owns the draft, the pipeline owns the write

**Context.** Two-way sync invites two copies of the same data, and two copies drift. The editor is
text-first; the composer is form-first. Both must end up writing the same stored document.

**Decision.** In edit mode the composer holds the raw object and derives canonical text with
`formatDocumentJson` (the same key ordering as `formatDocument`). One effect pushes that text into the
pipeline, which owns debounce, autosave, conflicts, and recovery. There is no second serializer and no
second writer. Stored content is **adopted** into the form only while the pipeline reports no unsaved
edits, so a tab's write can never overwrite an in-progress form. The three pipeline actions that replace
the draft (reload the stored version, restore a recovery draft, resolve a conflict) are wrapped so the
form adopts the same text; adopting normalizes nothing.

**Consequences.** Both surfaces store byte-identical documents for the same content, and a change made in
one is visible in the other after the pipeline confirms it. The wrapping is the price of not merging two
drafts; where merging would be needed, the pipeline already asks instead of guessing.

## ADR-93 — Sections are fieldsets, reordering is a button, and snippets are inserted by value

**Context.** The task asks for accessible forms and keyboard reordering, and for snippet insertion into a
chosen section. Drag handles and drop targets are the usual answer to the first, and a snippet that only
records an id would show text that is not in the document.

**Decision.** Every section is a `<fieldset>` with a real `<legend>`, and every repeated row (a variable,
an example, an instruction) is its own fieldset or labelled input. Reordering is a pair of buttons with
names that include the row ("Move instruction 2 up"), disabled at the ends — no pointer-only affordance
and no keyboard-specific mode. A snippet's **value** is written into the document at the chosen section
(text replaces, lists append without duplicates) and its id is recorded in `includes`; the panel reports
which of those happened, and the Insert button is disabled when the value does not fit the section. The
document's `includes` list can also be edited directly.

**Consequences.** The form is keyboard-complete and announces its structure. A snippet edit later does not
retroactively change a document that used it — the value was copied, which the panel and the docs state.

## Verification log — TASK-017

**Scope verified:** the composer's view/patch model (including unknown-field preservation, unreadable rows
and list reordering), variable and default validation, JSON field application rules, snippet insertion,
starter replacement, both routes (create `/composer`, edit `/prompts/:id/compose`), the save gate, the
unsaved-changes guard, and the editor → composer handoff.

### Tests added (54 cases)

| File                                                    | Cases | Covers                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/composer.test.ts`                           | 38    | view reading (complete, partial, wrong types, extras, unreadable rows), patch preservation of unknown top-level and nested keys, every patch field, list moves, all issue kinds, completeness, starters, snippet insert/replace/dedupe/refusal, JSON field labels |
| `src/routes/composer/ComposerRoute.test.tsx`            | 9     | blank start and preview, live edits, create → navigate, missing name refusal, unusable variable blocked, unparseable JSON field blocked, snippet insertion, starter replacement confirm, leave guard                                                              |
| `src/routes/composer/ComposerEditRoute.test.tsx`        | 5     | stored document loaded into form and preview, autosave of a field edit with a version bump, unknown field preserved through a save, duplicate variable holds saving back (including `Mod+S`) with no version bump, leave guard                                    |
| `src/features/save/useSavePipeline.test.tsx` (extended) | +1    | a caller-held gate suppresses autosave and manual saves, then writes once the reason clears                                                                                                                                                                       |
| `src/routes/editor/EditorRoute.test.tsx` (extended)     | +1    | the workspace links to the composer for the open prompt                                                                                                                                                                                                           |

### Gates

| Gate                        | Result                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`          | exit 0                                                                                                                                                            |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                                                                |
| `npx vitest run`            | **75 files / 1078 tests passed, 0 failures**                                                                                                                      |
| `npx vitest run --coverage` | thresholds pass — `src/domain` 95.86/91.66/98.99/96.33, `src/store` 96.07/89/97.08/97.43, `src/data` 96.51/87.03/100/97.22; `composer.ts` 92.85/88.44/97.77/92.78 |
| `npx prettier --check .`    | clean                                                                                                                                                             |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                                                                   |
| `npm run build`             | exit 0 — CSS 54.99 kB (13.32 kB gzip), app JS 870.22 kB (256.68 kB gzip), lazy `JsonEditor` chunk 427.59 kB (138.55 kB gzip)                                      |

### Known limitations and honesty notes

- **No browser binary exists in this environment.** There was no manual pass at 390 px, no pointer or
  keyboard walkthrough, and no screenshot. The responsive claim rests on the layout being a single column
  below `lg` plus jsdom tests; it is not a visual verification.
- **The composer renders the sections it knows.** Unknown top-level keys are preserved and named; unknown
  keys nested inside a _known_ section are preserved by patches, but the form cannot show them, so they are
  visible only in the JSON preview. There is no per-field "show raw" escape hatch yet.
- **Rename, not restructure.** The composer cannot add, remove, or reorder top-level sections; a document
  with an unusual shape is better handled in the raw editor, which the composer links to.
- **Snippet values are copied.** Editing a stored snippet later does not update documents that already
  used it; only the `includes` reference remains.
- **The create route writes nothing until "Create prompt" succeeds.** There is no autosave for a prompt that
  does not exist yet, so a browser crash loses an unsubmitted draft — the leave guard only covers in-app
  navigation and `beforeunload`.
- **The write gate is deliberately coarse.** Any composer error blocks every write, including metadata-only
  edits, so the form and the stored document cannot disagree while the user is mid-fix.

### Deliberate deviations recorded for TASK-017

- The plan named `src/features/composer/{sections,useComposerState,validation}`. The implementation puts the
  model in `src/domain/composer.ts` (pure, unit-tested), the draft in
  `src/features/composer/useComposerDraft.ts`, and the form in `src/components/composer/*` — the same split
  the rest of the app uses.
- The document editor in the composer's side panel is a **read-only preview**, not a second CodeMirror. It
  links to the raw editor for real text editing, so there is no second save path.
- `useSavePipeline` gained `blockedReason` (ADR-90) — a small, default-off extension of TASK-015 rather than
  a parallel save implementation.
- The composer's edit mode is `/prompts/:promptId/compose`; `/composer` always creates a new prompt (and
  navigates into edit mode after a successful create), so a route never has two meanings.
- `src/domain/composer.ts` is a new domain module, so the purity guard's module list and the barrel export
  list were extended; `formatDocumentJson` was added to `serialization.ts` so the composer and the editor
  share one key order.

## ADR-94 — Using a template materialises a deep copy, and every creation path uses the same function

**Context.** A template is a stored document, and a prompt is a stored document. Copying one into the
other is easy to get wrong in three ways: sharing a nested array between two records, carrying a local
`snippet` reference into a prompt that never merged it, or keeping `output.schemaRef` when the schema is
not stored in this browser. The library's create dialog (TASK-012) and the catalogue (TASK-018) both
create prompts from templates, so a second implementation would eventually disagree with the first.

**Decision.** `instantiateTemplate()` in `src/domain/templates.ts` is the only materialisation function.
It JSON-round-trips the document, so the copy shares no object with the template or with other prompts,
clears `includes`, and drops `output.schemaRef` when the caller supplies the set of schema ids this
browser holds. Both the store action (`useTemplate`) and the library dialog call it. Identity is left to
`createPrompt`, which takes the injected id generator, so two uses of one template always produce two
distinct records at version 1.

**Consequences.** Editing a prompt made from a template can never change the template, and two prompts
made from it are independent (asserted in `src/store/templates.test.ts` and again through the store in
`src/store/templates.test.ts`). The cost is that a template cannot ship a schema reference: it survives
only if the target browser already stores that schema, and the preview says so before the user commits.

## ADR-95 — A template never carries snippet references, and the preview states what will be dropped

**Context.** `includes` records which stored snippets were merged into _this_ document. A template is a
blueprint for a document that does not exist yet; copying its `includes` to a new prompt would claim a
merge that never happened and attach ids that may not even exist in the target browser.

**Decision.** Both directions clear the list. `templateDraftFromPrompt` drops `includes` when saving a
prompt as a template (the values already live in the sections), and `instantiateTemplate` drops it again
when a prompt is created, reporting the removed ids. The preview sheet lists the removals under "What
will not be copied" before the user presses "Use template", and the dialog warns when saving a prompt that
referenced snippets.

**Consequences.** No prompt ever starts life with a dangling snippet reference. Snippet text that was
already merged stays in the document; only the provenance link is lost, which is the honest state — the
composer can insert the snippet again, and the record then names a merge that actually happened.

## ADR-96 — Template names are unique case-insensitively, and the store enforces it, not only the dialog

**Context.** The catalogue shows templates by name inside category groups. Two templates called
"Code review" and "code review" read as duplicates and make the search results ambiguous. A dialog-only
check is bypassable: two tabs can both validate against the same list, then both write.

**Decision.** `checkTemplateName()` is a pure rule (trimmed, case-insensitive, optional `excludeId` for a
rename) used by the dialog for live feedback **and** by the store before `create`/`update`. The store also
re-validates the document with `templateIssues()` — a template that could not become a valid prompt is
never stored. Failures throw `RuleViolationError`, which the dialog renders inline and the route toasts.

**Consequences.** A duplicate name is refused twice, with the same message, and the second attempt cannot
slip through a race. The rule is stricter than prompts (which may share a title): templates are picked
from a list by name, so ambiguity there has no upside.

## ADR-97 — The dashboard deep-links into the catalogue's preview instead of creating prompts itself

**Context.** The dashboard already showed three quick-start templates (TASK-010). TASK-018 makes them
real, and the obvious shortcut is a "Use" button on the dashboard card. That would duplicate the
creation flow that the catalogue's preview owns — two buttons, two code paths, two chances to disagree
about what gets dropped.

**Decision.** Each quick-start card links to `/templates?template=<id>`. The catalogue reads the parameter,
opens its preview sheet for that template, and the sheet's "Use template" button performs the creation.
The parameter is the only state involved: closing the sheet removes it, so Back returns to the previous
screen and a stale id is corrected rather than showing an empty panel.

**Consequences.** One creation path, one preview, and the dashboard stays a reading surface that links
onward (as ADR-24 requires of empty and partial states). The catalogue's filters remain component state
because they describe a visit; the preview is in the URL because it is deep-linkable.

## ADR-98 — Built-in templates are versioned data with permanent ids, and a seed bump is additive

**Context.** TASK-007 seeded two templates with `SEED_VERSION = 1`. TASK-018 needs at least eight across
eight categories. Existing installations must gain the new documents without duplicating the old ones,
resetting user templates, or overwriting a stored built-in.

**Decision.** The catalogue is plain data in `src/data/db/templates.ts`: nine entries, each with a fixed
id and a `buildContent()` function that goes through `createBlankDocument` so the shape is normalized.
`SEED_VERSION` becomes 2, and the seed loop creates a row only when its id is missing. The two v1 ids and
their documents are unchanged, so a v1 database gains exactly seven rows. Nothing pretends to be a
migration: there is no schema change, and no stored field changes meaning. Tags live in
`content.metadata.tags` rather than a new column, so a template's tags and the tags of the prompt it
creates are the same list by construction.

**Consequences.** Seeding stays idempotent and resumable (a second run creates nothing; an interrupted
run fills only the gaps), and the catalogue can grow again the same way. The cost is that changing a
built-in's _content_ cannot reach existing installations — a template is user-editable data once stored,
and built-ins are immutable by design (ADR-08). Improving a shipped document therefore means a new id,
not an edit.

## Verification log — TASK-018

**Scope verified:** the built-in catalogue (nine documents, eight required categories, every one validated),
template→prompt materialisation (deep copy, snippet references dropped, schema reference resolved against
storage), name uniqueness on create and rename, built-in immutability in the store _and_ in the rendered
menu, the filter/search/count behaviour, the preview sheet and its deep link, create-from-prompt, duplicate,
rename, delete, and the two empty states.

### Tests added (89 cases)

| File                                           | Cases | Covers                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/templates.test.ts`                 | 40    | tags, summaries and hashes, ordering, every filter dimension, issue rules (name, description, variables, document errors), name checks, copy naming, built-in protection, materialisation (independence, dropped snippets, schema resolution, titles), draft from prompt                                                                                                                                            |
| `src/data/db/templates.test.ts`                | 8     | catalogue size, required categories, unique ids and names, seed-v1 ids preserved, every document validates, every template has role/objective/instructions/variables/tags, valid variable identifiers, deterministic builds                                                                                                                                                                                         |
| `src/store/templates.test.ts`                  | 22    | create (trim, category default, name collision, invalid document, ordering, activity), create-from-prompt (document copy, `includes` cleared, missing prompt), update (rename, collision, built-in refusal, activity), duplicate (built-in source, independence, numbering), delete (user, built-in refusal), use (independent prompt, fresh id, dropped references, kept schema, title override, missing template) |
| `src/routes/templates/TemplatesRoute.test.tsx` | 17    | two sections with badges, card metadata, search + no-match + clear, kind and category filters, empty catalogue, no-custom-templates empty state, preview contents, deep link and Escape, create-and-navigate, second independent prompt, built-in menu without edit/delete, duplicate, rename, duplicate-name refusal, delete, create-from-prompt, required fields, no-prompts notice                               |
| `src/data/db/seed.test.ts` (extended)          | +2    | v1 → v2 upgrade adds exactly the seven new templates; user templates survive a seed bump                                                                                                                                                                                                                                                                                                                            |

**Extended without new cases:** `src/routes/dashboard/DashboardRoute.test.tsx` (quick-start cards now assert
their deep links), `src/app/dataBoot.test.ts` (seed version 2 and catalogue-sized template count),
`src/domain/purity.test.ts` (two module lists), `src/routes/library/LibraryRoute.test.tsx` (unchanged,
re-run after the create dialog switched to `instantiateTemplate`).

### Gates

| Gate                        | Result                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`          | exit 0                                                                                                                                                                                                                                                  |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                                                                                                                                                      |
| `npx vitest run`            | **79 files / 1167 tests passed, 0 failures**                                                                                                                                                                                                            |
| `npx vitest run --coverage` | thresholds pass — all files 95.94/90.17/97.14/96.86; `src/domain` 96.03/92.07/99.06/96.53, `src/store` 96.14/88.81/97.31/97.66, `src/data` 96.51/87.03/100/97.22; `templates.ts` (domain) 100/100/100/100, `data/db/templates.ts` 97.97/95.83/100/98.86 |
| `npx prettier --check .`    | clean                                                                                                                                                                                                                                                   |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                                                                                                                                                         |
| `npm run build`             | exit 0 — CSS 56.04 kB (13.51 kB gzip), app JS 914.89 kB (267.71 kB gzip), lazy `JsonEditor` chunk 427.59 kB (138.55 kB gzip)                                                                                                                            |

### Known limitations and honesty notes

- **No browser binary exists in this environment.** There was no manual pass at 390 px, no pointer or
  keyboard walkthrough, and no screenshot. The responsive claim rests on the grid collapsing to one column
  below `sm` and on jsdom tests; it is not a visual verification.
- **A built-in's content cannot be changed once stored.** Fixing a shipped document means a new id, which
  would duplicate the row on upgrade; the current choice is that stored data is the user's, not ours (ADR-98).
- **Using a template does not fill variables.** The prompt is created as a copy; supplying values is the
  laboratory's job (TASK-021), so the preview describes variables rather than rendering them.
- **The preview is a summary, not the JSON text.** It shows role, objective, instructions, constraints,
  variable table, output format, counts, and size. There is no raw-text view of a template yet.
- **Categories are free text.** Case and surrounding spaces are normalized, but "Extraction" and "Extracts"
  stay separate; there is no rename or merge for a category.
- **Deleting a template has no undo.** The confirmation says so; prompts already created from it are
  unaffected because they are independent copies.
- **The dashboard shows the first three templates** (existing limit from TASK-010), built-ins first, with the
  rest behind "All templates".
- **Search is substring matching, not fuzzy.** Multi-word queries require every word, which is predictable
  rather than clever.

### Deliberate deviations recorded for TASK-018

- `ActivityType` gained `'template'`, with an icon and label in the activity rail. Recording a template use
  as an ordinary prompt `created` event would have hidden the source of the prompt in the timeline.
- The plan's store actions are implemented as six methods on the existing data store rather than a separate
  template store: templates already hydrate with everything else, and a second store would duplicate that.
- `src/routes/library/LibraryRoute.tsx` now materialises a chosen template through `instantiateTemplate`
  instead of an inline JSON copy, so both creation paths drop the same references (ADR-94).
- `src/data/db/templates.ts` is exported from the `@/data` barrel: it is shipped _data_ the seed and tests
  both read, and it is not an adapter or a raw database module.
- A duplicated `## Validation studio` heading in `README.md` was removed while editing the document list.

## ADR-99 — History is a screen selected by `?revision=`, not a drawer inside the editor

**Context.** TASK-019 needs a snapshot list, a read-only viewer, and a restore flow. The editor already
holds a CodeMirror instance, an inspector column, a save pipeline, a recovery draft, and a block-leave
guard. A history drawer would have to coexist with all of that — including a read-only second editor inside
a dirty draft's screen.

**Decision.** History lives at `/prompts/:promptId/history`. The list occupies the left column and the
viewer the right; the selected snapshot is `?revision=<id>`. `RevisionViewer` still renders the shared
`JsonEditor` in `readOnly` mode, so highlighting, search, and monospace formatting are identical to the
editor without a second implementation. The route owns no draft: reading history cannot conflict with a
pending edit, and leaving history cannot trip the editor's unsaved-changes guard.

**Consequences.** A snapshot is linkable and Back closes the viewer instead of leaving the screen. The cost is
one navigation to compare a snapshot with the current document; the restore dialog compensates by listing
the exact field-level changes before you commit. Restoring navigates back to the editor, which re-reads the
stored prompt — "a refreshed editor" is a mount, not a state patch, so no stale draft survives a restore.

## ADR-100 — A restore writes its safety snapshot first and compensates if the write fails

**Context.** Restoring replaces the document, title, description, tags, and variables at once. The plan
requires that restoration "cannot lose newer work" and that a failure leaves data untouched. There is no
multi-record transaction in IndexedDB here, and a revision plus a prompt write are two records.

**Decision.** `restoreRevision(id)` creates a `restore-safety` revision of the _current_ prompt first, then
writes the restored state with the prompt's `expectedVersion`, then records an activity event. If the
prompt write throws, the safety revision is deleted again (best effort, failures swallowed so the original
error is what surfaces) and nothing else changes. Restores never delete a revision and never renumber one:
the safety snapshot takes `max(revisionNumber) + 1`, so history is append-only. Restored content and
variables are deep-copied through JSON, so the stored revision and the prompt never share a reference.

**Consequences.** The worst case is a leftover safety snapshot describing a restore that did not happen —
visible, labelled, and harmless — rather than an unexplained gap. Because the safety snapshot is written
before the prompt, the undo of a restore is always already recorded when the restore becomes visible.
`revisions.deleteByPrompt` still runs on prompt deletion, so history never outlives its prompt.

## ADR-101 — Pruning is explicit, non-renumbering, and never automatic

**Context.** Each revision stores a full document copy. The plan asks for a warning when the count is high
and an optional prune with explicit confirmation and counts.

**Decision.** `REVISION_WARNING_THRESHOLD` is 25. Past it, the history screen shows a warning with a prune
action, and a `Prune` control is always available on a non-empty history. The dialog states the exact
removal count and the numbers being removed before the button is enabled; there is no automatic pruning and
no setting that prunes silently. `pruneRevisions(promptId, keep)` keeps the newest N (floor 1), removes only
the oldest, and renumbers nothing — the next snapshot continues from the highest number the prompt ever had.
The repository gained an idempotent `revisions.deleteMany(ids)` so a prune is one call and unknown ids are
not an error.

**Consequences.** History is monotonic: numbers are stable identifiers that never point at different
content, and gaps are honest evidence that old snapshots were removed. The cost is that a pruned history
cannot be "compacted" into a tidy v1..vN sequence — deliberately, because renumbering would make an exported
or bookmarked reference point at different content. Snapshots remain in local storage only; deleting the
prompt deletes its history.

## Verification log — TASK-019

**Scope verified:** snapshot creation with an optional label (dialog warns about a dirty draft and offers to
save it first), per-prompt ordering, the list's metadata (number, label or "No label", kind as a worded badge,
relative time with the absolute time in `title` and the accessible name, size), the read-only viewer,
field-level restore confirmation, the safety revision, failure compensation, the retention warning, opt-in
pruning with counts, and both palette commands. Autosave not creating revisions is covered by the existing
save-pipeline tests plus the history suite's empty-state case.

### Tests added (59 cases)

| File                                                | Cases | Covers                                                                                                                                                                                                                            |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/revisions.test.ts`                      | 21    | ordering, filtering by prompt, lookup, summaries (kind words, size, hash, captured counts), size phrasing, restore impact (changed/unchanged/noop), label normalisation and checks, prune plan (floor, counts), warning threshold |
| `src/store/revisions.test.ts`                       | 25    | snapshot numbering and payload, labels, activity, restore (safety first, deep copy, activity, unchanged fields, version guard, failure compensation), prune (counts, floor, no renumbering, other prompts untouched)              |
| `src/routes/history/HistoryRoute.test.tsx`          | 8     | newest-first list with kind/time, deep-linked selection, unknown id correction, labelled snapshot save, restore + safety toast, retention warning and prune, empty state and first snapshot, missing prompt                       |
| `src/routes/editor/EditorRoute.test.tsx` (extended) | +3    | history link with "none", snapshot count, snapshot from the header                                                                                                                                                                |
| `src/lib/commands/coreCommands.test.ts` (extended)  | +1    | snapshot command exists only while registered; history command only from a prompt; navigation target                                                                                                                              |
| `src/data/repositories/contract.ts` (extended)      | +1    | `deleteMany` removes exactly the requested revisions and ignores unknown ids                                                                                                                                                      |

### Gates

| Gate                        | Result                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`          | exit 0                                                                                                                       |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                           |
| `npx vitest run`            | **82 files / 1227 tests passed, 0 failures**                                                                                 |
| `npx vitest run --coverage` | thresholds pass — all files 96.06/90.29/97.24/96.95 (`src/domain` and `src/store` thresholds both satisfied)                 |
| `npx prettier --check .`    | clean                                                                                                                        |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                              |
| `npm run build`             | exit 0 — CSS 56.51 kB (13.60 kB gzip), app JS 944.08 kB (274.24 kB gzip), lazy `JsonEditor` chunk 427.66 kB (138.58 kB gzip) |

### Known limitations and honesty notes

- **No browser binary exists in this environment.** There was no manual pass at 390 px, no keyboard
  walkthrough of the list, viewer, or dialogs on a real device, and no screenshot. Responsive and keyboard
  claims rest on the grid collapsing to one column below `lg`, native buttons, focus-visible outlines, and
  jsdom tests against the real route.
- **There is no diff yet.** The viewer shows a snapshot on its own and says where the diff lives (TASK-020).
  "Matches the stored prompt" is a hash comparison, not a line-by-line one.
- **Restore and prune are not undoable from the UI.** A restore can be undone by restoring its safety
  snapshot; a prune cannot be undone at all. Both dialogs say so.
- **Pruning is per prompt and manual.** There is no global retention setting and no automatic cleanup, so a
  library with many prompts can still accumulate many snapshots.
- **The list is not virtualised.** A prompt with several hundred snapshots will render every row; the
  retention warning exists partly for that reason.
- **Copy uses the clipboard API only.** In environments without `navigator.clipboard` the copy button
  reports failure rather than silently pretending to copy, matching the shared `CopyButton` behaviour.
- **The editor's snapshot dialog saves the draft first when asked**, because a snapshot captures stored
  state; a draft that was never saved is not part of any snapshot, and the dialog says so.
- **Numbers are stable across pruning and deletion of other prompts**, but deleting the prompt itself
  removes its history, so a restore cannot resurrect a deleted prompt.

## ADR-102 — A change is a pointer-addressed entry with a shape/value classification

**Context.** TASK-020 needs "a path-aware structural JSON diff with clear structural vs. textual
distinctions". The vocabulary matters more than the algorithm here: a person reading "3 changes" has to know
whether keys moved or a sentence was rewritten, and every row has to be locatable in the document.

**Decision.** `src/domain/diff.ts` emits an ordered list of `DiffEntry` objects. Each carries an RFC 6901
pointer (with `~0`/`~1` escaping), the same path as segments for breadcrumbs, a readable label, the values on
both sides, a kind (`added`, `removed`, `changed`, `type-changed`, `reordered`), and a category:

- **structural** = `added`, `removed`, `type-changed`, `reordered`.
- **textual** = `changed` (a value that kept its type and changed in place).

Ordering is document order as far as it exists: additions and changes follow the new document's key order,
then removals follow in the old key order. Nothing is sorted, because key order is often what the user is
looking at. `identical` is deep equality over parsed values, so whitespace and object member order are never
changes; array order is content, so a pure re-order is reported.

**Consequences.** Every row can be copied as a pointer that addressing tools understand, and the UI never has
to guess a category from a kind. The cost is that "textual" is a slightly odd word for "3 → 4" — the engine
uses the task's vocabulary and the interface spells it out ("Text: a value kept its type and changed in
place"). Type changes are structural because they change how the document can be read, not just what it says.

## ADR-103 — Arrays are compared positionally after trimming, and re-orders are claimed only for scalars

**Context.** A naive index-by-index array comparison turns "insert one instruction at the top" into a change
to every following element, which is accurate and useless. Real move detection (LCS or keyed matching) is
either expensive on large arrays or requires identity heuristics ("match by `name`") that silently mislabel
edits as moves.

**Decision.** Arrays are compared in two steps. First, if both arrays contain only scalars, have the same
length, and hold the same multiset of values, the whole array is one `reordered` entry with a capped list of
`{from, to}` moves and a total `movedPositions` count. Otherwise the common prefix and suffix are trimmed by
deep equality, elements in the remaining middle are compared index by index, and extra elements on either
side are reported as `added` or `removed` at their indices. No element is ever guessed to have "moved" when
its content also changed.

**Consequences.** Insertions and removals stay one entry, and a re-order of a list of strings is one entry
instead of N. The cost is that re-ordering an array of objects with no scalar change is reported as a series
of changes rather than a move; that is visible and correct, just less pretty. Duplicate scalar values make a
`moved` pair a hint (the target is the first matching index), which the engine documents and the UI labels as
positions rather than a permutation. Comparisons are capped at 2,000 entries and say `truncated` when they
stop, so a pathological document cannot freeze the tab.

## ADR-104 — Comparison sources are URL parameters; pasted JSON is deliberately not

**Context.** The plan asks for a deep-linkable `/diff` route that "survives reload", plus ad-hoc pasted
documents and the ability to compare any prompt or snapshot with any other. Query strings are the only state
the browser restores for free.

**Decision.** A side is serialised as a short reference: `prompt:<id>`, `revision:<id>`, or `text`. The route
reads `?left=` and `?right=`, with `?prompt=<id>` as a shortcut meaning "newest snapshot versus the stored
prompt" — the comparison the editor's **Compare** and the history screen's **Compare snapshots** links open.
A revision reference carries no prompt id because the revision already has one. Pasted JSON is marked by
`text` and stored in component state only: a whole document does not belong in a URL (length limits, history,
and shoulder-surfing), so the screen states that a reload clears the pasted side. Copying writes the entries
that are visible under the current filter, and records the filter in the output, so a filtered copy never
looks like a complete comparison.

**Consequences.** Every server-independent comparison is linkable, bookmarkable, and reload-safe; pasted
comparisons are explicitly ephemeral. Changing a picker rewrites both parameters and drops `?prompt=`, so the
URL is always explicit about what is on screen. Nothing on this route writes to storage: opening, filtering,
switching views, and copying all leave prompts and snapshots untouched.

## Verification log — TASK-020

**Scope verified:** the engine's fixtures (nested object add/remove/change, scalar and container type changes,
array insert/remove/replace/re-order with move caps, large arrays, Unicode including NFC vs. NFD and emoji),
pointer escaping and round-tripping, summary and filter helpers, value formatting and truncation, and both
copy formats; the route's default and explicit sources, deep links, paste parsing with a non-blocking error,
filter-faithful copying, view switching, keyboard traversal, and the identical/no-differences state; the
history and editor entry points; and both palette commands.

### Tests added (78 cases)

| File                                       | Cases | Covers                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/diff.test.ts`                  | 41    | equality and key/array order, every change kind, nesting and ordering, type changes at field and root, array insert/remove/replace/re-order/move caps, large arrays, pointers and escaping, Unicode, summaries and filters, value formatting, JSON and text copies with filter notes, entry caps and truncation, side labels |
| `src/features/diff/sources.test.ts`        | 19    | parameter round-trips and malformed values, default source pairs, resolution (prompt/revision/deleted/missing), revision picker ordering, kind switching, empty library                                                                                                                                                      |
| `src/routes/diff/DiffRoute.test.tsx`       | 13    | `?prompt=` defaults, explicit deep links, list and detail rendering, keyboard traversal, filtering and filtered copy, whole-comparison copy, identical state, unified/split and full values, pasted JSON and parse errors, URL never carrying pasted text, missing snapshot, empty library, swap                             |
| `src/routes/history/HistoryRoute.test.tsx` | +1    | header **Compare snapshots** and per-snapshot **Compare with current** links                                                                                                                                                                                                                                                 |
| `src/routes/editor/EditorRoute.test.tsx`   | +1    | header **Compare** link                                                                                                                                                                                                                                                                                                      |
| `src/lib/commands/coreCommands.test.ts`    | +1    | `diff.compare` only from a prompt workspace, `diff.open` everywhere, navigation targets                                                                                                                                                                                                                                      |

### Gates

| Gate                        | Result                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`          | exit 0                                                                                                                                                                                                                               |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                                                                                                                                   |
| `npx vitest run`            | **85 files / 1305 tests passed, 0 failures**                                                                                                                                                                                         |
| `npx vitest run --coverage` | thresholds pass — all files 96.14/90.70/97.36/97.09; `src/domain` 96.22/92.52/99.21/96.91 (`diff.ts` 97.48/96.42/100/100), `src/store` 96.49/89.24/97.4/97.8, `src/data` 96.51/87.03/100/97.22 (statements/branches/functions/lines) |
| `npx prettier --check .`    | clean                                                                                                                                                                                                                                |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                                                                                                                                      |
| `npm run build`             | exit 0 — CSS 57.37 kB (13.72 kB gzip), app JS 976.55 kB (283.20 kB gzip), lazy `JsonEditor` chunk 427.66 kB (138.58 kB gzip)                                                                                                         |

### Known limitations and honesty notes

- **No browser binary exists in this environment**, so there was no manual pass at 390 px, no pointer or
  keyboard walkthrough of the pickers, list, or detail panel on a real device, and no screenshot. The
  responsive and keyboard claims rest on `lg` breakpoints, native controls, roving tabindex with
  focus-visible rings, and jsdom tests against the real route.
- **The copy is a change list, not a patch.** "Copy as text" produces a readable list (before/after lines with
  paths) that cannot be applied to a file; the UI calls it that rather than implying a unified diff.
- **Re-orders are detected for scalar arrays only** (ADR-103). Re-ordering an array of objects appears as
  changes to the affected indices.
- **The split view is a two-column change list, not two document trees.** It places before and after side by
  side; there is no synchronised scrolling document view.
- **Comparisons cap at 2,000 entries**, and the screen and the copy both say when that happened.
- **Pasted JSON is not persisted** — not to storage, not to the URL, and not across a reload.
- **No path jump into the editor.** A change names its pointer, but the raw editor has no "scroll to path"
  command yet; that would be a separate piece of work.
- **No revision is created by comparing**, so a comparison can never change what it is looking at.

## ADR-105 — Playground inputs live in `sessionStorage`, never `localStorage`

**Context.** The playground needs values between rerenders and should survive an accidental reload of the
tab, but a variable's value is usually the sentence a prompt will be sent with — often a customer's text.
The library already persists prompts, revisions, and a recovery draft: prompts and revisions in IndexedDB,
recovery drafts in `localStorage` keyed by prompt id.

**Decision.** Inputs are stored in `sessionStorage`, one key per prompt
(`promptforge.playground.<promptId>`), holding `{ promptId, values, savedAt }` where `values` is a map of
raw field text. A record is capped (200 entries, 200,000 characters) and validated on read: wrong prompt id,
unparsable JSON, a non-string value, or an over-cap payload is treated as _absent_ rather than repaired. Writes
are debounced and their result is reported; `canUsePlaygroundStorage` probes with a real set/remove, so a
browser that refuses storage simply has no remembered inputs. Nothing is written to a prompt, a revision, or
the app's IndexedDB.

**Why not `localStorage`.** Persisting a customer's text in a profile that survives the tab — and that the
next person to open this browser can read — is a privacy cost with no product benefit: playground values are
a scratch pad for one working session, not document state. `sessionStorage` gives the useful half of
persistence (reload-safe in the same tab) and drops the risky half (a permanent record). It also keeps the
"what is a draft?" story simple: a recovery draft belongs to a real edit and is cleared when that edit is
saved; playground text belongs to no edit and is cleared when the tab closes.

**Why not IndexedDB or the prompt itself.** A saved test case is a deliberate artifact with a name and a
purpose (TASK-022). Silently attaching values to a prompt would blur "the prompt" and "one attempt at using
it", and would change the document without a save. The panel says, in words, that inputs are kept in this tab
only and never leave the browser.

**Consequences.** A reload keeps the inputs; a new tab starts empty; a closed tab loses them with no
warning, which is the point. Clearing a field is a real edit to stored text, so a cleared _required_ field is
treated as unanswered (the render blocks) rather than substituting an empty string, and a declared default of
`""` still resolves because defaults are applied by the renderer, not by the form. `localStorage` remains
reserved for the editor's recovery draft (ADR-76) and preferences.

## ADR-106 — The template language is substitution, and there is no evaluator to disable

**Context.** Text in a prompt document contains `{{name}}` placeholders. The obvious next requests are
expressions (`{{price * 1.2}}`), helpers, and conditionals, and the obvious implementation shortcut is to
`eval` or `new Function` a token. Losing the boundary would let a document — which may have been imported from
somewhere else — execute code in this origin, where the whole library lives.

**Decision.** `{{name}}` is matched by a scanner, the identifier is checked against
`^[A-Za-z_][A-Za-z0-9_]*$`, and the name is looked up in a plain object of declared variables. That is the
entire language. Nothing is evaluated, no helper table is consulted, and no code is constructed. Values are
inserted by declaration: a string as-is, a number and a boolean as literals, JSON as compact JSON. A value
whose type does not match the declaration is an error, not a coercion attempt. Tokens that do not resolve are
copied through unchanged and reported — the placeholder stays visible rather than disappearing.

**Enforcement.** `src/domain/render.ts` and `src/domain/variables.ts` contain no `eval(`, `new Function`,
`Function(`, `setTimeout(`, or dynamic `import(`; `src/domain/render.test.ts` reads both files, strips
comments, and fails the suite if any of those appear. The same suite renders `{{1 + 1}}`, `{{constructor}}`,
`{{__proto__}}`, and `{{toString}}` and asserts they come out as literal text. A declared name is looked up
with `Object.hasOwn`, so inherited prototype members are never read.

**Consequences.** No expression, loop, or helper syntax is possible in v1, and documents that use one are
reported as unusable placeholders rather than half-working. Bounded work is explicit: at most 1,000 tokens per
string and 200,000 characters of output, past which the render is refused with a message instead of slowing
the tab. A future expression language would be a new, deliberately sandboxed decision (ADR-105's neighbours),
not a quiet relaxation of this one.

## Verification log — TASK-021

**Scope verified:** the scanner's token boundaries and problem kinds (unclosed, empty name, invalid name,
truncation); reference extraction across every string in a document, including fields that are not rendered;
reconciliation of declarations against references; input parsing and formatting for all four declared types;
coercion and its error path; section layout, ordering, and omission; missing-required blocking versus
optional fallback to a default; undeclared and unused reporting; determinism; the security boundary; the
storage layer's caps and fail-soft reads; the hook's debounce, resets, and restoration; the screen's blocked,
undeclared, boolean, no-variable, broken-document, and missing-prompt states; the editor Preview tab; and the
palette command.

### Tests added (84 cases)

| File                                             | Cases | Covers                                                                                                                                                                                                              |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/variables.test.ts`                   | 26    | Token scanning and problem kinds, caps, path extraction across nested strings, per-path occurrence counts, reconciliation order, per-type parsing/formatting, coercion, type wording                                |
| `src/domain/render.test.ts`                      | 26    | Section order and omission, substitution for all four types, defaults, blocked renders, unknown/invalid tokens, determinism, unicode/newlines/nested braces, caps, no-evaluator grep                                |
| `src/features/playground/valuesStorage.test.ts`  | 6     | Round-trip per prompt, foreign/corrupt payloads treated as absent, write and read caps, throwing storage, clearing one prompt                                                                                       |
| `src/features/playground/usePlayground.test.ts`  | 12    | Defaults, required blocking, blank-field semantics, invalid number/JSON, resets, reconciliation, debounce timing, restoration, disabled persistence, variable-set changes                                           |
| `src/routes/playground/PlaygroundRoute.test.tsx` | 10    | Blocked render and copy absence, typed input and live preview, invalid number/JSON, undeclared/unused reporting, boolean switch, no-variable document, tab restoration, broken document, missing prompt, scope note |
| `src/routes/editor/EditorRoute.test.tsx`         | +3    | Preview tab follows the draft, pauses on invalid JSON, links to the standalone playground                                                                                                                           |
| `src/lib/commands/coreCommands.test.ts`          | +1    | `playground.open` only from a prompt workspace, and its navigation target                                                                                                                                           |

### Gates

| Gate                        | Result                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`          | exit 0                                                                                                                                                                                                                                                                   |
| `npx eslint .`              | exit 0, 0 warnings                                                                                                                                                                                                                                                       |
| `npx vitest run`            | **90 files / 1,389 tests passed, 0 failures**                                                                                                                                                                                                                            |
| `npx vitest run --coverage` | thresholds pass — all files 96.28/90.93/97.46/97.19; `src/domain` 96.47/92.68/99.29/97.1 (`render.ts` 100/93.1/100/100, `variables.ts` 96.99/94.18/100/97.47); `src/store` 96.49/89.24/97.4/97.8; `src/data` 96.51/87.03/100/97.22 (statements/branches/functions/lines) |
| `npx prettier --check .`    | clean                                                                                                                                                                                                                                                                    |
| `npm run check:contrast`    | 64 pairings pass in both themes                                                                                                                                                                                                                                          |
| `npm run build`             | exit 0 — CSS 58.96 kB (13.85 kB gzip), app JS 1,005.20 kB (291.15 kB gzip), lazy `JsonEditor` chunk 427.66 kB (138.58 kB gzip)                                                                                                                                           |
| no-evaluator grep           | `grep -nE '\beval\s*\(\|new\s+Function\|Function\s*\(\|setTimeout\s*\(\|import\s*\(' src/domain/render.ts src/domain/variables.ts` finds no call sites (only prose in comments, which the test strips) and the same rule is asserted in `src/domain/render.test.ts`      |

### Known limitations and honesty notes

- **No browser binary exists in this environment**, so there was no manual pass at 390 px, no pointer or
  keyboard walkthrough of the form or the output block on a real device, and no screenshot. Responsive and
  keyboard claims rest on wrapping monospace output, `lg`/`xl` breakpoints, labelled native controls, and
  jsdom tests against the real route.
- **No model is called, ever.** The playground renders text; it cannot tell whether the prompt is good, and
  the scope note says so.
- **"Save as test case" is not rendered.** It belongs to TASK-022, and a button that did nothing would be
  worse than no button.
- **A blank field is an unanswered question for every type, including string.** Whitespace-only text is
  treated as blank too, so a prompt cannot currently be rendered with a value that is intentionally spaces.
- **Only the prose fields are rendered.** Examples, output configuration, and metadata stay out of the text;
  variable extraction still scans them, and the screen states the difference.
- **Values are inserted verbatim.** There is no escaping, templating, or quoting: a string containing
  `{{other}}` is inserted as written and is not re-scanned, because substitution is a single pass over the
  source text.
- **Re-ordering or re-rendering is not cheap for very large documents**: the render is capped at 200,000
  characters and 1,000 tokens per string, and the render is refused with a message past that, rather than
  attempting to stream.
- **Inputs are per tab.** A reload keeps them; a second tab starts empty; closing the tab loses them without
  warning (ADR-105).
