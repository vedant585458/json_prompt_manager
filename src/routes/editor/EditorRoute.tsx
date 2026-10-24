import { AlertTriangle, FileJson, Save } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';

import { EditorInspector } from '@/components/editor/EditorInspector';
import { EditorStatusBar } from '@/components/editor/EditorStatusBar';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { JsonErrorPanel } from '@/components/editor/JsonErrorPanel';
import { TreeView } from '@/components/editor/TreeView';
import { PromptSummaryCard } from '@/components/prompts/PromptSummaryCard';
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  buttonVariants,
  useToast,
} from '@/components/ui';
import type { JsonEditorHandle } from '@/components/editor/JsonEditor';
import type { JsonSyntaxError } from '@/domain/jsonText';
import { formatJsonText, minifyJsonText } from '@/domain/jsonText';
import { formatDocument } from '@/domain/serialization';
import { useDocumentDraft } from '@/features/editor/useDocumentDraft';
import { registerPromptFavoriteToggle } from '@/lib/commands/promptActions';
import { cn } from '@/lib/cn';
import { describeDataError } from '@/store/dataStore';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { usePreferencesStore } from '@/store/preferences';

/**
 * Prompt workspace (TASK-014).
 *
 * Layout: breadcrumb, the prompt's metadata header, a raw/tree tab strip over the
 * CodeMirror host (lazily imported), an error panel, a status bar, and the
 * inspector scaffold.
 *
 * Honesty rules that matter here:
 * - The text is a **draft**. Nothing in this task saves to the database, and the
 *   status bar says so instead of showing a save state.
 * - A syntax error never touches the text; it only disables the rewrites that
 *   would need a parsed value.
 * - Leaving with unsaved edits asks first, and the draft stays recoverable in
 *   this browser either way.
 */

const JsonEditor = lazy(() => import('@/components/editor/JsonEditor'));

const CANONICAL_INDENT = 2;
const EMPTY_CARET = { line: 1, column: 1 };

function EditorFallback() {
  return (
    <div
      className="flex h-[60vh] min-h-80 items-center justify-center rounded-md border border-line bg-surface-1"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <FileJson size={16} />
        Loading the editor…
      </div>
    </div>
  );
}

