# PromptForge — Integration Verification (TASK-030)

This is the record of an integration pass, not a promise. Every claim below names the command
that produced it or the test file that asserts it, and §7 lists what this pass **could not**
check in an environment with no browser binary.

Date: 2026-10-25. Commit under test: the TASK-030 working tree on
`arena/3b0d1d76-json-prompt-manager`.

---

## 1. Summary

| Question                                                 | Answer                                                                                                                                            | Evidence                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Does every route render?                                 | Yes — 16 paths, each with one `main` landmark, one `h1`, a correct document title, and no error boundary                                          | `src/test/workflows/routeMatrix.test.tsx` (41 cases)    |
| Is every internal link live?                             | Yes — every `a[href^="/"]` on every route resolves to a real route, and every rail destination exists                                             | same file, "every internal link resolves"               |
| Does every palette command work and land somewhere real? | Yes — 26 commands, unique ids, unique bindings, guards that never throw, every navigation target resolves                                         | `src/test/workflows/commandMatrix.test.tsx` (22 cases)  |
| Do the keyboard shortcuts work everywhere?               | Palette and help open from six different routes; a `G L` sequence navigates from `/settings`                                                      | same file, "the global keyboard works from every route" |
| Does a backup actually restore a library?                | Yes — export → delete the database → import into a fresh install restores documents, metadata, membership, history, and test cases field by field | `src/test/workflows/persistenceRoundTrip.test.ts`       |
| Does the production build serve on every route?          | Yes — 16/16 paths return `200 text/html` with the app root, assets return 200                                                                     | §5, `curl` against `npm run preview`                    |
| Are the quality gates green?                             | Yes — typecheck, lint, format, 1,975 tests, coverage floors, build                                                                                | §4                                                      |
| Defects found                                            | 2 fixed, each with a regression test                                                                                                              | §6                                                      |
| Defects left open                                        | 0 known; limitations and unverifiable areas in §7 and `docs/LIMITATIONS.md`                                                                       | —                                                       |

## 2. What was verified, and how

The environment has no browser, so "manual matrix" was executed as **automated integration
through the real router, stores, and repositories in jsdom**, plus **HTTP-level checks of the
production build**. Nothing in this document was verified by looking at pixels.

