import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/** Validation route (TASK-008 shell; the studio arrives in TASK-016). */
export function ValidationRoute() {
  return (
    <RouteScaffold
      title="Validation"
      description="Check a prompt document against the PromptForge rules and any JSON Schema attached to it."
      plannedFor="TASK-016"
      planned={[
        'Rule results with a jump-to-offending-path action.',
        'Schema validation against drafts, without saving the draft first.',
        'A clear statement that valid JSON is syntax, not prompt quality.',
      ]}
    />
  );
}
