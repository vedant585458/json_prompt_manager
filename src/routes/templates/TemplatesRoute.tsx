import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/** Templates route (TASK-008 shell; the gallery arrives in TASK-018). */
export function TemplatesRoute() {
  return (
    <RouteScaffold
      title="Templates"
      description="Reusable starting points for common prompt shapes, kept alongside your own templates."
      plannedFor="TASK-018"
      planned={[
        'The built-in templates that ship with this build, with previews.',
        'Create a prompt from a template, then edit it in the workspace.',
        'Save a prompt you are proud of as a reusable template.',
      ]}
    />
  );
}
