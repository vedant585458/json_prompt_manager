import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createPromptSchema, createSnippet, createTemplate } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import type { PromptDocument, PromptSchema, Snippet } from '@/domain/types';
import { BlueprintPanel } from '@/features/blueprint/BlueprintPanel';

const NOW = new Date('2026-10-24T09:00:00.000Z');

/** The drawing itself, not the icons inside buttons. */
function drawing(): Element | null {
  return document.querySelector('[data-blueprint-graph="true"]');
}

function deps(prefix: string) {
  let counter = 0;
  return { now: () => NOW, newId: () => `${prefix}-${++counter}` };
}

function documentWith(overrides: Partial<PromptDocument> = {}): PromptDocument {
  return createBlankDocument({
    name: 'Support triage',
    role: 'Support lead',
    objective: 'Queue the {{ticket}} for {{team}}.',
    instructions: ['Read the ticket.', 'Return the queue.'],
    constraints: ['Never invent a value.'],
    variables: [
      { name: 'ticket', type: 'string', required: true },
      { name: 'team', type: 'string', required: true, defaultValue: 'general' },
    ],
    output: { format: 'json' },
    ...overrides,
  });
}

function screenshot(overrides: {
  document?: PromptDocument;
  attachedSchema?: PromptSchema | null;
  attachedSchemaId?: string | null;
  snippets?: readonly Snippet[];
  metadata?: Readonly<Record<string, string>>;
  onOpenPath?: (path: string) => void;
}) {
  const onOpenPath = overrides.onOpenPath ?? vi.fn();

  render(
    <MemoryRouter>
      <BlueprintPanel
        document={overrides.document ?? documentWith()}
        promptId="p-1"
        attachedSchema={overrides.attachedSchema ?? null}
        attachedSchemaId={overrides.attachedSchemaId ?? null}
        snippets={overrides.snippets ?? []}
        templates={[]}
        metadata={overrides.metadata ?? {}}
        onOpenPath={onOpenPath}
      />
    </MemoryRouter>,
  );

  return { onOpenPath };
}

