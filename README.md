# PromptForge

**Advanced JSON Prompt Management Studio** — a local-first workspace for creating, organizing, validating, versioning, comparing, and optimizing structured JSON prompts.

> **Status: TASK-015 complete — the save pipeline, autosave, and recovery.**
> The repository contains the toolchain, the Prompt Observatory token system with dark and light
> themes, the primitive layer, the overlay/feedback layer demonstrated in a design gallery, the typed
> domain model, the persistence layer (repository interfaces, IndexedDB with migrations, an in-memory
> parity adapter, typed storage errors), the application data lifecycle (storage selection with a
> labelled ephemeral fallback, versioned first-run seeding, data/preferences/UI stores, pure selectors,
> a hydrating bootstrap, and an error boundary), the application shell (route table, collapsible rail,
> drawer navigation, breadcrumbs, skip link, route focus/title/scroll behaviour, recovery screens, and a
> working settings screen for theme, density, and autosave), the command system (declarative registry
> that rejects duplicate shortcuts, platform-aware single and two-step bindings, a fuzzy-searchable
> palette at `⌘K` / `Ctrl K`, and a generated shortcut reference), the dashboard, and the **library**:
> URL-synced search across titles, descriptions, tags, and JSON, tag/folder/collection/status/validation
> /date filters, three sorts, pinned section, grid and list views, and per-card selection — plus the
> full prompt lifecycle (create from a template or blank, edit metadata, duplicate, archive with undo,
> delete with a confirmed cascade), folder/collection management with cycle guards, and multi-select
> bulk actions with an honest undo, and the **JSON editor**: a CodeMirror 6 host with formatting,
> minify, find/replace, folding, copy, and undo/redo, a scanner that reports exact syntax locations,
> a read-only tree view, a document inspector, and a draft that is explicitly not a save — and now a
> **save pipeline**: debounced autosave from the saved preferences, `Mod+S`, serialized version-guarded
> writes, a truthful save status, an explicit stale-write conflict dialog, `localStorage` recovery
> drafts that are cleared only after a confirmed write, cross-tab write notices, and a labelled
> ephemeral mode that refuses to save instead of pretending. Every declared route is reachable; screens
> not yet built say so instead of showing mock controls. Each subsequent feature is built in a separate,
> explicitly authorized task tracked in [`tasks.md`](./tasks.md).

---

## Requirements

- **Node.js** `>= 22.12.0` (verified with v22.22.3)
- **npm** `>= 10`

## Getting started

```bash
npm install       # install dependencies from package-lock.json
npm run dev       # start the dev server at http://localhost:5173
```

The dev server binds to `0.0.0.0:5173` and accepts proxied hostnames, so it also works inside
sandbox/preview environments. It does not use a host allowlist.

## Quality gates

| Command                  | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `npm run typecheck`      | TypeScript project check (`tsc --noEmit`, strict mode) |
| `npm run lint`           | ESLint flat config (TypeScript + React hooks)          |
| `npm run format:check`   | Prettier verification                                  |
| `npm run check:contrast` | WCAG contrast gate for design-token pairings           |
| `npm run format`         | Prettier write                                         |
| `npm test`               | Vitest in watch mode                                   |
| `npm run test:run`       | Vitest single run (CI style)                           |
| `npm run test:coverage`  | Domain coverage report + 90% thresholds                |
| `npm run build`          | Type-check, then production build into `dist/`         |
| `npm run preview`        | Serve the production build at http://localhost:4173    |

All of the above must pass before a task can be marked complete in `tasks.md`.

## Technology stack

| Area        | Choice                                                                      |
| ----------- | --------------------------------------------------------------------------- |
| UI          | React 19, TypeScript (strict), Vite                                         |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`                                     |
| State       | Zustand (introduced with the data layer)                                    |
| Routing     | react-router-dom 7 (`createBrowserRouter`, memory router in tests)          |
| Commands    | Custom registry + palette (`src/lib/commands`), Radix dialog, no extra deps |
| Persistence | IndexedDB through repository interfaces (`idb`), in-memory parity adapter   |
| Editor      | CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-json`), lazy chunk |
| Validation  | In-house JSON Schema interpreter, no code generation (TASK-016)             |
| Testing     | Vitest, Testing Library, `jest-dom`, `fake-indexeddb`, jsdom                |
| Quality     | ESLint (flat config), Prettier                                              |

Dependencies for later tasks are already pinned in `package.json` where they define the
architecture; features are still implemented only when their task is authorized.

## Project structure

