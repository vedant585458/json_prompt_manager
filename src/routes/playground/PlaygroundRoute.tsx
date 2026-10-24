import { ArrowLeft, FlaskConical } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';
import { Button, EmptyState, ErrorState, SkeletonText, buttonVariants } from '@/components/ui';
import { parseDocument } from '@/domain/serialization';
import { cn } from '@/lib/cn';
import { useDataStoreApi } from '@/store/dataStoreContext';

/**
 * Prompt playground (TASK-021).
 *
 * Fill in the document's declared variables and read the exact text it renders.
 * The screen is read-only with respect to the library: inputs live in this tab's
 * session storage, no prompt field is written, and nothing is sent anywhere —
 * this is a preview, not an execution.
 *
 * The document comes from storage. The editor's Preview tab runs the same panel
 * over the draft, which is the difference between "what is saved" and "what I am
 * about to save".
 */
export function PlaygroundRoute() {
  const { promptId } = useParams<{ promptId: string }>();
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);

  const prompt = promptId ? (prompts.find((candidate) => candidate.id === promptId) ?? null) : null;

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-6xl" aria-busy="true">
        <SkeletonText lines={4} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="The playground could not be opened"
        description="This prompt could not be read from this browser. Nothing was changed."
        action={
          <Button variant="primary" onClick={() => void hydrate()}>
            Try again
          </Button>
        }
        detail={error ?? undefined}
      />
    );
  }

  if (!prompt) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <header>
          <p className="metadata-rail">Playground</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Variable playground</h1>
        </header>
        <EmptyState
          title="This prompt is not in your library"
          description={
            promptId
              ? `No stored prompt has the id “${promptId}”. It may have been deleted, so there is nothing to render.`
              : 'No prompt id was given, so there is nothing to show.'
          }
          action={
            <Link to="/library" className={cn(buttonVariants({ variant: 'primary' }))}>
              Go to the library
            </Link>
          }
        />
      </div>
    );
  }

  // The stored document is normalized on the way in, but a document written by
  // an older version or a hand-edited database row could still fail to parse;
  // the screen says so instead of rendering a partial document.
  const parsed = parseDocument(prompt.content);
  const document = parsed.ok ? parsed.value : null;
  const blocking = parsed.issues.filter((issue) => issue.severity === 'error').slice(0, 4);

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4">
      <nav
        aria-label="Prompt location"
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/library" className="rounded-xs hover:text-ink hover:underline">
              Library
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="min-w-0 truncate">
            <Link
              to={`/prompts/${prompt.id}`}
              className="rounded-xs hover:text-ink hover:underline"
            >
              {prompt.title}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink-secondary">
            Playground
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/prompts/${prompt.id}/history`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            History
          </Link>
          <Link
            to={`/prompts/${prompt.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <ArrowLeft aria-hidden="true" size={12} />
            Back to the editor
          </Link>
        </div>
      </nav>

      <header className="flex flex-col gap-2">
        <p className="metadata-rail">Variable playground</p>
        <h1 className="font-display text-3xl leading-tight text-ink">Playground</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink-secondary">
          Fill in the values this prompt expects and read the text it produces. The document, its
          history, and its saved state are untouched.
        </p>
      </header>

      {document ? (
        <PlaygroundPanel promptId={prompt.id} document={document} />
      ) : (
        <div className="rounded-md border border-danger/35 bg-danger-soft p-3">
          <h2 className="text-sm font-semibold text-danger">The stored document cannot be read</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Nothing is rendered because the document does not pass its own shape checks. Open the
            editor to see every problem.
          </p>
          {blocking.length > 0 ? (
            <ul className="mt-2 space-y-1 text-2xs leading-relaxed text-ink-secondary">
              {blocking.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <span className="font-mono text-ink">{issue.path}</span>: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            to={`/prompts/${prompt.id}`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3')}
          >
            Open the editor
          </Link>
        </div>
      )}

      <section
        aria-labelledby="playground-scope"
        className="rounded-md border border-line bg-surface-1 p-3"
      >
        <h2
          id="playground-scope"
          className="flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          <FlaskConical aria-hidden="true" size={12} />
          What this does — and does not do
        </h2>
        <ul className="mt-1.5 space-y-1 text-2xs leading-relaxed text-ink-secondary">
          <li>
            Substitution is literal: <span className="font-mono">{'{{name}}'}</span> becomes that
            variable&apos;s value. There are no expressions, helpers, or loops, and nothing is
            evaluated as code.
          </li>
          <li>
            A required variable without a value stops the render rather than producing a prompt with
            a hole in it. Optional variables without a value keep their placeholder visible.
          </li>
          <li>
            Inputs are kept in this tab only. They are not saved with the prompt, not added to its
            history, and never sent anywhere.
          </li>
          <li>
            This previews text. It does not call a model, and it cannot tell you whether the prompt
            is good — only what it would say.
          </li>
        </ul>
      </section>
    </div>
  );
}
