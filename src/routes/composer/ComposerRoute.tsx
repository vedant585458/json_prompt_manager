import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router-dom';

import { ComposerFields } from '@/components/composer/ComposerFields';
import { ComposerIssues } from '@/components/composer/ComposerIssues';
import { ComposerPreview } from '@/components/composer/ComposerPreview';
import { SnippetInsert } from '@/components/composer/SnippetInsert';
import {
  Alert,
  Button,
  ConfirmDialog,
  ErrorState,
  SkeletonCard,
  buttonVariants,
  useToast,
} from '@/components/ui';
import {
  COMPOSER_STARTERS,
  applySnippet,
  composerIssues,
  createComposerDocument,
  describeCompleteness,
  describeJsonFieldKey,
  hasComposerErrors,
  readComposerView,
  type SnippetTargetId,
} from '@/domain/composer';
import { parseDocument } from '@/domain/serialization';
import type { JsonObject, Snippet } from '@/domain/types';
import { useComposerDraft } from '@/features/composer/useComposerDraft';
import { cn } from '@/lib/cn';
import { describeDataError } from '@/store/dataStore';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { usePreferencesStore } from '@/store/preferences';

/**
 * Compose a new prompt (TASK-017).
 *
 * The form edits a raw JSON object, so a field this form does not render is
 * never dropped by an edit — the patch starts from the current object. Nothing
 * is written until "Create prompt" succeeds, and leaving with an unsubmitted
 * draft asks first.
 */
