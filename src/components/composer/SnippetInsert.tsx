import { useState } from 'react';

import { Button, Field, Select } from '@/components/ui';
import {
  SNIPPET_TARGETS,
  defaultSnippetTarget,
  snippetValueFits,
  type SnippetTargetId,
} from '@/domain/composer';
import type { Snippet } from '@/domain/types';

export interface SnippetInsertProps {
  readonly snippets: readonly Snippet[];
  /** Applies the insert; returns the sentence the panel should show. */
  readonly onInsert: (snippet: Snippet, target: SnippetTargetId) => string;
  readonly disabled?: boolean;
}

/**
 * Insert a stored snippet into a chosen section (TASK-017).
 *
 * The target defaults to the section the snippet was written for, and the Insert
 * button is disabled when the snippet's value does not fit the chosen section —
 * no click that would quietly do nothing. The panel reports what actually
 * happened ("Replaced…", "Added…", "already present").
 */
export function SnippetInsert({ snippets, onInsert, disabled = false }: SnippetInsertProps) {
  const [snippetId, setSnippetId] = useState('');
  const [target, setTarget] = useState<SnippetTargetId>('instructions');
  const [message, setMessage] = useState<string | null>(null);

  const snippet = snippets.find((candidate) => candidate.id === snippetId) ?? null;
  const targetDefinition = SNIPPET_TARGETS.find((candidate) => candidate.id === target) ?? null;
  const fits =
    snippet && targetDefinition ? snippetValueFits(targetDefinition, snippet.value) : false;

  function chooseSnippet(nextId: string) {
    setSnippetId(nextId);
    setMessage(null);
    const chosen = snippets.find((candidate) => candidate.id === nextId);
    if (chosen) setTarget(defaultSnippetTarget(chosen));
  }

  function insert() {
    if (!snippet) return;
    setMessage(onInsert(snippet, target));
  }

  return (
    <section
      aria-label="Insert a snippet"
      className="space-y-2 rounded-md border border-dashed border-line bg-surface-1 p-3"
    >
      <div>
        <h2 className="text-xs font-medium tracking-wide text-ink uppercase">Insert a snippet</h2>
        <p className="text-2xs text-ink-muted">
          Snippets are reusable fragments stored in this browser. Text fields are replaced; list
          fields gain the entries they do not already have. The document records the snippet it
          uses.
        </p>
      </div>

      {snippets.length === 0 ? (
        <p className="text-2xs text-ink-muted">
          No snippets are stored here yet, so there is nothing to insert.
        </p>
      ) : (
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Snippet">
            {(control) => (
              <Select
                {...control}
                value={snippetId}
                disabled={disabled}
                placeholder="Choose a snippet"
                options={snippets.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                }))}
                onChange={(event) => chooseSnippet(event.target.value)}
              />
            )}
          </Field>

          <Field label="Into">
            {(control) => (
              <Select
                {...control}
                value={target}
                disabled={disabled}
                options={SNIPPET_TARGETS.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.label,
                }))}
                onChange={(event) => {
                  setTarget(event.target.value as SnippetTargetId);
                  setMessage(null);
                }}
              />
            )}
          </Field>

          <Button variant="secondary" disabled={disabled || !fits} onClick={insert}>
            Insert
          </Button>
        </div>
      )}

      {snippet && !fits ? (
        <p className="text-2xs text-warning">
          “{snippet.name}” does not fit {targetDefinition?.label.toLowerCase() ?? 'that section'};
          choose another section or edit the snippet.
        </p>
      ) : null}

      {snippet?.description ? (
        <p className="text-2xs text-ink-muted">{snippet.description}</p>
      ) : null}

      <p role="status" className="text-2xs text-ink-secondary">
        {message ?? ''}
      </p>
    </section>
  );
}
