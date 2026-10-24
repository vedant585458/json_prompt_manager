import { useLocation } from 'react-router-dom';

import { LIBRARY_FILTER_LABELS, readLibraryFilter } from '@/lib/libraryLinks';
import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/** Library route (TASK-008 shell; search and filters arrive in TASK-011/013). */
export function LibraryRoute() {
  const { search } = useLocation();
  const filter = readLibraryFilter(search);

  return (
    <RouteScaffold
      title="Library"
      description="Every prompt in one place, browsable by folder, collection, tag, and status."
      plannedFor="TASK-011"
      planned={[
        'Search, filters, and sorting across the whole library.',
        'Create, duplicate, archive, and delete prompts.',
        'Tag and favorite management, including bulk selection.',
      ]}
      note={
        filter === 'all' ? undefined : (
          <>
            You arrived with a request for <strong>{LIBRARY_FILTER_LABELS[filter]}</strong> (
            <code className="font-mono text-2xs">?filter={filter}</code>). The dashboard builds that
            link today; applying it to a result list is what TASK-011 adds.
          </>
        )
      }
    />
  );
}
