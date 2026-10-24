import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';

import { ComposerFields } from '@/components/composer/ComposerFields';
import { ComposerIssues } from '@/components/composer/ComposerIssues';
import { ComposerPreview } from '@/components/composer/ComposerPreview';
import { SnippetInsert } from '@/components/composer/SnippetInsert';
import { SaveConflictDialog } from '@/components/editor/SaveConflictDialog';
import { SaveStatus } from '@/components/editor/SaveStatus';
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonCard,
  buttonVariants,
  useToast,
} from '@/components/ui';
import {
  applySnippet,
  composerIssues,
  createComposerDocument,
  describeCompleteness,
  describeJsonFieldKey,
  hasComposerErrors,
  isComposerObject,
  readComposerView,
  type SnippetTargetId,
} from '@/domain/composer';
import { documentToJson, formatDocumentJson, parseJson } from '@/domain/serialization';
import type { Snippet } from '@/domain/types';
import { useComposerDraft } from '@/features/composer/useComposerDraft';
import { useSavePipeline } from '@/features/save/useSavePipeline';
import { cn } from '@/lib/cn';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { usePreferencesStore } from '@/store/preferences';

/**
 * Edit a prompt through the composer (TASK-017).
 *
 * The form and the save pipeline meet in one place: every form edit produces
 * canonical JSON text, and the pipeline owns writing it. A draft with unresolved
 * problems is held back rather than written in a normalized form behind the
 * user's back, and the stored document is adopted whenever the form is clean.
 */
