import { Hammer } from 'lucide-react';

import { Card, StatusPill } from '@/components/ui';

export interface RouteScaffoldProps {
  readonly title: string;
  readonly description: string;
  /** The task that will build this surface, e.g. "TASK-010". */
  readonly plannedFor: string;
  /** What the finished screen will do. Plain claims, no promises about dates. */
  readonly planned: readonly string[];
}

/**
 * Placeholder page body (TASK-008).
 *
 * This is intentionally not a mock-up: it states that the surface is not built
 * yet, lists what it will contain, and offers no controls that would appear to
 * work. Every route in this task renders one until its own task replaces it.
 */
export function RouteScaffold({ title, description, plannedFor, planned }: RouteScaffoldProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="metadata-rail">{plannedFor} · not built yet</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">{title}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-secondary">{description}</p>
      </header>

      <Card as="section" aria-labelledby="planned-heading" className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="info" icon={<Hammer size={12} strokeWidth={1.75} />}>
            Scaffold
          </StatusPill>
          <h2 id="planned-heading" className="text-sm font-semibold text-ink">
            What this screen will do
          </h2>
        </div>

        <ul className="space-y-2 text-sm leading-relaxed text-ink-secondary">
          {planned.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span
                aria-hidden="true"
                className="mt-2 size-1 shrink-0 rounded-pill bg-line-strong"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
          Nothing here reads, changes, or sends your prompts. The navigation, theme, and settings
          around it are real.
        </p>
      </Card>
    </div>
  );
}
