import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { bootData, type BootOutcome } from '@/app/dataBoot';
import { DataStoreProvider } from '@/app/providers/DataStoreProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { useDataStore, type DataStore } from '@/store/dataStore';
import { describeDataError } from '@/store/dataStore';

export interface DataBootstrapProps {
  children: ReactNode;
  /** Injected in tests; the application uses the shared store. */
  store?: DataStore;
  /** Injected in tests; defaults to the real boot sequence. */
  boot?: (store: DataStore) => Promise<BootOutcome>;
}

const defaultBoot = (store: DataStore): Promise<BootOutcome> => bootData({ store });

/** Honest, specific loading state — never a blank screen. */
function LoadingLibrary() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6"
    >
      <div role="status" aria-live="polite">
        <p className="font-mono text-2xs tracking-[0.14em] text-ink-muted uppercase">PromptForge</p>
        <h1 className="mt-2 font-display text-2xl leading-tight text-ink">Opening your library</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
          Reading prompts, folders, and activity from this browser. Nothing leaves this device.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonText lines={3} className="max-w-xl" />
    </main>
  );
}

function EphemeralBanner({ notice }: { notice: string }) {
  return (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 sm:px-6">
      <Alert tone="warning" title="Ephemeral mode — changes are not saved" live="polite">
        <p className="text-xs leading-relaxed">{notice}</p>
      </Alert>
    </div>
  );
}

/**
 * Data bootstrap (TASK-007).
 *
 * Renders nothing but a loading state until repositories are attached, the seed
 * has run, and the stores are hydrated — so no screen can render with an empty
 * library that looks like real data. When storage cannot be opened, the app
 * starts anyway and says so, loudly, at the top of every screen.
 */
export function DataBootstrap({
  children,
  store = useDataStore,
  boot = defaultBoot,
}: DataBootstrapProps) {
  const useStore = store;
  const status = useStore((state) => state.status);
  const error = useStore((state) => state.error);
  const retryHydrate = useStore((state) => state.hydrate);

  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setFailure(null);

    void (async () => {
      try {
        const outcome = await boot(store);
        if (cancelled) return;
        setNotice(outcome.notice);
        setPhase('ready');
      } catch (caught) {
        if (cancelled) return;
        setFailure(describeDataError(caught));
        setPhase('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [boot, store, attempt]);

  const retryBoot = useCallback(() => setAttempt((value) => value + 1), []);

  if (phase === 'failed') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center px-4 py-10">
        <ErrorState
          title="PromptForge could not open your library"
          description="Storage did not start, so nothing was read or written. Your existing data, if any, is untouched in this browser. Try again, or reload the page."
          action={
            <Button variant="primary" onClick={retryBoot}>
              Try again
            </Button>
          }
          detail={failure ?? undefined}
        />
      </main>
    );
  }

  if (phase === 'loading' || status === 'idle' || status === 'loading') return <LoadingLibrary />;

  if (status === 'error') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center px-4 py-10">
        <ErrorState
          title="Your library could not be loaded"
          description="The database opened, but reading it failed. Saving is disabled until this succeeds, so nothing is overwritten. Try again, and if it persists, export what you can from a working build."
          action={
            <Button variant="primary" onClick={() => void retryHydrate()}>
              Try again
            </Button>
          }
          detail={error ?? undefined}
        />
      </main>
    );
  }

  return (
    <DataStoreProvider store={store}>
      <div className="flex min-h-dvh flex-col bg-canvas">
        {notice ? <EphemeralBanner notice={notice} /> : null}
        {children}
      </div>
    </DataStoreProvider>
  );
}
