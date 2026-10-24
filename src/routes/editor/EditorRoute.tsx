import { useParams } from 'react-router-dom';

import { RouteScaffold } from '@/routes/shared/RouteScaffold';

/**
 * Prompt workspace route (TASK-008 shell; the editor arrives in TASK-014).
 *
 * The id in the URL is shown as given — the route does not pretend to have
 * loaded a document. The real editor will resolve it against the library and
 * say so when a prompt is missing.
 */
export function EditorRoute() {
  const { promptId } = useParams<{ promptId: string }>();

  return (
    <div className="space-y-6">
      <RouteScaffold
        title="Prompt workspace"
        description="The editing surface for one prompt: JSON editor, inspector, validation, and version history."
        plannedFor="TASK-014"
        planned={[
          'A JSON editor with inline rule results and schema validation.',
          'Debounced autosave with an explicit save state, plus manual versions.',
          'An inspector panel for metadata, variables, and test cases.',
        ]}
      />
      <p className="mx-auto max-w-3xl text-xs text-ink-muted">
        Requested prompt id:{' '}
        <code className="rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 text-ink-secondary">
          {promptId ?? '(none)'}
        </code>
      </p>
    </div>
  );
}
