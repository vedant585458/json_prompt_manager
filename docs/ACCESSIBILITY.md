# PromptForge — Accessibility

**Target:** WCAG 2.2 AA on every implemented surface.
**Built in:** TASK-028 (audit and remediation), on foundations from TASK-002 (tokens, focus, motion), TASK-008 (landmarks, skip link), and TASK-004 (overlay focus behaviour).
**Authority:** this page describes what is actually verified. Where something was not checked, it says so instead of implying a pass.

## How accessibility is verified

Three gates, each covering what it can actually see:

| Gate                              | Command                                                                                          | What it proves                                                                                                        | What it cannot prove                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Automated markup audit (axe-core) | `npx vitest run src/test/a11y.routes.test.tsx src/test/a11y.overlays.test.tsx`                   | No critical or serious violations on the primary routes and the overlays                                              | Contrast, target size, focus order, anything needing layout         |
| Keyboard and semantics suite      | `npx vitest run src/components/layout/shell.a11y.test.tsx src/components/ui/forms.a11y.test.tsx` | Skip link, landmarks, headings, form association, error announcements, focus trap and restore, no hover-only controls | Real tab order through a rendered page; screen-reader speech output |
| Palette contrast gate             | `npm run check:contrast`                                                                         | Every token pairing the UI is built from, in both themes, including composited disabled states                        | Whether a component used the right token                            |

The axe rules that need a rendering engine are disabled in one place
(`UNSUPPORTED_IN_JSDOM` in `src/test/a11y.ts`) rather than silently skipped per test:
`color-contrast`, `color-contrast-enhanced`, `target-size`,
`scrollable-region-focusable`, `label-content-name-mismatch`, and `region`.

## axe results

Run on a seeded library (two prompts, a folder, a collection, a schema, a revision, a
test case), with each screen waited on until it had rendered its real content.

| Surface                                         | Findings (critical/serious) |
| ----------------------------------------------- | --------------------------- |
| Dashboard `/`                                   | 0                           |
| Library `/library`                              | 0                           |
| Editor `/prompts/:id`                           | 0                           |
| Composer `/prompts/:id/compose` and `/composer` | 0                           |
| Validation `/validation`                        | 0                           |
| Templates `/templates`                          | 0                           |
| Health `/health`                                | 0                           |
| Settings `/settings`                            | 0                           |
| Diff `/diff?prompt=…`                           | 0                           |
| Command palette (empty and with results)        | 0                           |
| Shortcut help                                   | 0                           |
| Import dialog                                   | 0                           |
| Destructive confirmation                        | 0                           |
| Dropdown menu                                   | 0                           |
| Sheet                                           | 0                           |

No `moderate` or `minor` findings remain either: a probe run over every route returned
`none` for all impacts before the strict suites were written. The sanity test in
`a11y.routes.test.tsx` appends an unnamed button and asserts axe catches it, so a
suite that silently stopped scanning would fail.

## What TASK-028 fixed

| Finding                                                                | Where                                                                                                                      | Fix                                                                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `aria-label` on a generic `<span>` (aria-prohibited-attr, serious)     | `EditorStatusBar`                                                                                                          | The abbreviation is `aria-hidden`; a `sr-only` span carries "Line 3, column 12" as real text               |
| `aria-label` on a `<pre>` (aria-prohibited-attr, serious)              | `ComposerPreview`                                                                                                          | The scrollable block is `role="region"`, which may be named                                                |
| Heading order jumped h1 → h4 (moderate)                                | `ComposerFields`                                                                                                           | "Snippets used" is an `h2`, so the outline has no missing level                                            |
| Field errors were associated but never announced                       | `Field`                                                                                                                    | The error paragraph is `role="alert"`, with a decorative icon                                              |
| Skip link scrolled without moving focus                                | `SkipLink`                                                                                                                 | The click handler focuses the target explicitly (and tolerates environments with no `scrollIntoView`)      |
| The in-app reduced-motion switch did nothing                           | `ThemeProvider`, `styles/theme.ts`                                                                                         | The stored preference now sets `[data-reduced-motion='true']`; the OS media query still applies on its own |
| Disabled controls faded to 55 % (2.3–2.6:1 for muted text)             | `buttonVariants`, `IconButton`, `controlStyles`, `Checkbox`, `RadioGroup`, `Switch`, `Tabs`, `DropdownMenu`, `ContextMenu` | Fade raised to 70 %, and the gate now composites it: worst case 3.06:1                                     |
| The contrast gate never measured composited or accent-on-surface pairs | `scripts/check-contrast.mjs`                                                                                               | 12 new pairings (accent on surface-2/3, sunken surface text, disabled states, danger/inverse); 64 → **88** |

