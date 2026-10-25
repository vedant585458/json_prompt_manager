import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useMemo } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/app/providers/ToastProvider';
import { createBlankDocument } from '@/domain/promptDocument';
import { inspectQuality } from '@/domain/quality';
import type { PromptDocument } from '@/domain/types';
import { QualityPanel } from '@/features/quality/QualityPanel';
import { dismissalStorageKey } from '@/features/quality/dismissalStorage';
import { useQualityDismissals } from '@/features/quality/useQualityDismissals';

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective: 'Classify the {{ticket}}.',
    instructions: ['Read the ticket.'],
    examples: [{ input: 'A', output: 'B' }],
    variables: [{ name: 'ticket', type: 'string', required: true }],
    ...overrides,
  });
}

/** The real panel with the real dismissal hook, so storage is exercised. */
function Harness({
  document = documentWith(),
  description = 'Sorts tickets into queues.',
  rawText,
  onOpenPath = vi.fn(),
}: {
  document?: PromptDocument;
  description?: string;
  rawText?: string;
  onOpenPath?: (path: string) => void;
}) {
  const report = useMemo(
    () =>
      inspectQuality({
        document,
        record: { description },
        snippetIds: [],
        schemaIds: [],
        rawText: rawText ?? JSON.stringify(document),
      }),
    [description, document, rawText],
  );
  const dismissals = useQualityDismissals('p-1');

  return (
    <QualityPanel report={report} promptId="p-1" dismissals={dismissals} onOpenPath={onOpenPath} />
  );
}

function renderPanel(props: Parameters<typeof Harness>[0] = {}) {
  const onOpenPath = vi.fn<(path: string) => void>();

  render(
    <MemoryRouter>
      <ToastProvider>
        <Harness {...props} onOpenPath={onOpenPath} />
      </ToastProvider>
    </MemoryRouter>,
  );

  return { onOpenPath };
}

