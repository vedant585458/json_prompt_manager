import { Camera, Download, FileJson, GitCompare, History } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { EditorInspector } from '@/components/editor/EditorInspector';
import { SaveConflictDialog } from '@/components/editor/SaveConflictDialog';
import { SaveStatus } from '@/components/editor/SaveStatus';
import { EditorStatusBar } from '@/components/editor/EditorStatusBar';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { JsonErrorPanel } from '@/components/editor/JsonErrorPanel';
import { TreeView } from '@/components/editor/TreeView';
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';
import { BlueprintPanel } from '@/features/blueprint/BlueprintPanel';
import { QualityChip } from '@/features/quality/QualityChip';
import { QualityPanel } from '@/features/quality/QualityPanel';
import { useQualityDismissals } from '@/features/quality/useQualityDismissals';
import { PromptSummaryCard } from '@/components/prompts/PromptSummaryCard';
import { SnapshotDialog } from '@/components/revisions/SnapshotDialog';
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
import { parseDocument } from '@/domain/serialization';
import { validateJsonText } from '@/domain/validation';
import { applyDismissals, inspectQuality, type QualityReport } from '@/domain/quality';
import { revisionsForPrompt } from '@/domain/revisions';
import { useSavePipeline } from '@/features/save/useSavePipeline';
import { useTransfer } from '@/features/transfer/useTransfer';
import { findLineForPath, type ValidationIssue } from '@/domain/validation';
import { offsetAtLineColumn } from '@/domain/jsonText';
import { registerPromptFavoriteToggle } from '@/lib/commands/promptActions';
import { registerPromptExport } from '@/lib/commands/transferActions';
import { registerPromptSnapshot } from '@/lib/commands/promptActions';
import { registerPromptValidation } from '@/lib/commands/promptActions';
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
 * - The text is a **draft** until the save pipeline confirms a write. The status
 *   row never says "Saved" before the transaction resolves (TASK-015).
 * - A syntax error never touches the text; it only blocks saving and the rewrites
 *   that would need a parsed value.
 * - Leaving with unsaved edits asks first, and the draft stays recoverable in
 *   this browser either way.
 * - A write from another tab is announced, never applied over a dirty draft.
 */

const JsonEditor = lazy(() => import('@/components/editor/JsonEditor'));

const EMPTY_CARET = { line: 1, column: 1 };

/** The editor's tabs. `?panel=` can select any of them (TASK-023, TASK-024). */
type EditorView = 'raw' | 'tree' | 'preview' | 'blueprint' | 'quality';

const VIEWS: readonly EditorView[] = ['raw', 'tree', 'preview', 'blueprint', 'quality'];