describe('blueprint panel', () => {
  it('summarises what it drew and offers both representations', () => {
    screenshot({});

    expect(screen.getByRole('heading', { name: 'Blueprint' })).toBeInTheDocument();
    expect(
      screen.getByText(/2 inputs, 5 sections, 1 output node\. Derived from the draft/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Graph/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /List/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides the drawing from assistive technology but lists every node as a button', () => {
    screenshot({});

    expect(drawing()).not.toBeNull();

    const list = screen.getByRole('region', { name: /Inputs/ });
    expect(within(list).getByRole('button', { name: /ticket/ })).toBeInTheDocument();
  });

  it('switches to the list view, which keeps the same nodes', async () => {
    const user = userEvent.setup();
    screenshot({});

    await user.click(screen.getByRole('button', { name: /List/ }));

    expect(screen.getByRole('button', { name: /List/ })).toHaveAttribute('aria-pressed', 'true');
    expect(drawing()).toBeNull();
    expect(screen.getByRole('button', { name: /ticket/ })).toBeInTheDocument();
    // The legend belongs to the drawing; the list labels each kind inline.
    expect(screen.queryByRole('heading', { name: 'Legend' })).not.toBeInTheDocument();
  });

  it('shows the details of the selected node and jumps to the field it names', async () => {
    const user = userEvent.setup();
    const { onOpenPath } = screenshot({});

    await user.click(screen.getByRole('button', { name: /Objective/ }));

    expect(screen.getByRole('heading', { name: 'Objective', level: 3 })).toBeInTheDocument();
    expect(screen.getAllByText(/^\d+ characters$/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Jump to “Objective” in the editor/ }));
    expect(onOpenPath).toHaveBeenCalledWith('objective');
  });

  it('marks an unresolved reference in words as well as with an icon', () => {
    screenshot({ document: documentWith({ objective: 'Queue the {{ghost}}.' }) });

    expect(screen.getByText('1 unresolved')).toBeInTheDocument();

    const list = screen.getByRole('region', { name: /Inputs/ });
    const ghost = within(list).getByRole('button', { name: /ghost/ });
    expect(within(ghost).getAllByText('Unresolved').length).toBeGreaterThan(0);
    expect(within(ghost).getByText('not declared')).toBeInTheDocument();
  });

  it('explains an unresolved node and links to where it can be fixed', async () => {
    const user = userEvent.setup();
    screenshot({ document: documentWith({ includes: ['gone'] }) });

    const list = screen.getByRole('region', { name: /Inputs/ });
    await user.click(within(list).getByRole('button', { name: /Missing snippet/ }));

    expect(screen.getByText('What needs fixing')).toBeInTheDocument();
    expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /the snippet library/ })).toHaveAttribute(
      'href',
      '/prompts/p-1/compose',
    );
  });

  it('links a variable to the playground and a schema to validation', async () => {
    const user = userEvent.setup();
    const schema = createPromptSchema(
      { name: 'Triage schema', schemaContent: { type: 'object' } },
      deps('schema'),
    );
    screenshot({ attachedSchema: schema, attachedSchemaId: schema.id });

    await user.click(screen.getByRole('button', { name: /ticket/ }));
    expect(screen.getByRole('link', { name: /the playground/ })).toHaveAttribute(
      'href',
      '/prompts/p-1/playground',
    );

    await user.click(screen.getByRole('button', { name: /Triage schema/ }));
    expect(screen.getByRole('link', { name: /the validation studio/ })).toHaveAttribute(
      'href',
      '/validation?prompt=p-1',
    );
  });

  it('links a snippet to the composer where snippets live', async () => {
    const user = userEvent.setup();
    const snippet = createSnippet(
      {
        name: 'Tone rules',
        description: 'How to sound.',
        targetPath: 'instructions',
        value: ['Be brief.'],
      },
      deps('snippet'),
    );
    screenshot({ document: documentWith({ includes: [snippet.id] }), snippets: [snippet] });

    await user.click(screen.getByRole('button', { name: /Tone rules/ }));
    expect(screen.getByRole('link', { name: /the snippet library/ })).toHaveAttribute(
      'href',
      '/prompts/p-1/compose',
    );
  });

  it('records the template origin when the metadata names one', async () => {
    const user = userEvent.setup();
    const template = createTemplate(
      { name: 'Support blueprint', content: documentWith() },
      deps('template'),
    );

    render(
      <MemoryRouter>
        <BlueprintPanel
          document={documentWith()}
          promptId="p-1"
          attachedSchema={null}
          attachedSchemaId={null}
          snippets={[]}
          templates={[template]}
          metadata={{ templateId: template.id }}
          onOpenPath={vi.fn()}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Support blueprint/ }));
    expect(screen.getByRole('link', { name: /the templates/ })).toHaveAttribute(
      'href',
      '/templates',
    );
  });

  it('suppresses a simple blueprint but offers to draw it anyway', async () => {
    const user = userEvent.setup();
    screenshot({
      document: documentWith({
        role: '',
        objective: '',
        instructions: [],
        constraints: [],
        variables: [],
      }),
    });

    expect(screen.getByText('This prompt is simple — no blueprint needed')).toBeInTheDocument();
    expect(drawing()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'View the blueprint anyway' }));
    expect(screen.getByRole('heading', { name: 'Blueprint' })).toBeInTheDocument();
    expect(drawing()).not.toBeNull();
  });

  it('zooms the drawing in bounded steps and says the current scale', async () => {
    const user = userEvent.setup();
    screenshot({});

    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });

    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.click(zoomIn);
    expect(screen.getByText('115%')).toBeInTheDocument();
    expect(zoomIn).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeDisabled();

    // The bottom of the range disables the control instead of silently clamping.
    for (let index = 0; index < 4; index += 1) await user.click(zoomOut);
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(zoomOut).toBeDisabled();
  });

  it('keeps the list usable when a node is selected from it', async () => {
    const user = userEvent.setup();
    screenshot({});

    const list = screen.getByRole('region', { name: /Structure/ });
    const row = within(list).getByRole('button', { name: /Instructions/ });
    await user.click(row);

    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Instructions', level: 3 })).toBeInTheDocument();
  });
});
