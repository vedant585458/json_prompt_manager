import { AlertTriangle, CheckCircle2, FileJson, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';

import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  Field,
  Select,
  StatusPill,
  useToast,
} from '@/components/ui';
import { systemDependencies } from '@/domain/factories';
import { formatDateTime } from '@/lib/dates';
import {
  IMPORT_DECISIONS,
  MAX_IMPORT_BYTES,
  buildImportPlan,
  readImportFile,
  type ImportDecision,
  type ImportFailure,
  type ImportPlan,
  type PreviewItem,
  type TransferPreview,
} from '@/domain/transfer/import';
import { formatBytes } from '@/domain/health';
import { useDataStoreApi } from '@/store/dataStoreContext';
import type { ImportOutcome } from '@/store/dataStore';
import { snapshotLibrary } from '@/features/transfer/useTransfer';

/** Wording per failure category, so the user knows what to do next. */
const FAILURE_TITLES: Record<ImportFailure['reason'], string> = {
  empty: 'That file is empty',
  'too-large': 'That file is too large',
  'not-json': 'That file is not JSON',
  unrecognised: 'That file is not a PromptForge export',
  'unsupported-version': 'That export version is not supported',
  'invalid-records': 'That file contains records this build cannot read',
};

const DECISION_LABELS: Record<ImportDecision, string> = {
  import: 'Add as a new prompt',
  copy: 'Add as a copy',
  skip: 'Skip this prompt',
  overwrite: 'Overwrite the stored prompt',
};

type Stage = 'choose' | 'preview' | 'result';

export interface ImportDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Runs after a successful write, with what was created. */
  readonly onImported?: (outcome: ImportOutcome) => void;
}

/**
 * Import (TASK-026).
 *
 * Three stages, in the order the guarantee needs them:
 *
 * 1. **Choose** a file. Size and JSON are checked before anything else.
 * 2. **Preview** every record, with a resolution per prompt. Nothing is written
 *    at this point, and the counts on the button are the counts that will be
 *    written.
 * 3. **Report** what the write did, including what was skipped and which ids had
 *    to change.
 *
 * A failure at any stage leaves the library untouched: the read stages only
 * produce values, and the write stage is a single store action that rolls itself
 * back (see `DataStore.applyImport`).
 */
