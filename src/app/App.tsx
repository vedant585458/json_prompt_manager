import { CircleCheck, Info, ShieldAlert, TriangleAlert } from 'lucide-react';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/cn';

/**
 * Temporary foundation proof for the Prompt Observatory design tokens.
 *
 * TASK-002 requires a fixture that proves the token system in both themes.
 * TASK-003 replaces this with the component gallery. Nothing here is a product
 * feature: the only working interaction is the theme control, and every
 * control specimen is presented as a token swatch rather than a fake UI.
 */

const SURFACES = [
  { token: 'canvas', className: 'bg-canvas', hint: 'App background' },
  { token: 'surface-1', className: 'bg-surface-1', hint: 'Panels' },
  { token: 'surface-2', className: 'bg-surface-2', hint: 'Nested panels' },
  { token: 'surface-3', className: 'bg-surface-3', hint: 'Hover / inputs' },
] as const;

const TYPE_SPECIMENS = [
  { label: 'Display / Instrument Serif', className: 'font-display text-2xl tracking-tight' },
  { label: 'Heading / Inter 600', className: 'text-xl font-semibold' },
  { label: 'Body / Inter 400', className: 'text-base text-ink' },
  { label: 'Secondary / Inter 400', className: 'text-base text-ink-secondary' },
  { label: 'Muted / Inter 400', className: 'text-sm text-ink-muted' },
  { label: 'Code / JetBrains Mono', className: 'font-mono text-sm text-ink-secondary' },
] as const;

const STATES = [
  {
    label: 'Valid',
    detail: 'JSON parsed without errors',
    Icon: CircleCheck,
    className: 'bg-success-soft text-success',
  },
  {
    label: 'Warning',
    detail: 'Schema mismatch, recoverable',
    Icon: TriangleAlert,
    className: 'bg-warning-soft text-warning',
  },
  {
    label: 'Error',
    detail: 'Invalid syntax, not saved',
    Icon: ShieldAlert,
    className: 'bg-danger-soft text-danger',
  },
  {
    label: 'Information',
    detail: 'Local rendering, no provider',
    Icon: Info,
    className: 'bg-info-soft text-info',
  },
] as const;

const SPACING = [
  { token: 'space-1', width: 'w-1' },
  { token: 'space-2', width: 'w-2' },
  { token: 'space-3', width: 'w-3' },
  { token: 'space-4', width: 'w-4' },
  { token: 'space-6', width: 'w-6' },
  { token: 'space-8', width: 'w-8' },
  { token: 'space-12', width: 'w-12' },
  { token: 'space-16', width: 'w-16' },
] as const;

const RADII = ['rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl'] as const;

