/**
 * Overlay bookkeeping (TASK-004, extended in TASK-009).
 *
 * Kept in `lib` so both the overlay primitives and framework-free helpers (the
 * shortcut dispatcher) can ask "is focus inside an overlay?" without importing
 * a component module.
 */

/** Marks an overlay surface so focus tracking and shortcut guards can see it. */
export const OVERLAY_ATTRIBUTE = 'data-pf-overlay';

/** True when the element sits inside any overlay (dialog, sheet, palette). */
export function isWithinOverlay(element: Element | null): boolean {
  return element?.closest(`[${OVERLAY_ATTRIBUTE}]`) !== null;
}
