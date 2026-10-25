# PromptForge — Testing Notes

This file records **how the suite is run, what it covers, and what it does not**. Every
number below comes from a command that was executed in this repository; nothing here is an
estimate. Where something could not be verified, it says so instead of implying coverage.

Last refreshed: 2026-10-25 (post-delivery FIX-001).

---

## 1. How to run

| Command                  | What it does                                                            |
| ------------------------ | ----------------------------------------------------------------------- |
| `npm run test:run`       | One-shot run of the whole suite (the CI-style command; no watch mode).  |
| `npm run test`           | Watch mode for local development.                                       |
| `npm run test:coverage`  | `vitest run --coverage`: full suite plus the coverage table and floors. |
| `npx vitest run <path>`  | A single file or directory, e.g. `npx vitest run src/domain/transfer`.  |
| `npm run typecheck`      | `tsc --noEmit`.                                                         |
| `npm run lint`           | ESLint, flat config.                                                    |
| `npm run format:check`   | Prettier check (never runs in watch mode during tests).                 |
| `npm run check:links`    | Link and anchor check over the README, `tasks.md`, and `docs/`.         |
| `npm run check:contrast` | WCAG contrast gate for 88 token pairings, both themes.                  |
| `npm run build`          | Typecheck plus production build.                                        |

The runner is Vitest 5 with `jsdom` and `@testing-library/react`. There is no browser
binary in this environment, so nothing here is an end-to-end browser test — see §7.

## 2. Latest results (executed)

| Gate                    | Result                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run test:run`      | **123 files, 1,990 tests, all passing**, no skipped or `todo` tests                                                |
| `npm run test:coverage` | Same suite; **91.59 % statements, 85.08 % branches, 89.65 % functions, 92.59 % lines** (258 measured source files) |
| Determinism             | Two consecutive full runs produced identical counts (1,990 / 123) and identical coverage figures                   |
| `npm run typecheck`     | 0 errors                                                                                                           |
| `npm run lint`          | Clean                                                                                                              |
| `npm run format:check`  | Clean                                                                                                              |
| `npm run build`         | Exit 0                                                                                                             |

Wall time on this machine: **266.21 s for `npm run test:run`** and **319.63 s for
`npm run test:coverage`** (the difference is instrumentation). In both runs the tests
themselves are only about half of the time — jsdom environment setup and module import per
file are the rest, which is why the suite is parallelised into workers rather than
optimised file by file.

## 3. Test inventory

123 test files, grouped by where they live. Every module that holds logic has a sibling
test; the two domain files without one (`src/domain/index.ts`, `src/domain/types.ts`) are a
re-export barrel and type-only declarations, so there is nothing there to assert.

| Area              | Files | Representative files                                                                                                                           |
| ----------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`     | 26    | `render.test.ts`, `diff.test.ts`, `graph.test.ts`, `quality.test.ts`, `health.test.ts`, `composer.test.ts`, `jsonSchema.test.ts`, `transfer/*` |
| `src/data/`       | 9     | `db/migrations.test.ts`, `repositories/indexedDb.test.ts`, `adapters/inMemory.test.ts`                                                         |
| `src/store/`      | 9     | `dataStore.test.ts` (58 cases), `selectors.test.ts`, `preferences.test.ts`                                                                     |
| `src/lib/`        | 10    | `commands/*`, `folderTree`, `debounce`, `useMediaQuery`, `dates`                                                                               |
| `src/components/` | 20    | `ui/*` (11), `command-palette/CommandPalette.test.tsx`, `editor/*`, `layout/*`                                                                 |
| `src/features/`   | 16    | `save/useSavePipeline.test.tsx`, `save/savePipeline.indexedDb.test.tsx`, `quality`, `editor`                                                   |
| `src/routes/`     | 16    | `library/LibraryRoute.test.tsx` (the largest screen suite), `editor/EditorRoute.test.tsx`, `validation/`, `playground/`                        |
| `src/app/`        | 7     | `router.test.tsx`, `DataBootstrap.test.tsx`, `ErrorBoundary.test.tsx`, `dataBoot.test.ts`                                                      |
| `src/styles/`     | 2     | token and theme contract tests                                                                                                                 |
| `src/test/`       | 4     | shared accessibility suites (`a11y.routes`, `a11y.overlays`)                                                                                   |

### 3.1 Shared test utilities (`src/test/`)

