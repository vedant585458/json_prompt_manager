import { useRef } from 'react';

import { Checkbox } from '@/components/ui';

/** How a card or row reports a selection change; `range` extends the selection. */
export type SelectionToggle = (id: string, options?: { readonly range?: boolean }) => void;

export interface SelectionCheckboxProps {
  readonly promptId: string;
  readonly title: string;
  readonly checked: boolean;
  /** `range` is true when Shift was held, for extending the selection. */
  readonly onToggle: (options: { readonly range: boolean }) => void;
  readonly className?: string;
}

/**
 * One row's selection checkbox (TASK-011, Shift ranges in TASK-013).
 *
 * Radix's checkbox changes state on Space and on click, and neither callback
 * carries the modifier keys, so the modifier is captured on pointer/key down —
 * immediately before the change — and read back in `onCheckedChange`. Both
 * cards and rows use this component so the behaviour cannot drift between views.
 */
export function SelectionCheckbox({
  promptId,
  title,
  checked,
  onToggle,
  className,
}: SelectionCheckboxProps) {
  const shiftRef = useRef(false);

  return (
    <Checkbox
      id={`select-${promptId}`}
      name={`select-${promptId}`}
      checked={checked}
      className={className}
      onPointerDown={(event) => {
        shiftRef.current = event.shiftKey;
      }}
      onKeyDown={(event) => {
        shiftRef.current = event.shiftKey;
      }}
      onCheckedChange={() => onToggle({ range: shiftRef.current })}
      label={<span className="sr-only">Select “{title}”</span>}
    />
  );
}
