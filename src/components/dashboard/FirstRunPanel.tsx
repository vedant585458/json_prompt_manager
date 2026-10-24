import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui';
import { describeDataError } from '@/store/dataStore';

const STEPS = [
  {
    title: 'Start from a template',
    body: 'Two starter documents ship with this build. Opening one is safe: nothing is sent anywhere.',
  },
  {
    title: 'Write your own',
    body: 'The composer walks the structured sections — role, objective, instructions, output — one at a time.',
  },
  {
    title: 'Read it back before you ship it',
    body: 'Validation proves the JSON parses. It says nothing about whether the prompt is any good.',
  },
] as const;

export interface FirstRunPanelProps {
  /**
   * Persists the dismissal. The panel stays put and reports the failure if this
   * rejects, so a preference that was not saved is never shown as saved.
   */
  readonly onDismiss: () => Promise<void>;
}

/**
 * First-run guide (TASK-010).
 *
 * Visible only while `settings.onboardedAt` is null, so once dismissal is
 * written to the settings repository the guide cannot come back on reload. The
 * dismissal is never optimistic: the panel disappears only after storage
 * accepted the change.
 */
export function FirstRunPanel({ onDismiss }: FirstRunPanelProps) {
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const dismiss = async () => {
    setDismissing(true);
    setError(null);

    try {
      await onDismiss();
    } catch (caught) {
      if (!mounted.current) return;
      setError(describeDataError(caught));
      setDismissing(false);
    }
  };

  return (
    <section
      aria-labelledby="first-run-title"
      className="rounded-lg border border-accent/35 bg-surface-1 p-4 sm:p-5"
    >
      <p className="flex items-center gap-1.5 text-accent">
        <Sparkles aria-hidden="true" size={13} strokeWidth={1.75} />
        <span className="metadata-rail text-accent">First run</span>
      </p>

      <h2 id="first-run-title" className="mt-2 font-display text-xl leading-tight text-ink">
        Three things to try before you build your own
      </h2>
      <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-muted">
        This guide shows until you dismiss it. Dismissing is stored with your settings on this
        device, so it will not reappear on reload.
      </p>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex min-w-0 gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill border border-line bg-surface-2 font-mono text-2xs text-ink-secondary"
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-ink">{step.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                {step.body}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
        <Link
          to="/composer"
          className="inline-flex h-9 items-center gap-2 rounded-sm bg-accent-fill px-3.5 text-sm font-medium text-accent-foreground transition-colors duration-[var(--pf-duration-fast)] hover:bg-accent-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Create a prompt
          <ArrowRight aria-hidden="true" size={14} />
        </Link>
        <Link
          to="/templates"
          className="inline-flex h-9 items-center rounded-sm border border-line-control bg-surface-2 px-3.5 text-sm text-ink transition-colors duration-[var(--pf-duration-fast)] hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Browse templates
        </Link>

        <Button
          variant="ghost"
          size="md"
          className="ml-auto"
          loading={dismissing}
          loadingLabel="Saving your preference"
          onClick={() => void dismiss()}
        >
          Dismiss guide
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-2.5 text-xs leading-relaxed text-danger">
          The dismissal could not be saved: {error} The guide will show again next time.
        </p>
      ) : null}
    </section>
  );
}
