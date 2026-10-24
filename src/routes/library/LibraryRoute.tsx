import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/** Library route (TASK-008 shell; search and filters arrive in TASK-011/013). */
export function LibraryRoute() {
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
    />
  );
}
