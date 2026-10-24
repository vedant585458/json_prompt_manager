import { ArrowLeft, FlaskConical, Play, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Select,
  SkeletonText,
  buttonVariants,
} from '@/components/ui';
import { resolveCaseInputs, runTestCase, summarizeLabRuns, type LabRun } from '@/domain/lab';
import { validatePromptDocument } from '@/domain/promptDocument';
import { validateJsonValue } from '@/domain/validation';
import { parseDocument, documentToJson } from '@/domain/serialization';
import type { PromptDocument, PromptSchema, PromptRevision, TestCase } from '@/domain/types';
import { CaseEditor, type CaseDraft } from '@/features/testCases/CaseEditor';
import { CaseList, type CaseSummary } from '@/features/testCases/CaseList';
import { RunResults, RunSummaryLine } from '@/features/testCases/RunResults';
import { VariantComparison } from '@/features/testCases/VariantComparison';
import {
  loadCaseIntoPlayground,
  readPlaygroundCarryOver,
  type PlaygroundCarryOver,
} from '@/features/testCases/playgroundBridge';
import { cn } from '@/lib/cn';
import { describeDataError } from '@/store/dataStore';
import { useDataStoreApi } from '@/store/dataStoreContext';

const STORED = 'stored';

type EditorState =
  | { readonly mode: 'new'; readonly seed: PlaygroundCarryOver | null }
  | { readonly mode: 'edit'; readonly testCase: TestCase };

function sourceOptions(
  promptVersion: number,
  revisions: readonly PromptRevision[],
): { value: string; label: string }[] {
  return [
    { value: STORED, label: `Stored prompt (version ${promptVersion})` },
    ...revisions.map((revision) => ({
      value: revision.id,
      label: `Snapshot v${revision.revisionNumber}${
        revision.label ? ` · ${revision.label}` : ''
      } · ${new Date(revision.createdAt).toLocaleString()}`,
    })),
  ];
}

function schemaFor(schemas: readonly PromptSchema[], id: string | null): PromptSchema | null {
  return id ? (schemas.find((schema) => schema.id === id) ?? null) : null;
}

/**
 * Prompt laboratory (TASK-022).
 *
 * Saved, named input sets render against one chosen version of the prompt, all
 * in this browser. The laboratory exists to answer one question honestly: *what
 * words does this document produce for these values?* It cannot answer whether
 * an answer would be good, because no model is connected — the banner says so
 * permanently rather than in a footnote.
 */