export function EditorRoute() {
  const { promptId } = useParams<{ promptId: string }>();
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const folders = store((state) => state.folders);
  const collections = store((state) => state.collections);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);
  const toggleFavorite = store((state) => state.toggleFavorite);
  const togglePin = store((state) => state.togglePin);
  const archivePrompt = store((state) => state.archivePrompt);
  const unarchivePrompt = store((state) => state.unarchivePrompt);
  const indentSize = usePreferencesStore((state) => state.indentSize);

  const toast = useToast();
  const now = useMemo(() => new Date(), []);
  const prompt = promptId ? (prompts.find((candidate) => candidate.id === promptId) ?? null) : null;

  const [view, setView] = useState<'raw' | 'tree'>('raw');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [caret, setCaret] = useState(EMPTY_CARET);
  const editorRef = useRef<JsonEditorHandle>(null);

  // The stored document is canonical text with two spaces. The indent preference
  // belongs to the Format action, so changing it never rewrites the base the
  // draft is compared against.
  const savedText = useMemo(
    () => (prompt ? formatDocument(prompt.content, CANONICAL_INDENT) : ''),
    [prompt],
  );

  const draft = useDocumentDraft({
    promptId: prompt?.id ?? '',
    savedText,
    savedUpdatedAt: prompt?.updatedAt ?? '',
  });

  const blocker = useBlocker(draft.dirty && Boolean(prompt));

  const handleCaret = useCallback((position: { line: number; column: number }) => {
    setCaret(position);
  }, []);

  const handleToggleFavorite = useCallback(() => {
    if (!prompt) return;
    void (async () => {
      try {
        const saved = await toggleFavorite(prompt.id);
        toast.success({
          title: saved.favorite ? 'Added to favorites' : 'Removed from favorites',
          description: saved.title,
        });
      } catch (caught) {
        toast.error({
          title: 'The favorite was not changed',
          description: describeDataError(caught),
        });
      }
    })();
  }, [prompt, toggleFavorite, toast]);

  const handleTogglePin = useCallback(() => {
    if (!prompt) return;
    void (async () => {
      try {
        const saved = await togglePin(prompt.id);
        toast.success({ title: saved.pinned ? 'Pinned' : 'Unpinned', description: saved.title });
      } catch (caught) {
        toast.error({ title: 'The pin was not changed', description: describeDataError(caught) });
      }
    })();
  }, [prompt, togglePin, toast]);

  const handleToggleArchive = useCallback(() => {
    if (!prompt) return;
    void (async () => {
      const archiving = !prompt.archived;
      try {
        if (archiving) await archivePrompt(prompt.id);
        else await unarchivePrompt(prompt.id);

        toast.success({
          title: archiving ? 'Prompt archived' : 'Prompt restored',
          description: prompt.title,
          action: {
            label: 'Undo',
            onClick: () => {
              void (async () => {
                try {
                  if (archiving) await unarchivePrompt(prompt.id);
                  else await archivePrompt(prompt.id);
                } catch (caught) {
                  toast.error({
                    title: 'That change could not be undone',
                    description: describeDataError(caught),
                  });
                }
              })();
            },
          },
        });
      } catch (caught) {
        toast.error({
          title: 'The prompt was not updated',
          description: describeDataError(caught),
        });
      }
    })();
  }, [prompt, archivePrompt, unarchivePrompt, toast]);

  // The palette command asks the mounted workspace; nothing is registered when
  // the prompt is missing, so the command cannot act on stale data.
  useEffect(
    () => registerPromptFavoriteToggle(prompt ? handleToggleFavorite : null),
    [prompt, handleToggleFavorite],
  );

  const focusOffset = useCallback((offset: number) => {
    setView('raw');
    // The editor may still be mounting after the tab switch; one frame is enough.
    requestAnimationFrame(() => editorRef.current?.jumpToOffset(offset));
  }, []);

  const applyRewrite = useCallback(
    (kind: 'format' | 'minify') => {
      const result =
        kind === 'format' ? formatJsonText(draft.text, indentSize) : minifyJsonText(draft.text);

      if (!result.ok) {
        toast.error({
          title: 'The document could not be rewritten',
          description: result.error.message,
        });
        return;
      }

      if (result.text === draft.text) {
        toast.info({ title: kind === 'format' ? 'Already formatted' : 'Already minified' });
        return;
      }

      draft.setText(result.text);
      toast.success({ title: kind === 'format' ? 'Formatted' : 'Minified' });
    },
    [draft, indentSize, toast],
  );

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
        <h1 className="font-display text-3xl leading-tight text-ink">Prompt workspace</h1>
        <EmptyState
          title="This prompt is not in your library"
          description={
            promptId
              ? `No stored prompt has the id “${promptId}”. It may have been deleted, or the link may point at another browser’s library.`
              : 'No prompt id was given, so there is nothing to open.'
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

  const syntaxError: JsonSyntaxError | null = draft.parse.error;

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4">
      <nav aria-label="Prompt location" className="text-xs text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/library" className="rounded-xs hover:text-ink hover:underline">
              Library
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="min-w-0 truncate text-ink-secondary">
            {prompt.title}
          </li>
        </ol>
      </nav>

      <PromptSummaryCard
        prompt={prompt}
        folderName={folders.find((folder) => folder.id === prompt.folderId)?.name ?? null}
        collectionNames={collections
          .filter((collection) => prompt.collectionIds.includes(collection.id))
          .map((collection) => collection.name)}
        now={now}
        onToggleFavorite={handleToggleFavorite}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
      />

      {draft.recovery ? (
        <Alert
          tone="warning"
          title="An unsaved draft from this browser is available"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={draft.restoreRecovery}>
                Restore the draft
              </Button>
              <Button variant="ghost" size="sm" onClick={draft.discardRecovery}>
                Discard it
              </Button>
            </div>
          }
        >
          It was written {new Date(draft.recovery.savedAt).toLocaleString()} and is not part of the
          stored prompt.
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-3">
          <Tabs value={view} onValueChange={(value) => setView(value as 'raw' | 'tree')}>
            <TabsList aria-label="Editor view">
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
              <TabsTrigger value="tree">Tree view</TabsTrigger>
            </TabsList>

            <TabsContent value="raw" className="space-y-3">
              <EditorToolbar
                documentText={draft.text}
                canRewrite={syntaxError === null}
                errorLine={syntaxError?.line ?? null}
                onFormat={() => applyRewrite('format')}
                onMinify={() => applyRewrite('minify')}
                onFind={() => editorRef.current?.openSearch()}
                onUndo={() => editorRef.current?.undo()}
                onRedo={() => editorRef.current?.redo()}
                onJumpToError={() => syntaxError && focusOffset(syntaxError.offset)}
                onCopied={() => toast.success({ title: 'Document copied' })}
              />

              <Suspense fallback={<EditorFallback />}>
                <JsonEditor
                  ref={editorRef}
                  value={draft.text}
                  onChange={draft.setText}
                  indent={indentSize}
                  ariaLabel={`JSON document for ${prompt.title}`}
                  onCaretChange={handleCaret}
                  className="h-[60vh] min-h-80"
                />
              </Suspense>

              {syntaxError ? <JsonErrorPanel error={syntaxError} onJump={focusOffset} /> : null}
            </TabsContent>

            <TabsContent value="tree">
              <TreeView value={draft.parse.value} error={syntaxError} />
            </TabsContent>
          </Tabs>

          <EditorStatusBar
            caret={caret}
            stats={draft.stats}
            error={syntaxError}
            checking={draft.parse.checking}
            indent={indentSize}
            largeDocument={draft.largeDocument}
            draftOnly={draft.dirty}
          />
        </div>

        <EditorInspector
          open={inspectorOpen}
          onToggle={() => setInspectorOpen((open) => !open)}
          stats={draft.stats}
          value={draft.parse.value}
          error={syntaxError}
        />
      </div>

      {draft.dirty ? (
        <p className="flex items-center gap-1.5 text-2xs text-warning">
          <AlertTriangle aria-hidden="true" size={12} />
          Draft only — this text is in this tab, not in storage. Copy it or keep the tab open.
        </p>
      ) : null}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title="Leave with unsaved changes?"
        description="Your edits are not saved. They stay recoverable in this browser as a draft, but leaving discards the undo history for this tab."
        confirmLabel="Leave the editor"
        cancelLabel="Stay"
        tone="destructive"
        onConfirm={() => blocker.proceed?.()}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {draft.draftPersisted ? 'Recovery draft written to this browser.' : ''}
      </p>

      <p className="flex items-center gap-1.5 text-2xs text-ink-muted">
        <Save aria-hidden="true" size={12} />
        Saving to the library arrives in TASK-015; nothing here claims to have saved.
      </p>
    </div>
  );
}
