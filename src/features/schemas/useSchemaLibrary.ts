/**
 * Schema library actions (TASK-016).
 *
 * The validation studio, the editor, and the create-prompt dialog all need to
 * create, edit, attach, and delete schemas. Keeping that in one hook means the
 * activity-free, atomic behaviour of the store's schema mutations (detach before
 * delete) is used the same way everywhere.
 */

import { useCallback, useState } from 'react';

import type { JsonObject, Prompt, PromptSchema } from '@/domain/types';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { describeDataError } from '@/store/dataStore';

export interface SchemaWriteInput {
  readonly name: string;
  readonly description: string;
  readonly schemaContent: JsonObject;
}

export interface SchemaLibrary {
  readonly schemas: readonly PromptSchema[];
  readonly busy: boolean;
  readonly error: string | null;
  readonly createSchema: (input: SchemaWriteInput) => Promise<PromptSchema | null>;
  readonly updateSchema: (id: string, input: SchemaWriteInput) => Promise<PromptSchema | null>;
  /** Deletes and detaches; reports how many prompts lost the reference. */
  readonly deleteSchema: (id: string) => Promise<{ readonly detached: number } | null>;
  readonly attachSchema: (promptId: string, schemaId: string | null) => Promise<Prompt | null>;
  readonly clearError: () => void;
}

export function useSchemaLibrary(): SchemaLibrary {
  const store = useDataStoreApi();
  const schemas = store((state) => state.schemas);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(task: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await task();
    } catch (caught) {
      setError(describeDataError(caught));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const createSchema = useCallback(
    (input: SchemaWriteInput) => run(() => store.getState().addSchema(input)),
    [run, store],
  );

  const updateSchema = useCallback(
    (id: string, input: SchemaWriteInput) =>
      run(() =>
        store.getState().updateSchema(id, {
          name: input.name,
          description: input.description,
          schemaContent: input.schemaContent,
        }),
      ),
    [run, store],
  );

  const deleteSchema = useCallback(
    (id: string) =>
      run(async () => {
        const result = await store.getState().deleteSchema(id);
        return { detached: result.detachedPrompts };
      }),
    [run, store],
  );

  const attachSchema = useCallback(
    (promptId: string, schemaId: string | null) =>
      run(() => store.getState().setPromptSchema(promptId, schemaId)),
    [run, store],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    schemas,
    busy,
    error,
    createSchema,
    updateSchema,
    deleteSchema,
    attachSchema,
    clearError,
  };
}
