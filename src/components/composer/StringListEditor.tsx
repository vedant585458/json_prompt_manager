import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Button, IconButton, Input } from '@/components/ui';
import { moveListItem } from '@/domain/composer';
import { cn } from '@/lib/cn';

/**
 * A reorderable list of short strings (TASK-017).
 *
 * Used for instructions, constraints, context references, and tags. Every row is
 * a real labelled input and every reorder is a button, so the list can be
 * reordered with a keyboard alone — no drag handle, no pointer-only affordance.
 */
export interface StringListEditorProps {
  readonly legend: string;
  readonly description?: string;
  readonly items: readonly string[];
  readonly onChange: (items: string[]) => void;
  readonly addLabel: string;
  readonly itemLabel: string;
  readonly placeholder?: string;
  readonly emptyText: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly maxLength?: number;
}

export function StringListEditor({
  legend,
  description,
  items,
  onChange,
  addLabel,
  itemLabel,
  placeholder,
  emptyText,
  error,
  disabled = false,
  maxLength = 400,
}: StringListEditorProps) {
  const errorId = `list-error-${legend.replace(/\s+/g, '-').toLowerCase()}`;

  function replace(index: number, value: string) {
    onChange(items.map((item, position) => (position === index ? value : item)));
  }

  return (
    <fieldset className="min-w-0 space-y-2" aria-describedby={error ? errorId : undefined}>
      <legend className="text-xs font-medium tracking-wide text-ink uppercase">{legend}</legend>
      {description ? <p className="text-2xs text-ink-muted">{description}</p> : null}

      {items.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line px-3 py-2 text-xs text-ink-muted">
          {emptyText}
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <Input
                aria-label={`${itemLabel} ${index + 1}`}
                value={item}
                maxLength={maxLength}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(event) => replace(index, event.target.value)}
              />
              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  label={`Move ${itemLabel} ${index + 1} up`}
                  size="sm"
                  disabled={disabled || index === 0}
                  onClick={() => onChange(moveListItem(items, index, -1))}
                >
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton
                  label={`Move ${itemLabel} ${index + 1} down`}
                  size="sm"
                  disabled={disabled || index === items.length - 1}
                  onClick={() => onChange(moveListItem(items, index, 1))}
                >
                  <ChevronDown size={14} />
                </IconButton>
                <IconButton
                  label={`Remove ${itemLabel} ${index + 1}`}
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange(items.filter((_, position) => position !== index))}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...items, ''])}
        className="justify-start"
      >
        <Plus size={14} aria-hidden="true" />
        {addLabel}
      </Button>

      {error ? (
        <p id={errorId} className={cn('text-2xs text-danger')}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
