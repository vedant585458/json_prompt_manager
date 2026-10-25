# PromptForge — Known Limitations

This file lists what the product, the test suite, and this delivery **do not** do, with the
evidence or reason for each. It exists so that no reader has to infer coverage from silence.
Started in TASK-029 (E2E attempt); extended by TASK-030 (integration pass); TASK-031 closes it.

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

## 2a. What the TASK-030 integration pass verified, and what it still could not

`docs/VERIFICATION.md` records the pass in detail: every route renders with the right title and
landmarks, every internal link resolves, every command is discoverable and points at a real
route, the global keyboard works from six screens, and a full backup survives deleting the
database and importing into a fresh install. Two defects were found and fixed there.

What that pass **still** could not do is look at anything. Every screen was verified
structurally (does the right markup, copy, and state exist?) rather than visually (does it look
right at 360 px, is the focus ring visible, does the modal cover the right layer?). Those items
stay in §2.

## 3. Product-scope limitations (by design)

- **Single browser, single device.** All data lives in this browser’s IndexedDB. There is no
  account, no sync, and no server: exporting is the only backup. In private windows, blocked
  storage, or a refused write, the app runs in **ephemeral mode** and says so.
- **No provider integration, and no execution of any kind.** There is no API key field, no model
  picker, no "test against GPT/Claude" button, and no code path that could become one: the app
  makes no runtime network request at all (a test guard fails the suite if one appears). It can
  tell you a document is well-formed, consistent, and free of specific smells; it cannot tell you
  whether a model will follow it. Valid JSON is never described as an effective prompt.
- **Quality findings are heuristics, not verdicts.** The fifteen rules in
  [`QUALITY-RULES.md`](./QUALITY-RULES.md) look for concrete, explainable problems — missing
  objectives, contradictory instructions, undeclared placeholders, and so on — and each states its
  reason. Nothing is scored, ranked against other prompts, or measured against model output.
- **No real-time collaboration, sharing, or multi-user features.** Nothing is shared, invited, or
  synced. Two tabs of the same browser are coordinated (write announcements and stale-write
  conflicts) and nothing more; there is no presence, no cursors, no comment threads, no roles.
  Moving a library between people means exporting a file and importing it.
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
- **Browser support is a target, not a tested matrix.** The build assumes modern evergreen
  browsers with IndexedDB, CSS custom properties, and the APIs the bundle uses; Tailwind CSS v4
  requires Chrome/Edge 111+, Safari 16.4+, or Firefox 128+. No real browser was available during
  this delivery (see §1–2), so support is a statement about the code the build targets. Old
  browsers, in-app webviews, and unusual mobile shells are untested. `BroadcastChannel` degrades
  gracefully when absent — the cross-tab notice simply does not appear — but that degradation was
  exercised only in jsdom.

## 4. Environment and deployment limitations

- **A host must not serve `index.html` for missing assets.** The local preview (`vite preview`,
  SPA mode) answers `/assets/nope.js` with `200 text/html`. That is fine locally, but a static
  host configured to fall back to `index.html` for every path would turn a stale asset reference
  into a MIME-type error instead of a 404. Deploy with `/assets/*` served strictly (404 on miss)
  and the fallback applied only to extension-less routes.
- **No browser binary**, so the production bundle was verified by `npm run build` plus HTTP
  checks against `npm run preview` (16/16 route paths return `200 text/html` with the app root,
  and the referenced JS/CSS return 200). No page was executed in a browser during this delivery.
- **No screenshots or visual record exist.** Every image in a product README would have had to be
  invented here. The running `/design` gallery is the visual reference instead — see
  [`DEPLOYMENT.md`](./DEPLOYMENT.md) §5 for the three things worth checking by eye on the target
  browser.

- No browser binary, so the production build was verified by `npm run build` and route
  assertions, not by loading it in a browser (`npm run preview` was not exercised).
- No automated visual regression; no screenshot comparison is performed anywhere.
- The accessibility work (TASK-028) is automated axe checks plus static review. It is not a
  conformance claim, and it is not a substitute for a manual audit by a person using
  assistive technology.

## 5. Accepted defects

None known. The TASK-030 pass fixed the two defects it found (`/diff` reported itself as
"Not found" in the title, top bar, and breadcrumb; the shortcut help omitted its own `?`
binding) and added a regression test for each — see `docs/VERIFICATION.md` §6.

Anything found later belongs here, with its impact, rather than in a commit message.