function sectionId(title: string): string {
  return `section-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;
}

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={sectionId(title)}
      className={cn('surface-panel p-5 sm:p-6', className)}
    >
      <p className="metadata-rail">Tokens</p>
      <h2 id={sectionId(title)} className="mt-2 text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function App() {
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
            <span className="hidden text-2xs text-ink-muted sm:inline">design foundation</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="content-container py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="metadata-rail">TASK-002 · Design tokens and theme system</p>
          <h1 className="mt-3 font-display text-3xl text-ink">The Prompt Observatory</h1>
          <p className="mt-3 max-w-2xl text-md text-ink-secondary">
            A dark-first token system with a designed light theme, self-hosted typography, and a
            single source of truth for color, spacing, motion, and elevation. This page proves the
            tokens; product workspaces arrive in later tasks.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Section
            title="Layered surfaces"
            description="Neutral planes create hierarchy without heavy shadows or gradients."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SURFACES.map((surface) => (
                <div key={surface.token}>
                  <div
                    className={cn(
                      'h-16 rounded-sm border border-line',
                      surface.className,
                      surface.className === 'bg-canvas' && 'border-line-strong',
                    )}
                  />
                  <p className="mt-2 font-mono text-2xs text-ink-secondary">{surface.token}</p>
                  <p className="text-2xs text-ink-muted">{surface.hint}</p>
                </div>
              ))}
            </div>
            <div className="editor-surface mt-4 p-4">
              <pre className="text-ink-secondary">
                <code>{`{
  "role": "senior reviewer",
  "output": { "format": "json" }
}`}</code>
              </pre>
            </div>
          </Section>

          <Section
            title="Type hierarchy"
            description="Editorial display, readable UI type, and monospace precision for structure."
          >
            <ul className="space-y-3">
              {TYPE_SPECIMENS.map((specimen) => (
                <li key={specimen.label}>
                  <p className={specimen.className}>Structured prompts, inspected.</p>
                  <p className="mt-0.5 font-mono text-2xs text-ink-muted">{specimen.label}</p>
                </li>
              ))}
            </ul>
            <p className="tabular mt-4 border-t border-line pt-4 font-mono text-2xs text-ink-muted">
              1,248 prompts · 96 revisions · 12 schemas
            </p>
          </Section>

          <Section
            title="Semantic states"
            description="State color never stands alone; each pairing carries an icon and a label."
          >
            <ul className="space-y-2">
              {STATES.map(({ label, detail, Icon, className }) => (
                <li
                  key={label}
                  className={cn('flex items-start gap-3 rounded-sm px-3 py-2 text-sm', className)}
                >
                  <Icon aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="ml-2 text-ink-secondary">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Accent and focus"
            description="Chartreuse is reserved for primary action, active state, and focus."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { token: 'accent', className: 'bg-accent' },
                { token: 'accent-fill', className: 'bg-accent-fill' },
                { token: 'accent-hover', className: 'bg-accent-hover' },
                { token: 'accent-soft', className: 'bg-accent-soft' },
              ].map((swatch) => (
                <div key={swatch.token}>
                  <div className={cn('h-10 rounded-sm border border-line', swatch.className)} />
                  <p className="mt-1.5 font-mono text-2xs text-ink-muted">{swatch.token}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded-sm bg-accent-fill px-3 py-2 text-sm font-medium text-accent-foreground">
                Primary action
              </span>
              <span className="rounded-sm border border-line-control px-3 py-2 text-sm text-ink">
                Secondary action
              </span>
              <span className="rounded-xs px-2 py-1.5 text-sm text-accent outline-2 outline-offset-2 outline-focus-ring">
                Focus ring
              </span>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Specimens show control tokens; interactive primitives ship in TASK-003. Real controls
              use <code className="text-ink-secondary">:focus-visible</code> with a 2px accent ring
              and 2px offset.
            </p>
          </Section>

          <Section
            title="Spacing and radii"
            description="A 4px spacing base and a restrained radius scale."
          >
            <div className="space-y-2">
              {SPACING.map((item) => (
                <div key={item.token} className="flex items-center gap-3">
                  <span className="w-16 font-mono text-2xs text-ink-muted">{item.token}</span>
                  <span className={cn('h-2 rounded-pill bg-accent-soft', item.width)} />
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {RADII.map((radius) => (
                <span
                  key={radius}
                  className={cn(
                    'grid h-12 w-12 place-items-center border border-line bg-surface-2 font-mono text-2xs text-ink-muted',
                    radius,
                  )}
                >
                  {radius.replace('rounded-', '')}
                </span>
              ))}
            </div>
          </Section>

          <Section
            title="Elevation, motion, and loading"
            description="Borders carry most separation; shadows stay quiet. Motion is short and optional."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-line bg-surface-2 p-3 shadow-sm">
                <p className="font-mono text-2xs text-ink-muted">shadow-sm</p>
                <p className="mt-1 text-sm text-ink-secondary">Resting card</p>
              </div>
              <div className="rounded-md border border-line bg-surface-1 p-3 shadow-panel">
                <p className="font-mono text-2xs text-ink-muted">shadow-panel</p>
                <p className="mt-1 text-sm text-ink-secondary">Floating panel</p>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-line bg-surface-2 p-3 transition-transform duration-[var(--pf-duration-base)] ease-[var(--pf-ease-out)] hover:-translate-y-0.5">
              <p className="font-mono text-2xs text-ink-muted">duration-base · ease-out</p>
              <p className="mt-1 text-sm text-ink-secondary">
                Hover to preview the motion token. Reduced-motion users see no movement.
              </p>
            </div>

            <div className="mt-4 space-y-2" aria-hidden="true">
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
            <p className="mt-2 font-mono text-2xs text-ink-muted">
              skeleton specimen · animation disabled under reduced motion
            </p>
          </Section>
        </div>

        <footer className="mt-10 flex flex-col gap-2 border-t border-line pt-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Foundation preview only. Product screens begin in TASK-008; component gallery in
            TASK-003.
          </p>
          <p className="font-mono text-2xs">
            contrast verified · <span className="text-ink-secondary">npm run check:contrast</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
