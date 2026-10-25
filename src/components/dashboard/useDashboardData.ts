import { useMemo } from 'react';

import { collectQualityAttention } from '@/features/quality/qualityAttention';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { selectDashboardData, type DashboardData } from '@/store/dashboard';

/**
 * Reads the dashboard's data from the live store (TASK-010).
 *
 * The selectors stay pure; this hook is the only place that knows where the
 * records come from. Aggregates are recomputed when stored records change, and
 * only then — a re-render caused by an unrelated store update cannot make the
 * numbers drift.
 */
export function useDashboardData(): DashboardData {
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const collections = store((state) => state.collections);
  const templates = store((state) => state.templates);
  const revisions = store((state) => state.revisions);
  const activity = store((state) => state.activity);
  const schemas = store((state) => state.schemas);
  const snippets = store((state) => state.snippets);

  // Quality findings are derived from the same stored documents the rest of the
  // dashboard reads, and filtered by this browser's dismissals (TASK-024).
  const quality = useMemo(
    () =>
      collectQualityAttention(prompts, {
        snippetIds: snippets.map((snippet) => snippet.id),
        schemaIds: schemas.map((schema) => schema.id),
      }),
    [prompts, schemas, snippets],
  );

  return useMemo(
    () =>
      selectDashboardData({
        prompts,
        collections,
        templates,
        revisions,
        activity,
        schemas,
        quality,
        now: new Date(),
      }),
    [prompts, collections, templates, revisions, activity, schemas, quality],
  );
}
