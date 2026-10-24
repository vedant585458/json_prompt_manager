import { AlertTriangle, ArrowLeftRight, Equal, GitCompare } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { DiffChangeList, type DiffView } from '@/components/diff/DiffChangeList';
import { DiffPathBreadcrumb } from '@/components/diff/DiffPathBreadcrumb';
import { DiffSourcePicker } from '@/components/diff/DiffSourcePicker';
import { DiffSummaryBar } from '@/components/diff/DiffSummaryBar';
import { DiffValue } from '@/components/diff/DiffValue';
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyIconButton,
  EmptyState,
  ErrorState,
  SkeletonText,
  buttonVariants,
  useToast,
} from '@/components/ui';
import {
  DIFF_CATEGORY_DESCRIPTIONS,
  DIFF_CATEGORY_LABELS,
  DIFF_CHANGE_KIND_DESCRIPTIONS,
  DIFF_CHANGE_KIND_LABELS,
  diffDocuments,
  diffToJson,
  diffToText,
  filterDiffEntries,
  restrictDiffResult,
} from '@/domain/diff';
import type { DiffChangeKind, DiffEntry, DiffSummary } from '@/domain/diff';
import { scanJson } from '@/domain/jsonText';
import type { JsonValue } from '@/domain/types';
import {
  defaultDiffSources,
  parseDiffSource,
  resolveDiffSource,
  serializeDiffSource,
  switchDiffSourceKind,
} from '@/features/diff/sources';
import type { DiffSource, DiffSourceKind, ResolvedSide } from '@/features/diff/sources';
import { cn } from '@/lib/cn';
import { useDataStoreApi } from '@/store/dataStoreContext';

/**
 * Structural diff explorer (TASK-020).
 *
 * Two sources, one comparison. The sources live in the URL (`?left=`, `?right=`,
 * with `?prompt=` as a shortcut that means "newest snapshot vs. stored"), so a
 * comparison can be linked, bookmarked, and reloaded. Pasted JSON cannot: it
 * stays in this tab, and the screen says so rather than pretending a reload
 * keeps it.
 *
 * The route never writes anything. Opening a comparison, filtering it, viewing
 * it split or unified, and copying it all leave the prompt and its history
 * untouched.
 */

const EMPTY_COUNTS: Readonly<Record<DiffChangeKind, number>> = {
  added: 0,
  removed: 0,
  changed: 0,
  'type-changed': 0,
  reordered: 0,
};

type ParsedText =
  | { readonly state: 'empty' }
  | { readonly state: 'invalid'; readonly error: string }
  | { readonly state: 'valid'; readonly value: JsonValue };

function parsePastedText(text: string): ParsedText {
  if (text.trim().length === 0) return { state: 'empty' };

  const scanned = scanJson(text);
  if (!scanned.ok) return { state: 'invalid', error: scanned.error.message };
  return { state: 'valid', value: scanned.value };
}

function sideLabel(source: DiffSource, resolved: ResolvedSide, fallback: string): string {
  if (source.kind === 'text') return 'Pasted JSON';
  return resolved.ok ? resolved.label : fallback;
}

function sideDetail(source: DiffSource, resolved: ResolvedSide): string {
  if (source.kind === 'text') return 'Pasted JSON';
  return resolved.ok ? resolved.detail : 'Unavailable';
}

