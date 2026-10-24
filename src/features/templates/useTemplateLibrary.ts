/**
 * Template library actions (TASK-018).
 *
 * Every operation returns an **outcome** rather than throwing or leaving the
 * caller to read a stale `error` field: the templates screen can await a save
 * and immediately know whether it landed and why it did not. That matters most
 * for the dialog, which must keep the user's typed text on screen while showing
 * the reason the write was refused.
 *
 * The store still rethrows, so this hook is a thin, uniform wrapper — the rules
 * themselves (immutability, name uniqueness, document validity) live in
 * `src/domain/templates.ts` and `src/store/dataStore.ts`.
 */

import { useCallback, useState } from 'react';

import type { Prompt, PromptDocument, PromptTemplate } from '@/domain/types';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { describeDataError } from '@/store/dataStore';

export interface TemplateWriteInput {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly content: PromptDocument;
}

export interface TemplateFromPromptInput {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
}

export interface TemplateEditInput {
  readonly name?: string;
  readonly description?: string;
  readonly category?: string;
}

/** Result of a template operation: either the stored value or a readable reason. */
export type TemplateOutcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export interface TemplateLibrary {
  readonly templates: readonly PromptTemplate[];
  readonly busy: boolean;
  readonly createTemplate: (input: TemplateWriteInput) => Promise<TemplateOutcome<PromptTemplate>>;
  readonly createFromPrompt: (
    promptId: string,
    input: TemplateFromPromptInput,
  ) => Promise<TemplateOutcome<PromptTemplate>>;
  readonly updateTemplate: (
    id: string,
    input: TemplateEditInput,
  ) => Promise<TemplateOutcome<PromptTemplate>>;
  readonly duplicateTemplate: (
    id: string,
    input?: TemplateEditInput,
  ) => Promise<TemplateOutcome<PromptTemplate>>;
  readonly deleteTemplate: (id: string) => Promise<TemplateOutcome<PromptTemplate>>;
  readonly useTemplate: (id: string, title?: string) => Promise<TemplateOutcome<Prompt>>;
}

export function useTemplateLibrary(): TemplateLibrary {
  const store = useDataStoreApi();
  const templates = store((state) => state.templates);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T>(task: () => Promise<T>): Promise<TemplateOutcome<T>> => {
    setBusy(true);
    try {
      return { ok: true, value: await task() };
    } catch (caught) {
      return { ok: false, error: describeDataError(caught) };
    } finally {
      setBusy(false);
    }
  }, []);

  const createTemplate = useCallback(
    (input: TemplateWriteInput) => run(() => store.getState().createTemplate(input)),
    [run, store],
  );

  const createFromPrompt = useCallback(
    (promptId: string, input: TemplateFromPromptInput) =>
      run(() => store.getState().createTemplateFromPrompt(promptId, input)),
    [run, store],
  );

  const updateTemplate = useCallback(
    (id: string, input: TemplateEditInput) => run(() => store.getState().updateTemplate(id, input)),
    [run, store],
  );

  const duplicateTemplate = useCallback(
    (id: string, input?: TemplateEditInput) =>
      run(() => store.getState().duplicateTemplate(id, input)),
    [run, store],
  );

  const deleteTemplate = useCallback(
    (id: string) => run(() => store.getState().deleteTemplate(id)),
    [run, store],
  );

  const useTemplate = useCallback(
    (id: string, title?: string) =>
      run(() => store.getState().useTemplate(id, title ? { title } : {})),
    [run, store],
  );

  return {
    templates,
    busy,
    createTemplate,
    createFromPrompt,
    updateTemplate,
    duplicateTemplate,
    deleteTemplate,
    useTemplate,
  };
}
