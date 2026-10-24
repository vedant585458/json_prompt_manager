import { useEffect, useState } from 'react';

import { Field, Textarea } from '@/components/ui';
import { parseJson } from '@/domain/serialization';
import type { JsonValue } from '@/domain/types';

/**
 * A JSON-valued form field (TASK-017).
 *
 * Some document fields are arbitrary JSON (`context.data`, an example, a
 * variable default). They are edited as text and parsed as you type:
 *
 * - when the text parses, the document is updated immediately;
 * - when it does not, **nothing is applied** and the error says so, so the
 *   document never holds a value the user did not write;
 * - the parent learns that this field is unusable and blocks saving, so a
 *   half-typed value cannot be silently dropped either.
 */
export interface JsonValueFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly value: JsonValue | undefined;
  readonly onChange: (value: JsonValue | undefined) => void;
  /** Reports whether the current text is applicable; `true` for empty input. */
  readonly onValidityChange?: (valid: boolean) => void;
  readonly rows?: number;
  readonly placeholder?: string;
}

function textOf(value: JsonValue | undefined): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

function sameValue(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function JsonValueField({
  label,
  hint,
  value,
  onChange,
  onValidityChange,
  rows = 3,
  placeholder,
}: JsonValueFieldProps) {
  const [text, setText] = useState(() => textOf(value));
  const [error, setError] = useState<string | null>(null);

  // A change from elsewhere (a snippet, a restored draft) replaces the text only
  // when the field is not mid-edit with something invalid.
  useEffect(() => {
    setText((current) => {
      if (error) return current;
      const parsed = parseJson(current);
      if (parsed.ok && sameValue(parsed.value, value)) return current;
      return textOf(value);
    });
    // `error` is deliberately not a dependency: an invalid draft stays put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(next: string) {
    setText(next);

    if (next.trim().length === 0) {
      setError(null);
      onValidityChange?.(true);
      onChange(undefined);
      return;
    }

    const parsed = parseJson(next);
    if (!parsed.ok) {
      setError(
        `Not applied — this is not valid JSON yet (${parsed.issues[0]?.message ?? 'check the syntax'}). The document keeps its previous value until it parses.`,
      );
      onValidityChange?.(false);
      return;
    }

    setError(null);
    onValidityChange?.(true);
    onChange(parsed.value);
  }

  return (
    <Field
      label={label}
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
      optionalLabel="Empty"
    >
      {(control) => (
        <Textarea
          {...control}
          mono
          rows={rows}
          value={text}
          placeholder={placeholder}
          invalid={Boolean(error)}
          onChange={(event) => handleChange(event.target.value)}
          spellCheck={false}
        />
      )}
    </Field>
  );
}
