import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/** Dashboard route (TASK-008 shell; content arrives in TASK-010). */
export function DashboardRoute() {
  return (
    <RouteScaffold
      title="Dashboard"
      description="The landing screen: what changed, what needs attention, and the fastest way back into your work."
      plannedFor="TASK-010"
      planned={[
        'Library counts and recent activity, read from the local database.',
        'Prompts that need attention: stale, unvalidated, or missing variables.',
        'A first-run walkthrough for an empty workspace.',
      ]}
    />
  );
}