export function DiffRoute() {
  const store = useDataStoreApi();
  const prompts = store((state) => state.prompts);
  const revisions = store((state) => state.revisions);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);
  const toast = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const [texts, setTexts] = useState<{ before: string; after: string }>({ before: '', after: '' });
  const [activeKinds, setActiveKinds] = useState<readonly DiffChangeKind[]>([]);
  const [view, setView] = useState<DiffView>('unified');
  const [fullValues, setFullValues] = useState(false);
  const [selectedPointer, setSelectedPointer] = useState<string | null>(null);

  const docs = useMemo(() => ({ prompts, revisions }), [prompts, revisions]);

  const promptParam = searchParams.get('prompt');
  const before = useMemo<DiffSource>(() => {
    const fromUrl = parseDiffSource(searchParams.get('left'));
    if (fromUrl) return fromUrl;
    if (promptParam) return defaultDiffSources(promptParam, revisions).before;
    const first = prompts[0];
    return first ? { kind: 'prompt', promptId: first.id } : { kind: 'text' };
  }, [searchParams, promptParam, revisions, prompts]);

  const after = useMemo<DiffSource>(() => {
    const fromUrl = parseDiffSource(searchParams.get('right'));
    if (fromUrl) return fromUrl;
    if (promptParam) return defaultDiffSources(promptParam, revisions).after;
    return { kind: 'text' };
  }, [searchParams, promptParam, revisions]);

  const resolvedBefore = useMemo(() => resolveDiffSource(before, docs), [before, docs]);
  const resolvedAfter = useMemo(() => resolveDiffSource(after, docs), [after, docs]);

  const parsedBefore = useMemo(() => parsePastedText(texts.before), [texts.before]);
  const parsedAfter = useMemo(() => parsePastedText(texts.after), [texts.after]);

  const beforeDocument = useMemo<JsonValue | null>(() => {
    if (before.kind === 'text') return parsedBefore.state === 'valid' ? parsedBefore.value : null;
    return resolvedBefore.ok ? resolvedBefore.document : null;
  }, [before.kind, parsedBefore, resolvedBefore]);

  const afterDocument = useMemo<JsonValue | null>(() => {
    if (after.kind === 'text') return parsedAfter.state === 'valid' ? parsedAfter.value : null;
    return resolvedAfter.ok ? resolvedAfter.document : null;
  }, [after.kind, parsedAfter, resolvedAfter]);

  const diff = useMemo(
    () =>
      beforeDocument !== null && afterDocument !== null
        ? diffDocuments(beforeDocument, afterDocument)
        : null,
    [beforeDocument, afterDocument],
  );

  const visible = useMemo(
    () => (diff ? filterDiffEntries(diff.entries, activeKinds) : []),
    [diff, activeKinds],
  );

  const counts = diff?.summary.counts ?? EMPTY_COUNTS;
  const summary: DiffSummary = diff?.summary ?? {
    total: 0,
    counts: EMPTY_COUNTS,
    structural: 0,
    textual: 0,
  };

  const selected: DiffEntry | null =
    visible.find((entry) => entry.pointer === selectedPointer) ?? visible[0] ?? null;

  const sides = {
    before: sideLabel(before, resolvedBefore, 'Unavailable side'),
    after: sideLabel(after, resolvedAfter, 'Unavailable side'),
  };

  const filterNote = useMemo(() => {
    if (!diff || activeKinds.length === 0) return undefined;
    return `Filtered view: showing ${visible.length} of ${diff.entries.length} changes (${activeKinds
      .map((kind) => DIFF_CHANGE_KIND_LABELS[kind])
      .join(', ')}).`;
  }, [diff, activeKinds, visible.length]);

  const restricted = useMemo(
    () => (diff ? restrictDiffResult(diff, visible) : null),
    [diff, visible],
  );

  const copyJson = restricted
    ? diffToJson(restricted, sides, filterNote ? { filterNote } : {})
    : '';
  const copyText = restricted
    ? diffToText(restricted, sides, filterNote ? { filterNote } : {})
    : '';

  const copyLabel =
    activeKinds.length > 0
      ? `Copy ${visible.length} shown ${visible.length === 1 ? 'change' : 'changes'}`
      : `Copy all ${diff?.entries.length ?? 0} ${diff?.entries.length === 1 ? 'change' : 'changes'}`;

  const sharedPromptId =
    before.kind !== 'text' && after.kind !== 'text' && before.promptId === after.promptId
      ? before.promptId
      : null;

  const applySources = useCallback(
    (next: { before?: DiffSource; after?: DiffSource }) => {
      const params = new URLSearchParams(searchParams);
      params.set('left', serializeDiffSource(next.before ?? before));
      params.set('right', serializeDiffSource(next.after ?? after));
      params.delete('prompt');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams, before, after],
  );

  function handleKindChange(side: 'before' | 'after', kind: DiffSourceKind) {
    if (kind === 'text') {
      applySources(side === 'before' ? { before: { kind: 'text' } } : { after: { kind: 'text' } });
      return;
    }

    const current = side === 'before' ? before : after;
    const next = switchDiffSourceKind(kind, current, docs);
    applySources(side === 'before' ? { before: next } : { after: next });
  }

  function handleSourceChange(side: 'before' | 'after', source: DiffSource) {
    applySources(side === 'before' ? { before: source } : { after: source });
  }

  function swap() {
    setSelectedPointer(null);
    applySources({ before: after, after: before });
  }

  function toggleKind(kind: DiffChangeKind) {
    setActiveKinds((current) =>
      current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind],
    );
  }

  const blockingNotice = useMemo(() => {
    if (
      !diff &&
      beforeDocument === null &&
      before.kind === 'text' &&
      parsedBefore.state === 'invalid'
    ) {
      return 'The Before side does not parse, so nothing is compared yet.';
    }
    if (
      !diff &&
      afterDocument === null &&
      after.kind === 'text' &&
      parsedAfter.state === 'invalid'
    ) {
      return 'The After side does not parse, so nothing is compared yet.';
    }
    return null;
  }, [diff, beforeDocument, afterDocument, before.kind, after.kind, parsedBefore, parsedAfter]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-7xl" aria-busy="true">
        <SkeletonText lines={5} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="The diff could not be prepared"
        description="Prompts and snapshots could not be read from this browser. Nothing was changed."
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
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="metadata-rail">Comparison</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Compare documents</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
            A path-aware comparison of two JSON documents: what was added, removed, changed, or
            re-ordered, and whether that changed the structure or a value.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 font-mono text-2xs tracking-wide uppercase',
              diff?.identical
                ? 'border-line bg-surface-2 text-ink-secondary'
                : 'border-accent/40 bg-accent-soft text-accent',
            )}
          >
            {diff?.identical
              ? 'Identical'
              : `${summary.total} ${summary.total === 1 ? 'change' : 'changes'}`}
          </span>
          <Button variant="secondary" onClick={swap}>
            <ArrowLeftRight aria-hidden="true" size={13} />
            Swap sides
          </Button>
          {sharedPromptId ? (
            <Link
              to={`/prompts/${sharedPromptId}`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Open the prompt
            </Link>
          ) : null}
          {sharedPromptId ? (
            <Link
              to={`/prompts/${sharedPromptId}/history`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              History
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <DiffSourcePicker
          side="before"
          heading="Before"
          source={before}
          text={texts.before}
          textError={parsedBefore.state === 'invalid' ? parsedBefore.error : null}
          prompts={prompts}
          revisions={revisions}
          onKindChange={(kind) => handleKindChange('before', kind)}
          onSourceChange={(source) => handleSourceChange('before', source)}
          onTextChange={(text) => setTexts((current) => ({ ...current, before: text }))}
        />
        <DiffSourcePicker
          side="after"
          heading="After"
          source={after}
          text={texts.after}
          textError={parsedAfter.state === 'invalid' ? parsedAfter.error : null}
          prompts={prompts}
          revisions={revisions}
          onKindChange={(kind) => handleKindChange('after', kind)}
          onSourceChange={(source) => handleSourceChange('after', source)}
          onTextChange={(text) => setTexts((current) => ({ ...current, after: text }))}
        />
      </div>

      {!resolvedBefore.ok && before.kind !== 'text' ? (
        <Alert tone="warning" title="The Before side cannot be shown">
          <p className="text-xs leading-relaxed">{resolvedBefore.error}</p>
        </Alert>
      ) : null}
      {!resolvedAfter.ok && after.kind !== 'text' ? (
        <Alert tone="warning" title="The After side cannot be shown">
          <p className="text-xs leading-relaxed">{resolvedAfter.error}</p>
        </Alert>
      ) : null}

      {diff ? (
        <DiffSummaryBar
          summary={summary}
          counts={counts}
          activeKinds={activeKinds}
          onToggleKind={toggleKind}
          onClearKinds={() => setActiveKinds([])}
          view={view}
          onViewChange={setView}
          fullValues={fullValues}
          onFullValuesChange={setFullValues}
          copyJson={copyJson}
          copyText={copyText}
          copyLabel={copyLabel}
          onCopied={() => toast.success({ title: 'Comparison copied' })}
        />
      ) : null}

      {diff?.truncated ? (
        <Alert tone="warning" title="This comparison is longer than it can show">
          <p className="text-xs leading-relaxed">
            Showing the first {diff.entries.length} changes. The summary and the copy describe only
            those; nothing was silently dropped from the documents themselves.
          </p>
        </Alert>
      ) : null}

      {diff ? (
        diff.identical ? (
          <EmptyState
            icon={Equal}
            title="No differences"
            description={`${sides.before} and ${sides.after} parse to the same JSON. Formatting and object key order do not count as differences.`}
            action={
              sharedPromptId ? (
                <Link
                  to={`/prompts/${sharedPromptId}/history`}
                  className={cn(buttonVariants({ variant: 'primary' }))}
                >
                  Open the prompt’s history
                </Link>
              ) : (
                <Button variant="secondary" onClick={swap}>
                  Swap the two sides
                </Button>
              )
            }
          />
        ) : (
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="min-w-0">
              {visible.length === 0 ? (
                <EmptyState
                  icon={GitCompare}
                  title="No changes match this filter"
                  description={`All ${diff.entries.length} changes are hidden by the current filter. The comparison itself is unchanged.`}
                  action={
                    <Button variant="secondary" onClick={() => setActiveKinds([])}>
                      Show all changes
                    </Button>
                  }
                />
              ) : (
                <DiffChangeList
                  entries={visible}
                  view={view}
                  fullValues={fullValues}
                  selectedPointer={selected?.pointer ?? null}
                  onSelect={(entry) => setSelectedPointer(entry.pointer)}
                  sideLabels={sides}
                  label={`Changes between ${sides.before} and ${sides.after}`}
                />
              )}
            </div>

            {selected ? (
              <SelectedChange
                entry={selected}
                sides={sides}
                index={visible.indexOf(selected)}
                total={visible.length}
              />
            ) : (
              <Card as="section" aria-labelledby="diff-detail-empty" className="min-w-0">
                <h2 id="diff-detail-empty" className="text-sm font-semibold text-ink">
                  No change selected
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                  Pick a row to see its exact path, both values, and the RFC 6901 pointer.
                </p>
              </Card>
            )}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-line px-4 py-8">
          <div className="mx-auto max-w-prose text-center">
            <h2 className="text-sm font-semibold text-ink">
              {blockingNotice ? 'The comparison is paused' : 'Two sides are needed'}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
              {blockingNotice ??
                'Choose a stored prompt, a snapshot, or paste JSON on each side. Nothing is compared until both sides parse.'}
            </p>
            <ul className="mt-3 space-y-1 text-left text-2xs leading-relaxed text-ink-muted">
              <li>Before: {sideDetail(before, resolvedBefore)}</li>
              <li>After: {sideDetail(after, resolvedAfter)}</li>
            </ul>
          </div>
        </div>
      )}

      <section
        aria-labelledby="diff-about"
        className="rounded-md border border-line bg-surface-1 p-3"
      >
        <h2
          id="diff-about"
          className="text-2xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          What this comparison is — and is not
        </h2>
        <ul className="mt-1.5 space-y-1 text-2xs leading-relaxed text-ink-secondary">
          <li>
            It compares parsed JSON values. Whitespace is not a difference, and object member order
            is not a difference; array order is, and a pure re-order is reported as one change.
          </li>
          <li>
            <span className="font-medium text-ink">Structure</span> means a key or array element was
            added, removed, or re-ordered, or a value changed type.{' '}
            <span className="font-medium text-ink">Text</span> means a value kept its type and
            changed in place.
          </li>
          <li>
            It reports what changed, not what it means. Two differently worded instructions that say
            the same thing are still two different strings, and nothing here scores prompt quality.
          </li>
          <li>
            Opening a comparison writes nothing: the stored prompt, its snapshots, and its activity
            are untouched.
          </li>
        </ul>
      </section>
    </div>
  );
}

interface SelectedChangeProps {
  readonly entry: DiffEntry;
  readonly sides: { readonly before: string; readonly after: string };
  readonly index: number;
  readonly total: number;
}

function SelectedChange({ entry, sides, index, total }: SelectedChangeProps) {
  return (
    <Card as="section" aria-labelledby="diff-detail-heading" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="metadata-rail">
            Change {index + 1} of {total}
          </p>
          <h2
            id="diff-detail-heading"
            className="mt-1 font-mono text-sm leading-tight break-all text-ink"
          >
            {entry.label}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            tone={
              entry.kind === 'removed' ? 'danger' : entry.kind === 'added' ? 'success' : 'neutral'
            }
          >
            {DIFF_CHANGE_KIND_LABELS[entry.kind]}
          </Badge>
          <Badge tone="neutral">{DIFF_CATEGORY_LABELS[entry.category]}</Badge>
        </div>
      </div>

      <DiffPathBreadcrumb segments={entry.segments} />

      <p className="text-2xs leading-relaxed text-ink-muted">
        {DIFF_CHANGE_KIND_DESCRIPTIONS[entry.kind]}. {DIFF_CATEGORY_DESCRIPTIONS[entry.category]}
      </p>

      <div className="space-y-2 rounded-md border border-line bg-surface-2 p-2.5">
        <div>
          <p className="text-2xs tracking-wide text-ink-muted uppercase">Before · {sides.before}</p>
          <DiffValue value={entry.before} side="before" absentLabel="Not in the older side" full />
        </div>
        <div>
          <p className="text-2xs tracking-wide text-ink-muted uppercase">After · {sides.after}</p>
          <DiffValue value={entry.after} side="after" absentLabel="Not in the newer side" full />
        </div>
      </div>

      {entry.moves && entry.moves.length > 0 ? (
        <div>
          <p className="text-2xs tracking-wide text-ink-muted uppercase">Positions that moved</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {entry.moves.map((move) => (
              <li
                key={`${move.from}-${move.to}`}
                className="rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-ink-secondary"
              >
                {move.from} → {move.to}
              </li>
            ))}
          </ul>
          {entry.movedPositions !== undefined && entry.movedPositions > entry.moves.length ? (
            <p className="mt-1 text-2xs text-ink-muted">
              {entry.movedPositions - entry.moves.length} further positions moved and are not listed
              individually.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 truncate rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-ink-secondary">
          {entry.pointer === '' ? '(root)' : entry.pointer}
        </code>
        <CopyIconButton
          value={entry.pointer}
          label={`Copy path ${entry.label} as a JSON Pointer`}
          onCopied={() => undefined}
        />
        {entry.kind === 'type-changed' ? (
          <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
            <AlertTriangle aria-hidden="true" size={11} />
            Type changed; values are shown as they are.
          </span>
        ) : null}
      </div>
    </Card>
  );
}
