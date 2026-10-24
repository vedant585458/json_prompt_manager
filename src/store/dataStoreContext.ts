/**
 * Data store injection (TASK-010).
 *
 * The data store is a module singleton in the running app, but the bootstrap
 * already accepts a store instance so tests can drive it directly. Without a
 * context that injection stopped at the bootstrap: screens kept reading the
 * singleton. This context closes that gap, so a test can render the real shell,
 * the real store, and real repositories together — which is exactly what the
 * dashboard's aggregate tests need.
 *
 * Components call `useDataStoreApi()` and keep using the store as a hook:
 * `const prompts = useDataStoreApi()((state) => state.prompts)`.
 */

import { createContext, useContext } from 'react';

import { useDataStore, type DataStore } from '@/store/dataStore';

export const DataStoreContext = createContext<DataStore | null>(null);

/** The store from the nearest provider, or the application singleton. */
export function useDataStoreApi(): DataStore {
  const injected = useContext(DataStoreContext);
  return injected ?? useDataStore;
}
