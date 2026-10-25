import { useCallback, useEffect, useState } from 'react';

import {
  addDismissal,
  createDismissal,
  removeDismissal,
  type QualityDismissal,
  type QualityFinding,
} from '@/domain/quality';
import {
  canUseDismissalStorage,
  clearDismissals,
  loadDismissals,
  saveDismissals,
} from '@/features/quality/dismissalStorage';

export type DismissalOutcome =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

export interface QualityDismissalsApi {
  readonly dismissals: readonly QualityDismissal[];
  /** False when this browser will not store a dismissal; the panel says so. */
  readonly available: boolean;
  /** Why the last write failed, if it did. */
  readonly error: string | null;
  dismiss: (finding: QualityFinding, reason: string) => DismissalOutcome;
  restore: (fingerprint: string) => DismissalOutcome;
  restoreAll: () => DismissalOutcome;
}

/**
 * Dismissals for one prompt, read once and written through (TASK-024).
 *
 * The list is re-read when the prompt changes, and the in-memory copy is only
 * updated after a write succeeds — so the screen never shows a dismissal the
 * browser did not keep.
 */
export function useQualityDismissals(promptId: string): QualityDismissalsApi {
  const [state, setState] = useState<{
    dismissals: QualityDismissal[];
    available: boolean;
    error: string | null;
  }>(() => ({
    dismissals: loadDismissals(promptId),
    available: canUseDismissalStorage(),
    error: null,
  }));

  useEffect(() => {
    setState({
      dismissals: loadDismissals(promptId),
      available: canUseDismissalStorage(),
      error: null,
    });
  }, [promptId]);

  /**
   * Refreshes from storage after a write.
   *
   * The array in hand is never trusted: `localStorage` is re-read so the screen
   * shows exactly what was kept, and a refused write leaves the previous state
   * with an error instead of a dismissal the browser does not have.
   */
  const commit = useCallback(
    (ok: boolean, error: string): DismissalOutcome => {
      if (!ok) {
        setState((current) => ({ ...current, error }));
        return { ok: false, error };
      }

      setState((current) => ({
        dismissals: loadDismissals(promptId),
        available: current.available,
        error: null,
      }));
      return { ok: true };
    },
    [promptId],
  );

  const dismiss = useCallback(
    (finding: QualityFinding, reason: string): DismissalOutcome => {
      const created = createDismissal(finding, reason, new Date().toISOString());
      if (!created.ok) return { ok: false, error: created.error };

      const written = saveDismissals(promptId, addDismissal(state.dismissals, created.dismissal));
      return commit(
        written,
        written ? '' : 'This browser refused to store the dismissal, so nothing changed.',
      );
    },
    [commit, promptId, state.dismissals],
  );

  const restore = useCallback(
    (fingerprint: string): DismissalOutcome => {
      const written = saveDismissals(promptId, removeDismissal(state.dismissals, fingerprint));
      return commit(
        written,
        written ? '' : 'This browser refused to update the dismissals, so nothing changed.',
      );
    },
    [commit, promptId, state.dismissals],
  );

  const restoreAll = useCallback((): DismissalOutcome => {
    const written = clearDismissals(promptId);
    return commit(
      written,
      written ? '' : 'This browser refused to update the dismissals, so nothing changed.',
    );
  }, [commit, promptId]);

  return {
    dismissals: state.dismissals,
    available: state.available,
    error: state.error,
    dismiss,
    restore,
    restoreAll,
  };
}
