# PromptForge — Deployment

PromptForge is a static site. `npm run build` produces a folder you can serve from any static
host, CDN, or object store. There is **no server component, no database, no environment
variable, and no secret** to configure: all data lives in the visitor's browser.

Nothing here is a hosting walkthrough for a specific provider — that would be a fabricated setup.
These are the requirements any static host has to meet, and the checks that prove it does.

---

## 1. Build

```bash
npm ci
npm run build        # tsc --noEmit first, then vite build
```

Output in `dist/` (2.0 MB total for the current build):

| Path                          | What it is                                          | Notes                                         |
| ----------------------------- | --------------------------------------------------- | --------------------------------------------- |
| `index.html`                  | The app shell, with the inline theme-boot script    | Must be served for extension-less routes (§2) |
| `assets/index-<hash>.js`      | The application bundle                              | ~1.19 MB, ~341 kB gzip                        |
| `assets/JsonEditor-<hash>.js` | CodeMirror, loaded only when an editor screen opens | ~420 kB                                       |
| `assets/index-<hash>.css`     | Compiled Tailwind plus design tokens                | ~63 kB, ~15 kB gzip                           |
| `assets/*.woff2`, `*.woff`    | Self-hosted Inter, JetBrains Mono, Instrument Serif | No runtime font requests                      |
| `favicon.svg`                 | Icon                                                | —                                             |

Every filename is content-hashed except `index.html`, which is why the cache rules in §4 matter.

## 2. The one requirement hosts get wrong: fallback vs 404

The app uses browser history routing, so a deep link such as `/prompts/abc` is not a file on the
server. The host must:

1. **Serve `index.html` for extension-less routes** (the SPA fallback), so `/library`,
   `/prompts/abc/history`, and `/diff` all boot the app.
2. **Return a real 404 for missing files under `/assets/`.** A blanket "everything falls back to
   `index.html`" rule turns a stale asset reference into a `200 text/html` response that the
   browser refuses to execute, and the user sees a blank page with a MIME-type error instead of a
   clean failure.

The local preview server (`vite preview`) demonstrates the wrong-ish behaviour: it answers
`/assets/nope.js` with `200 text/html`. That is fine locally and is recorded as a deployment
caveat in [LIMITATIONS.md](./LIMITATIONS.md) §4 — do not copy it to production.

Equivalent rules, by host capability:

```
# nginx
location /assets/ { try_files $uri =404; }
location /       { try_files $uri $uri/ /index.html; }

# Netlify  (_redirects)
/assets/*  /assets/:splat  404
/*         /index.html     200

# Apache (.htaccess)
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/assets/ [NC]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ - [R=404,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

## 3. Base path (subdirectory hosting)

**Not supported as configured.** The build emits absolute `/assets/...` URLs and the router is
created without a `basename`, so the app must be served from the domain root.

Serving under a subdirectory (e.g. `https://example.com/studio/`) would require two changes and a
re-verification:

1. `base: '/studio/'` in `vite.config.ts`, so asset URLs are emitted with the prefix.
2. `createBrowserRouter(routes, { basename: '/studio' })` in `src/app/router.tsx`, so links and
   deep links resolve under the prefix.

Both are small, but neither is exercised by the test suite today, so this document does not claim
they work — it names what would have to change and that it would need verification afterwards.

## 4. Caching and headers

Content-hashed files can be cached forever; `index.html` must not be.

```
/assets/*        Cache-Control: public, max-age=31536000, immutable
/index.html      Cache-Control: no-cache
/*.svg           Cache-Control: public, max-age=86400
```

Compression matters more than usual here: the main bundle drops from 1.19 MB to about 341 kB with
gzip (or brotli, if the host offers it). Serve:

```
Content-Type: text/html; charset=utf-8      for index.html
Content-Type: application/javascript       for /assets/*.js
Content-Type: text/css                     for /assets/*.css
Content-Type: font/woff2                   for /assets/*.woff2
```

Suggested additions (not verified in any browser during this delivery, so stated as
recommendations rather than tested facts):

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'
```

`script-src` needs `'unsafe-inline'` because of the inline theme-boot script that prevents a flash
of the wrong theme; `style-src` needs it because Radix and CodeMirror set inline styles. No
external origin is required for anything — if your policy allows a third-party origin, the app
does not need it.

## 5. Post-deploy check

Run these against the deployed URL. They are the same checks that were run locally in
[VERIFICATION.md](./VERIFICATION.md) §5, and they catch the two most common mistakes (missing
fallback, wrong asset path) immediately.

```bash
BASE=https://your-host.example
for path in / /library /composer /templates /validation /health /settings /diff \
            /prompts/example /prompts/example/history /prompts/example/playground \
            /prompts/example/lab /prompts/example/compose /design /no-such-route; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")" "$path"
done
# expect 200 for every line

# assets referenced by the served HTML must resolve with a JS/CSS content type
curl -s "$BASE/" | grep -oE '/assets/[^"]+' | while read -r asset; do
  printf '%s %s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$asset")" \
    "$(curl -s -o /dev/null -w '%{content_type}' "$BASE$asset")" "$asset"
done

# a missing asset must 404, not return HTML
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/assets/does-not-exist.js"   # expect 404
```

Then open the site once and check three things by hand, because no automated test in this
repository can: the theme is correct on first paint (no white flash in dark mode), `/design`
renders the gallery, and creating a prompt survives a reload. If IndexedDB is blocked (private
windows, strict settings), the app must show the ephemeral banner instead of failing — that is the
one behaviour worth confirming on the target browser.

## 6. Data, privacy, and what a deployment implies

- The host serves static files only. It never receives prompt content: there is no analytics, no
  telemetry, no error reporting endpoint, and no runtime request of any kind.
- Visitors' libraries live in their own browser. **Clearing site data deletes them**; export is
  the only backup, and it is the visitor's responsibility (the Settings screen says so).
- If you deploy a new build, users keep their IndexedDB data across deployments. Schema changes
  are handled by the migrations in `src/data/db/migrations.ts`; a database written by a _newer_
  build than the one being served is reported as a migration error rather than being corrupted.

## 7. Not included (and deliberately so)

- No CI provider configuration. The gate is a list of commands (see the README's command table or
  [TESTING.md](./TESTING.md) §1); wiring it to a runner is a one-file job for whoever owns the
  pipeline.
- No container image, no infrastructure-as-code, no hosting provider chosen for you.
- No service worker, so no offline-after-cold-cache behaviour and no install prompt.
- No base-path deployment, as described in §3.
