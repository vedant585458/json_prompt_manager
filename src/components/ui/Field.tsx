import { useId, type ReactNode } from 'react';

import { fieldMessageVariants } from '@/components/ui/fieldVariants';

import { cn } from '@/lib/cn';

/**
 * Field (TASK-003).
 *
 * Owns label, hint, and error wiring so association cannot be forgotten. The
 * control is supplied through a render function that receives the ids and ARIA
 * attributes it must spread onto the input.
 *
 * Errors never clear or replace the control's value; they only annotate it.
 */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  className?: string;
  /** Visually hides the label while keeping it available to assistive tech. */
  hideLabel?: boolean;
  children: (control: FieldControlProps) => ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  optionalLabel = 'Optional',
  className,
  hideLabel = false,
  children,
}: FieldProps) {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  const control = children({
    id: controlId,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? true : undefined,
    required,
  });

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={controlId}
          className={cn('text-xs font-medium text-ink-secondary', hideLabel && 'sr-only')}
        >
          {label}
          {required ? (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {!required && optionalLabel ? (
          <span className="text-2xs text-ink-muted">{optionalLabel}</span>
        ) : null}
      </div>
      <div className="mt-1.5">{control}</div>
      {hint ? (
        <p id={hintId} className={fieldMessageVariants({ tone: 'hint' })}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={cn(fieldMessageVariants({ tone: 'error' }), 'flex gap-1.5')}>
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
