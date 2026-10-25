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
`src/lib/useMediaQuery.test.ts`):

- dialogs switch to a bottom-sheet treatment below 640 px (`max-sm:` classes plus
  `env(safe-area-inset-bottom)` padding);
- buttons and icon buttons grow to a 44 px target under `pointer: coarse`;
- the main column keeps clear of the home indicator (`env(safe-area-inset-bottom)`);
- the breakpoint hook reports the wide layout when `matchMedia` is missing, follows
  `change` events, supports the legacy `addListener` API, and unsubscribes on unmount;
- the editor, at a single-pane width, renders its inspector once — inside a sheet
  opened from an "Inspector" button — instead of a second column.

**What was not verified:** jsdom implements no layout, so `scrollWidth`/`clientWidth`
numbers are meaningless there and no test claims otherwise. No horizontal-overflow
measurement, screenshot, or touch-emulation pass has been performed, because this
environment has no browser binary. Those remain open checks for TASK-030 (manual
integration verification).
