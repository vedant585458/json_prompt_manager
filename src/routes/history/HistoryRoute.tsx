import { ArrowLeft, Camera, FileJson, GitCompare, Scissors } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { PruneRevisionsDialog } from '@/components/revisions/PruneRevisionsDialog';
import { RestoreRevisionDialog } from '@/components/revisions/RestoreRevisionDialog';
import { RevisionList } from '@/components/revisions/RevisionList';
import { RevisionViewer } from '@/components/revisions/RevisionViewer';
import { SnapshotDialog } from '@/components/revisions/SnapshotDialog';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SkeletonText,
  badgeVariants,
  buttonVariants,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { documentHash, formatDocument } from '@/domain/serialization';
import {
  REVISION_WARNING_THRESHOLD,
  needsPruneWarning,
  summariseRevision,
} from '@/domain/revisions';
import type { PromptRevision } from '@/domain/types';
import { useRevisionHistory } from '@/features/revisions/useRevisionHistory';
import { registerPromptSnapshot } from '@/lib/commands/promptActions';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { usePreferencesStore } from '@/store/preferences';

/**
 * Version history (TASK-019).
 *
 * One prompt's snapshots, newest first, beside a read-only viewer. The screen is
 * a *reading* surface with three deliberate writes:
 *
 * 1. **Save snapshot** — an explicit capture of the stored prompt.
 * 2. **Restore** — replaces the stored prompt *after* snapshotting what it
 *    replaces; the dialog lists every field it will change.
 * 3. **Prune** — opt-in removal of the oldest snapshots, with counts shown before
 *    the button is usable.
 *
 * Autosave and ordinary edits never appear here: a revision exists only because
 * one of those three actions ran (or an import created one), which the empty
 * state says plainly.
 *
 * The selected snapshot lives in `?revision=<id>`, so a snapshot can be linked
 * to and the browser's Back closes the viewer rather than leaving the screen.
 */

