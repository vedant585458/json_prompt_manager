import type { ReactNode } from 'react';

import { DataStoreContext } from '@/store/dataStoreContext';
import type { DataStore } from '@/store/dataStore';

export interface DataStoreProviderProps {
  readonly store: DataStore;
  readonly children: ReactNode;
}

/** Makes one data store the store for everything below it. */
export function DataStoreProvider({ store, children }: DataStoreProviderProps) {
  return <DataStoreContext.Provider value={store}>{children}</DataStoreContext.Provider>;
}
