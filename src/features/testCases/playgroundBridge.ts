import type { JsonValue, VariableDefinition } from '@/domain/types';
import { parseVariableInput } from '@/domain/variables';
import { formatCaseInputs, type LabProblem } from '@/domain/lab';
import { readPlaygroundValues, writePlaygroundValues } from '@/features/playground/valuesStorage';

/**
 * The bridge between a saved test case and the playground's remembered inputs
 * (TASK-022).
 *
 * Both directions are lossy in exactly one documented way: the playground keeps
 * *text*, so a stored value has to be parsed back through the variable's type
 * before it can become a case value. Anything that will not parse is reported
 * instead of being guessed at — a silently dropped value would make a case look
 * more complete than it is.
 */

export interface PlaygroundCarryOver {
  readonly values: Readonly<Record<string, JsonValue>>;
  /** Values that could not be carried over, one entry per variable. */
  readonly problems: readonly LabProblem[];
  /** True when the tab has never written inputs for this prompt. */
  readonly empty: boolean;
}

const NO_VALUES: PlaygroundCarryOver = { values: {}, problems: [], empty: true };

/** Turns this tab's remembered playground text into case values. */
export function caseValuesFromPlaygroundText(
  variables: readonly VariableDefinition[],
  inputs: Readonly<Record<string, string>>,
): PlaygroundCarryOver {
  const values: Record<string, JsonValue> = {};
  const problems: LabProblem[] = [];

  const declared = new Map(variables.map((variable) => [variable.name, variable]));

  for (const [name, raw] of Object.entries(inputs)) {
    const variable = declared.get(name);

    if (!variable) {
      problems.push({
        category: 'inputs',
        severity: 'warning',
        name,
        message: `“${name}” was in the playground but this prompt no longer declares it, so it was not carried over.`,
      });
      continue;
    }

    // The playground treats a blank string as "no answer" for every type,
    // including `string`, so the carry-over skips exactly the same values. A case
    // must never claim an answer the playground would show as unanswered.
    if (variable.type === 'string' && raw === '') continue;

    const parsed = parseVariableInput(variable, raw);
    if (parsed.state === 'value') {
      values[name] = parsed.value;
    } else if (parsed.state === 'invalid') {
      problems.push({
        category: 'inputs',
        severity: 'warning',
        name,
        message: `“${name}” is not a valid ${variable.type} value, so it was not carried over.`,
      });
    }
  }

  return { values, problems, empty: Object.keys(inputs).length === 0 };
}

/**
 * Reads the playground inputs this tab remembered for a prompt.
 *
 * Storage is fail-soft: no session storage, or a value this module did not
 * write, reads as "nothing remembered" rather than as an error.
 */
export function readPlaygroundCarryOver(
  promptId: string,
  variables: readonly VariableDefinition[],
  storage?: Storage | null,
): PlaygroundCarryOver {
  const stored = readPlaygroundValues(promptId, storage);
  if (!stored) return NO_VALUES;

  return caseValuesFromPlaygroundText(variables, stored.values);
}

export interface LoadIntoPlaygroundResult {
  readonly written: boolean;
  readonly values: Readonly<Record<string, string>>;
}

/**
 * Writes a case's values into the playground's remembered inputs.
 *
 * The write is what the playground already reads on mount, so opening the
 * playground afterwards shows exactly these values. Storage refusing the write
 * is returned, not hidden: the caller says so instead of promising a carry-over
 * that did not happen.
 */
export function loadCaseIntoPlayground(
  promptId: string,
  variables: readonly VariableDefinition[],
  inputValues: Readonly<Record<string, JsonValue>>,
  storage?: Storage | null,
): LoadIntoPlaygroundResult {
  const values = formatCaseInputs(variables, inputValues);
  return { written: writePlaygroundValues(promptId, values, storage), values };
}
