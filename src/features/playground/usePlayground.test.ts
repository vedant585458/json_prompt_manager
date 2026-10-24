import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBlankDocument } from '@/domain/promptDocument';
import type { PromptDocument } from '@/domain/types';
import {
  PLAYGROUND_DEBOUNCE_MS,
  usePlayground,
  type UsePlaygroundOptions,
} from '@/features/playground/usePlayground';
import { playgroundStorageKey } from '@/features/playground/valuesStorage';

const IMMEDIATE: UsePlaygroundOptions = { storage: null, debounceMs: 0 };

afterEach(() => {
  vi.useRealTimers();
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

function documentWithVariables(overrides: {
  readonly variables?: PromptDocument['variables'];
  readonly objective?: string;
}): PromptDocument {
  const base = createBlankDocument({
    name: 'Ticket triage',
    role: 'Support lead',
    objective: overrides.objective ?? 'Queue the {{ticket}} for {{team}}.',
    instructions: ['Read the ticket body.'],
    constraints: ['Never invent a value.'],
    variables: overrides.variables ?? [
      { name: 'ticket', type: 'string', required: true },
      { name: 'team', type: 'string', required: true, defaultValue: 'general' },
    ],
  });
  return base;
}

describe('usePlayground', () => {
  it('prefills declared defaults and renders them without any typing', () => {
    const document = documentWithVariables({});
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    expect(result.current.inputs).toEqual({ ticket: '', team: 'general' });
    // The required ticket is blank, so the preview is blocked rather than
    // shipping a prompt with a hole in it.
    expect(result.current.rendered.blocked).toBe(true);
    expect(result.current.rendered.missing).toEqual(['ticket']);
    expect(result.current.rendered.issues).toContainEqual(
      expect.objectContaining({ code: 'missing-required', name: 'ticket', severity: 'error' }),
    );
  });

  it('substitutes values once every required variable is answered', () => {
    const document = documentWithVariables({});
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    act(() => result.current.setInput('ticket', 'Billing question'));

    expect(result.current.rendered.blocked).toBe(false);
    expect(result.current.rendered.text).toBe(
      [
        'ROLE',
        'Support lead',
        '',
        'OBJECTIVE',
        'Queue the Billing question for general.',
        '',
        'INSTRUCTIONS',
        '1. Read the ticket body.',
        '',
        'CONSTRAINTS',
        '- Never invent a value.',
      ].join('\n'),
    );
    expect(result.current.rendered.characters).toBe(result.current.rendered.text.length);
  });

  it('treats a blank string field as unanswered instead of substituting nothing', () => {
    const document = documentWithVariables({
      variables: [
        { name: 'ticket', type: 'string', required: false },
        { name: 'team', type: 'string', required: true, defaultValue: 'general' },
      ],
    });
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    // Optional and blank: the placeholder stays visible and is reported.
    expect(result.current.rendered.blocked).toBe(false);
    expect(result.current.rendered.text).toContain('Queue the {{ticket}} for general.');
    expect(result.current.rendered.issues).toContainEqual(
      expect.objectContaining({ code: 'missing-optional', name: 'ticket', severity: 'warning' }),
    );

    act(() => result.current.setInput('ticket', '   '));
    expect(result.current.rendered.text).toContain('{{ticket}}');
  });

  it('reports an invalid field and keeps the last good text out of the preview', () => {
    const document = documentWithVariables({
      objective: 'Spend no more than {{budget}} rupees on {{team}}.',
      variables: [
        { name: 'budget', type: 'number', required: true },
        { name: 'team', type: 'string', required: true, defaultValue: 'general' },
      ],
    });
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    act(() => result.current.setInput('budget', '12.5'));
    expect(result.current.rendered.text).toContain('Spend no more than 12.5 rupees');

    act(() => result.current.setInput('budget', '12,5'));
    expect(result.current.parsed.budget).toEqual({
      state: 'invalid',
      error: 'Enter a number, for example 42 or 3.5.',
    });
    // The invalid text is not a value, so the render is blocked rather than
    // showing 12.5 as though it were what the field says.
    expect(result.current.rendered.blocked).toBe(true);
  });

  it('renders JSON compactly and rejects malformed JSON with a position', () => {
    const document = documentWithVariables({
      objective: 'Answer using {{payload}}.',
      variables: [{ name: 'payload', type: 'json', required: true }],
    });
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    act(() => result.current.setInput('payload', '{\n  "id": 7,\n  "ok": true\n}'));
    expect(result.current.rendered.text).toContain('Answer using {"id":7,"ok":true}.');

    act(() => result.current.setInput('payload', '{"id": }'));
    expect(result.current.parsed.payload?.state).toBe('invalid');
    expect(result.current.rendered.blocked).toBe(true);
  });

  it('resets one variable and all of them to their defaults', () => {
    const document = documentWithVariables({});
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    act(() => result.current.setInput('ticket', 'Typed'));
    act(() => result.current.setInput('team', 'billing'));
    expect(result.current.inputs).toEqual({ ticket: 'Typed', team: 'billing' });

    act(() => result.current.resetVariable('team'));
    expect(result.current.inputs).toEqual({ ticket: 'Typed', team: 'general' });

    act(() => result.current.resetAll());
    expect(result.current.inputs).toEqual({ ticket: '', team: 'general' });
  });

  it('reports unused declarations, undeclared references, and unusable placeholders', () => {
    const document = documentWithVariables({
      objective: 'Queue the {{ticket}} for {{ghost}} using {{#each items}}.',
      variables: [
        { name: 'ticket', type: 'string', required: true },
        { name: 'unused', type: 'string', required: false },
      ],
    });
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    expect(result.current.reconciliation.unused.map((variable) => variable.name)).toEqual([
      'unused',
    ]);
    expect(result.current.reconciliation.undeclared.map((entry) => entry.name)).toEqual(['ghost']);
    expect(result.current.scan.problems).toHaveLength(1);
    expect(result.current.rendered.issues).toContainEqual(
      expect.objectContaining({ code: 'undeclared', name: 'ghost', severity: 'warning' }),
    );
  });

  it('holds the preview back until the debounce settles, then catches up in one pass', () => {
    vi.useFakeTimers();
    const document = documentWithVariables({});
    const { result } = renderHook(() =>
      usePlayground('p1', document, { storage: null, debounceMs: PLAYGROUND_DEBOUNCE_MS }),
    );

    act(() => result.current.setInput('ticket', 'Billing'));
    expect(result.current.pending).toBe(true);
    // The field shows the new text immediately; only the derived preview waits.
    expect(result.current.inputs.ticket).toBe('Billing');
    expect(result.current.rendered.blocked).toBe(true);

    act(() => {
      vi.advanceTimersByTime(PLAYGROUND_DEBOUNCE_MS - 1);
    });
    expect(result.current.pending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.rendered.blocked).toBe(false);
    expect(result.current.rendered.text).toContain('Queue the Billing for general.');
  });

  it('keeps inputs in this tab and reads them back for the same prompt only', () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const document = documentWithVariables({});
    const first = renderHook(() => usePlayground('p1', document, { storage, debounceMs: 0 }));

    act(() => first.result.current.setInput('ticket', 'Kept in this tab'));
    expect(first.result.current.persisted).toBe(false);

    // Persistence is delayed; run the timer the hook scheduled.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(first.result.current.persisted).toBe(true);
    expect(storage.getItem(playgroundStorageKey('p1'))).toContain('Kept in this tab');
    first.unmount();

    const again = renderHook(() => usePlayground('p1', document, { storage, debounceMs: 0 }));
    expect(again.result.current.restored).toBe(true);
    expect(again.result.current.inputs.ticket).toBe('Kept in this tab');
    again.unmount();

    const other = renderHook(() => usePlayground('p2', document, { storage, debounceMs: 0 }));
    expect(other.result.current.restored).toBe(false);
    expect(other.result.current.inputs.ticket).toBe('');
  });

  it('drops restored text for variables the document no longer declares', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      playgroundStorageKey('p1'),
      JSON.stringify({
        promptId: 'p1',
        savedAt: '2026-10-24T09:00:00.000Z',
        values: { ticket: 'Restored', removed: 'stale' },
      }),
    );

    const { result } = renderHook(() =>
      usePlayground('p1', documentWithVariables({}), { storage, debounceMs: 0 }),
    );

    expect(result.current.inputs).toEqual({ ticket: 'Restored', team: 'general' });
    expect(result.current.values).toEqual({ ticket: 'Restored', team: 'general' });
  });

  it('never touches storage when persistence is disabled', () => {
    vi.useFakeTimers();
    const document = documentWithVariables({});
    const { result } = renderHook(() => usePlayground('p1', document, IMMEDIATE));

    act(() => result.current.setInput('ticket', 'Local only'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.persisted).toBe(false);
    expect(result.current.restored).toBe(false);
    expect(result.current.inputs.ticket).toBe('Local only');
  });

  it('keeps existing answers when the document gains a variable', () => {
    const before = createBlankDocument({
      name: 'Ticket triage',
      role: 'Support lead',
      objective: 'Queue {{ticket}}.',
      instructions: ['Read the ticket.'],
      variables: [{ name: 'ticket', type: 'string', required: true }],
    });
    const after = createBlankDocument({
      name: 'Ticket triage',
      role: 'Support lead',
      objective: 'Queue {{ticket}} for {{team}}.',
      instructions: ['Read the ticket.'],
      variables: [
        { name: 'ticket', type: 'string', required: true },
        { name: 'team', type: 'string', required: true, defaultValue: 'general' },
      ],
    });

    const { result, rerender } = renderHook(
      ({ document }: { readonly document: PromptDocument }) =>
        usePlayground('p1', document, IMMEDIATE),
      { initialProps: { document: before } },
    );

    act(() => result.current.setInput('ticket', 'Billing'));
    rerender({ document: after });

    expect(result.current.inputs).toEqual({ ticket: 'Billing', team: 'general' });
    expect(result.current.rendered.text).toContain('Queue Billing for general.');
  });
});