function isEditorView(value: string | null): value is EditorView {
  return value !== null && (VIEWS as readonly string[]).includes(value);
}

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
  const schemas = store((state) => state.schemas);
  const revisions = store((state) => state.revisions);
  const folders = store((state) => state.folders);
  const collections = store((state) => state.collections);
  const snippets = store((state) => state.snippets);
  const templates = store((state) => state.templates);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);
  const toggleFavorite = store((state) => state.toggleFavorite);
  const togglePin = store((state) => state.togglePin);
  const archivePrompt = store((state) => state.archivePrompt);
  const unarchivePrompt = store((state) => state.unarchivePrompt);
  const indentSize = usePreferencesStore((state) => state.indentSize);
  const autosaveEnabled = usePreferencesStore((state) => state.autosaveEnabled);

  const toast = useToast();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const prompt = promptId ? (prompts.find((candidate) => candidate.id === promptId) ?? null) : null;

  const [view, setView] = useState<EditorView>('raw');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [caret, setCaret] = useState(EMPTY_CARET);
  const editorRef = useRef<JsonEditorHandle>(null);

  // The pipeline keeps the draft, so the canonical indent lives there; the indent
  // preference still belongs to the Format action.
  const save = useSavePipeline({ prompt, store });

  const blocker = useBlocker(save.dirty && Boolean(prompt));

  const handleCaret = useCallback((position: { line: number; column: number }) => {
    setCaret(position);
  }, []);

  // The Preview tab renders the *draft*. `save.parse.value` is null while the
  // text is not valid JSON, so the tab can never show a stale document as if it
  // were the current one.
  const draftDocument = useMemo(() => {
    if (save.parse.value === null) return null;
    const parsed = parseDocument(save.parse.value);
    return parsed.ok ? parsed.value : null;
  }, [save.parse.value]);

  const revisionCount = useMemo(
    () => (prompt ? revisionsForPrompt(revisions, prompt.id).length : 0),
    [prompt, revisions],
  );

  // The Quality tab reviews the draft, and its header chip must show the same
  // findings as the tab, so the report and the dismissals are derived here and
  // passed to both (TASK-024).
  const snippetIds = useMemo(() => snippets.map((snippet) => snippet.id), [snippets]);
  const schemaIds = useMemo(() => schemas.map((schema) => schema.id), [schemas]);
  // Only the draft is reviewed: showing findings for the stored prompt while the
  // draft is broken would describe a document the reader is not looking at.
  const qualityDocument = draftDocument;
  const promptDescription = prompt?.description ?? '';

  const qualityReport = useMemo<QualityReport | null>(
    () =>
      qualityDocument === null
        ? null
        : inspectQuality({
            document: qualityDocument,
            record: { description: promptDescription },
            snippetIds,
            schemaIds,
            // The saved document has no raw text of its own, and its keys are
            // unique by construction; only the draft can repeat one.
            rawText: draftDocument === null ? null : save.text,
          }),
    [draftDocument, promptDescription, qualityDocument, save.text, schemaIds, snippetIds],
  );

  const qualityDismissals = useQualityDismissals(prompt?.id ?? '');
  const qualityFindings = useMemo(
    () =>
      qualityReport === null
        ? []
        : applyDismissals(qualityReport.findings, qualityDismissals.dismissals).visible,
    [qualityDismissals.dismissals, qualityReport],
  );

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

  const [searchParams, setSearchParams] = useSearchParams();
  const [recheckToken, setRecheckToken] = useState(0);

  const attachedSchema = prompt?.schemaId
    ? (schemas.find((schema) => schema.id === prompt.schemaId) ?? null)
    : null;

  // A live report over the draft: an edit is described as it is typed, and the
  // attached schema is part of the input because the studio can change it.
  const report = useMemo(() => {
    // `recheckToken` is a manual "run it again" for a report the user distrusts;
    // reading it inside the factory keeps the dependency honest.
    void recheckToken;
    return validateJsonText(
      save.text,
      attachedSchema ? { schema: attachedSchema.schemaContent } : {},
    );
  }, [attachedSchema, recheckToken, save.text]);

  /** Moves the caret to the line holding a validation path, or says it cannot. */
  const focusIssuePath = useCallback(
    (issue: ValidationIssue) => {
      const line = findLineForPath(save.text, issue.path);
      if (line === null) {
        toast.info({
          title: 'That path is not on a line',
          description: `The editor could not locate ${issue.path}; the path can still be copied.`,
        });
        return;
      }

      // The scanner maps a 1-based line to an offset; column 1 is the line start.
      const located = offsetAtLineColumn(save.text, line, 1);
      focusOffset(located);
    },
    [focusOffset, save.text, toast],
  );

  // The validation studio links here with `?line=` after a syntax finding.
  const requestedLine = Number(searchParams.get('line') ?? '');
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    if (!prompt || !Number.isInteger(requestedLine) || requestedLine < 1) return;
    if (save.parse.checking) return;

    const located = offsetAtLineColumn(save.text, requestedLine, 1);
    focusOffset(located);

    const next = new URLSearchParams(searchParams);
    next.delete('line');
    setSearchParams(next, { replace: true });
  }, [
    focusOffset,
    prompt,
    requestedLine,
    save.parse.checking,
    save.text,
    searchParams,
    setSearchParams,
  ]);

  // The Blueprint tab's "jump to field" action (TASK-023): find the section key
  // in the draft text and put the caret on it. The key is searched as JSON, not
  // as free text, so a mention of the word inside a sentence is not a match.
  const openDocumentPath = useCallback(
    (path: string) => {
      // The empty path names the document as a whole (the oversized-document
      // rule), so the caret goes to the top rather than hunting for a key.
      if (path.length === 0) {
        focusOffset(0);
        return;
      }

      const root = path.split(/[.[]/)[0] ?? path;
      const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const index = save.text.search(new RegExp(`"${escaped}"\\s*:`));

      if (index < 0) {
        toast.info({
          title: 'That field is not in the draft',
          description: `“${root}” has no key in this document yet.`,
        });
        return;
      }

      focusOffset(index);
    },
    [focusOffset, save.text, toast],
  );

  // A palette command or a link can ask for a tab; the request is honoured once
  // and removed from the URL so it cannot fight a later tab switch.
  const requestedPanel = searchParams.get('panel');
  useEffect(() => {
    if (!prompt || !isEditorView(requestedPanel)) return;

    setView(requestedPanel);
    const next = new URLSearchParams(searchParams);
    next.delete('panel');
    setSearchParams(next, { replace: true });
  }, [prompt, requestedPanel, searchParams, setSearchParams]);

  // Command palette: "Validate this prompt" opens the studio for this prompt.
  useEffect(
    () =>
      registerPromptValidation(
        prompt
          ? () => {
              navigate(`/validation?prompt=${prompt.id}`);
            }
          : null,
      ),
    [navigate, prompt],
  );

  // Command palette: "Save a snapshot" opens the same dialog as the header.
  useEffect(
    () =>
      registerPromptSnapshot(
        prompt
          ? () => {
              setSnapshotOpen(true);
            }
          : null,
      ),
    [prompt],
  );

  // Command palette and the workspace header share one export action (TASK-026).
  const transfer = useTransfer();
  const exportPromptFile = transfer.exportPromptFile;

  useEffect(
    () =>
      registerPromptExport(
        prompt
          ? () => {
              void exportPromptFile(prompt.id);
            }
          : null,
      ),
    [exportPromptFile, prompt],
  );

  const handleSnapshot = useCallback(
    async (label: string | null) => {
      const result = await save.snapshot(label);
      if (!result.ok) return result;

      toast.success({
        title: `Snapshot v${result.revision.revisionNumber} saved`,
        description: label ?? prompt?.title ?? undefined,
      });
      return { ok: true };
    },
    [prompt, save, toast],
  );

  const applyRewrite = useCallback(
    (kind: 'format' | 'minify') => {
      const result =
        kind === 'format' ? formatJsonText(save.text, indentSize) : minifyJsonText(save.text);

      if (!result.ok) {
        toast.error({
          title: 'The document could not be rewritten',
          description: result.error.message,
        });
        return;
      }

      if (result.text === save.text) {
        toast.info({ title: kind === 'format' ? 'Already formatted' : 'Already minified' });
        return;
      }

      save.setText(result.text);
      toast.success({ title: kind === 'format' ? 'Formatted' : 'Minified' });
    },
    [save, indentSize, toast],
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

  const syntaxError: JsonSyntaxError | null = save.parse.error;

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
          <li aria-current="page" className="min-w-0 truncate text-ink-secondary">
            {prompt.title}
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-1.5">
          {qualityReport ? (
            <QualityChip findings={qualityFindings} onOpen={() => setView('quality')} />
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setSnapshotOpen(true)}>
            <Camera aria-hidden="true" size={12} />
            Save snapshot
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void exportPromptFile(prompt.id)}
            loading={transfer.busy}
            loadingLabel="Preparing"
          >
            <Download aria-hidden="true" size={12} />
            Export
          </Button>
          <Link
            to={`/diff?prompt=${encodeURIComponent(prompt.id)}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5')}
          >
            <GitCompare aria-hidden="true" size={12} />
            Compare
          </Link>
          <Link
            to={`/prompts/${prompt.id}/history`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5')}
          >
            <History aria-hidden="true" size={12} />
            History
            <span className="font-mono text-2xs text-ink-muted">
              {revisionCount === 0 ? 'none' : revisionCount}
            </span>
          </Link>
          <Link
            to={`/prompts/${prompt.id}/compose`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            Compose
          </Link>
        </div>
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

      {!save.durable ? (
        <Alert tone="warning" title="Ephemeral mode — saving is disabled">
          <p className="text-xs leading-relaxed">
            Storage did not open in this browser, so this prompt cannot be written anywhere. Your
            edits are still mirrored to a recovery draft here and survive a reload of this tab.
          </p>
        </Alert>
      ) : null}

      {save.recovery ? (
        <Alert
          tone="warning"
          title="An unsaved draft from this browser is available"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={save.restoreRecovery}>
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-3">
          <SaveStatus
            state={save.state}
            lastSavedAt={save.lastSavedAt}
            error={save.error}
            canSave={save.durable && save.dirty && !save.saving && !save.conflict}
            autosaveEnabled={autosaveEnabled}
            onSave={() => void save.saveNow('manual')}
            onRetry={() => void save.retry()}
          />

          <Tabs
            value={view}
            onValueChange={(value) => setView(isEditorView(value) ? value : 'raw')}
          >
            <TabsList aria-label="Editor view">
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
              <TabsTrigger value="tree">Tree view</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="blueprint">Blueprint</TabsTrigger>
              <TabsTrigger value="quality">Quality</TabsTrigger>
            </TabsList>

            <TabsContent value="raw" className="space-y-3">
              <EditorToolbar
                documentText={save.text}
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
                  value={save.text}
                  onChange={save.setText}
                  indent={indentSize}
                  ariaLabel={`JSON document for ${prompt.title}`}
                  onCaretChange={handleCaret}
                  className="h-[60vh] min-h-80"
                />
              </Suspense>

              {syntaxError ? <JsonErrorPanel error={syntaxError} onJump={focusOffset} /> : null}
            </TabsContent>

            <TabsContent value="tree">
              <TreeView value={save.parse.value} error={syntaxError} />
            </TabsContent>

            <TabsContent value="preview">
              {draftDocument ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-2xs leading-relaxed text-ink-muted">
                      This preview follows the draft, not the saved prompt. Nothing here is written
                      to it.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        to={`/prompts/${prompt.id}/lab?new=1&from=playground`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                      >
                        Save as a test case
                      </Link>
                      <Link
                        to={`/prompts/${prompt.id}/lab`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                      >
                        Laboratory
                      </Link>
                      <Link
                        to={`/prompts/${prompt.id}/playground`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                      >
                        Open the playground
                      </Link>
                    </div>
                  </div>
                  <PlaygroundPanel promptId={prompt.id} document={draftDocument} />
                </div>
              ) : (
                <Alert tone="info" title="There is nothing to preview yet">
                  <p className="text-xs leading-relaxed">
                    {syntaxError
                      ? 'The preview needs valid JSON, and the draft currently has a syntax error. Fix it and this tab fills in.'
                      : 'The draft parses as JSON but does not match the prompt document shape, so no variables can be read from it. The document must be an object with a version, a metadata object, and the expected sections.'}
                  </p>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="blueprint">
              {draftDocument ? (
                <div className="space-y-3">
                  <p className="text-2xs leading-relaxed text-ink-muted">
                    This blueprint follows the draft, not the saved prompt. It is derived on every
                    render and cannot edit anything.
                  </p>
                  <BlueprintPanel
                    document={draftDocument}
                    promptId={prompt.id}
                    attachedSchema={attachedSchema}
                    attachedSchemaId={prompt.schemaId}
                    snippets={snippets}
                    templates={templates}
                    metadata={prompt.metadata}
                    onOpenPath={openDocumentPath}
                  />
                </div>
              ) : (
                <Alert tone="info" title="There is nothing to draw yet">
                  <p className="text-xs leading-relaxed">
                    {syntaxError
                      ? 'The blueprint needs valid JSON, and the draft currently has a syntax error. Fix it and this tab fills in.'
                      : 'The draft parses as JSON but does not match the prompt document shape, so its sections and variables cannot be read.'}
                  </p>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="quality">
              {qualityReport ? (
                <div className="space-y-3">
                  <p className="text-2xs leading-relaxed text-ink-muted">
                    This review follows the draft, not the saved prompt. It is derived from the text
                    on every render and cannot edit anything.
                  </p>
                  <QualityPanel
                    report={qualityReport}
                    promptId={prompt.id}
                    dismissals={qualityDismissals}
                    onOpenPath={openDocumentPath}
                  />
                </div>
              ) : (
                <Alert tone="info" title="There is nothing to review yet">
                  <p className="text-xs leading-relaxed">
                    {syntaxError
                      ? 'The review needs valid JSON, and the draft currently has a syntax error. Fix it and this tab fills in.'
                      : 'The draft parses as JSON but does not match the prompt document shape, so its sections and variables cannot be read.'}
                  </p>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          <EditorStatusBar
            caret={caret}
            stats={save.stats}
            error={syntaxError}
            checking={save.parse.checking}
            indent={indentSize}
            largeDocument={save.largeDocument}
            draftOnly={save.dirty}
          />
        </div>

        <EditorInspector
          open={inspectorOpen}
          onToggle={() => setInspectorOpen((open) => !open)}
          stats={save.stats}
          value={save.parse.value}
          error={syntaxError}
          report={report}
          schemaName={attachedSchema?.name ?? null}
          promptId={prompt.id}
          onRevalidate={() => setRecheckToken((token) => token + 1)}
          onFocusPath={focusIssuePath}
        />
      </div>

      <SaveConflictDialog
        conflict={save.conflict}
        busy={save.saving}
        onReloadStored={() => void save.reloadStoredVersion()}
        onKeepDraft={() => void save.keepDraftAsNew()}
        onDismiss={save.dismissConflict}
      />

      <SnapshotDialog
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        promptTitle={prompt.title}
        dirty={save.dirty}
        onSaveDraft={() => save.saveNow('manual')}
        onSnapshot={handleSnapshot}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title="Leave with unsaved changes?"
        description="This draft has not been written to storage yet. It stays recoverable in this browser, but leaving closes the tab's undo history."
        confirmLabel="Leave the editor"
        cancelLabel="Stay"
        tone="destructive"
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