## Contrast

Every pairing below is computed from `src/styles/tokens.css` by
`npm run check:contrast`, which fails the build if any value drops. Text pairs are held
to 4.5:1; UI boundaries, focus rings, and disabled controls to 3:1. WCAG exempts
inactive controls from contrast, but the product holds them to 3:1 anyway — a control
nobody can read is still a control nobody can use.

| Pair                                   | Role | Dark      | Light     | Minimum |
| -------------------------------------- | ---- | --------- | --------- | ------- |
| Primary text on canvas                 | Text | 16.80:1 ✓ | 17.52:1 ✓ | 4.5:1   |
| Primary text on surface-1              | Text | 16.07:1 ✓ | 18.45:1 ✓ | 4.5:1   |
| Primary text on surface-2              | Text | 15.16:1 ✓ | 16.35:1 ✓ | 4.5:1   |
| Primary text on surface-3              | Text | 13.97:1 ✓ | 14.94:1 ✓ | 4.5:1   |
| Secondary text on surface-1            | Text | 8.22:1 ✓  | 7.90:1 ✓  | 4.5:1   |
| Secondary text on surface-2            | Text | 7.75:1 ✓  | 7.00:1 ✓  | 4.5:1   |
| Secondary text on surface-3            | Text | 7.14:1 ✓  | 6.40:1 ✓  | 4.5:1   |
| Muted text on surface-1                | Text | 5.65:1 ✓  | 5.81:1 ✓  | 4.5:1   |
| Muted text on surface-2                | Text | 5.33:1 ✓  | 5.14:1 ✓  | 4.5:1   |
| Muted text on surface-3                | Text | 4.91:1 ✓  | 4.70:1 ✓  | 4.5:1   |
| Accent text on surface-1               | Text | 14.82:1 ✓ | 7.18:1 ✓  | 4.5:1   |
| Accent text on canvas                  | Text | 15.50:1 ✓ | 6.82:1 ✓  | 4.5:1   |
| Accent text on accent-soft             | Text | 12.38:1 ✓ | 6.38:1 ✓  | 4.5:1   |
| JSON key on editor background          | Text | 11.48:1 ✓ | 7.45:1 ✓  | 4.5:1   |
| JSON string on editor background       | Text | 13.45:1 ✓ | 5.93:1 ✓  | 4.5:1   |
| JSON number on editor background       | Text | 12.86:1 ✓ | 6.81:1 ✓  | 4.5:1   |
| JSON literal on editor background      | Text | 10.24:1 ✓ | 7.52:1 ✓  | 4.5:1   |
| JSON punctuation on editor background  | Text | 7.70:1 ✓  | 7.19:1 ✓  | 4.5:1   |
| Editor gutter on editor background     | Text | 5.77:1 ✓  | 5.28:1 ✓  | 4.5:1   |
| Accent-fill label                      | Text | 15.14:1 ✓ | 14.82:1 ✓ | 4.5:1   |
| Success text on surface-1              | Text | 10.93:1 ✓ | 5.35:1 ✓  | 4.5:1   |
| Success text on success-soft           | Text | 9.17:1 ✓  | 4.75:1 ✓  | 4.5:1   |
| Warning text on surface-1              | Text | 10.72:1 ✓ | 5.93:1 ✓  | 4.5:1   |
| Warning text on warning-soft           | Text | 8.93:1 ✓  | 5.24:1 ✓  | 4.5:1   |
| Danger text on surface-1               | Text | 6.56:1 ✓  | 6.52:1 ✓  | 4.5:1   |
| Danger text on danger-soft             | Text | 5.95:1 ✓  | 5.49:1 ✓  | 4.5:1   |
| Info text on surface-1                 | Text | 7.67:1 ✓  | 6.60:1 ✓  | 4.5:1   |
| Info text on info-soft                 | Text | 6.78:1 ✓  | 5.66:1 ✓  | 4.5:1   |
| Control boundary on surface-1          | UI   | 3.26:1 ✓  | 3.22:1 ✓  | 3:1     |
| Strong boundary on surface-1           | UI   | 4.11:1 ✓  | 4.79:1 ✓  | 3:1     |
| Accent text on surface-2               | Text | 13.99:1 ✓ | 6.36:1 ✓  | 4.5:1   |
| Accent text on surface-3               | Text | 12.88:1 ✓ | 5.82:1 ✓  | 4.5:1   |
| Accent text on accent-soft over canvas | Text | 12.38:1 ✓ | 6.38:1 ✓  | 4.5:1   |
| Primary text on surface-sunken         | Text | 16.41:1 ✓ | 16.79:1 ✓ | 4.5:1   |
| Secondary text on surface-sunken       | Text | 8.39:1 ✓  | 7.19:1 ✓  | 4.5:1   |
| Muted text on surface-sunken           | Text | 5.77:1 ✓  | 5.28:1 ✓  | 4.5:1   |
| Disabled secondary button label        | UI   | 7.88:1 ✓  | 6.49:1 ✓  | 3:1     |
| Disabled primary button label          | UI   | 6.58:1 ✓  | 6.18:1 ✓  | 3:1     |
| Disabled ghost button label            | UI   | 4.53:1 ✓  | 3.66:1 ✓  | 3:1     |
| Disabled muted helper text             | UI   | 3.33:1 ✓  | 3.06:1 ✓  | 3:1     |
| Danger text on danger-soft over canvas | Text | 5.95:1 ✓  | 5.49:1 ✓  | 4.5:1   |
| Inverse text on danger fill            | Text | 6.70:1 ✓  | 6.52:1 ✓  | 4.5:1   |
| Focus ring on canvas                   | UI   | 15.50:1 ✓ | 6.82:1 ✓  | 3:1     |
| Focus ring on surface-1                | UI   | 14.82:1 ✓ | 7.18:1 ✓  | 3:1     |

