import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/** Composer route (TASK-008 shell; the composer arrives in TASK-017). */
export function ComposerRoute() {
  return (
    <RouteScaffold
      title="Composer"
      description="Assemble a structured prompt from typed sections instead of hand-writing one large JSON document."
      plannedFor="TASK-017"
      planned={[
        'Section-by-section authoring with a live JSON preview.',
        'Explicit variables with types, defaults, and required flags.',
        'A save path into the same library and version history as the editor.',
      ]}
    />
  );
}