export function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const store = useDataStoreApi();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<Stage>('choose');
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ImportDecision>>({});
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const reset = useCallback(() => {
    setStage('choose');
    setReading(false);
    setWriting(false);
    setFailure(null);
    setWriteError(null);
    setPreview(null);
    setDecisions({});
    setPlan(null);
    setOutcome(null);
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleFile = useCallback(
    async (file: File) => {
      setReading(true);
      setFailure(null);
      setWriteError(null);
      setFileName(file.name);

      try {
        if (file.size > MAX_IMPORT_BYTES) {
          setFailure({
            reason: 'too-large',
            message: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMPORT_BYTES)}.`,
            issues: [],
          });
          return;
        }

        const text = await file.text();
        const result = readImportFile(text, {
          deps: systemDependencies,
          library: snapshotLibrary(store.getState()),
        });

        if (!result.ok) {
          setFailure(result.failure);
          return;
        }

        setPreview(result.value);
        setDecisions(result.value.decisions);
        setStage('preview');
      } catch (error) {
        setFailure({
          reason: 'not-json',
          message:
            error instanceof Error && error.message
              ? `That file could not be read: ${error.message}`
              : 'That file could not be read.',
          issues: [],
        });
      } finally {
        setReading(false);
      }
    },
    [store],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  };

  const decide = (sourceId: string, decision: ImportDecision) => {
    setDecisions((current) => ({ ...current, [sourceId]: decision }));
  };

  const willWrite = preview
    ? preview.items.filter((item) => (decisions[item.sourceId] ?? item.defaultDecision) !== 'skip')
    : [];
  const willOverwrite = preview
    ? preview.items.filter(
        (item) => (decisions[item.sourceId] ?? item.defaultDecision) === 'overwrite',
      )
    : [];

  const handleConfirm = async () => {
    if (!preview) return;

    setWriting(true);
    setWriteError(null);

    try {
      const built = buildImportPlan(
        preview,
        decisions,
        snapshotLibrary(store.getState()),
        systemDependencies,
      );

      const written = await store.getState().applyImport(built);
      setPlan(built);
      setOutcome(written);
      setStage('result');

      toast.success({
        title: 'Import finished',
        description:
          written.remapped > 0
            ? `${written.created} added, ${written.overwritten} overwritten, ${written.remapped} ids remapped.`
            : `${written.created} added, ${written.overwritten} overwritten, ${written.skipped} skipped.`,
      });

      onImported?.(written);
    } catch (error) {
      setWriteError(
        error instanceof Error && error.message
          ? error.message
          : 'The import failed. Nothing was written.',
      );
    } finally {
      setWriting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (writing ? undefined : onOpenChange(next))}>
      <DialogContent
        title={stage === 'result' ? 'Import finished' : 'Import from a file'}
        description={
          stage === 'choose'
            ? `A PromptForge bundle, a prompt file, or a single prompt document. JSON only, up to ${formatBytes(MAX_IMPORT_BYTES)}.`
            : stage === 'preview'
              ? 'Nothing is written until you confirm. Every prompt can be imported, copied, skipped, or overwritten.'
              : 'What this import did to your library.'
        }
        size="lg"
        dismissible={!writing}
        footer={
          stage === 'choose' ? (
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          ) : stage === 'preview' ? (
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={writing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirm()}
                loading={writing}
                loadingLabel="Importing"
                disabled={willWrite.length === 0}
              >
                {willWrite.length === 0
                  ? 'Nothing selected'
                  : `Import ${willWrite.length} ${willWrite.length === 1 ? 'prompt' : 'prompts'}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" type="button" onClick={reset}>
                Import another file
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          )
        }
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {failure ? (
            <Alert
              tone="danger"
              live="assertive"
              title={FAILURE_TITLES[failure.reason]}
              action={
                <Button variant="secondary" size="sm" type="button" onClick={reset}>
                  Choose another file
                </Button>
              }
            >
              <p>{failure.message}</p>
              {failure.issues.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {failure.issues.slice(0, 6).map((issue, index) => (
                    <li key={`${issue.path}-${index}`} className="font-mono text-2xs">
                      {issue.path ? `${issue.path}: ` : ''}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}

          {stage === 'choose' ? (
            <div className="space-y-3">
              <Field
                label="File"
                hint="A .json file from PromptForge, or a prompt document."
                required
              >
                {(control) => (
                  <input
                    {...control}
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleInputChange}
                    disabled={reading}
                    className="block w-full rounded-md border border-line bg-surface-1 px-3 py-2 text-sm text-ink file:mr-3 file:rounded-sm file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-ink"
                  />
                )}
              </Field>

              {reading ? (
                <p role="status" className="text-xs text-ink-muted">
                  Reading and checking {fileName || 'the file'}…
                </p>
              ) : null}

              <p className="text-xs leading-relaxed text-ink-muted">
                Exports never contain your preferences, activity log, or recovery drafts — see{' '}
                <Link to="/settings" className="underline" onClick={() => onOpenChange(false)}>
                  settings
                </Link>{' '}
                to download a backup.
              </p>
            </div>
          ) : null}

          {stage === 'preview' && preview ? (
            <PreviewBody
              preview={preview}
              decisions={decisions}
              onDecide={decide}
              willOverwrite={willOverwrite.length}
            />
          ) : null}

          {writeError ? (
            <Alert tone="danger" live="assertive" title="The import did not finish">
              <p>{writeError}</p>
            </Alert>
          ) : null}

          {stage === 'result' && plan && outcome ? (
            <ResultBody plan={plan} outcome={outcome} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Preview                                                                    */
/* -------------------------------------------------------------------------- */

function PreviewBody({
  preview,
  decisions,
  onDecide,
  willOverwrite,
}: {
  readonly preview: TransferPreview;
  readonly decisions: Readonly<Record<string, ImportDecision>>;
  readonly onDecide: (sourceId: string, decision: ImportDecision) => void;
  readonly willOverwrite: number;
}) {
  const counts = preview.supporting;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-line bg-surface-1 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="info" icon={<FileJson size={12} strokeWidth={1.75} />}>
            {preview.format === 'document' ? 'Prompt document' : 'PromptForge export'}
          </StatusPill>
          <span className="font-mono text-2xs text-ink-muted">
            {preview.bundle.format}@{preview.bundle.version}
          </span>
          <span className="text-2xs text-ink-muted">
            exported {formatDateTime(preview.exportedAt)} · app {preview.appVersion}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-secondary">
          {preview.counts.prompts} {preview.counts.prompts === 1 ? 'prompt' : 'prompts'} ·{' '}
          {counts.folders} folders · {counts.collections} collections · {counts.schemas} schemas ·{' '}
          {counts.snippets} snippets · {counts.revisions} revisions · {counts.testCases} test cases
          · {counts.templates} templates
        </p>
      </div>

      {preview.warnings.length > 0 ? (
        <Alert tone="warning" title="Before you import">
          <ul className="space-y-1">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <ul className="space-y-2">
        {preview.items.map((item) => (
          <PreviewRow
            key={item.sourceId}
            item={item}
            decision={decisions[item.sourceId] ?? item.defaultDecision}
            onDecide={onDecide}
          />
        ))}
      </ul>

      {willOverwrite > 0 ? (
        <Alert
          tone="warning"
          title={`${willOverwrite} stored ${willOverwrite === 1 ? 'prompt will be' : 'prompts will be'} replaced`}
        >
          <p>
            An overwrite keeps the stored prompt&rsquo;s identity and adds the imported document on
            top of it. Choose &ldquo;Add as a copy&rdquo; instead if you want to keep both.
          </p>
        </Alert>
      ) : null}
    </div>
  );
}

function PreviewRow({
  item,
  decision,
  onDecide,
}: {
  readonly item: PreviewItem;
  readonly decision: ImportDecision;
  readonly onDecide: (sourceId: string, decision: ImportDecision) => void;
}) {
  const options = IMPORT_DECISIONS.filter((candidate) =>
    item.allowedDecisions.includes(candidate),
  ).map((candidate) => ({ value: candidate, label: DECISION_LABELS[candidate] }));

  return (
    <li className="rounded-md border border-line bg-surface-1 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{item.description}</p>
          ) : null}
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 font-mono text-2xs text-ink-muted">
            <span>{item.revisionCount} revisions</span>
            <span>· {item.testCaseCount} test cases</span>
            {item.folderName ? <span>· folder {item.folderName}</span> : null}
            {item.collectionNames.length > 0 ? (
              <span>· {item.collectionNames.join(', ')}</span>
            ) : null}
            {item.schemaName ? <span>· schema {item.schemaName}</span> : null}
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Select
            aria-label={`Resolution for ${item.title}`}
            size="sm"
            value={decision}
            options={options}
            onChange={(event) => onDecide(item.sourceId, event.target.value as ImportDecision)}
          />
        </div>
      </div>

      {item.conflict ? (
        <p className="mt-2 flex items-start gap-1.5 text-2xs text-warning">
          <AlertTriangle aria-hidden="true" size={12} strokeWidth={1.75} className="mt-0.5" />
          <span>
            <Badge tone="warning">{item.conflict.kind.replace('same-', 'same ')}</Badge>{' '}
            <span className="text-ink-muted">
              {item.conflict.detail} Stored as “{item.conflict.title}”.
            </span>
          </span>
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-2xs text-success">
          <CheckCircle2 aria-hidden="true" size={12} strokeWidth={1.75} />
          Nothing in this library matches it yet.
        </p>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Result                                                                     */
/* -------------------------------------------------------------------------- */

function ResultBody({
  plan,
  outcome,
}: {
  readonly plan: ImportPlan;
  readonly outcome: ImportOutcome;
}) {
  const skipped = plan.entries.filter((entry) => entry.outcome === 'skipped');
  const copied = plan.remaps.filter((remap) => remap.reason === 'copy');
  const remappedIds = plan.remaps.filter((remap) => remap.reason === 'id-taken');

  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-3" aria-label="Import summary">
        <ResultStat label="Added" value={outcome.created} />
        <ResultStat label="Overwritten" value={outcome.overwritten} />
        <ResultStat label="Skipped" value={outcome.skipped} />
      </ul>

      <p className="text-xs text-ink-secondary">
        {plan.counts.folders} folders, {plan.counts.collections} collections, {plan.counts.schemas}{' '}
        schemas, {plan.counts.snippets} snippets, {plan.counts.revisions} revisions, and{' '}
        {plan.counts.testCases} test cases were written with them.
      </p>

      {skipped.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold text-ink">Skipped</h3>
          <ul className="mt-1 space-y-1 text-xs text-ink-muted">
            {skipped.map((entry) => (
              <li key={entry.sourceId}>· {entry.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.remaps.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold text-ink">Identifiers that changed</h3>
          <p className="mt-1 text-xs text-ink-muted">
            {remappedIds.length} records already existed under their original id and were given a
            new one; {copied.length} were imported as copies. Every reference was remapped with
            them.
          </p>
        </div>
      ) : null}

      {plan.warnings.length > 0 ? (
        <Alert tone="info" title="Also worth knowing">
          <ul className="space-y-1">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}

function ResultStat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <li className="rounded-md border border-line bg-surface-1 p-3">
      <p className="font-mono text-2xs tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl leading-none text-ink tabular">{value}</p>
    </li>
  );
}

/** The button the palette command and the settings card both render. */
export function ImportTrigger({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="secondary" type="button" onClick={onClick} disabled={disabled}>
      <Upload aria-hidden="true" size={14} />
      Import from file
    </Button>
  );
}
