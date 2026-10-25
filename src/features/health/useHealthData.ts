/**
 * Health dashboard data (TASK-025).
 *
 * The report is recomputed whenever stored records change, and the clock is
 * re-read when the screen is entered. There is no polling and no interval: the
 * numbers describe the records in this browser at the moment shown in the
 * header, and the "Refresh" control re-reads the clock on demand.
 */

import { useCallback, useMemo, useState } from 'react';

import { computeHealth, type HealthReport } from '@/domain/health';
import type { ActivityEvent } from '@/domain/types';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { usePreferencesStore } from '@/store/preferencesStore';

export interface HealthData {
  readonly report: HealthReport;
  /** When the screen last recomputed — the same instant the report used. */
  readonly refreshedAt: Date;
  /** The stored log itself; the timeline pages through these events. */
  readonly activity: readonly ActivityEvent[];
  refresh: () => void;
}

export function useHealthData(): HealthData {
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const collections = store((state) => state.collections);
  const folders = store((state) => state.folders);
  const revisions = store((state) => state.revisions);
  const schemas = store((state) => state.schemas);
  const activity = store((state) => state.activity);
  const thresholds = usePreferencesStore((state) => state.healthThresholds);

  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => setNow(new Date()), []);

  const report = useMemo(
    () =>
      computeHealth({
        prompts,
        collections,
        folders,
        revisions,
        schemas,
        activity,
        thresholds,
        now,
      }),
    [prompts, collections, folders, revisions, schemas, activity, thresholds, now],
  );

  return { report, refreshedAt: now, activity, refresh };
}