/** Opens the dismiss form on the card with this title and submits a reason. */
async function dismissFinding(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  reason: string,
) {
  const card = screen
    .getAllByRole('article')
    .find((article) => within(article).queryByText(title) !== null);
  if (!card) throw new Error(`No card titled ${title}`);

  await user.click(within(card).getByRole('button', { name: 'Dismiss…' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText(/Why is it acceptable\?/), reason);
  await user.click(within(dialog).getByRole('button', { name: 'Dismiss the finding' }));
}

/** A dismissal API with no storage, for tests that do not exercise dismissals. */
function unavailableDismissals() {
  const outcome = { ok: false as const, error: 'No storage in this test.' };

  return {
    dismissals: [],
    available: false,
    error: null,
    dismiss: () => outcome,
    restore: () => outcome,
    restoreAll: () => outcome,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('quality panel', () => {
  it('states what the review is and what it is not', () => {
    renderPanel();

    expect(screen.getByText('Rule-based review, not a score')).toBeInTheDocument();
    expect(screen.getByText(/nothing here changes your prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/A fact about the document/)).toBeInTheDocument();
    expect(screen.getByText(/A rule of thumb about prompt writing/)).toBeInTheDocument();
  });

  it('shows an honest empty state when no rule fires', () => {
    renderPanel();

    expect(screen.getAllByText('No structural findings').length).toBeGreaterThan(0);
    expect(screen.getByText(/That is a statement about structure/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check it against a schema' })).toHaveAttribute(
      'href',
      '/validation?prompt=p-1',
    );
    expect(screen.getByRole('status')).toHaveTextContent('No structural findings');
  });

  it('groups findings by severity and labels each one’s rule kind', async () => {
    renderPanel({ document: documentWith({ role: '', objective: '' }) });

    expect(screen.getByRole('heading', { name: 'Errors' })).toBeInTheDocument();
    const errors = screen.getAllByRole('article');
    expect(errors.length).toBeGreaterThan(0);

    expect(screen.getAllByText('Deterministic').length).toBeGreaterThan(0);
    // The remaining findings are suggestions, so that group exists too.
    expect(screen.getByRole('heading', { name: 'Suggestions' })).toBeInTheDocument();
    expect(screen.getAllByText('Heuristic').length).toBeGreaterThan(0);
    // A count of every finding is stated in words as well as in the groups.
    expect(screen.getByRole('status')).toHaveTextContent(/^\d+ findings?: /);
  });

  it('explains why a finding fired and what could be done, without editing', async () => {
    const user = userEvent.setup();
    renderPanel({
      document: documentWith({ objective: 'Classify {{ghost}}.', variables: [] }),
    });

    const card = screen.getByRole('article');
    expect(within(card).getByText('“ghost” is used but never declared')).toBeInTheDocument();
    expect(within(card).getByText('objective')).toBeInTheDocument();

    await user.click(within(card).getByText('Why this was flagged'));
    expect(within(card).getByText(/Nothing can fill it in/)).toBeInTheDocument();
    expect(within(card).getByText(/Add a variable named/)).toBeInTheDocument();
  });

  it('sends the caller to the field a finding names', async () => {
    const user = userEvent.setup();
    const { onOpenPath } = renderPanel({ document: documentWith({ role: '' }) });

    await user.click(screen.getAllByRole('button', { name: 'Go to the field' })[0]!);

    expect(onOpenPath).toHaveBeenCalledTimes(1);
    expect(onOpenPath.mock.calls[0]?.[0]).toBe('role');
  });

  it('filters by severity and by rule kind, and offers a way back', async () => {
    const user = userEvent.setup();
    renderPanel({ document: documentWith({ role: '', objective: '' }) });

    await user.selectOptions(screen.getByLabelText('Filter by severity'), 'info');
    expect(screen.getByRole('heading', { name: 'Suggestions' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Errors' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by rule kind'), 'deterministic');
    expect(screen.getByText(/No finding matches these filters/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(screen.getByRole('heading', { name: 'Errors' })).toBeInTheDocument();
  });

  it('dismisses a finding with a reason and keeps it out of the list', async () => {
    const user = userEvent.setup();
    renderPanel({ document: documentWith({ role: '', examples: [] }) });

    expect(screen.getAllByRole('article')).toHaveLength(2);
    await dismissFinding(user, 'No role is given', 'This prompt is deliberately voice-neutral.');

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByText('No role is given')).not.toBeInTheDocument();
    expect(screen.getByText('There is no worked example')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/1 dismissed/);

    // The reason was written to this browser, for this prompt only.
    const stored = window.localStorage.getItem(dismissalStorageKey('p-1'));
    expect(stored).toContain('deliberately voice-neutral');
    expect(window.localStorage.getItem(dismissalStorageKey('p-2'))).toBeNull();
  });

  it('requires a reason before it stores a dismissal', async () => {
    const user = userEvent.setup();
    renderPanel({ document: documentWith({ role: '', examples: [] }) });

    await user.click(screen.getAllByRole('button', { name: 'Dismiss…' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Dismiss the finding' }));

    expect(within(dialog).getByText(/Give a reason of at least 3 characters/)).toBeInTheDocument();
    expect(window.localStorage.getItem(dismissalStorageKey('p-1'))).toBeNull();
  });

  it('shows the dismissed findings with their reasons, and restores one', async () => {
    const user = userEvent.setup();
    renderPanel({ document: documentWith({ role: '', examples: [] }) });

    await dismissFinding(user, 'No role is given', 'Deliberately voice-neutral.');
    await user.click(screen.getByRole('button', { name: /Dismissed/ }));

    const section = screen.getByRole('region', { name: 'Dismissed' });
    expect(within(section).getByText('“Deliberately voice-neutral.”')).toBeInTheDocument();
    expect(within(section).getByText(/tied to the exact content/)).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Restore' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(window.localStorage.getItem(dismissalStorageKey('p-1'))).toBeNull();
  });

  it('brings a dismissed finding back when the text it named changes', async () => {
    const user = userEvent.setup();
    const long = 'a'.repeat(420);

    function Screen({ instructions }: { instructions: string[] }) {
      return (
        <MemoryRouter>
          <ToastProvider>
            <Harness document={documentWith({ role: 'Support lead', instructions })} />
          </ToastProvider>
        </MemoryRouter>
      );
    }

    const { rerender } = render(<Screen instructions={[long]} />);
    await dismissFinding(
      user,
      'Instruction 1 is past 400 characters',
      'The specification is meant to be long.',
    );

    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('Every finding is dismissed')).toBeInTheDocument();

    rerender(<Screen instructions={[`Edited: ${long}`]} />);

    expect(screen.getByText(/Some dismissals no longer match/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Instruction 1 is past 400 characters')).toBeInTheDocument();
  });

  it('states the thresholds and lists every rule it ran', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText(/The 15 rules and their thresholds/));

    const text = document.body.textContent ?? '';
    expect(text).toContain('objective 800');
    expect(text).toContain('whole document 8,000 characters');
    expect(screen.getByText('oversized-content')).toBeInTheDocument();
    expect(screen.getByText(/they never run it and never rewrite it/)).toBeInTheDocument();
  });

  it('says which checks did not run, and why', async () => {
    const user = userEvent.setup();
    const report = inspectQuality({ document: documentWith(), record: { description: 'Sorts.' } });

    render(
      <MemoryRouter>
        <ToastProvider>
          <QualityPanel
            report={report}
            promptId="p-1"
            dismissals={unavailableDismissals()}
            onOpenPath={vi.fn()}
          />
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByText(/checks did not run/, { selector: 'summary' }));

    expect(screen.getByText(/The snippet library was not supplied/)).toBeInTheDocument();
    expect(screen.getByText(/Stored schema ids were not supplied/)).toBeInTheDocument();
    expect(screen.getByText(/The raw draft text was not supplied/)).toBeInTheDocument();
  });

  it('says so when the browser refuses to store a dismissal', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key.includes('dismissals')) throw new Error('QuotaExceededError');
    });

    try {
      renderPanel({ document: documentWith({ role: '', examples: [] }) });

      await user.click(screen.getAllByRole('button', { name: 'Dismiss…' })[0]!);
      const dialog = await screen.findByRole('dialog');
      await user.type(
        within(dialog).getByLabelText(/Why is it acceptable\?/),
        'Deliberately voice-neutral.',
      );
      await user.click(within(dialog).getByRole('button', { name: 'Dismiss the finding' }));

      // The dialog stays open and says the write failed; nothing was stored.
      expect(
        within(dialog).getByText(/This browser refused to store the dismissal/),
      ).toBeInTheDocument();
      expect(window.localStorage.getItem(dismissalStorageKey('p-1'))).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('reports repeated JSON keys from the draft text', () => {
    renderPanel({
      document: documentWith({ role: 'Support lead' }),
      rawText: '{"name":"Support triage","metadata":{"notes":"a","notes":"b"}}',
    });

    expect(screen.getByText('“notes” appears twice in one object')).toBeInTheDocument();
    expect(screen.getByText('metadata.notes')).toBeInTheDocument();
  });

  it('labels a record-level finding as outside the document', () => {
    renderPanel({ document: documentWith({ role: 'Support lead' }), description: '   ' });

    const card = screen.getByRole('article');
    expect(within(card).getByText('The prompt has no description')).toBeInTheDocument();
    expect(within(card).getByText('description')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Go to the field' })).not.toBeInTheDocument();
  });
});