```
src/
  app/            application root, providers, router (grows in later tasks)
  routes/         route-level screens (shell scaffolds + settings + design gallery)
  components/layout/  shell, rail, drawer, breadcrumbs, top bar, route chrome, shortcut help
  components/command-palette/  palette dialog and the command layer mounted by the shell
  components/dashboard/  dashboard sections, stat strip, rails, and the first-run guide
  components/health/   health cards, distribution bars with tables, attention lists, activity timeline, storage
  components/library/  filter bar, ingredient rail, prompt cards and rows, badges
  components/prompts/  prompt create/edit dialog, action menu, delete confirmation, summary card
  components/editor/   CodeMirror host and theme, toolbar, tree view, error panel, status bar,
                       save status, conflict dialog, inspector
  features/editor/     draft text, parse debounce, in-app leave guard
  features/save/       save pipeline, recovery drafts, shared write queue and broadcaster
  features/playground/ typed inputs, debounced rendering, this tab's remembered values
  features/testCases/  case editor and list, run results, variant comparison, playground bridge
  components/playground/  variable form and rendered preview, shared by the route and the editor
  lib/commands/   registry, shortcut parsing/matching, core commands, React bindings
  components/     ui primitives, layout, and domain components
  features/       feature modules (organization, save pipeline, revisions, diff, lab, blueprint, quality, health, ...)
  domain/         pure TypeScript domain logic and types (no React, no storage)
  data/           repository interfaces, IndexedDB + in-memory adapters, migrations,
                  typed storage errors, write queue, cross-tab announcements
  store/          Zustand stores (data, preferences, interface) and pure selectors
  hooks/          reusable hooks
  lib/            small framework-agnostic utilities
  styles/         tokens and global styles
  test/           test setup and shared fixtures
docs/             architecture, data model, persistence, validation, testing, limits, accessibility
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for layer rules, the design-system contract,
and architectural decisions, and [`docs/DECISIONS.md`](./docs/DECISIONS.md) for the decision log and
the generated contrast table.

Verification has its own record: [`docs/VERIFICATION.md`](./docs/VERIFICATION.md) is the integration pass —
every route, its title and landmarks, every internal link resolved against the router, every palette
command and its target, the global keyboard from six screens, and a full backup that survives deleting
the database and importing into a fresh install — with the two defects it found and fixed, and the
list of what it could not check without a browser.

Testing and limits have their own pages. [`docs/TESTING.md`](./docs/TESTING.md) records how to run
the suite (`npm run test:run`, `npm run test:coverage`), the current inventory and measured coverage
with the per-tree floors that gate it, which test covers each critical workflow, and what the suite
provably cannot check. [`docs/LIMITATIONS.md`](./docs/LIMITATIONS.md) states the gaps plainly —
including why there is no Playwright suite in this repository and what a jsdom test can never prove.

Accessibility has its own page: [`docs/ACCESSIBILITY.md`](./docs/ACCESSIBILITY.md) records the
three gates (an axe-core audit over every route and overlay, a keyboard and semantics suite, and
the token contrast gate with composited disabled states), the findings that were fixed, the full
44-pair contrast table, and — in the same detail — what was **not** verified, because this
environment has no browser or screen reader.

## Dashboard

`/` is the command centre, and every number on it is read from stored records through one pure
selector (`src/store/dashboard.ts`) — nothing is hard-coded and nothing is estimated.

- **Editorial header.** Greeting and long date, one summary sentence generated from the same counts as
  the stat strip, and three ways in: New prompt (`/composer`), From template (`/templates`), Search
  (opens the command palette).
- **Stat strip.** Prompts, favorites, archived, collections, snapshots, and documents that will not
  parse. Each tile links to the view it counts (filtered library or `/validation`), and the parse tile
  changes its wording as well as its colour when the count is above zero.
- **Sections.** Recently edited (5), pinned rail (6 cards), favorites (5), quick-start templates (3),
  needs attention (broken documents first, then prompts idle for 30+ days, capped at 5), and the last
  eight activity events — each with an empty state that says what belongs there.
- **First run.** A three-step guide shown only while `settings.onboardedAt` is null. Dismissing writes
  the timestamp through the settings repository; the guide disappears only after that write succeeds,
  and a failure is reported instead of pretended away.
- **Honesty rules.** "Invalid" means `parseDocument()` refused the stored document, and the copy says
  "will not parse" — valid JSON is never presented as prompt quality. Archived prompts stay out of
  recents, pinned, favorites, attention, and the unreadable count.

## Library

`/library` is the working index of the studio. Everything it shows comes from stored prompts, and the
address bar is the only filter state — reload, back/forward, and in-app links all reproduce the view.

- **Search.** Case-insensitive across title, description, tags, and the stored JSON document. Terms are
  ANDed (`json schema` needs both), fields are ORed, and matches are highlighted in the title,
  description, and the JSON excerpt that explains why a prompt matched. Typing is debounced (250 ms)
  and replaces the current history entry; pressing `/` from anywhere in the library focuses the field.
- **Filters.** Tag multi-select (tags combine with AND), folder subtree, collection, status, document
  health ("parses" / "will not parse"), archived toggle, favorites, prompts with snapshots, and an
  edited-within window. Active filters appear as removable chips with a single "Clear all".
- **Sort and views.** Updated, created, or title; grid of artifact cards or a dense list with the same
  facts. The choice is remembered (`promptforge.library.view`) and a `?view=` link can override it.
- **Pinned.** Pinned prompts render in their own section above the results and are never duplicated in
  the main list; counts count each prompt once.
- **Selection.** Every card and row has a checkbox; Shift-click extends a range, `Select all shown`
  selects exactly the current filter, and the sticky bulk bar reports the count and the scope. See
  [Favorites, pins, archive, and bulk actions](#favorites-pins-archive-and-bulk-actions).
- **Actions.** Each card and row has a `⋯` menu (edit details, duplicate, archive/restore, delete) and
  the header has "New prompt"; both open dialogs rather than navigating to empty screens.
- **Honesty rules.** "Will not parse" is `parseDocument()` refusing the stored document — never a claim
  about prompt quality. Archived prompts stay hidden unless the toggle is on, and the archive toggle
  changes the rail's counts with it. An empty library and an empty _result set_ are different states
  with different explanations and different ways forward.
- **URL contract.** `?q=&folder=&tag=&collection=&status=&validation=&archived=&favorites=&snapshots=&incollection=&edited=&sort=&view=`,
  plus the dashboard's `?filter=` shorthand as a base layer that explicit parameters override.

## Creating and organizing

The library owns the prompt lifecycle. Nothing is optimistic: a dialog closes, a toast appears, and a
card changes only after the store confirms the write.

- **Create.** Title, description, folder, collections, tags, status, and a template/blank choice. The
  document is created from the template (or the schema defaults) and the editor opens on the stored
  prompt, never on a draft.
- **Edit details.** The same fields, minus the template choice. The JSON document is deliberately out
  of reach here — it belongs to the editor (TASK-014).
- **Duplicate.** Copies the document and metadata with fresh IDs and a `(copy)`, `(copy 2)`, … title, so
  editing one never touches the other. The activity log records it.
- **Archive.** Archived prompts leave the working views, the archive scope (`?archived=1` or the rail
  toggle) shows only them with its own empty state, and both the single and bulk toasts offer **Undo**.
- **Delete.** Confirmation names the prompt and lists the snapshots and test cases that disappear with
  it. Deletion is one IndexedDB transaction over prompts, revisions, and test cases — a failure leaves
  every row in place and the dialog open with an error.
- **Folders.** Create, rename, re-parent, and delete. Depth is capped at five levels, duplicate sibling
  names are refused, and the parent picker cannot express a cycle; the domain rule still runs on submit
  and renders its message under the field. Deleting a folder moves its prompts and subfolders to the
  removed folder's parent and says where they went.
- **Collections.** Create, rename, describe, and delete. A collection is membership, not a container:
  deleting one clears the membership and never deletes a prompt.
- **Palette and links.** `prompt.new` and `folder.new` open the same dialogs as `/library?new=prompt`
  and `/library?new=folder`, so a command, a link, and a click share one path.

## Favorites, pins, archive, and bulk actions

Library rows and cards carry a selection checkbox next to their link, and an actions menu with edit,
duplicate, favorite, pin, archive/restore, and delete. Favorites and pins are write-through: the toggle
persists, rolls back visually if storage refuses, and shows up on the dashboard. Pinned prompts collect
in their own section, sorted A→Z.

- **Archive** is a scope, not a delete: `?archived=1` (or the rail toggle) shows only archived prompts,
  with its own empty state and a `Back to the library` link. Archived prompts are excluded from the
  dashboard's recents, favorites, and health counts, and can be restored individually or in bulk.
- **Tags** come from a census of the library. The tag manager renames or removes a tag across every
  prompt in one transaction and states the affected count first; the bulk tag dialog adds or removes
  tags on a selection.
- **Selection** is route state: `Select all shown` selects exactly the current filter, the sticky bar
  states the scope (`All 3 prompts shown`, `2 prompts selected`), and any filter, sort, or scope change
  clears it — a hidden row can never be modified by a later action. Shift-click extends a range.
- **Undo** restores a snapshot of the affected rows (favorite/pinned/archived/tags) without discarding
  later edits; a bulk delete's Undo re-creates the prompts with their revisions and test cases. A failed
  undo says so instead of claiming success.

Every bulk write is one repository transaction (`prompts.updateMany`, `prompts.deleteManyCascade`), so a
selection is never half-changed.

## JSON editor

`/prompts/:promptId` opens the workspace: the prompt's metadata header (with favorite, pin, and
archive), a raw/tree/preview tab strip, the editor, a syntax-error panel, a status bar, and a collapsible
inspector.

- **Raw JSON.** CodeMirror 6 with JSON highlighting, line numbers, fold gutters, bracket matching,
  active-line highlighting, the indent width from settings, and `Mod-F` find/replace. The toolbar also
  has Format, Minify, Undo/Redo, Find, Copy all, and Jump to error, so nothing is keyboard-only.
- **Exact errors.** A small scanner in `src/domain/jsonText.ts` owns the parse, so the reported line and
  column point at the token that is actually wrong — V8's message sometimes only contains a truncated
  snippet. A syntax error never modifies the text; it disables the rewrites that need a parsed value and
  offers to move the caret to the offending line.
- **Tree view.** A read-only, keyboard-operable `role="tree"` of the parsed document with arrow-key
  navigation, expandable nodes, typed summaries, and a copy-path control. Invalid JSON shows guidance
  instead of a partial tree.
- **Saving.** Autosave runs after the delay set in Settings (or `Mod+S` for an immediate write). Writes
  are serialized per prompt and carry the version the draft was based on, so a save that lost a race is
  reported as a conflict — reload the stored version, keep the draft as new content, or view both —
  rather than silently overwriting. "Saved" appears only after the write resolves; a failure keeps the
  draft and offers Retry.
- **Recovery.** A dirty draft is mirrored to `localStorage` with the version it was typed over, and is
  cleared only once storage confirms a write. After a reload the editor offers the draft with a line
  hint. A write announced by another tab raises a notice; it never replaces what you are typing. When
  storage cannot open, the editor says saving is off and keeps the recovery draft anyway.
- **Validation.** The inspector has a Validation tab over the _live draft_: syntax, the PromptForge
  document shape, and — when a schema is attached — JSON Schema conformance, each finding with its path
  and a Find action that moves the caret. A draft is checked without being saved; document warnings
  never block a save. The scope note says plainly that validity is syntax and structure, not prompt
  quality.
- **Snapshots.** "Save snapshot" in the header (or the palette) captures the stored document, title,
  description, tags, and variables together, with an optional label. Autosave never creates one, so
  history stays the record of decisions rather than of keystrokes.
- **Preview.** The third tab renders the _draft_ with its declared variables filled in, using the same
  panel as the standalone playground below; it pauses while the draft is not valid JSON rather than
  showing stale text. CodeMirror is a lazy chunk, so the rest of the app does not pay for it.
- **Test cases.** The header links to this prompt's laboratory, where saved input sets can be run and
  compared; the preview's inputs can be saved as a case from there.

## Version history

`/prompts/:promptId/history` (the **History** link in the editor header, with the snapshot count) lists
this prompt's snapshots newest first and shows the selected one in a read-only, highlighted viewer.

- **What a snapshot holds.** The document, title, description, tags, and variables — the five fields a
  restore replaces. Folder, collections, status, favorite, pin, archive, and the schema reference stay as
  they are, and the dialog says so.
- **Restoring is reversible.** The confirmation lists every field that would change with its before and
  after, and names the safety snapshot that is created first. A restore never deletes or renumbers
  history, so the state it replaced is always one restore away.
- **Pruning is your call.** Past 25 snapshots the screen suggests pruning. The dialog states exactly how
  many will be removed and which numbers before the button is enabled; numbers are never renumbered, so
  gaps are honest. Nothing is pruned automatically.
- **Honest labels.** Each row carries a worded kind: "Snapshot" for a manual capture, "Safety snapshot"
  for an automatic pre-restore capture, "Imported" when an import created it — never colour alone.
- **Palette.** "Save a snapshot of the open prompt" appears only while a prompt screen has registered the
  dialog; "Open the version history" appears only from a prompt workspace.

## Comparing documents

`/diff` compares two JSON documents and explains every change by path. Open it from the editor's
**Compare** link, from a snapshot's **Compare with current**, from the history screen's **Compare
snapshots**, or from the command palette.

- **Any two sides.** Each side can be a stored prompt, one snapshot, or pasted JSON. `?left=` and
  `?right=` hold the choice, so a comparison can be bookmarked or reloaded; `?prompt=<id>` is a shortcut
  for "newest snapshot versus what is stored now".
- **Paths, not just values.** Every change carries an RFC 6901 pointer (`/instructions/2`), a readable
  breadcrumb, both values, and a class: **Structure** for additions, removals, re-orders, and type changes;
  **Text** for a value that kept its type and changed in place.
- **Array-aware.** An insertion is one entry rather than a change to every following element, and a pure
  re-order of a list of values is reported as one change with the positions that moved.
- **Read it your way.** Filter by change type, switch between unified and split rows, show full values
  instead of previews, and move between changes with ↑ / ↓ / Home / End.
- **Copy what you see.** "Copy as JSON" and "Copy as text" write the changes visible under the current
  filter and record that filter in the output. The text form is a readable list, not an applicable patch.
- **Honest scope.** Whitespace and object key order are not differences. The comparison reports what
  changed, not what it means, and it never writes to your prompts or snapshots. Pasted JSON is not stored
  and is not part of the URL, so a reload clears it — the screen says so.

## Variable playground and preview

`/prompts/:promptId/playground` (or the editor's **Preview** tab) renders a prompt with values filled in.
The template language is one thing: `{{name}}` is replaced by that declared variable's value. There are no
expressions, helpers, or loops, and nothing is evaluated as code.

- **Typed fields.** One input per declared variable: text, a number, a switch for booleans, and a JSON
  field with a parsed error message. Required variables are marked, each field offers a reset to its
  declared default, and "Reset all" restores the whole form.
- **Missing is not empty.** A required variable with no value and no default blocks the render, and the
  panel lists exactly what to fill in. An optional variable falls back to its default; with no default its
  placeholder stays visible and is reported. A cleared field counts as unanswered for every type.
- **Nothing is silently dropped.** Undeclared references, unusable placeholders (`{{1 + 1}}`,
  `{{#each}}`), and declared variables the text never uses are all named under the form, and unresolved
  placeholders are marked inline in the output.
- **The output.** A scrollable, focusable monospace block with wrapping text, a character count, and a copy
  button — the same characters the prompt would contain, with no hidden rewriting. Rendering is debounced
  so typing stays responsive, and the count, the errors, and the text always describe the same inputs.
- **Session-only inputs.** Values are kept in this tab's `sessionStorage`, per prompt: a reload keeps them,
  closing the tab drops them, and nothing is written to the prompt, its history, or anywhere else.
- **Honest scope.** It previews text; it does not call a model, and it cannot tell you whether the prompt
  is good. "Save as a test case" hands the inputs to the laboratory, which stores them only when you save
  the case.

## Prompt laboratory with saved test cases

`/prompts/:promptId/lab` renders this prompt with named sets of values and compares the results. It is
the repeatable version of the playground: the values are stored with the prompt instead of living in a tab.

- **Test cases.** Create, rename, duplicate, and delete named cases per prompt (confirmed, because a case
  cannot be recovered), with an optional expected schema for the rendered text. Each row shows how many
  declared variables the case answers and when it last changed. Names are unique per prompt, up to 50
  cases and 120 characters each.
- **Runs.** Pick the stored prompt or one of its snapshots, then run one case or every case. A run checks
  the document's shape, the attached prompt schema, and the case's values _before_ rendering; a blocking
  problem stops the run and the card says "Nothing was rendered" rather than showing partial text.
- **Results.** Each card reports the status, the exact character count, variable coverage, unresolved
  variable names, and problems grouped as Document, Inputs, or Rendering — so "my case is incomplete" is
  never mistaken for "my prompt is broken". Rendered text can be read in place and copied.
- **Comparison.** Two runs, aligned line by line, with additions and removals marked by a symbol as well
  as a colour. Identical variants are reported as identical. Very long texts fall back to a start-and-end
  overview, and the added/removed counts stay exact.
- **Playground hand-off, both ways.** A case can be loaded into this tab's playground inputs, and the
  playground's remembered inputs can seed a new case. Values that cannot be parsed into the declared type
  are reported, not dropped.
- **What it is not.** Local rendering only: no AI model provider is connected, nothing is sent anywhere,
  nothing is scored, and no count is called a token count. The banner saying so is permanent.

## Quality inspector

The **Quality** tab in the prompt workspace (and the `quality.inspect` command) reviews the draft against
fifteen written rules and reports what they find. It is not a score and it never edits your prompt.

- **Rules, not opinions.** Every finding names the rule that produced it and says whether it is
  **deterministic** (a fact: a placeholder with no declaration, a JSON key that is silently discarded, an
  included snippet that no longer exists, a schema reference that points at nothing) or **heuristic** (a rule
  of thumb: no role, no worked example, a field past a length threshold). A rule of thumb can be wrong, and it
  is never presented as a defect.
- **Missing inputs are admitted, not guessed.** A rule that needs the snippet library, the schema list, the
  prompt record, or the raw draft says it was skipped and why, rather than assuming the worst.
- **Each finding explains itself.** The field it names, a clipped excerpt of the evidence, why the rule fired,
  and a suggested fix you can ignore. `Go to the field` puts the editor caret on that key; `Copy finding` copies
  the whole finding as text.
- **Dismiss with a reason.** A dismissal hides one finding for this prompt, in this browser, with a reason
  stored beside it (never in the prompt or its history). It is tied to the exact content it was about, so an
  unrelated edit leaves it alone and an edit to that field brings the finding back — and the stale dismissal is
  reported rather than silently forgotten. Dismissed findings can be restored one at a time or all at once.
- **The thresholds are on the screen.** The oversized-content rule states every length it uses (objective
  800, each instruction 400, context description 1,000, notes 800, whole document 8,000 characters) — as
  guidance, never as a limit.
- **Honest scope.** No model is called, nothing is scored, nothing is rewritten. The full rule reference is in
  `docs/QUALITY-RULES.md`, and the dashboard escalates only the five rules that describe an actual
  inconsistency — an unfinished draft is a draft, not a defect.

## Prompt blueprint

The **Blueprint** tab in the prompt workspace answers "what is this prompt made of, and what is it missing?"
It draws the draft as a dependency graph: the sections the document fills, the variables it declares, the
snippets it includes, the schema attached to it, and where it came from.

- **Derived, never stored.** The picture is rebuilt from the draft on every render — sections, variables,
  snippets, schema, and template origin. It cannot go stale and it never edits anything.
- **Three columns.** Inputs (variables, snippets, references) feed the document's structure, which feeds the
  output. Edges show what refers to what, with containment drawn differently from reference.
- **Missing pieces are named, not just coloured.** A placeholder with no declaration, a snippet that no longer
  exists, a snippet writing to a section the blueprint does not know, and a schema id that points at nothing
  are all flagged with an icon, the word "Unresolved", and an explanation of what to fix and a link to where
  to fix it.
- **Details on click.** Every node opens an inspector with its value or details and one "open the source"
  action: a variable goes to the playground, a snippet to the composer where snippets live, a schema to the
  validation studio, and a section to that field in the JSON editor.
- **The list is the real content.** The drawing is decorative to assistive technology; the same nodes are
  always available as a keyboard-operable, per-column list, and narrow screens get that list instead of the
  drawing. A "List view" toggle is available at every width.
- **Zoom without traps.** Fit-to-view plus five zoom steps (70 %–130 %) from buttons, inside a scrollable
  container — no wheel handler and no drag canvas, so the page keeps scrolling on a phone.
- **Honest about small prompts.** Fewer than three meaningful nodes and the tab says the prompt is simple and
  offers to draw it anyway. A truncated blueprint (60 nodes, 120 edges) says how much it left out.

## Guided composer

`/composer` builds a prompt section by section; `/prompts/:id/compose` (or the editor's **Compose** link)
edits an existing one through the same save pipeline as the raw editor.

- **One document, two surfaces.** The form patches the document's JSON, so every field it does not render —
  including unknown keys nested inside a section — is preserved verbatim and named in the preview panel.
  The preview is read-only; the **Open in the JSON editor** link hands off to the raw editor for anything
  the form cannot express.
- **Sections.** Identity (name, role), task (objective, instructions, constraints), context (description,
  references, structured data), variables, output (format, attached schema, example output), examples, and
  metadata (author, tags, notes, snippets used). Repeated rows are reordered with buttons that name the row,
  so the whole form is keyboard operable.
- **Variables.** Name, type, required, default, and description per variable. Invalid identifiers, duplicates,
  and defaults that contradict the declared type are errors attached to the row.
- **Snippets.** Insert a stored snippet into a chosen section: text fields are replaced, list fields gain the
  entries they do not already have, and the document records the snippet id. The Insert button is disabled
  when the value does not fit the section.
- **Honest checks.** A JSON field that does not parse is not applied and holds saving back; duplicate rows are
  never silently deduplicated on write. The panel counts how many sections have content and says plainly that
  this is not a judgement of prompt quality.
- **Safety.** Creating a prompt writes nothing until **Create prompt** succeeds; leaving with an unsubmitted
  draft asks first. Editing autosaves through the TASK-015 pipeline, with conflicts, recovery drafts, and the
  unsaved-changes guard unchanged.

## Template catalog

`/templates` (`G T`, or the dashboard's **From template** button) is where a prompt starts from a written
example instead of an empty document.

- **Nine built-in documents.** Extraction, classification, summarization, code review, structured analysis,
  agent system prompts, content generation, and JSON transformation — each with a role, an objective,
  instructions, constraints, at least one variable, and tags. Using one is free; the catalogue is local data.
- **Preview before creating.** The sheet shows the document's role and objective, its instructions and
  constraints, a variable table (name, type, required, default), the output format, and the JSON size, all
  computed with the same function that builds the prompt.
- **Use creates a copy.** A new prompt with its own identifier and version; editing it never changes the
  template or another prompt. Snippet references are not carried over, and an output schema reference is
  dropped when this browser does not store that schema — both are stated in the preview.
- **Your own templates.** Save any stored prompt as a template (name, description, category), then duplicate,
  rename, re-describe, or delete it. Built-ins are marked in words and are read-only; duplicating one gives
  you a custom copy to edit.
- **Finding one.** Search covers names, descriptions, categories, tags, and variable names; filter by
  category and by built-in/custom; the result count is announced. Empty states exist for an empty catalogue,
  no custom templates, and no matches.
- **Filters are not stored.** They describe the visit. The open preview is in the URL (`?template=<id>`), so
  the dashboard can deep-link into it and Back closes the panel.

## Health dashboard

`/health` is the library's maintenance view, reachable from the rail, the palette (`G H`), and the dashboard.
Every number is recomputed from the records in this browser at the instant printed in the header; there is no
polling and no cached figure.

- **What needs attention, exactly.** Documents that will not parse, prompts that fail their attached schema,
  undeclared placeholders, unused declarations, and prompts without a description — each list is a set of links
  to those prompts, not a report about anonymous totals. Archived prompts are counted in the totals and kept out
  of the work lists.
- **One definition of broken.** The health report and the dashboard's attention list call the same parser and
  the same unreadable-document scan, so their counts cannot drift apart.
- **Distribution you can read without a chart.** Prompts per collection and per folder are bars over real
  counts, each row linking into that filtered library view, followed by a table with the same numbers,
  row/column headers, and the share of the largest group.
- **Stale is a setting, not a mystery.** Untouched prompts are grouped at 30 / 60 / 90 days by default; the
  thresholds live in Settings and the screen prints the values it used. The buckets are cumulative, and they say
  so. Oldest first, each prompt linked.
- **An activity timeline from real mutations.** Every event is one the app actually wrote, grouped by day
  (UTC), with an icon, a type label, and a link to the prompt when one is still attached. The type filter narrows
  the log, "Load older" extends the same ordering page by page, and the log's cap — the 500 most recent events —
  is stated on the screen.
- **Definitions and timestamps are part of the report.** A block explains what "will not parse", "untouched",
  and each other term means, and prints the oldest edit, newest edit, newest revision, and newest activity it
  measured.
- **Storage is what the browser says.** `navigator.storage.estimate` is optional; the card shows the figure
  with its caveat (it covers the whole origin) or says plainly that this browser does not report it. Nothing is
  estimated or invented.
- **Honest empty states.** An empty library says there is nothing to report; an empty log says nothing has been
  recorded and offers the two real ways to start.

## Validation studio

`/validation` (also `G V`, or the editor's _Open the studio_ link) is where schemas are managed and
prompts are checked side by side.

- **Schemas are reusable and local.** Create, rename, edit, and delete a schema in the studio; attach one
  to a prompt from the same screen. Usage counts appear before a deletion, and deleting detaches the
  prompts that use the schema in one write, so nothing is left pointing at a missing record.
- **Per-kind results.** Findings are grouped as syntax errors, schema errors, and document-shape
  warnings, each with a count and a filter. Every row gives its path (`$.variables[0].name`), a
  copy-pointer action, and — where the studio can reach the editor — a jump link.
- **One honest verdict.** A schema that cannot be evaluated is reported as a schema problem, not as an
  invalid prompt. A document too large to check says it was skipped. Unsupported keywords are refused
  when the schema is saved, rather than silently ignored.
- **The limits are published.** [`docs/VALIDATION.md`](./docs/VALIDATION.md) lists the supported keyword
  subset, the formats actually checked, and the size/error caps.

## Design system

- **Dark-first**, with a designed light theme. A tiny inline boot script applies the stored or system
  preference before first paint, so no page flashes the wrong theme.
- **Tokens only.** Every color, spacing, radius, type size, shadow, easing, and stacking value is a
  CSS custom property in `src/styles/tokens.css`; components consume Tailwind utilities generated
  from them. No component contains a color literal.
- **Typography.** Inter Variable for UI, JetBrains Mono for structure and JSON, Instrument Serif for
  editorial display — all self-hosted with metric-adjusted fallbacks. No runtime font requests.
- **Accessible accent.** Chartreuse is the identity color; it is split into `accent` (text/icons,
  light-theme darkening included) and `accent-fill` (surfaces) so both themes meet WCAG AA.
- **Proof, not promises.** `npm run check:contrast` verifies 26 text/UI pairings in both themes and
  fails the build threshold on regression.
- **Reduced motion** is honored through the OS preference and a `data-reduced-motion` hook for the
  future in-app setting.

## Component library

`src/components/ui/` holds framework-level primitives with **no domain knowledge** — the same
components every later screen composes:

- **Actions:** `Button` (primary / secondary / ghost / danger, three sizes, loading), `IconButton`,
  `CopyButton`, `CopyIconButton`
- **Forms:** `Field` (label, hint, error, `aria-describedby`/`aria-invalid` wiring), `Input`,
  `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup`
- **Structure:** `Surface`, `Card`, `Separator`, `Tabs`
- **Feedback:** `Badge`, `StatusPill`, `ProgressBar`, `Spinner`, `Tooltip`, `Kbd`, `Alert`,
  `InlineError`, `EmptyState`, `ErrorState`, `Skeleton`/`SkeletonText`, `AsyncBoundary`
- **Overlays:** `Dialog`, `ConfirmDialog` (destructive variant with optional typed confirmation),
  `Sheet` (right panel that becomes a bottom sheet under 640 px), `DropdownMenu`/`DropdownMenuItem`,
  `ContextMenu`, and `ToastProvider`/`useToast` (queue, undo action, 8 s minimum for errors)

Composite widgets delegate keyboard and screen-reader behavior to Radix UI while keeping bespoke,
token-driven styling. Component tests cover roles, accessible names, keyboard interaction, error
association, and loading announcements.

The **design gallery** (`src/routes/design/DesignGallery.tsx`) renders every primitive in every
state — including live dialog, confirmation, sheet, menu, toast, and state demos — and is the visual
reference for later tasks. It becomes the `/design` route in TASK-008 and
is the temporary application root until then.

## Domain model

`src/domain/` is pure TypeScript with no React, storage, or browser APIs — enforced by
`src/domain/purity.test.ts`. It contains the entity types, the canonical `PromptDocument`
specification, validation that returns structured issues instead of throwing, deterministic entity
factories (injected clock and ID generator), serialization with round-trip preservation of unknown
fields, and the folder/revision/tag invariants. See [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md).

```ts
import { createPrompt, formatDocument, parseDocument } from '@/domain';

const result = parseDocument(pastedText);
if (!result.ok)
  showIssues(result.issues); // path + message + severity
else editor.load(formatDocument(result.value));
```

## Persistence

`src/data/` holds the storage layer behind repository interfaces: eleven repositories over a
`promptforge` IndexedDB database (schema v2, eleven object stores, versioned migrations) plus an
in-memory adapter that passes the same contract suite. Every failure is typed — `StaleWriteError`,
`QuotaExceededError`, `StorageUnavailableError`, `CorruptDataError`, and friends — and prompt writes
are guarded by an `expectedVersion` check, so a stale edit is rejected instead of overwriting newer
content.

```ts
import { createWriteQueue, type Repositories } from '@/data';

const queue = createWriteQueue();
await queue.run(prompt.id, () => repositories.prompts.update(next, { expectedVersion }));
```

Code outside `src/data` imports only `@/data`; ESLint blocks deep adapter imports and any React/UI
import inside the layer. Schema, migrations, and failure semantics are documented in
[`docs/PERSISTENCE.md`](./docs/PERSISTENCE.md).

## First run and storage

On first load the app probes storage with a real write/read/delete, opens (or creates) the
`promptforge` database, seeds a starter library exactly once, and hydrates the stores before any
screen renders. If storage is unavailable the app still starts on an in-memory adapter and says so in
a banner: **changes are kept in memory only and disappear when you reload**.

The seed is versioned (`meta.seedVersion`), resumable, and never overwrites edits: a welcome prompt, a
folder, a collection, nine built-in templates, and default settings — no activity events, because the
timeline belongs to the user. Details: [`docs/PERSISTENCE.md`](./docs/PERSISTENCE.md) §8–9.

## Data and privacy

PromptForge is designed to be **local-first and single-user**. Prompts, revisions, and settings are
stored in the browser's IndexedDB on this device (or in memory in ephemeral mode). The application
does not send prompt content to any server, makes no external runtime requests, and integrates no AI
model provider in its planned v1 scope. Playground values are the one exception to "stored in
IndexedDB": they live in this tab's `sessionStorage` (reload-safe, gone when the tab closes), because a
variable's value is often a customer's text rather than document state.

## Roadmap

The complete, approval-gated plan — 31 tasks with acceptance criteria and validation steps —
lives in [`tasks.md`](./tasks.md). Planning is complete; implementation proceeds one authorized
task at a time.