export function ComposerEditRoute() {
  const { promptId } = useParams<{ promptId: string }>();
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const schemas = store((state) => state.schemas);
  const snippets = store((state) => state.snippets);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);
  const readStoredPrompt = store((state) => state.readStoredPrompt);
  const indent = usePreferencesStore((state) => state.indentSize);
  const autosaveEnabled = usePreferencesStore((state) => state.autosaveEnabled);

  const toast = useToast();
  const prompt = promptId ? (prompts.find((candidate) => candidate.id === promptId) ?? null) : null;

  const initial = useMemo(
    () => (prompt ? documentToJson(prompt.content) : createComposerDocument()),
    // The draft is seeded once per prompt; later versions are adopted below when
    // the form has no unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt?.id],
  );

  const composer = useComposerDraft(initial, indent);
  const [invalidJson, setInvalidJson] = useState<ReadonlySet<string>>(() => new Set());

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

  const save = useSavePipeline({
    prompt,
    store,
    indent,
    blockedReason: blocked
      ? 'This draft has problems that would be normalized or dropped on write, so it is not being saved yet.'
      : null,
  });

  const lastPushed = useRef(composer.text);

  // The form owns the document; the pipeline owns writing its text.
  useEffect(() => {
    if (composer.text === lastPushed.current) return;
    lastPushed.current = composer.text;
    save.setText(composer.text);
  }, [composer.text, save]);

  // A stored document that changed elsewhere (another tab, a reload) is adopted
  // only while the form has nothing unsaved, so a draft is never clobbered.
  useEffect(() => {
    if (!prompt || save.dirty) return;

    const stored = documentToJson(prompt.content);
    if (JSON.stringify(stored) === JSON.stringify(composer.raw)) return;

    const text = formatDocumentJson(stored, indent);
    lastPushed.current = text;
    composer.adopt(stored);
    save.setText(text);
    // `composer` and `save` are stable enough for this adoption check; the guard
    // above makes it a no-op in the common case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt?.version, save.dirty]);

  const blocker = useBlocker(save.dirty && Boolean(prompt) && !save.saving);

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

  async function handleReloadStored() {
    const reloaded = await save.reloadStoredVersion();
    if (!reloaded || !prompt) return;

    const stored = await readStoredPrompt(prompt.id);
    if (!stored) return;

    const next = documentToJson(stored.content);
    const text = formatDocumentJson(next, indent);
    lastPushed.current = text;
    composer.adopt(next);
    save.setText(text);
  }

  function handleRestoreRecovery() {
    const recovered = save.recovery?.draft.text;
    save.restoreRecovery();
    if (!recovered) return;

    const parsed = parseJson(recovered);
    if (!parsed.ok || !isComposerObject(parsed.value)) {
      toast.info({
        title: 'The recovered draft is not a prompt document',
        description:
          'It was restored into the draft, but this form cannot represent it. Open the raw editor to work with it.',
      });
      return;
    }

    lastPushed.current = recovered;
    composer.adopt(parsed.value);
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
        title="This prompt could not be read"
        description="The prompt could not be loaded from this browser. Nothing was changed."
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
        <h1 className="font-display text-3xl leading-tight text-ink">Composer</h1>
        <EmptyState
          title="This prompt is not in your library"
          description={
            promptId
              ? `No stored prompt has the id “${promptId}”. It may have been deleted, or the link may point at another browser’s library.`
              : 'No prompt id was given, so there is nothing to compose.'
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
          <li className="min-w-0 truncate text-ink-secondary">{prompt.title}</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink-secondary">
            Composer
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl leading-tight text-ink">Compose “{prompt.title}”</h1>
          <p className="max-w-2xl text-xs leading-relaxed text-ink-secondary">
            Edits here write the same document the JSON editor shows. Fields this form does not
            render are kept exactly as written.
          </p>
        </div>
        <Link
          to={`/prompts/${prompt.id}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          Open the JSON editor
        </Link>
      </header>

      {!save.durable ? (
        <Alert tone="warning" title="Ephemeral mode — saving is disabled">
          <p className="text-xs leading-relaxed">
            Storage did not open in this browser, so this prompt cannot be written anywhere. Your
            edits stay in this form only.
          </p>
        </Alert>
      ) : null}

      {blocked ? (
        <Alert tone="warning" title="Saving is held back">
          <p className="text-xs leading-relaxed">
            {unappliedFields.length > 0
              ? `These fields are not applied because the text is not valid JSON: ${unappliedFields.join(', ')}.`
              : 'The checks below list what has to be fixed first.'}{' '}
            Saving the document now would store a normalized version of it, so nothing is written
            until these are resolved.
          </p>
        </Alert>
      ) : null}

      {save.recovery ? (
        <Alert
          tone="warning"
          title="An unsaved draft from this browser is available"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={handleRestoreRecovery}>
                Restore the draft
              </Button>
              <Button variant="ghost" size="sm" onClick={save.discardRecovery}>
                Discard it
              </Button>
            </div>
          }
        >
          <p className="text-xs leading-relaxed">
            It was written {new Date(save.recovery.draft.savedAt).toLocaleString()} and is not part
            of the stored prompt. {save.recovery.hint}
            {save.recovery.basedOnOlderVersion
              ? ' It was typed over an older version of this prompt, so the stored text has changed since.'
              : ''}
          </p>
        </Alert>
      ) : null}

      {save.remote ? (
        <Alert
          tone="info"
          title="This prompt was saved in another tab"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => void save.reviewConflict()}>
                Review both versions
              </Button>
              <Button variant="ghost" size="sm" onClick={save.dismissRemote}>
                Keep editing
              </Button>
            </div>
          }
        >
          <p className="text-xs leading-relaxed">
            Version {save.remote.version} was written elsewhere at{' '}
            {new Date(save.remote.at).toLocaleTimeString()}. Your draft is untouched; saving it now
            would be a conflict, which you will be asked to resolve.
          </p>
        </Alert>
      ) : null}

      <SaveStatus
        state={save.state}
        lastSavedAt={save.lastSavedAt}
        error={save.error}
        canSave={save.durable && save.dirty && !save.saving && !save.conflict && !blocked}
        autosaveEnabled={autosaveEnabled}
        onSave={() => void save.saveNow('manual')}
        onRetry={() => void save.retry()}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <SnippetInsert
            snippets={snippets}
            onInsert={handleInsertSnippet}
            disabled={!save.durable}
          />

          <ComposerFields
            view={view}
            issues={issues}
            schemas={schemas}
            snippets={snippets}
            onPatch={composer.patch}
            onInvalidJsonChange={handleJsonValidity}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <ComposerPreview
            json={composer.text}
            promptId={prompt.id}
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

      <SaveConflictDialog
        conflict={save.conflict}
        busy={save.saving}
        onReloadStored={() => void handleReloadStored()}
        onKeepDraft={() => void save.keepDraftAsNew()}
        onDismiss={save.dismissConflict}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title="Leave with unsaved changes?"
        description="This draft has not been written to storage yet. It stays recoverable in this browser, but leaving closes the tab's undo history."
        confirmLabel="Leave the composer"
        cancelLabel="Stay"
        tone="destructive"
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
