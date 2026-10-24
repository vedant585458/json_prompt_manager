import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/** Health route (TASK-008 shell; the report arrives in TASK-025). */
export function HealthRoute() {
  return (
    <RouteScaffold
      title="Health"
      description="A maintenance view of the library: what is stale, duplicated, orphaned, or broken."
      plannedFor="TASK-025"
      planned={[
        'Findings computed locally from your prompts and references.',
        'Filters by severity and a way to open the affected prompt.',
        'No destructive fix runs without an explicit confirmation.',
      ]}
    />
  );
}