| Area                         | Verification                                                                                                                                                  | Result                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Routes (16 paths)            | Render with a seeded library; level-1 heading, title, landmarks, breadcrumb, no error boundary                                                                | Pass                  |
| Not-found path               | `/there-is-nothing-here` renders the 404 screen with a way back                                                                                               | Pass                  |
| Internal links               | Every anchor on every route resolved against the router's own table                                                                                           | Pass                  |
| Rail navigation              | Every `ALL_NAV` destination resolves to a route                                                                                                               | Pass                  |
| Empty library                | Dashboard, library, health, validation, playground each state their emptiness and the next step                                                               | Pass                  |
| First run                    | Dashboard shows the three-step guide with a working Dismiss control                                                                                           | Pass                  |
| Shipped content              | `seedDatabase` writes starters once; a second call is a no-op and duplicates nothing                                                                          | Pass                  |
| Command catalogue            | 26 commands: groups, descriptions, namespaced ids, lowercase keywords, parseable unique bindings                                                              | Pass                  |
| Palette discovery            | Every command is findable by typing its own title in every state where it claims to be available                                                              | Pass                  |
| Screen-scoped commands       | Validate / snapshot / export appear on a prompt screen and disappear on `/library`; import stays                                                              | Pass                  |
| Keyboard from every route    | `Mod+K` and `?` open from `/`, `/library`, `/validation`, `/prompts/prompt-1`, `/settings`, `/design`; `G L` navigates                                        | Pass                  |
| Shortcut documentation       | Every binding the palette advertises has a help row, and every help row belongs to a real binding                                                             | Pass (after defect 2) |
| Create from template         | `TemplatesRoute.test.tsx` (17), `LibraryRoute.test.tsx` (63) cover use → new prompt → editor                                                                  | Pass                  |
| Edit / validate / fix        | `EditorRoute.test.tsx` (39), `ValidationRoute.test.tsx` (11)                                                                                                  | Pass                  |
| Save / autosave / recovery   | `useSavePipeline.test.tsx` (17), `savePipeline.indexedDb.test.tsx` (2), `durableFailure.test.tsx` (2)                                                         | Pass                  |
| Folders / collections / tags | `LibraryRoute.test.tsx` create, rename, re-parent, descendant guard, delete-by-move, tag rename/delete                                                        | Pass                  |
| Favorites / pins / archive   | `LibraryRoute.test.tsx` incl. bulk favorite/archive/delete with undo                                                                                          | Pass                  |
| Snapshots / restore          | `HistoryRoute.test.tsx` (9) + `criticalFlows.test.ts` (§10.2.3 safety revision)                                                                               | Pass                  |
| Diff                         | `DiffRoute.test.tsx` (13)                                                                                                                                     | Pass                  |
| Variables / preview          | `PlaygroundRoute.test.tsx` (10), `VariablesEditor.test.tsx` (14)                                                                                              | Pass                  |
| Lab / test cases             | `LabRoute.test.tsx` (19)                                                                                                                                      | Pass                  |
| Graph (blueprint)            | `BlueprintPanel.test.tsx` (12)                                                                                                                                | Pass                  |
| Inspector / quality          | `QualityPanel.test.tsx` (15)                                                                                                                                  | Pass                  |
| Health                       | `HealthRoute.test.tsx` (17)                                                                                                                                   | Pass                  |
| Import / export              | `ImportDialog.test.tsx` (12), `SettingsRoute.test.tsx` backup case, `persistenceRoundTrip.test.ts`                                                            | Pass                  |
| Settings / theme             | `SettingsRoute.test.tsx` (7), `themeBoot.test.ts`, `ThemeToggle` via shell                                                                                    | Pass                  |
| Ephemeral mode               | `DataBootstrap.test.tsx` (5) label + "not saved" copy; `useSavePipeline` disabled-state case                                                                  | Pass                  |
| Persistence after reload     | `criticalFlows.test.ts` reopen-connection cases; `savePipeline.indexedDb.test.tsx` second connection                                                          | Pass                  |
| Persistence after failure    | `durableFailure.test.tsx`: refused write, draft kept, no false "saved", retry lands                                                                           | Pass                  |
| Persistence after round trip | `persistenceRoundTrip.test.ts`: database deleted between export and import                                                                                    | Pass                  |
| Honesty copy                 | Playground "never sent anywhere", settings "Preferences never leave this browser", import fidelity notes asserted equal to `FIDELITY_NOTES`, ephemeral banner | Pass                  |

## 3. New verification suites added by this task

| File                                              | Cases | What it does that nothing else did                                                                                                                                                                                              |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/test/workflows/routeMatrix.test.tsx`         | 41    | Opens every route, asserts the shell contract on each, resolves every link, sweeps empty-library screens and the first-run guide, and checks that seeding is idempotent. Also asserts it covers every path the router declares. |
| `src/test/workflows/commandMatrix.test.tsx`       | 22    | Treats the palette as one catalogue: structure, uniqueness, discovery by title, navigation targets, guard safety, screen-scoped availability, help/palette agreement, and global keyboard from six routes.                      |
| `src/test/workflows/persistenceRoundTrip.test.ts` | 3     | A real backup cycle: write to IndexedDB, export, delete the database, import into a fresh one, compare documents and membership; asserts the documented omissions too.                                                          |
| `src/components/layout/navigation.test.ts`        | 7     | `routeLabel` / `crumbsForPath`, including the regression for defect 1.                                                                                                                                                          |

## 4. Quality gates (executed)

| Command                     | Result                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`         | 0 errors                                                                                                       |
| `npm run lint`              | Clean                                                                                                          |
| `npx prettier --check .`    | Clean                                                                                                          |
| `npm run test:run`          | **123 files, 1,975 tests, all passing**, exit 0, **252.79 s**                                                  |
| `npx vitest run --coverage` | **EXIT 0**, 123 files / 1,975 tests, coverage **91.57 / 85.01 / 89.69 / 92.58**, all thresholds met (299.85 s) |
| `npm run build`             | Exit 0 — `index-*.js` 1,193.93 kB (340.53 kB gzip), CSS 62.81 kB (14.52 kB gzip)                               |
| `npm run check:contrast`    | Unchanged from TASK-028 (88 pairings); no token changed in this pass                                           |

## 5. Production preview smoke test

`npm run build` then `npm run preview` (Vite preview, `0.0.0.0:4173`), then `curl` for every
route path:

