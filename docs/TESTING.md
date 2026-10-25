# PromptForge — Testing Notes

## Responsive viewports (TASK-027)

The responsive pass targets the following widths. Every route is expected to work at
each one; the column after the width records how that width was checked.

| Width   | Represents                      | How it was checked                                                                               |
| ------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| 360 px  | Small Android phone             | Static class review + jsdom contract tests; **not** measured in a real browser (no browser here) |
| 390 px  | iPhone 13/14/15                 | Static class review + jsdom contract tests; same caveat                                          |
| 768 px  | Tablet portrait                 | Static class review                                                                              |
| 1024 px | Tablet landscape / small laptop | Static class review + the editor's single-pane boundary is asserted at this width                |
| 1280 px | Laptop                          | Static class review                                                                              |
| 1440 px | Desktop                         | Static class review                                                                              |
| 1920 px | Wide desktop                    | Static class review                                                                              |

**What was actually verified automatically** (`src/components/ui/responsive.test.tsx`,
`src/lib/useMediaQuery.test.ts`, `src/components/library/FilterBar.compact.test.tsx`,
`src/store/uiStore.test.ts`):

- dialogs switch to a bottom-sheet treatment below 640 px (`max-sm:` classes plus
  `env(safe-area-inset-bottom)` padding);
- buttons and icon buttons grow to a 44 px target under `pointer: coarse`;
- the main column keeps clear of the home indicator (`env(safe-area-inset-bottom)`);
- the breakpoint hook reports the wide layout when `matchMedia` is missing, follows
  `change` events, supports the legacy `addListener` API, and unsubscribes on unmount;
- the editor, at a single-pane width, renders its inspector once — inside a sheet
  opened from an "Inspector" button — instead of a second column;
- the library filter bar, at a compact width, keeps search and the view toggle in
  place and puts sorting, the three selects, the two checkboxes, and the applied
  chips behind a "Filters" button (the chips stay outside the sheet, so an applied
  filter can always be removed), with the same controls and handlers as the wide
  layout;
- the rail's collapsed state survives a reload through `localStorage`, ignores an
  unreadable value, and does not throw when storage is blocked.

**Already stacked before this pass** (checked by reading the markup, not by
rewriting it): the diff route (`lg:grid-cols-2` and `lg:grid-cols-[…22rem]`), the
laboratory (`xl:grid-cols-[…]`), the blueprint (`hidden … md:block` grid with a
list fallback below `md`), and the validation summary (`grid-cols-2 sm:grid-cols-4`)
all collapse to a single column at narrow widths. The editor toolbar hides its
labels below `sm` and wraps, which is why no overflow menu was added — every action
stays reachable and none is hover-only.

**What was not verified:** jsdom implements no layout, so `scrollWidth`/`clientWidth`
numbers are meaningless there and no test claims otherwise. No horizontal-overflow
measurement, screenshot, or touch-emulation pass has been performed, because this
environment has no browser binary. Those remain open checks for TASK-030 (manual
integration verification).
