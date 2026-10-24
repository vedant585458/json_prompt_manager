/**
 * Revision history actions (TASK-019).
 *
 * The store owns ordering, numbering, and the safety snapshot; this hook gives a
 * screen the three operations it needs and reports each outcome as a value, so a
 * dialog can stay open and explain a refusal instead of the route guessing at a
 * toast after the fact.
 *
 * `revisions` here is already scoped to one prompt and ordered newest first —
 * the screens never filter or sort history themselves.
 */

import { useCallback, useMemo, useState } from 'react';

import { revisionsForPrompt } from '@/domain/revisions';
import type { PromptRevision } from '@/domain/types';
import { describeDataError } from '@/store/dataStore';
import { useDataStoreApi } from '@/store/dataStoreContext';

export type RevisionOutcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export interface RestoredPrompt {
  readonly promptId: string;
  readonly title: string;
  readonly restoredNumber: number;
  readonly safetyNumber: number;
}

export interface PrunedHistory {
  readonly removed: number;
  readonly kept: number;
}

export interface RevisionHistory {
  /** This prompt's snapshots, newest first. */
  readonly revisions: readonly PromptRevision[];
  readonly count: number;
  readonly busy: boolean;
  readonly snapshot: (label: string | null) => Promise<RevisionOutcome<PromptRevision>>;
  readonly restore: (revisionId: string) => Promise<RevisionOutcome<RestoredPrompt>>;
  readonly prune: (keep: number) => Promise<RevisionOutcome<PrunedHistory>>;
}

export function useRevisionHistory(promptId: string | undefined): RevisionHistory {
  const store = useDataStoreApi();
  const all = store((state) => state.revisions);
  const [busy, setBusy] = useState(false);

  const revisions = useMemo(
    () => (promptId ? revisionsForPrompt(all, promptId) : []),
    [all, promptId],
  );

  const run = useCallback(async <T>(task: () => Promise<T>): Promise<RevisionOutcome<T>> => {
    setBusy(true);
    try {
      return { ok: true, value: await task() };
    } catch (caught) {
      return { ok: false, error: describeDataError(caught) };
    } finally {
      setBusy(false);
    }
  }, []);

  const snapshot = useCallback(
    (label: string | null) =>
      run(() => {
        if (!promptId) throw new Error('There is no prompt to snapshot.');
        return store.getState().snapshotPrompt(promptId, label);
      }),
    [promptId, run, store],
  );

  const restore = useCallback(
    (revisionId: string) =>
      run(async () => {
        const result = await store.getState().restoreRevision(revisionId);
        return {
          promptId: result.prompt.id,
          title: result.prompt.title,
          restoredNumber: result.restoredFrom.revisionNumber,
          safetyNumber: result.safetyRevision.revisionNumber,
        };
      }),
    [run, store],
  );

  const prune = useCallback(
    (keep: number) =>
      run(async () => {
        if (!promptId) throw new Error('There is no prompt whose history could be pruned.');
        const result = await store.getState().pruneRevisions(promptId, keep);
        return { removed: result.removed, kept: result.kept };
      }),
    [promptId, run, store],
  );

  return { revisions, count: revisions.length, busy, snapshot, restore, prune };
}