export function ComposerRoute() {
  const store = useDataStoreApi();
  const schemas = store((state) => state.schemas);
  const snippets = store((state) => state.snippets);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);
  const addPrompt = store((state) => state.addPrompt);
  const indent = usePreferencesStore((state) => state.indentSize);

  const toast = useToast();
  const navigate = useNavigate();

  const composer = useComposerDraft(useMemo(createComposerDocument, []), indent);
  const [invalidJson, setInvalidJson] = useState<ReadonlySet<string>>(() => new Set());
  const [creating, setCreating] = useState(false);
  const [pendingStarter, setPendingStarter] = useState<string | null>(null);

  const view = useMemo(() => readComposerView(composer.raw), [composer.raw]);
  const issues = useMemo(
    () =>
      composerIssues(view, {
        schemaIds: schemas.map((schema) => schema.id),
        snippetIds: snippets.map((snippet) => snippet.id),
      }),
    [schemas, snippets, view],
  );
  const completeness = useMemo(() => describeCompleteness(view), [view]);
  const unappliedFields = useMemo(
    () => [...invalidJson].map(describeJsonFieldKey).sort(),
    [invalidJson],
  );
  const blocked = hasComposerErrors(issues) || invalidJson.size > 0;

  const blocker = useBlocker(composer.dirty && !creating);

  useEffect(() => {
    if (!composer.dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [composer.dirty]);

  /** `invalid` is the form's language: a field whose text does not parse yet. */
  function handleJsonValidity(key: string, invalid: boolean) {
    setInvalidJson((current) => {
      const next = new Set(current);
      if (invalid) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function handleInsertSnippet(snippet: Snippet, target: SnippetTargetId): string {
    const result = applySnippet(composer.raw, snippet, target);
    if (!result.ok) {
      toast.error({ title: 'The snippet was not inserted', description: result.message });
      return result.message;
    }

    composer.replace(result.raw);
    toast.success({ title: 'Snippet inserted', description: result.message });
    return result.message;
  }

  function startFrom(id: string) {
    const starter = COMPOSER_STARTERS.find((candidate) => candidate.id === id);
    if (!starter) return;

    if (composer.dirty) {
      setPendingStarter(id);
      return;
    }

    composer.replace(starter.create());
  }

  async function createPrompt() {
    if (blocked) {
      toast.error({
        title: 'The prompt was not created',
        description:
          unappliedFields.length > 0
            ? `Fix the fields that are not applied: ${unappliedFields.join(', ')}.`
            : 'Resolve the problems listed under Checks first.',
      });
      return;
    }

    const parsed = parseDocument(composer.raw as JsonObject);
    if (!parsed.ok) {
      toast.error({
        title: 'The prompt was not created',
        description: `${parsed.issues[0]?.path || 'document'}: ${parsed.issues[0]?.message ?? 'the document is not valid'}`,
      });
      return;
    }

    setCreating(true);
    try {
      const created = await addPrompt({ title: parsed.value.name, content: parsed.value });
      composer.markClean();
      const normalized = parsed.issues.find((issue) => issue.severity === 'warning');
      toast.success({
        title: 'Prompt created',
        description: normalized
          ? `${created.title} — saved with a normalization: ${normalized.message}`
          : created.title,
      });
      navigate(`/prompts/${created.id}/compose`, { replace: true });
    } catch (caught) {
      toast.error({
        title: 'The prompt was not created',
        description: describeDataError(caught),
      });
    } finally {
      setCreating(false);
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-6xl" aria-busy="true">
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="The composer could not read this browser’s data"
        description="Nothing was changed. Without storage there is no library to add the prompt to."
        action={
          <Button variant="primary" onClick={() => void hydrate()}>
            Try again
          </Button>
        }
        detail={error ?? undefined}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4">
      <nav aria-label="Composer location" className="text-xs text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/library" className="rounded-xs hover:text-ink hover:underline">
              Library
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink-secondary">
            Composer
          </li>
        </ol>
      </nav>

      <header className="space-y-1">
        <h1 className="font-display text-3xl leading-tight text-ink">Compose a prompt</h1>
        <p className="max-w-2xl text-xs leading-relaxed text-ink-secondary">
          Fill in the sections and the document is assembled for you. Fields this form does not show
          are kept exactly as written, and the JSON preview is the document that will be stored.
        </p>
      </header>

      <section aria-label="Starting point" className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-secondary">Start from</span>
        {COMPOSER_STARTERS.map((starter) => (
          <Button
            key={starter.id}
            variant="secondary"
            size="sm"
            onClick={() => startFrom(starter.id)}
            title={starter.description}
          >
            {starter.label}
          </Button>
        ))}
        {composer.dirty ? (
          <span className="text-2xs text-ink-muted">
            Choosing a starting point replaces this draft.
          </span>
        ) : null}
      </section>

      {blocked ? (
        <Alert tone="warning" title="This draft cannot be stored yet">
          <p className="text-xs leading-relaxed">
            {unappliedFields.length > 0
              ? `These fields are not applied because the text is not valid JSON: ${unappliedFields.join(', ')}.`
              : 'The checks below list what has to be fixed first.'}{' '}
            Nothing is written until then; the draft stays in this form.
          </p>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <SnippetInsert snippets={snippets} onInsert={handleInsertSnippet} disabled={creating} />

          <ComposerFields
            view={view}
            issues={issues}
            schemas={schemas}
            snippets={snippets}
            onPatch={composer.patch}
            onInvalidJsonChange={handleJsonValidity}
            disabled={creating}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <ComposerPreview
            json={composer.text}
            promptId={null}
            preserved={view.extras}
            largeDocument={composer.text.length > 200_000}
          />

          <ComposerIssues
            issues={issues}
            completeness={completeness}
            unappliedFields={unappliedFields}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p role="status" className="text-xs text-ink-muted">
          {blocked
            ? 'Not stored — resolve the problems above to create the prompt.'
            : 'Not stored yet. Creating the prompt writes it to this browser.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/library" className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}>
            Cancel
          </Link>
          <Button variant="primary" loading={creating} onClick={() => void createPrompt()}>
            Create prompt
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title="Leave the composer?"
        description="This draft has not been stored, so it will not appear in the library. Leaving discards it."
        confirmLabel="Discard the draft"
        cancelLabel="Keep composing"
        tone="destructive"
        onConfirm={() => blocker.proceed?.()}
      />

      <ConfirmDialog
        open={pendingStarter !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStarter(null);
        }}
        title="Replace this draft?"
        description="Choosing a starting point replaces everything typed so far. This cannot be undone."
        confirmLabel="Replace the draft"
        cancelLabel="Keep it"
        tone="destructive"
        onConfirm={() => {
          const starter = COMPOSER_STARTERS.find((candidate) => candidate.id === pendingStarter);
          if (starter) composer.replace(starter.create());
          setPendingStarter(null);
        }}
      />
    </div>
  );
}
