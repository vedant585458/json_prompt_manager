/**
 * Focus restoration helpers for overlays (TASK-004).
 *
 * Radix restores focus to its own `DialogTrigger`. Overlays in PromptForge are
 * usually opened from external state instead (a library row action, a command
 * palette entry, a toast action), so there is no trigger for Radix to return
 * to and focus would be dropped on `<body>`.
 *
 * The opener is captured when the overlay mounts. When that element is no
 * longer connected — the common case where focus had already moved *into* the
 * overlay through `autoFocus`, or the opener lived inside the overlay itself —
 * focus returns to the last element focused outside any overlay instead.
 */

import { OVERLAY_ATTRIBUTE } from '@/lib/overlay';

/**
 * Marks an overlay surface so the focus tracker can ignore its contents.
 * Defined in `lib` because the command dispatcher uses the same marker.
 */
export { OVERLAY_ATTRIBUTE };

let lastExternalFocus: Element | null = null;

function isTrackable(element: EventTarget | null): element is Element {
  return element instanceof Element && element.closest(`[${OVERLAY_ATTRIBUTE}]`) === null;
}

function handleFocusIn(event: FocusEvent): void {
  if (isTrackable(event.target)) lastExternalFocus = event.target;
}

let installed = false;

function install(): void {
  if (installed || typeof document === 'undefined') return;
  document.addEventListener('focusin', handleFocusIn, true);
  installed = true;
}

/** Keeps the fallback target current; called from every overlay. */
export function trackExternalFocus(): void {
  install();
}

/** Last element focused outside every overlay, or `null` before any focus. */
export function getLastExternalFocus(): Element | null {
  return lastExternalFocus;
}

/**
 * Restores focus to `opener` when it is still in the document, otherwise to the
 * last external focus target. Returns whether a target was found.
 */
export function restoreFocus(opener: Element | null, fallback = getLastExternalFocus()): boolean {
  const target = opener?.isConnected ? opener : fallback;
  if (target instanceof HTMLElement && target.isConnected) {
    target.focus();
    return true;
  }
  return false;
}