export function HistoryRoute() {
  const { promptId } = useParams<{ promptId: string }>();
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);
  const indent = usePreferencesStore((state) => state.indentSize);
  const history = useRevisionHistory(promptId);
  const toast = useToast();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<PromptRevision | null>(null);
  const [pruneOpen, setPruneOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const prompt = promptId ? (prompts.find((candidate) => candidate.id === promptId) ?? null) : null;

  const requestedId = searchParams.get('revision');
  const selected =
    history.revisions.find((revision) => revision.id === requestedId) ??
    history.revisions[0] ??
    null;

  // The URL may name a snapshot that was pruned, restored away, or never
  // existed; correct it rather than showing a viewer with nothing in it.
  useEffect(() => {
    // Wait for hydration: before it finishes the history is legitimately empty,
    // and dropping the id then would lose a valid deep link on every load.
    if (status !== 'ready') return;
    if (requestedId === null) return;
    if (history.revisions.some((revision) => revision.id === requestedId)) return;

    const next = new URLSearchParams(searchParams);
    next.delete('revision');
    setSearchParams(next, { replace: true });
  }, [history.revisions, requestedId, searchParams, setSearchParams, status]);

  const jsonFor = useMemo(
    () => (revision: PromptRevision) => formatDocument(revision.contentSnapshot, indent),
    [indent],
  );

  const currentHash = prompt ? documentHash(prompt.content) : null;
  const safetyNumber = (history.revisions[0]?.revisionNumber ?? 0) + 1;

  function selectRevision(revision: PromptRevision) {
    const next = new URLSearchParams(searchParams);
    next.set('revision', revision.id);
    setSearchParams(next, { replace: true });
  }

  // The palette asks the mounted screen to open its dialog; nothing is
  // registered without a prompt, so the command cannot act on stale data.
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

  async function handleSnapshot(label: string | null) {
    const outcome = await history.snapshot(label);
    if (!outcome.ok) return { ok: false, reason: outcome.error };

    toast.success({
      title: `Snapshot v${outcome.value.revisionNumber} saved`,
      description: label ?? prompt?.title ?? undefined,
    });
    selectRevision(outcome.value);
    return { ok: true };
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    const outcome = await history.restore(restoreTarget.id);
    if (!outcome.ok) {
      toast.error({ title: 'Nothing was restored', description: outcome.error });
      setRestoreTarget(null);
      return;
    }

    setRestoreTarget(null);
    toast.success({
      title: `Restored v${outcome.value.restoredNumber}`,
      description: `The state it replaced is saved as v${outcome.value.safetyNumber}.`,
    });
    // The editor reads the stored prompt on mount, so navigating there is what
    // "a refreshed editor" means: no stale draft is kept across the restore.
    navigate(`/prompts/${outcome.value.promptId}`);
  }

  async function handlePrune(keep: number) {
    const outcome = await history.prune(keep);
    if (!outcome.ok) {
      toast.error({ title: 'Nothing was pruned', description: outcome.error });
      return;
    }

    setPruneOpen(false);
    toast.success({
      title:
        outcome.value.removed === 0
          ? 'No snapshots removed'
          : `Removed ${outcome.value.removed} ${outcome.value.removed === 1 ? 'snapshot' : 'snapshots'}`,
      description: `${outcome.value.kept} kept. Snapshot numbers are unchanged, so gaps are expected.`,
    });
  }

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
        title="The history could not be read"
        description="This prompt's snapshots could not be loaded from this browser. Nothing was changed."
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
          <p className="metadata-rail">Prompt history</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Version history</h1>
        </header>
        <EmptyState
          title="This prompt is not in your library"
          description={
            promptId
              ? `No stored prompt has the id “${promptId}”, so there is no history to show. It may have been deleted.`
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
            History
          </li>
        </ol>
        <Link
          to={`/prompts/${prompt.id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          <ArrowLeft aria-hidden="true" size={12} />
          Back to the editor
        </Link>
      </nav>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="metadata-rail">Prompt history</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Version history</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
            Snapshots of “{prompt.title}”. A snapshot captures the document, title, description,
            tags, and variables together; restoring one is always reversible.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={badgeVariants({ tone: 'neutral' })}>
            {history.count} {history.count === 1 ? 'snapshot' : 'snapshots'}
          </span>
          <Link
            to={`/diff?prompt=${encodeURIComponent(prompt.id)}`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'gap-1.5')}
          >
            <GitCompare aria-hidden="true" size={12} />
            Compare snapshots
          </Link>
          <Button variant="primary" onClick={() => setSnapshotOpen(true)}>
            <Camera aria-hidden="true" size={14} />
            Save snapshot
          </Button>
        </div>
      </header>

      {needsPruneWarning(history.count) ? (
        <Alert
          tone="warning"
          title={`${history.count} snapshots on this prompt`}
          action={
            <Button variant="secondary" size="sm" onClick={() => setPruneOpen(true)}>
              <Scissors aria-hidden="true" size={12} />
              Prune old snapshots
            </Button>
          }
        >
          <p className="text-xs leading-relaxed">
            Past {REVISION_WARNING_THRESHOLD} snapshots the list stops being quick to scan, and each
            one is stored in full. Nothing is removed automatically — pruning is a choice you make,
            and it always keeps the newest snapshots.
          </p>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card as="section" aria-labelledby="history-list" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="history-list" className="text-sm font-semibold text-ink">
                Snapshots
              </h2>
              <p className="mt-1 text-xs text-ink-muted">Newest first. Autosave never adds one.</p>
            </div>
            {history.count > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setPruneOpen(true)}>
                Prune
              </Button>
            ) : null}
          </div>

          {history.count === 0 ? (
            <EmptyState
              title="No snapshots yet"
              description="Snapshots are taken when you ask for one. Editing and autosave change the prompt without recording history here, so save a snapshot before a risky rewrite."
              action={
                <Button variant="secondary" onClick={() => setSnapshotOpen(true)}>
                  Save the first snapshot
                </Button>
              }
            />
          ) : (
            <RevisionList
              revisions={history.revisions}
              selectedId={selected?.id ?? null}
              now={now}
              busy={history.busy}
              onSelect={selectRevision}
              onRestore={setRestoreTarget}
              onCopied={() => toast.success({ title: 'Snapshot JSON copied' })}
              jsonFor={jsonFor}
            />
          )}
        </Card>

        {selected ? (
          <div className="flex min-w-0 flex-col gap-3">
            <RevisionViewer
              revision={selected}
              json={jsonFor(selected)}
              indent={indent}
              now={now}
              busy={history.busy}
              onRestore={() => setRestoreTarget(selected)}
              onCopied={() => toast.success({ title: 'Snapshot JSON copied' })}
              matchesCurrent={currentHash === summariseRevision(selected).hash}
              compareHref={`/diff?left=revision:${encodeURIComponent(selected.id)}&right=prompt:${encodeURIComponent(prompt.id)}`}
            />
            <p className="flex items-start gap-2 rounded-md border border-line bg-surface-1 px-3 py-2 text-2xs leading-relaxed text-ink-muted">
              <FileJson aria-hidden="true" size={13} className="mt-0.5 shrink-0" />
              <span>
                A structural comparison between this snapshot and the current document arrives in
                TASK-020. Until then, the viewer shows the snapshot on its own and the restore
                dialog lists what a restore would change.
              </span>
            </p>
          </div>
        ) : (
          <Card as="section" aria-labelledby="history-empty-viewer" className="min-w-0">
            <h2 id="history-empty-viewer" className="text-sm font-semibold text-ink">
              Nothing to show
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
              Save a snapshot to read it here: number, kind, label, exact time, size, and the full
              document as read-only JSON.
            </p>
          </Card>
        )}
      </div>

      <section
        aria-labelledby="history-rules"
        className="rounded-md border border-line bg-surface-1 p-3"
      >
        <h2
          id="history-rules"
          className="text-2xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          How history works here
        </h2>
        <ul className="mt-1.5 space-y-1 text-2xs leading-relaxed text-ink-secondary">
          <li>
            A snapshot is taken only when you ask for one, and it is stored in this browser beside
            the prompt.
          </li>
          <li>
            Restoring replaces the document, title, description, tags, and variables. The state it
            replaces is saved first as a safety snapshot, so a restore can itself be undone.
          </li>
          <li>
            Snapshot numbers never change. Pruning the oldest ones leaves gaps, and the next
            snapshot continues from the highest number this prompt has ever had.
          </li>
          <li>
            Deleting the prompt deletes its history with it; that is what the deletion dialog
            counts.
          </li>
        </ul>
      </section>

      <SnapshotDialog
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        promptTitle={prompt.title}
        onSnapshot={handleSnapshot}
      />

      <RestoreRevisionDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        revision={restoreTarget}
        prompt={prompt}
        busy={history.busy}
        safetyNumber={safetyNumber}
        onConfirm={() => void handleRestore()}
      />

      <PruneRevisionsDialog
        open={pruneOpen}
        onOpenChange={setPruneOpen}
        revisions={history.revisions}
        busy={history.busy}
        onConfirm={(keep) => void handlePrune(keep)}
      />
    </div>
  );
}