export function LabRoute() {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useDataStoreApi();

  const prompts = store((state) => state.prompts);
  const schemas = store((state) => state.schemas);
  const testCases = store((state) => state.testCases);
  const revisions = store((state) => state.revisions);
  const status = store((state) => state.status);
  const error = store((state) => state.error);
  const hydrate = store((state) => state.hydrate);

  const addTestCase = store((state) => state.addTestCase);
  const updateTestCase = store((state) => state.updateTestCase);
  const duplicateTestCase = store((state) => state.duplicateTestCase);
  const deleteTestCase = store((state) => state.deleteTestCase);

  const prompt = promptId ? (prompts.find((candidate) => candidate.id === promptId) ?? null) : null;

  const [sourceId, setSourceId] = useState(STORED);
  const [runs, setRuns] = useState<readonly LabRun[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const seeded = useRef(false);

  const promptRevisions = useMemo(
    () =>
      revisions
        .filter((revision) => revision.promptId === prompt?.id)
        .slice()
        .sort((left, right) => right.revisionNumber - left.revisionNumber),
    [revisions, prompt?.id],
  );

  const cases = useMemo<readonly TestCase[]>(
    () =>
      testCases
        .filter((testCase) => testCase.promptId === prompt?.id)
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [testCases, prompt?.id],
  );

  const sourceRevision =
    sourceId === STORED
      ? null
      : (promptRevisions.find((revision) => revision.id === sourceId) ?? null);

  const selectedDocument = useMemo<{
    readonly document: PromptDocument | null;
    readonly problems: readonly string[];
  }>(() => {
    if (!prompt) return { document: null, problems: [] };

    const raw = sourceRevision ? sourceRevision.contentSnapshot : prompt.content;
    const parsed = parseDocument(raw);

    return parsed.ok
      ? { document: parsed.value, problems: [] }
      : {
          document: null,
          problems: parsed.issues
            .filter((issue) => issue.severity === 'error')
            .slice(0, 5)
            .map((issue) => `${issue.path}: ${issue.message}`),
        };
  }, [prompt, sourceRevision]);

  const document = selectedDocument.document;

  // A palette command or link can ask for a new case; the request is honoured
  // once, then removed from the URL so a reload does not reopen the form.
  useEffect(() => {
    if (seeded.current || !prompt || !document) return;
    if (searchParams.get('new') !== '1') return;

    seeded.current = true;
    const carry =
      searchParams.get('from') === 'playground'
        ? readPlaygroundCarryOver(prompt.id, document.variables)
        : null;
    setEditor({ mode: 'new', seed: carry });
    setSearchParams({}, { replace: true });
  }, [prompt, document, searchParams, setSearchParams]);

  const promptSchema = schemaFor(schemas, prompt?.schemaId ?? null);

  const preflight = useMemo(() => {
    if (!document) return null;

    const value = documentToJson(document);
    const result = validatePromptDocument(value);
    const documentProblems = result.ok
      ? []
      : result.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => `${issue.path.length > 0 ? `$.${issue.path}` : '$'}: ${issue.message}`);

    // The attached schema is part of the pre-run gate, exactly as it is in a run:
    // a document that does not conform must not produce text.
    if (promptSchema) {
      const report = validateJsonValue(value, {
        schema: promptSchema.schemaContent,
        checkDocument: false,
      });
      for (const issue of report.issues) {
        if (issue.severity !== 'error') continue;
        documentProblems.push(`${issue.path}: ${issue.message}`);
      }
    }

    const caseProblems = cases.map((testCase) => ({
      name: testCase.name,
      problems: resolveCaseInputs(document.variables, testCase.inputValues).problems.filter(
        (problem) => problem.severity === 'error',
      ),
    }));

    return { documentProblems, caseProblems };
  }, [document, cases, promptSchema]);

  function runCases(selected: readonly TestCase[]): void {
    if (!document || !prompt) return;

    setRunError(null);
    const next = selected.map((testCase) => {
      const expectedSchema = schemaFor(schemas, testCase.expectedStructure);

      return runTestCase({
        document,
        promptSchema: promptSchema?.schemaContent ?? null,
        testCase: {
          id: testCase.id,
          name: testCase.name,
          inputValues: testCase.inputValues,
        },
        expectedSchema: expectedSchema?.schemaContent ?? null,
        missingExpectedSchemaId:
          testCase.expectedStructure && !expectedSchema ? testCase.expectedStructure : null,
      });
    });

    setRuns(next);
  }

  async function saveCase(draft: CaseDraft): Promise<void> {
    if (!editor) return;

    setSaving(true);
    setFormError(null);
    try {
      if (editor.mode === 'edit') {
        await updateTestCase(editor.testCase.id, draft);
        setNotice(`Saved “${draft.name.trim()}”.`);
      } else {
        await addTestCase({
          promptId: prompt?.id ?? '',
          name: draft.name,
          inputValues: draft.inputValues,
          expectedStructure: draft.expectedStructure,
        });
        setNotice(`Saved the test case “${draft.name.trim()}”.`);
      }
      setEditor(null);
    } catch (cause) {
      setFormError(describeDataError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(testCase: CaseSummary): Promise<void> {
    setPendingId(testCase.id);
    setNotice(null);
    try {
      const copy = await duplicateTestCase(testCase.id);
      setNotice(`Duplicated “${testCase.name}” as “${copy.name}”.`);
    } catch (cause) {
      setRunError(describeDataError(cause));
    } finally {
      setPendingId(null);
    }
  }

  async function remove(testCase: CaseSummary): Promise<void> {
    setPendingId(testCase.id);
    setNotice(null);
    try {
      await deleteTestCase(testCase.id);
      setRuns((current) => current.filter((run) => run.caseId !== testCase.id));
      setNotice(`Deleted “${testCase.name}”.`);
    } catch (cause) {
      setRunError(describeDataError(cause));
    } finally {
      setPendingId(null);
    }
  }

  function openInPlayground(testCase: CaseSummary): void {
    if (!prompt || !document) return;

    const result = loadCaseIntoPlayground(prompt.id, document.variables, testCase.inputValues);
    if (!result.written) {
      setNotice(
        'This browser refused to remember the case values, so the playground was not opened. Nothing was lost — the case is still saved.',
      );
      return;
    }

    navigate(`/prompts/${prompt.id}/playground`);
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto w-full max-w-6xl" aria-busy="true">
        <SkeletonText lines={5} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="The laboratory could not be opened"
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
          <p className="metadata-rail">Laboratory</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Prompt laboratory</h1>
        </header>
        <EmptyState
          title="This prompt is not in your library"
          description={
            promptId
              ? `No stored prompt has the id “${promptId}”. It may have been deleted, so there is nothing to test.`
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

  const summary = summarizeLabRuns(runs);
  const comparable = runs
    .filter((run) => run.status === 'rendered')
    .map((run) => ({ id: run.caseId, label: run.caseName, text: run.text }));

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
            Laboratory
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to={`/prompts/${prompt.id}/playground`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <FlaskConical aria-hidden="true" size={12} />
            Playground
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
        <p className="metadata-rail">Prompt laboratory</p>
        <h1 className="font-display text-3xl leading-tight text-ink">Laboratory</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink-secondary">
          Save named sets of variable values, then render this prompt with each one. Results show
          the exact text produced and every check that stopped a run.
        </p>
      </header>

      <Alert tone="info" title="Local rendering only">
        No AI model provider is connected; PromptForge does not execute prompts against a model.
        Every result below is text this browser produced by substitution, counted in characters —
        never a token count and never a model answer.
      </Alert>

      {notice ? (
        <Alert tone="success" live="polite" title="Done" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}

      <Card className="min-w-0">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Prompt version</h2>
              <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
                Render the stored prompt or one of its snapshots. Cases are matched by variable
                name, so a case saved against another version still runs — and says what it could
                not resolve.
              </p>
            </div>
            <Field label="Prompt version to render" hideLabel className="min-w-0">
              {(control) => (
                <Select
                  {...control}
                  size="sm"
                  value={sourceId}
                  onChange={(event) => {
                    setSourceId(event.target.value);
                    setRuns([]);
                  }}
                  options={sourceOptions(prompt.version, promptRevisions)}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => runCases(cases)}
              disabled={cases.length === 0 || !document}
            >
              <Play aria-hidden="true" size={12} />
              Run all cases
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runCases(cases)}
              disabled={runs.length === 0 || !document}
            >
              <RefreshCw aria-hidden="true" size={12} />
              Re-run
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFormError(null);
                setEditor({ mode: 'new', seed: null });
              }}
            >
              <Plus aria-hidden="true" size={12} />
              New test case
            </Button>
            <Badge tone={promptSchema ? 'info' : 'neutral'}>
              {promptSchema ? `Prompt schema: ${promptSchema.name}` : 'No prompt schema attached'}
            </Badge>
            <Badge tone="neutral">
              {cases.length} case{cases.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {promptSchema ? (
            <p className="text-2xs leading-relaxed text-ink-muted">
              Every run checks the document against “{promptSchema.name}” first; a failing document
              blocks the run instead of producing text.
            </p>
          ) : null}
        </div>
      </Card>

      {!document ? (
        <Alert tone="danger" title="This version cannot be rendered">
          <p>
            The selected document does not pass its own shape checks, so nothing can be run. Open
            the editor to see every problem.
          </p>
          {selectedDocument.problems.length > 0 ? (
            <ul className="mt-2 space-y-1 font-mono text-2xs">
              {selectedDocument.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      {runError ? (
        <Alert tone="danger" title="That action did not complete" live="polite">
          {runError}
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Test cases</h2>
              <span className="text-2xs text-ink-muted">
                Saved with this prompt in this browser
              </span>
            </div>

            <div className="mt-2">
              <CaseList
                cases={cases}
                variables={document?.variables ?? []}
                schemaName={(id) => schemaFor(schemas, id)?.name ?? null}
                onCreate={() => setEditor({ mode: 'new', seed: null })}
                onEdit={(testCase) => {
                  setFormError(null);
                  const full = cases.find((candidate) => candidate.id === testCase.id);
                  if (full) setEditor({ mode: 'edit', testCase: full });
                }}
                onRun={(testCase) => {
                  const full = cases.find((candidate) => candidate.id === testCase.id);
                  if (full) runCases([full]);
                }}
                onLoadIntoPlayground={openInPlayground}
                onDuplicate={(testCase) => void duplicate(testCase)}
                onDelete={(testCase) => void remove(testCase)}
                pendingId={pendingId}
              />
            </div>
          </Card>

          {editor ? (
            <Card className="min-w-0">
              <CaseEditor
                key={editor.mode === 'edit' ? editor.testCase.id : 'new'}
                variables={document?.variables ?? []}
                schemas={schemas}
                existing={
                  editor.mode === 'edit'
                    ? {
                        name: editor.testCase.name,
                        inputValues: editor.testCase.inputValues,
                        expectedStructure: editor.testCase.expectedStructure,
                      }
                    : null
                }
                seed={editor.mode === 'new' ? editor.seed : null}
                pending={saving}
                error={formError}
                onSubmit={(draft) => void saveCase(draft)}
                onCancel={() => {
                  setEditor(null);
                  setFormError(null);
                }}
              />
            </Card>
          ) : null}

          {preflight ? (
            <Card className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Pre-run checks</h2>
              <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
                These run before any text is produced. A blocking problem stops the run; it is never
                rendered around.
              </p>

              {preflight.documentProblems.length > 0 ? (
                <div className="mt-2">
                  <h3 className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                    Document
                  </h3>
                  <ul className="mt-1 space-y-1 text-2xs leading-relaxed text-ink-secondary">
                    {preflight.documentProblems.map((problem) => (
                      <li key={problem} className="flex flex-wrap gap-1.5">
                        <span className="font-semibold text-danger">Blocking</span>
                        <span className="font-mono">{problem}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-2 text-2xs leading-relaxed text-ink-secondary">
                  The document passes its shape rules
                  {promptSchema ? ` and the attached schema` : ''}.
                </p>
              )}

              <div className="mt-2">
                <h3 className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                  Inputs
                </h3>
                {cases.length === 0 ? (
                  <p className="mt-1 text-2xs leading-relaxed text-ink-secondary">
                    No cases to check yet.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1 text-2xs leading-relaxed text-ink-secondary">
                    {preflight.caseProblems.map((entry) => (
                      <li key={entry.name} className="flex flex-wrap gap-1.5">
                        <span className="font-medium text-ink">{entry.name}</span>
                        {entry.problems.length === 0 ? (
                          <span className="text-ink-muted">every required value is present</span>
                        ) : (
                          <span className="text-danger">
                            {entry.problems.length} blocking input problem
                            {entry.problems.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Results</h2>
              <RunSummaryLine
                rendered={summary.rendered}
                blocked={summary.blocked}
                total={summary.total}
              />
            </div>
            <div className="mt-2">
              <RunResults runs={runs} />
            </div>
          </Card>

          <Card className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Compare two rendered variants</h2>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
              A line-by-line comparison of two runs. It shows what changed in the text; it cannot
              say which version is better.
            </p>
            <div className="mt-2">
              <VariantComparison
                variants={comparable}
                preferredAfterId={runs.at(-1)?.caseId ?? null}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