## Motion

- `@media (prefers-reduced-motion: reduce)` collapses every animation and transition
  to 0.01 ms and sets `scroll-behavior: auto`.
- `[data-reduced-motion='true']` does the same for the in-app preference, which is now
  actually applied (see the fix table).
- Individual transitions that matter for layout (the rail's width) also carry
  `motion-reduce:transition-none`, so they cannot animate even if the global rule is
  overridden.
- Reduced motion is a preference, not a downgrade: nothing is hidden or disabled by it.

## Keyboard

| Behaviour                                                                                      | Status                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skip link is the first tab stop and moves focus into `main`                                    | Verified                                                                                                                                                                                    |
| Dialogs trap focus and restore it to the opener                                                | Verified (Radix + `focus-return`)                                                                                                                                                           |
| Command palette: focus lands in the search field, Tab stays inside, Escape restores the opener | Verified                                                                                                                                                                                    |
| Two-key chords (`G` then `L`) do not fire while typing in a field                              | Verified                                                                                                                                                                                    |
| No control is revealed only on hover                                                           | Verified by a source scan (no `group-hover:` reveal of a hidden control)                                                                                                                    |
| Tree view: one tab stop, arrow keys, `aria-activedescendant`                                   | Verified by the TASK-014 suite                                                                                                                                                              |
| Everything focusable has a visible ring                                                        | Verified as a stylesheet contract: `:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible { outline: 2px solid var(--pf-focus-ring) }`; components do not cancel it |

## Screen-reader semantics

- One `main`, one `h1` per route, and every `navigation` landmark carries a label
  (asserted for six routes).
- Forms: `Field` owns the label, `aria-describedby` (hint + error), `aria-invalid`, and
  `required`; the asterisk is decorative and the state comes from the attribute.
- Status is never colour alone: save status, toasts, filter counts, bulk selection, and
  the diff summary are live regions with text; the editor's validation badge pairs its
  colour with words and an icon.
- Validation errors are listed with paths and messages, not just marked.

## Not verified (stated, not hidden)

- **No real browser or screen reader was available.** There is no browser binary in this
  environment, so there was no VoiceOver/NVDA pass, no manual tab-through of a rendered
  page, and no screenshot review. Every claim above comes from jsdom, axe, or a source
  scan.
- **Colour contrast of rendered pixels** is not measured; the token pairings are. A
  component that used the wrong token would pass the gate.
- **Target size** is a CSS contract (`pointer-coarse:min-h-11`) verified by class, not by
  measuring a rendered control. jsdom computes no geometry.
- **Zoom and reflow at 400 %** were not tested.
- **Reduced motion** was verified by attribute and stylesheet, not by watching an
  animation stop.
- **Focus-visible appearance** was not observed, only asserted as CSS.

## Known gaps

- The editor is a CodeMirror surface: its internal widget markup is third-party. axe
  passes on it here, but a browser audit could still find something inside the editor's
  own UI (search panel, autocomplete).
- The command palette's listbox is virtualised only by rendering all groups; with a very
  large command set, `aria-activedescendant` ids remain correct but the DOM grows.
- Health distribution bars are decorative duplicates of a real table beneath them; the
  bar itself has no accessible value of its own (the table is the accessible source).
- Toast timing: errors stay for 8 s or until dismissed, which is longer than the default
  but still a timer. Nothing moves focus to a toast.