| File                    | Purpose                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup.ts`              | Global setup: `matchMedia` mock, jest-dom matchers, Testing Library cleanup, network guard.                                                                                        |
| `clock.ts`              | `fakeClock()` — a frozen clock plus sequential ids, so nothing reads the real time.                                                                                                |
| `libraryFixture.ts`     | `buildLibrary()` / `buildTemplateFixture()` — deterministic seeded repositories.                                                                                                   |
| `networkGuard.ts`       | Replaces `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and `sendBeacon` with spies that **throw**, so an accidental outbound request fails the test and names the target. |
| `renderApp.tsx`         | Renders the app shell with fresh stores.                                                                                                                                           |
| `renderAppWithData.tsx` | Renders the real router and screens over in-memory repositories in durable or ephemeral mode.                                                                                      |
| `a11y.ts`               | The only place axe rules are configured (and the explicit list of rules jsdom cannot run).                                                                                         |
| `downloads.ts`          | Captures export downloads instead of touching the file system.                                                                                                                     |
| `matchMedia.ts`         | A controllable `matchMedia` for responsive contracts.                                                                                                                              |
| `commandContext.ts`     | Builds command-palette contexts.                                                                                                                                                   |
| `transferFixture.ts`    | Builds import/export bundles.                                                                                                                                                      |
| `workflows/`            | The integration flows of §10.2 (see §4).                                                                                                                                           |

**No test touches the network.** The guard in `setup.ts` is installed once, reset before
each test, and asserted after each test, so a suite that grew an outbound call would fail
instead of quietly reaching the internet. Tests also avoid real timers: the only timing
that exists is `waitFor`/`findBy*` polling, plus Vitest fake timers where a debounce or
autosave delay is itself under test.

## 4. Critical integration flows (§10.2)

All ten flows named in `tasks.md` §10.2 are covered. Flows 1, 2, 4, 7, 8, and 10 are also
driven end-to-end through the real store and repositories in `src/test/workflows/`; the
rest are covered by the screen suites that own those surfaces.

| #   | Flow                                                                               | Where it is covered                                                                                                                    | What the test asserts                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create a prompt, reload repositories, verify persistence and activity              | `test/workflows/criticalFlows.test.ts` (§10.2.1)                                                                                       | The row survives a fresh attachment, and exactly one activity event is recorded (not one per reconnect).                                                                                                                                                                           |
| 2   | Edit and autosave; save status transitions; stale-write rejection                  | `workflows/criticalFlows.test.ts` (§10.2.2), `features/save/useSavePipeline.test.tsx`, `features/save/savePipeline.indexedDb.test.tsx` | A write based on an older version is refused, the stored text is untouched, and the UI reports conflict rather than success.                                                                                                                                                       |
| 3   | Folder/collection creation, move, deletion safeguards                              | `routes/library/LibraryRoute.test.tsx` (create, rename, re-parent, descendant guard, delete-by-moving), `store/dataStore.test.ts`      | A folder cannot become its own descendant; deleting a folder moves its prompts and subfolders; deleting a collection clears membership only.                                                                                                                                       |
| 4   | Snapshot, edit, restore; safety revision; nothing silently lost                    | `workflows/criticalFlows.test.ts` (§10.2.3)                                                                                            | Restoring writes a `restore-safety` revision holding the state it replaced, so the newer text stays reachable.                                                                                                                                                                     |
| 5   | Validate against a stored schema; error list and paths; valid JSON, invalid schema | `routes/validation/ValidationRoute.test.tsx`, `domain/jsonSchema.test.ts`                                                              | Per-path findings are listed, severity filtering works, an unevaluable schema is reported as such instead of blaming the document.                                                                                                                                                 |
| 6   | Render with variables; missing-required detection; rendered output                 | `routes/playground/PlaygroundRoute.test.tsx`, `domain/render.test.ts`                                                                  | Rendering is blocked until a required variable is answered, with a precise reason; typed values are coerced and undeclared placeholders are surfaced.                                                                                                                              |
| 7   | Import a valid bundle and an invalid file; no partial writes                       | `workflows/criticalFlows.test.ts` (§10.2.7), `domain/transfer/*`, `components/transfer/ImportDialog`                                   | A valid bundle lands completely in one pass; a rejected file writes nothing at all.                                                                                                                                                                                                |
| 8   | Simulated storage failure; error state, draft retention, no false "saved"          | `workflows/durableFailure.test.tsx` (§10.2.8)                                                                                          | Over the real IndexedDB adapter with `update` failing: the status reads “Not saved”, the message is shown, no “Saved” text appears, the draft stays in the editor and in recovery storage, and the stored row is still at version 1. A second case retries and lands at version 2. |
| 9   | Command palette navigation and duplicate-execution guard                           | `components/command-palette/CommandPalette.test.tsx`, `app/router.test.tsx`                                                            | A chord or duplicate activation runs a command once, typing in a field does not trigger shortcuts, and commands navigate.                                                                                                                                                          |
| 10  | Bulk archive with undo restores prior state                                        | `workflows/criticalFlows.test.ts` (§10.2.10), `routes/library/LibraryRoute.test.tsx` (bulk archive/delete undo)                        | Every archived prompt returns to its previous state, and the undo is persisted, not just repainted.                                                                                                                                                                                |

