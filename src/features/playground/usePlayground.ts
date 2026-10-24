/**
 * Playground state (TASK-021).
 *
 * The form holds text; the domain holds meaning. This hook is the seam: it
 * parses each field into a typed value, applies defaults, renders the document,
 * and remembers the inputs for this tab. Debouncing happens here rather than in
 * the components, so the preview, the errors, and the character count always
 * describe the same inputs — a preview that lags its own error message would be
 * worse than one that lags both.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { renderPrompt, type RenderedPrompt } from '@/domain/render';
import type { JsonValue, PromptDocument, VariableDefinition } from '@/domain/types';
import {
  extractVariableReferences,
  formatVariableInput,
  parseVariableInput,
  reconcileVariables,
  type ReferenceScan,
  type VariableInputState,
  type VariableReconciliation,
} from '@/domain/variables';
import {
  canUsePlaygroundStorage,
  readPlaygroundValues,
  writePlaygroundValues,
} from '@/features/playground/valuesStorage';

export const PLAYGROUND_DEBOUNCE_MS = 150;
const STORAGE_WRITE_DELAY_MS = 300;

export interface Playground {
  readonly variables: readonly VariableDefinition[];
  /** Raw text exactly as typed, per variable name. */
  readonly inputs: Readonly<Record<string, string>>;
  readonly parsed: Readonly<Record<string, VariableInputState>>;
  /** Values that parsed successfully; defaults are applied by the renderer. */
  readonly values: Readonly<Record<string, JsonValue>>;
  readonly rendered: RenderedPrompt;
  readonly scan: ReferenceScan;
  readonly reconciliation: VariableReconciliation;
  /** True while a debounced pass is still pending. */
  readonly pending: boolean;
  /** True when inputs are being kept in this tab. */
  readonly persisted: boolean;
  /** True when inputs came back from an earlier visit to this tab. */
  readonly restored: boolean;
  readonly setInput: (name: string, raw: string) => void;
  readonly resetVariable: (name: string) => void;
  readonly resetAll: () => void;
}

function initialRaw(variable: VariableDefinition): string {
  return variable.defaultValue === undefined
    ? ''
    : formatVariableInput(variable, variable.defaultValue);
}

function variablesKey(variables: readonly VariableDefinition[]): string {
  return variables
    .map(
      (variable) =>
        `${variable.name}:${variable.type}:${String(variable.required)}:${JSON.stringify(
          variable.defaultValue ?? null,
        )}`,
    )
    .join('|');
}

/** Storage-restored text, filtered to variables that still exist. */
function restoredInputs(
  promptId: string,
  variables: readonly VariableDefinition[],
  storage: Storage | null | undefined,
): { readonly inputs: Record<string, string>; readonly savedAt: string | null } {
  const stored = readPlaygroundValues(promptId, storage);
  if (!stored) return { inputs: {}, savedAt: null };

  const inputs: Record<string, string> = {};
  for (const variable of variables) {
    const value = stored.values[variable.name];
    if (typeof value === 'string') inputs[variable.name] = value;
  }

  return { inputs, savedAt: stored.savedAt };
}

function isSame(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

export interface UsePlaygroundOptions {
  /** Storage override for tests; `null` disables persistence. */
  readonly storage?: Storage | null;
  readonly debounceMs?: number;
}

export function usePlayground(
  promptId: string,
  document: PromptDocument,
  options: UsePlaygroundOptions = {},
): Playground {
  const debounceMs = options.debounceMs ?? PLAYGROUND_DEBOUNCE_MS;
  const storage = options.storage;
  const variables = document.variables;
  const key = variablesKey(variables);

  const [canPersist] = useState(() => canUsePlaygroundStorage(storage));
  const [restored] = useState(() => restoredInputs(promptId, variables, storage));

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const variable of variables) {
      initial[variable.name] = restored.inputs[variable.name] ?? initialRaw(variable);
    }
    return initial;
  });

  const [persisted, setPersisted] = useState(() => Object.keys(restored.inputs).length > 0);
  const [debounced, setDebounced] = useState(inputs);
  const pending = !isSame(debounced, inputs);

  // The debounce keeps a fast typist from re-rendering on every keystroke; the
  // inputs themselves are never delayed or discarded.
  useEffect(() => {
    if (debounceMs <= 0) {
      setDebounced(inputs);
      return;
    }

    const timer = setTimeout(() => setDebounced(inputs), debounceMs);
    return () => clearTimeout(timer);
  }, [inputs, debounceMs]);

  // When the document's variables change (the editor tab follows a draft), keep
  // what still applies and fill in what is new, so no field is left nameless.
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;

    setInputs((current) => {
      const next: Record<string, string> = {};
      for (const variable of variables) {
        next[variable.name] = current[variable.name] ?? initialRaw(variable);
      }
      return isSame(next, current) ? current : next;
    });
  }, [key, variables]);

  // Persist after the user stops typing, and never claim success the storage
  // layer did not give.
  useEffect(() => {
    if (!canPersist) return;

    const timer = setTimeout(() => {
      const written = writePlaygroundValues(promptId, debounced, storage);
      if (written) setPersisted(true);
    }, STORAGE_WRITE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [debounced, canPersist, promptId, storage]);

  const parsed = useMemo(() => {
    const result: Record<string, VariableInputState> = {};
    for (const variable of variables) {
      result[variable.name] = parseVariableInput(variable, debounced[variable.name] ?? '');
    }
    return result;
  }, [variables, debounced]);

  // A blank field is an unanswered question for every type, string included.
  // Substituting `''` would make a required value vanish without a word and let
  // an optional placeholder disappear instead of staying visible, so the blank
  // case is left to the renderer: it blocks the render for a required variable
  // and names the placeholder for an optional one. An empty *default* still
  // works, because defaults are applied by the renderer, not by the form.
  const values = useMemo(() => {
    const result: Record<string, JsonValue> = {};
    for (const variable of variables) {
      const state = parsed[variable.name];
      if (state?.state !== 'value') continue;
      if (typeof state.value === 'string' && state.value.trim().length === 0) continue;
      result[variable.name] = state.value;
    }
    return result;
  }, [variables, parsed]);

  const rendered = useMemo(() => renderPrompt(document, values), [document, values]);

  const scan = useMemo(() => extractVariableReferences(document), [document]);
  const reconciliation = useMemo(
    () => reconcileVariables(variables, scan.references),
    [variables, scan],
  );

  const setInput = useCallback((name: string, raw: string) => {
    setInputs((current) => (current[name] === raw ? current : { ...current, [name]: raw }));
  }, []);

  const resetVariable = useCallback(
    (name: string) => {
      const variable = variables.find((candidate) => candidate.name === name);
      if (!variable) return;
      setInputs((current) => ({ ...current, [name]: initialRaw(variable) }));
    },
    [variables],
  );

  const resetAll = useCallback(() => {
    const next: Record<string, string> = {};
    for (const variable of variables) next[variable.name] = initialRaw(variable);
    setInputs(next);
  }, [variables]);

  return {
    variables,
    inputs,
    parsed,
    values,
    rendered,
    scan,
    reconciliation,
    pending,
    persisted: canPersist && persisted,
    restored: restored.savedAt !== null,
    setInput,
    resetVariable,
    resetAll,
  };
}
