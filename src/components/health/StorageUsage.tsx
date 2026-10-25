import { HardDrive } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { describeStorage, formatBytes, type StorageEstimate } from '@/domain/health';
import { cn } from '@/lib/cn';

type StorageState =
  | { readonly status: 'loading' }
  | { readonly status: 'reported'; readonly estimate: StorageEstimate }
  | { readonly status: 'failed'; readonly message: string };

interface StorageLike {
  readonly estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

/**
 * How much of this origin's storage the browser attributes to PromptForge.
 *
 * `navigator.storage.estimate` is optional and can reject (private windows,
 * blocked storage), so every outcome is rendered as itself: a number, "this
 * browser does not report it", or the message the browser gave. Nothing here
 * guesses a size, and nothing invented is shown as a measurement.
 */
export function StorageUsage() {
  const [state, setState] = useState<StorageState>({ status: 'loading' });

  const read = useCallback(async () => {
    setState({ status: 'loading' });

    const storage = (
      typeof navigator === 'undefined'
        ? undefined
        : (navigator as Navigator & { storage?: StorageLike })
    )?.storage;

    if (typeof storage?.estimate !== 'function') {
      setState({
        status: 'reported',
        estimate: {
          available: false,
          reason: 'This browser does not report storage usage, so no estimate is shown.',
        },
      });
      return;
    }

    try {
      const estimate = await storage.estimate();
      setState({
        status: 'reported',
        estimate: {
          available: true,
          usage: Math.max(0, estimate.usage ?? 0),
          quota: Math.max(0, estimate.quota ?? 0),
        },
      });
    } catch (error) {
      setState({
        status: 'failed',
        message:
          error instanceof Error && error.message.length > 0
            ? error.message
            : 'The browser refused the storage estimate request.',
      });
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  return (
    <DashboardSection
      id="health-storage"
      title="Storage"
      description="What the browser reports for this origin. It includes every PromptForge database, not just prompts."
    >
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface-2 text-ink-muted"
        >
          <HardDrive size={13} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="text-xs leading-relaxed text-ink-secondary">
            {state.status === 'loading'
              ? 'Asking the browser for an estimate…'
              : state.status === 'failed'
                ? `The estimate could not be read: ${state.message}`
                : describeStorage(state.estimate)}
          </p>
          {state.status === 'reported' && state.estimate.available ? (
            <p className="mt-1 font-mono text-2xs tabular text-ink-muted">
              {formatBytes(state.estimate.usage)} used · {formatBytes(state.estimate.quota)} quota
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void read()}
          disabled={state.status === 'loading'}
          className={cn(
            'shrink-0 rounded-xs px-1.5 py-0.5 text-2xs font-medium text-accent',
            'hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'disabled:text-ink-muted',
          )}
        >
          Check again
        </button>
      </div>
    </DashboardSection>
  );
}
