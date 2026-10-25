# PromptForge — Known Limitations

This file lists what the product, the test suite, and this delivery **do not** do, with the
evidence or reason for each. It exists so that no reader has to infer coverage from silence.
Started in TASK-029 (E2E attempt); TASK-030 and TASK-031 extend it.

Last updated: 2026-10-25.

---

## 1. End-to-end browser tests are not part of this repository

**Status: not available in this environment. Nothing is skipped in its place.**

TASK-029 attempted the optional Playwright chromium smoke suite. Installing the package
succeeded; downloading the browser did not:

```
$ npm i -D @playwright/test      → 0 vulnerabilities
$ npx playwright install chromium
Error: Failed to download Chrome for Testing 156.0.8078.4 (playwright chromium v1248)
  code: 'ECONNRESET', host: 'cdn.playwright.dev', port: 443
Failed to install browsers
```

The sandbox has outbound access to `registry.npmjs.org` but not to `cdn.playwright.dev`,
where browser binaries live, and no system Chromium is present. Consequences:

- `@playwright/test` was removed again; there is **no `e2e/` directory, no Playwright
  config, and no `*.spec.ts` file** in the repository, so nothing looks like a browser suite
  that silently never runs.
- `package.json` gained no dependency for it.
- The flows Playwright would have covered (create from template → edit invalid JSON → fix
  and save → add variable → preview → snapshot → diff → export, plus a mobile-viewport pass)
  are instead covered at the integration level (see `docs/TESTING.md` §4) and remain on the
  manual matrix in TASK-030.

To add browser tests later, on a machine that can reach the CDN or has a Chromium binary:
`npm i -D @playwright/test && npx playwright install chromium`, add `playwright.config.ts`
pointing at `npm run dev`, and re-run the manual matrix as a first smoke spec.

## 2. What a jsdom suite cannot prove

The suite runs in `jsdom`, which implements no layout engine and no paint. The following are
therefore **not verified by any automated test**, and no test in this repository claims them:

| Not verified                                              | Why                                        | Where it is checked instead                                                                                            |
| --------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Contrast on rendered pixels                               | No paint; axe cannot compute colours       | `npm run check:contrast` audits the token pairings (88 pairs, both themes); rendered-pixel contrast remains unmeasured |
| Target sizes / pointer geometry                           | `getBoundingClientRect` returns zeros      | Class-level contracts (`pointer-coarse:min-h-11`) plus manual review                                                   |
| Scrollable-region focus, `region`, label-in-name          | axe rules that need layout or an a11y tree | Excluded explicitly in `src/test/a11y.ts`, never reported as passing                                                   |
| Focus-ring visibility, animation, reduced-motion _effect_ | No styles applied                          | CSS-contract tests plus manual checks; the media query is driven through a `matchMedia` mock                           |
| 400 % zoom / reflow                                       | No viewport                                | Manual matrix (TASK-030)                                                                                               |
| Real screen-reader output                                 | No assistive technology                    | Structure is asserted; announcements are not                                                                           |
| CodeMirror widget internals                               | Third-party view code, no layout           | Hand-checked paths; integration assertions stop at the editor’s public surface                                         |
| Cross-tab behaviour                                       | No second browsing context                 | Simulated with `BroadcastChannel`/storage events in the save pipeline tests                                            |

## 3. Product-scope limitations (by design)

- **Single browser, single device.** All data lives in this browser’s IndexedDB. There is no
  account, no sync, and no server: exporting is the only backup. In private windows, blocked
  storage, or a refused write, the app runs in **ephemeral mode** and says so.
- **Not an LLM client.** PromptForge never sends a prompt anywhere and never executes it.
  Valid JSON is never described as an effective prompt; the quality inspector reports
  heuristics with reasons, not verdicts.
- **No expression language.** The renderer substitutes `{{name}}` tokens only. There is no
  `eval`, no conditionals, and no arithmetic — decisions recorded in ADR-04.
- **Import resolves conflicts per record, not per field.** A planned row can be added as new,
  added as a copy, skipped, or overwritten as a whole; there is no field-by-field merge
  editor.
- **Diff is structural, not semantic.** Key order is ignored; array order is significant.
- **Scale claims are bounded.** Fixtures reach 1,000 prompts and the tests assert behaviour
  at that size; there is no benchmark and no claim beyond it.
- **Translations and RTL** are not implemented. English-only, left-to-right.
- **No PWA / offline service worker.** The app is a static SPA that works once loaded; it is
  not installable and does not cache itself.

## 4. Environment limitations of this delivery

- No browser binary, so the production build was verified by `npm run build` and route
  assertions, not by loading it in a browser (`npm run preview` was not exercised).
- No automated visual regression; no screenshot comparison is performed anywhere.
- The accessibility work (TASK-028) is automated axe checks plus static review. It is not a
  conformance claim, and it is not a substitute for a manual audit by a person using
  assistive technology.

## 5. Accepted defects

None known at the time of writing. TASK-030 is the pass that searches for them; anything
found and not fixed will be listed here with its impact, instead of being left unmentioned.