```
200 text/html root=1 /                             200 text/html root=1 /diff
200 text/html root=1 /library                      200 text/html root=1 "/diff?prompt=prompt-1"
200 text/html root=1 /prompts/prompt-1             200 text/html root=1 /composer
200 text/html root=1 /prompts/prompt-1/compose     200 text/html root=1 /templates
200 text/html root=1 /prompts/prompt-1/history     200 text/html root=1 /validation
200 text/html root=1 /prompts/prompt-1/playground  200 text/html root=1 /health
200 text/html root=1 /prompts/prompt-1/lab         200 text/html root=1 /settings
200 text/html root=1 /there-is-nothing-here        200 text/html root=1 /design
```

Assets referenced by the served HTML:

```
200 1193930 /assets/index-*.js
200   62810 /assets/index-*.css
200        —  /favicon.svg
```

The served document declares `lang="en"`, a description meta tag, a theme-color, and the
inline theme-boot script that sets `data-theme` before first paint.

**Deployment caveat (not an app defect):** the preview server answers an unknown asset path
with the SPA fallback (`200 text/html` for `/assets/nope.js`), so a host that serves
`index.html` for missing files will make a stale asset reference fail as a MIME error instead
of a 404. A real deployment should serve `/assets/*` with `404` and only fall back to
`index.html` for extension-less routes. Recorded in `docs/LIMITATIONS.md` §4.

## 6. Defects found and fixed

### Defect 1 — `/diff` told the reader the page did not exist

- **Found by:** the route matrix asserting the document title and breadcrumb on every route.
- **Symptom:** the Diff screen rendered and worked, but `document.title` was
  `Not found · PromptForge`, the breadcrumb read `Not found`, and the top bar said the same.
  `routeLabel()` only knew rail destinations, and `/diff` has no rail entry (it is reached from
  the palette and from a prompt's history).
- **Cause:** `src/components/layout/navigation.ts` — nav-only label lookup with a `/prompts/`
  special case and no way to name a screen that is off the rail.
- **Fix:** added `OFF_NAV_LABELS` (`{ '/diff': 'Diff' }`) consulted by `routeLabel`, so the
  title, top bar, and breadcrumb all say "Diff".
- **Regression test:** `src/components/layout/navigation.test.ts` (label + trail) and
  `routeMatrix.test.tsx` (title on `/diff` and `/diff?prompt=…`).

### Defect 2 — the shortcut help hid the shortcut that opens it

- **Found by:** the command matrix cross-checking what the palette advertises against what the
  help overlay documents.
- **Symptom:** the help dialog says its rows are "every shortcut this build registers", but
  `?` itself was missing: `Show keyboard shortcuts` has `when: (context) => !context.helpOpen`,
  and the overlay evaluated availability with `helpOpen: true`, so the command filtered itself
  out of its own list.
- **Fix:** `src/components/layout/ShortcutHelpDialog.tsx` evaluates availability as if the
  overlay were closed, so the self-hiding guard no longer applies to its own documentation.
- **Regression test:** `commandMatrix.test.tsx` — "the help overlay documents every shortcut the
  palette advertises" (both directions, plus the existing
  `ShortcutHelpDialog.test.tsx` suite).

No other defect was found. Every other check in §2 passed on the first run; two further checks
failed first for the _test's_ own mistakes (a wrong expected title, a wrong route path) and were
corrected rather than being written off.

## 7. What this pass did not verify

Recorded in full in `docs/LIMITATIONS.md`; the short version:

- No browser binary, so no rendered layout, no pixel contrast, no target-size measurement, no
  focus-ring observation, no zoom/reflow, and no screen-reader session. Every screen was
  verified **structurally**, not visually.
- No Playwright suite exists in this repository (attempt recorded in `docs/LIMITATIONS.md` §1),
  so the cross-screen journeys in §2 are integration tests over jsdom, not browser runs.
- Multi-tab behaviour was not exercised with two real browsing contexts; the save pipeline's
  cross-tab path is covered by simulated `BroadcastChannel`/storage events.
- Scale was exercised to the fixtures the suites use (up to 1,000 prompts in
  `LibraryRoute.test.tsx`), not to a performance budget.

## 8. Reproducing this pass

```bash
npm ci
npm run typecheck && npm run lint && npx prettier --check .
npm run test:run                     # 123 files / 1,975 tests
npx vitest run --coverage            # floors in vite.config.ts
npm run test:run -- src/test/workflows   # the three new verification suites only
npm run build && npm run preview     # then curl the route list in §5
```
