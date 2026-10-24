import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Copy,
  Info,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  CopyButton,
  CopyIconButton,
  Field,
  IconButton,
  Input,
  Kbd,
  ProgressBar,
  RadioGroup,
  Select,
  Separator,
  ShortcutHint,
  SimpleTabs,
  Spinner,
  StatusPill,
  Surface,
  Switch,
  Textarea,
  Tooltip,
} from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Design gallery (TASK-003).
 *
 * Every primitive is shown in its real states — including invalid, disabled,
 * loading, and empty — so later screens have a reference implementation instead
 * of guesses. The only stateful demos are the ones needed to prove behavior;
 * nothing here pretends to be a product feature.
 *
 * Route note: TASK-003 delivers the screen. The router (TASK-008) mounts it at
 * `/design`; before that it is the application's temporary root view.
 */

function GallerySection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="surface-panel p-5 sm:p-6">
      <p className="metadata-rail">Primitives</p>
      <h2 id={`${id}-title`} className="mt-2 text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Example({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 font-mono text-2xs tracking-wide text-ink-muted uppercase">{label}</p>
      {children}
    </div>
  );
}

export function DesignGallery() {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [notes, setNotes] = useState('{"role": "reviewer"}');
  const [outputFormat, setOutputFormat] = useState('json');
  const [autoSave, setAutoSave] = useState(true);
  const [pinned, setPinned] = useState<'yes' | 'no'>('no');
  const [snapshots, setSnapshots] = useState<string[]>([]);

  function validateName(value: string) {
    setNameError(value.trim().length === 0 ? 'A prompt name is required.' : undefined);
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-sticky border-b border-line bg-canvas/95">
        <div className="content-container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="font-mono text-sm text-accent">
              {'{'}
            </span>
            <span className="font-mono text-xs tracking-wide text-ink-secondary uppercase">
              PromptForge
            </span>
            <span className="hidden text-2xs text-ink-muted sm:inline">design gallery</span>
          </div>
          <div className="flex items-center gap-2">
            <ShortcutHint keys={['⌘', 'K']} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="content-container py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="metadata-rail">TASK-003 · Core UI primitives</p>
          <h1 className="mt-3 font-display text-3xl text-ink">Design system gallery</h1>
          <p className="mt-3 text-md text-ink-secondary">
            The vocabulary every PromptForge surface composes. Each specimen is the real component
            with real states: focus, disabled, loading, invalid, and selected. The gallery itself
            uses no product data.
          </p>
        </div>

        <div className="mt-10 grid gap-5 xl:grid-cols-2">
          <GallerySection
            id="buttons"
            title="Buttons"
            description="Four meanings, three sizes, loading and disabled states. Primary is reserved for the single most important action in a region."
          >
            <div className="space-y-5">
              <Example label="Variants">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary">Create prompt</Button>
                  <Button variant="secondary">Import JSON</Button>
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="danger" leadingIcon={<Trash2 size={14} />}>
                    Delete
                  </Button>
                </div>
              </Example>

              <Example label="Sizes">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary">
                    Small
                  </Button>
                  <Button size="md" variant="secondary">
                    Medium
                  </Button>
                  <Button size="lg" variant="secondary">
                    Large
                  </Button>
                </div>
              </Example>

              <Example label="Icons, loading, disabled">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary" leadingIcon={<Plus size={14} />}>
                    New prompt
                  </Button>
                  <Button variant="secondary" trailingIcon={<Save size={14} />}>
                    Save snapshot
                  </Button>
                  <Button variant="primary" loading loadingLabel="Saving prompt">
                    Saving
                  </Button>
                  <Button variant="secondary" disabled>
                    Disabled
                  </Button>
                  <Button variant="ghost" disabled leadingIcon={<Archive size={14} />}>
                    Archive
                  </Button>
                </div>
              </Example>

              <Example label="Icon buttons (accessible names required)">
                <div className="flex flex-wrap items-center gap-2">
                  <IconButton label="Search prompts" variant="secondary">
                    <Search size={16} />
                  </IconButton>
                  <IconButton label="Prompt settings">
                    <Settings2 size={16} />
                  </IconButton>
                  <IconButton label="Add prompt" variant="accent">
                    <Plus size={16} />
                  </IconButton>
                  <IconButton label="Delete prompt" disabled>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </Example>
            </div>
          </GallerySection>

          <GallerySection
            id="fields"
            title="Fields and text entry"
            description="Labels, hints, and errors are wired by the Field component. Invalid input is annotated, never erased: try submitting the empty name."
          >
            <div className="space-y-5">
              <Example label="Validated field">
                <Field
                  label="Prompt name"
                  hint="Shown in the library and command palette."
                  error={nameError}
                  required
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={name}
                      placeholder="e.g. Structured extraction"
                      onChange={(event) => {
                        setName(event.target.value);
                        if (nameError) validateName(event.target.value);
                      }}
                      onBlur={(event) => validateName(event.target.value)}
                      invalid={Boolean(nameError)}
                      adornment={<Search size={14} />}
                    />
                  )}
                </Field>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => validateName(name)}>
                    Validate name
                  </Button>
                  <span className="text-2xs text-ink-muted">
                    Value is preserved when validation fails.
                  </span>
                </div>
              </Example>

              <div className="grid gap-4 sm:grid-cols-2">
                <Example label="Select">
                  <Field label="Output format" hint="Declared in the prompt document.">
                    {(control) => (
                      <Select
                        {...control}
                        value={outputFormat}
                        onChange={(event) => setOutputFormat(event.target.value)}
                        options={[
                          { value: 'json', label: 'JSON' },
                          { value: 'text', label: 'Plain text' },
                          { value: 'markdown', label: 'Markdown' },
                        ]}
                      />
                    )}
                  </Field>
                </Example>

                <Example label="Disabled and invalid">
                  <div className="space-y-3">
                    <Input placeholder="Disabled input" disabled />
                    <Input defaultValue="invalid@example" invalid aria-label="Invalid example" />
                  </div>
                </Example>
              </div>

              <Example label="Monospace textarea (structured content)">
                <Field label="Document preview" hint="Structured content uses the monospace face.">
                  {(control) => (
                    <Textarea
                      {...control}
                      mono
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  )}
                </Field>
              </Example>
            </div>
          </GallerySection>

          <GallerySection
            id="selection"
            title="Selection controls"
            description="Checkboxes, switches, and radio groups keep native semantics and roving focus; state is announced, not just colored."
          >
            <div className="space-y-5">
              <Example label="Checkbox">
                <div className="space-y-3">
                  <Checkbox
                    name="include-metadata"
                    label="Include metadata in export"
                    hint="Adds tags, folder path, and timestamps."
                    defaultChecked
                  />
                  <Checkbox name="strip-revisions" label="Strip revision history" />
                  <Checkbox
                    name="partial"
                    label="Indeterminate (bulk selection)"
                    checked="indeterminate"
                  />
                  <Checkbox name="disabled-check" label="Disabled option" disabled />
                </div>
              </Example>

              <Separator />

              <Example label="Switch">
                <div className="space-y-4">
                  <Switch
                    name="autosave"
                    label="Autosave changes"
                    hint={autoSave ? 'Saving after 900 ms of inactivity.' : 'Autosave is off.'}
                    checked={autoSave}
                    onCheckedChange={setAutoSave}
                  />
                  <Switch name="disabled-switch" label="Disabled preference" disabled />
                </div>
              </Example>

              <Separator />

              <Example label="Radio group (arrow keys move selection)">
                <RadioGroup
                  name="pin-state"
                  label="Pin this prompt"
                  value={pinned}
                  onValueChange={(value) => setPinned(value as 'yes' | 'no')}
                  options={[
                    {
                      value: 'yes',
                      label: 'Pin to dashboard',
                      hint: 'Always visible in the pinned rail.',
                    },
                    { value: 'no', label: 'Do not pin' },
                  ]}
                />
              </Example>
            </div>
          </GallerySection>

          <GallerySection
            id="status"
            title="Badges, status, and progress"
            description="Semantic color always arrives with an icon and a text label, so status survives grayscale and screen readers."
          >
            <div className="space-y-5">
              <Example label="Badges">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Draft</Badge>
                  <Badge tone="accent">Active</Badge>
                  <Badge tone="success" count={12}>
                    Valid
                  </Badge>
                  <Badge tone="warning">Needs review</Badge>
                  <Badge tone="danger" count={3}>
                    Invalid
                  </Badge>
                  <Badge tone="info">JSON Schema</Badge>
                </div>
              </Example>

              <Example label="Status pills">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="success" icon={<CheckCircle2 size={13} />}>
                    Valid JSON
                  </StatusPill>
                  <StatusPill tone="warning" icon={<AlertTriangle size={13} />}>
                    Schema mismatch
                  </StatusPill>
                  <StatusPill tone="danger" icon={<ShieldAlert size={13} />}>
                    Syntax error at line 4
                  </StatusPill>
                  <StatusPill tone="info" icon={<Info size={13} />}>
                    Local rendering only
                  </StatusPill>
                </div>
              </Example>

              <Separator />

              <Example label="Progress">
                <div className="space-y-4">
                  <ProgressBar
                    label="Revision history loaded"
                    value={7}
                    max={10}
                    caption="Revisions loaded"
                  />
                  <ProgressBar
                    label="Library backup"
                    value={100}
                    tone="success"
                    caption="Backup complete"
                  />
                </div>
              </Example>

              <Example label="Spinner">
                <div className="flex items-center gap-3 text-ink-muted">
                  <Spinner />
                  <Spinner size={20} className="text-accent" />
                  <Spinner size={24} label="Loading prompts" className="text-ink-secondary" />
                  <span className="text-xs">Decorative, labelled, and sized variants.</span>
                </div>
              </Example>
            </div>
          </GallerySection>

          <GallerySection
            id="surfaces"
            title="Surfaces and cards"
            description="States of one plane system: flat grouping, bordered panels, recessed editor areas, and interactive blocks."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Surface variant="panel" padding="md">
                <p className="text-sm font-medium text-ink">Panel</p>
                <p className="mt-1 text-xs text-ink-muted">Border plus quiet elevation.</p>
              </Surface>
              <Surface variant="flat" padding="md" className="border border-line">
                <p className="text-sm font-medium text-ink">Flat</p>
                <p className="mt-1 text-xs text-ink-muted">Grouping inside a panel.</p>
              </Surface>
              <Surface variant="sunken" padding="md">
                <p className="font-mono text-2xs tracking-wide text-ink-muted uppercase">sunken</p>
                <pre className="mt-1 overflow-x-auto font-mono text-xs text-ink-secondary">
                  <code>{'{ "output": { "format": "json" } }'}</code>
                </pre>
              </Surface>
              <Card variant="interactive" padding="md" as="article">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">Interactive card</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Hover changes the border; a real control would wrap it.
                    </p>
                  </div>
                  <Badge tone="accent">v3</Badge>
                </div>
              </Card>
            </div>
          </GallerySection>

          <GallerySection
            id="navigation"
            title="Tabs, tooltips, and keyboard hints"
            description="Tabs are keyboard navigable with arrow keys. Tooltips appear on focus as well as hover and dismiss with Escape."
          >
            <div className="space-y-5">
              <SimpleTabs
                label="Prompt inspector sections"
                items={[
                  {
                    value: 'validation',
                    label: 'Validation',
                    content: (
                      <p>
                        Validation results appear here. The panel keeps its own scroll region and
                        never pushes the editor off screen.
                      </p>
                    ),
                  },
                  {
                    value: 'variables',
                    label: 'Variables',
                    content: (
                      <p>
                        Variables are declared in the document and rendered through{' '}
                        <code className="font-mono text-xs text-ink">{'{{name}}'}</code> tokens.
                      </p>
                    ),
                  },
                  {
                    value: 'history',
                    label: 'History',
                    content: <p>Named snapshots and restore points appear here.</p>,
                  },
                  {
                    value: 'disabled',
                    label: 'Graph',
                    disabled: true,
                    content: <p>Disabled tabs are skipped by keyboard navigation.</p>,
                  },
                ]}
              />

              <Separator />

              <Example label="Tooltips and copy">
                <div className="flex flex-wrap items-center gap-2">
                  <Tooltip content="Copy the JSON path">
                    <IconButton label="Copy path" variant="secondary">
                      <Copy size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Snapshots are immutable; restoring creates a new revision.">
                    <span
                      tabIndex={0}
                      className="rounded-xs border border-line-control px-2 py-1 text-xs text-ink-secondary"
                    >
                      Hover or focus me
                    </span>
                  </Tooltip>
                  <CopyButton value={'{"role":"reviewer"}'} label="Copy document" />
                  <CopyIconButton value="promptforge.theme" label="Copy storage key" />
                </div>
              </Example>

              <Separator />

              <Example label="Keyboard hints">
                <div className="space-y-2 text-sm text-ink-secondary">
                  <p className="flex items-center justify-between gap-4">
                    Open command palette <ShortcutHint keys={['⌘', 'K']} />
                  </p>
                  <p className="flex items-center justify-between gap-4">
                    Validate document <ShortcutHint keys={['⌘', '⇧', 'V']} />
                  </p>
                  <p className="flex items-center justify-between gap-4">
                    Single key <Kbd>?</Kbd>
                  </p>
                </div>
              </Example>
            </div>
          </GallerySection>

          <GallerySection
            id="composition"
            title="Composed specimen"
            description="A small, real interaction assembled from the primitives: add named snapshots, then read the list back. State is real; no product data is involved."
          >
            <Card variant="panel" padding="md" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles aria-hidden="true" size={16} className="text-accent" />
                  <p className="text-sm font-medium text-ink">Snapshots</p>
                  <Badge tone="neutral" count={snapshots.length}>
                    saved
                  </Badge>
                </div>
                <CopyButton
                  value={snapshots.join('\n')}
                  label="Copy list"
                  size="sm"
                  disabled={snapshots.length === 0}
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <Field label="Snapshot label" className="flex-1">
                  {(control) => (
                    <Input
                      {...control}
                      name="snapshot-label"
                      placeholder="e.g. before tightening constraints"
                    />
                  )}
                </Field>
                <Button
                  variant="primary"
                  leadingIcon={<Plus size={14} />}
                  onClick={() =>
                    setSnapshots((current) => [...current, `Snapshot ${current.length + 1}`])
                  }
                >
                  Add snapshot
                </Button>
              </div>

              {snapshots.length === 0 ? (
                <p className="rounded-sm border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">
                  No snapshots yet. Use the button above to add one.
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-sm border border-line">
                  {snapshots.map((snapshot) => (
                    <li
                      key={snapshot}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-ink-secondary"
                    >
                      <span className="truncate">{snapshot}</span>
                      <IconButton
                        label={`Remove ${snapshot}`}
                        size="sm"
                        onClick={() =>
                          setSnapshots((current) => current.filter((item) => item !== snapshot))
                        }
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}

              <Separator />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSnapshots([])}
                  disabled={snapshots.length === 0}
                >
                  Clear all
                </Button>
                <span className={cn('text-2xs text-ink-muted')}>
                  Destructive bulk actions require confirmation in product screens.
                </span>
              </div>
            </Card>
          </GallerySection>
        </div>

        <footer className="mt-10 flex flex-col gap-2 border-t border-line pt-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Gallery only. Overlays, toasts, and empty/error states arrive in TASK-004; product
            screens in TASK-008 onward.
          </p>
          <p className="font-mono text-2xs">
            usage notes · <span className="text-ink-secondary">docs/ARCHITECTURE.md §11</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
