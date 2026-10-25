/**
 * Storage recovery (TASK-015 follow-up).
 *
 * When IndexedDB cannot be opened, the app runs on the in-memory adapter and
 * says so at the top of every screen. Saving is off in that mode, and the save
 * bar used to offer no way out of it: "Save now" was disabled and a retry had
 * nothing to retry. The bootstrap already knows how to try again (it re-runs
 * the whole boot sequence), so it publishes that action here and the save bar
 * offers it as "Try storage again".
 *
 * The context is `null` outside a bootstrap, which is what route-level tests
 * see: no provider, no reconnect button, no behaviour change.
 */

import { createContext, useContext } from 'react';

export interface StorageRecovery {
  /** True when the bootstrap is in ephemeral mode and can be asked to re-open. */
  readonly canRetry: boolean;
  /** Re-runs the boot sequence: open storage, seed, hydrate. */
  readonly retry: () => void;
}

export const StorageRecoveryContext = createContext<StorageRecovery | null>(null);

/** The nearest bootstrap's recovery action, or `null` when there is none. */
export function useStorageRecovery(): StorageRecovery | null {
  return useContext(StorageRecoveryContext);
}