### 4.1 Integration verification matrices (TASK-030)

| File                                     | Cases | What it verifies beyond the flow list above                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflows/routeMatrix.test.tsx`         | 41    | Every route in the router: one `main`, one `h1`, correct `document.title`, breadcrumb names the screen, no error boundary; every internal link on every screen resolves; empty-library copy and the first-run guide; seeding is idempotent; the matrix itself covers every declared path.                                               |
| `workflows/commandMatrix.test.tsx`       | 22    | The palette as one catalogue: structure and uniqueness, discovery by title wherever a command is available, every navigation target resolves, guards never throw, screen-scoped commands appear only with their screen, the help overlay documents every advertised binding, and `Mod+K` / `?` / a `G L` sequence work from six routes. |
| `workflows/persistenceRoundTrip.test.ts` | 3     | Export → delete the IndexedDB database → import into a fresh one, comparing documents, metadata, membership, history, and test cases; the documented omissions (activity log, preferences) are asserted, as is a rejected file leaving the library untouched.                                                                           |
| `components/layout/navigation.test.ts`   | 7     | `routeLabel` / `crumbsForPath`, including the `/diff` regression.                                                                                                                                                                                                                                                                       |

The results of that pass, including the two defects it found and fixed, are in
`docs/VERIFICATION.md`.

## 5. Coverage policy

Coverage is a **ratchet, not a target**. The floors in `vite.config.ts` sit a few points
below the measured value of the weakest module in each tree, so a real regression fails the
gate while deleting covered code does not. They are not thresholds chosen to make the
number look good.

| Tree                | Statements | Branches | Functions | Lines | Measured at TASK-031 (stmts / branch / funcs / lines) |
| ------------------- | ---------- | -------- | --------- | ----- | ----------------------------------------------------- |
| All files           | 88         | 80       | 85        | 88    | 91.48 / 84.90 / 89.46 / 92.49                         |
| `src/app/**`        | 88         | 76       | 88        | 88    | 94.71 / 82.09 / 94.29 / 94.02                         |
| `src/components/**` | 78         | 75       | 74        | 78    | 84.84 / 81.36 / 80.99 / 84.84                         |
| `src/data/**`       | 90         | 79       | 90        | 90    | 95.85 / 85.00 / 95.68 / 95.85                         |
| `src/domain/**`     | 92         | 87       | 94        | 92    | 97.02 / 91.67 / 98.96 / 97.02                         |
| `src/features/**`   | 82         | 74       | 84        | 82    | 88.89 / 80.77 / 90.05 / 88.89                         |
| `src/lib/**`        | 88         | 81       | 86        | 88    | 93.49 / 87.00 / 91.94 / 93.49                         |
| `src/routes/**`     | 74         | 67       | 71        | 74    | 81.30 / 74.32 / 78.75 / 81.30                         |
| `src/store/**`      | 90         | 83       | 92        | 90    | 95.89 / 89.36 / 97.71 / 95.89                         |

The fix cycle after TASK-031 raised the aggregate to **91.59 / 85.08 / 89.65 / 92.59** (1,990
tests); the per-tree figures above are from the TASK-031 run and every floor still holds.

Excluded from measurement (and why): `src/**/*.test.{ts,tsx}` (the tests themselves),
`src/test/**` (harnesses), `src/**/*.d.ts`, and `src/main.tsx` (the entry point plus the
`createRoot` call, which no unit test can meaningfully cover).

**Known weak spots, stated rather than hidden.** `src/routes/design/**` (the developer
design gallery) is 43.9 % of lines because it is a catalogue of demo states, not a workflow;
it is intentionally not chased. `components/editor/JsonEditor.tsx` and `TreeView.tsx` sit
around 65–70 % because jsdom has no layout and no CodeMirror measurement, so the untested
lines are pointer/measurement paths — covered by hand in a real browser (TASK-027 checks)
but not asserted here.

## 6. How the suite grew

| After task | Files | Tests | Coverage figure measured at the time                             |
| ---------- | ----- | ----- | ---------------------------------------------------------------- |
| TASK-026   | 109   | 1,829 | not recorded in this file (domain, data, store only)             |
| TASK-027   | 112   | 1,844 | not re-recorded separately                                       |
| TASK-028   | 116   | 1,879 | 96.62 / 90.59 / 97.78 / 97.55 — **domain, data, and store only** |
| TASK-029   | 119   | 1,902 | 91.48 / 84.90 / 89.46 / 92.49 — **all application source**       |
| TASK-030   | 123   | 1,975 | 91.57 / 85.01 / 89.69 / 92.58 — same measured set                |
| FIX-001    | 123   | 1,990 | 91.59 / 85.08 / 89.65 / 92.59 — same measured set                |

The TASK-029 figure is **lower on purpose**: from this task on, the measured set includes
the UI trees (`components`, `features`, `routes`, `app`, `lib`, `styles`) that earlier tasks
only reported on. Comparing 96 % against 91 % here compares different denominators; the
per-tree table in §5 is the meaningful record.

Test cases added by TASK-029: 23 in 3 files (9 integration flows, 14 variables-editor cases),
plus three shared utilities and the global network guard. One dead module
(`src/routes/shared/RouteScaffold.tsx`, unreferenced once every route had been built) was
removed rather than tested.

Test cases added by FIX-001 (the save bar): 15 across five suites — five pipeline cases (no-op
save, repeated refusal, retryability, storage re-open, held draft), five save-bar cases, two
editor-route cases (clean press, ephemeral explanation), and three bootstrap cases for the
recovery context; the composer's blocked-save test gained the reason assertions.

Test cases added by TASK-030: 73 in 4 files — the route matrix (41), the command matrix (22),
the backup round trip (3), and the navigation unit suite (7). Two defects were found and fixed
during that pass; see `docs/VERIFICATION.md` §6.

## 7. End-to-end / browser tests: not available here

TASK-029 attempted a Playwright chromium smoke suite and **could not install a browser**.
The evidence, from this environment on 2026-10-25:

```
$ npm i -D @playwright/test      # succeeded (0 vulnerabilities)
$ npx playwright install chromium
Error: Failed to download Chrome for Testing 156.0.8078.4 (playwright chromium v1248)
  code: 'ECONNRESET', host: 'cdn.playwright.dev', port: 443
Failed to install browsers
```

Because the browser binary cannot be fetched, `@playwright/test` was **uninstalled again**
and no `e2e/` directory, config, or `*.spec.ts` files were left behind. Nothing in this
repository is a skipped browser test dressed up as coverage. The consequence, and the plan
for the manual matrix that replaces it, is recorded in `docs/LIMITATIONS.md`.

What the missing browser costs us is listed explicitly in `docs/LIMITATIONS.md` §2 —
measured contrast, target size, real keyboard and screen-reader sessions, zoom/reflow, and
observing focus rings or motion.

## 8. Conventions for new tests

- **Name the behaviour, not the function.** `it('refuses a stale write and leaves the stored
text alone')`, not `it('editPrompt')`.
- **Arrange through the public surface.** Screens render through `renderAppWithData`;
  domain tests call the pure function; repository tests use `createInMemoryRepositories` or
  `fake-indexeddb` when the adapter itself is under test.
- **Never assert on the clock or on randomness.** Use `fakeClock()` and the fixtures in
  `src/test/`.
- **Never let a test reach the network.** The guard throws; do not stub it out.
- **Prefer one honest test over two that pass for the wrong reason.** If a path cannot be
  driven in jsdom, say so in a comment and in this document instead of writing a test that
  asserts nothing.
- No `it.skip` / `it.todo` for unfinished work: an unimplemented guarantee is documented as
  a limitation, not parked in the suite.

## 9. Still not verified by this suite

- Anything requiring a real browser: layout, overflow, contrast on rendered pixels, target
  sizes, focus visibility, motion, zoom/reflow, CodeMirror’s own widget internals.
- Screen-reader output. The axe suites prove structure, not announcements.
- Multi-tab behaviour beyond the simulated `BroadcastChannel`/storage events used in the save
  pipeline tests.
- Long-run behaviour (thousands of revisions, multi-year history). Scale is covered up to
  the 1,000-prompt fixtures those tests use; it is not a performance claim.
