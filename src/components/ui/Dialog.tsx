import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import {
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type ReactNode,
  type RefObject,
} from 'react';

import { IconButton } from '@/components/ui/IconButton';
import { OVERLAY_ATTRIBUTE, restoreFocus, trackExternalFocus } from '@/components/ui/focus-return';
import { cn } from '@/lib/cn';

/**
 * Captures the opener once the portal actually mounts.
 *
 * `DialogContent` itself renders even while closed (the portal hides it), so
 * the capture has to live inside the portal. A layout effect runs before
 * Radix's passive focus-scope effect, which is the moment the opener is still
 * focused.
 */
function FocusCapture({ openerRef }: { openerRef: RefObject<Element | null> }) {
  useLayoutEffect(() => {
    trackExternalFocus();
    openerRef.current = document.activeElement;
  }, [openerRef]);
  return null;
}

/**
 * Dialog (TASK-004).
 *
 * Radix owns the hard parts: focus trap, focus restore to the trigger, scroll
 * lock, `aria-modal`, and Escape handling. This wrapper adds the product's
 * surface treatment, a required accessible title, and configurable dismissal.
 *
 * Dismissal rules:
 * - `dismissible = true` (default) — Escape and overlay click close the dialog.
 * - `dismissible = false` — only an explicit close action closes it; use for
 *   destructive confirmations or unsaved-work warnings that must not be
 *   dismissed accidentally by a stray click.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogSize = 'sm' | 'md' | 'lg';

/**
 * Below `sm` a centred dialog is a cramped box floating in the middle of a phone
 * screen. These classes turn it into a bottom sheet instead: full width, flush
 * with the bottom edge, square at the bottom, rounded at the top, and clear of
 * the home-indicator safe area. CSS only, so no JavaScript media query has to
 * run before the first paint (TASK-027).
 */
const COMPACT_SHEET_CLASS = cn(
  'max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-none',
  'max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-xl',
  'max-sm:border-x-0 max-sm:border-b-0 max-sm:max-h-[85dvh]',
  'max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]',
);

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export interface DialogContentProps extends Omit<
  ComponentPropsWithRef<typeof DialogPrimitive.Content>,
  'title'
> {
  /** Accessible name, rendered as the visible heading. */
  title: string;
  /** Optional supporting text, also used as the accessible description. */
  description?: ReactNode;
  size?: DialogSize;
  dismissible?: boolean;
  /** Hides the corner close button; Escape/overlay rules still apply. */
  hideCloseButton?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}

export function DialogContent({
  title,
  description,
  size = 'md',
  dismissible = true,
  hideCloseButton = false,
  footer,
  className,
  children,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  /**
   * Focus restoration for externally controlled overlays.
   *
   * Radix restores focus to its own `DialogTrigger`; when an overlay is opened
   * from external state there is no trigger, and Radix's built-in handler
   * prevents the focus-scope restore and leaves focus on `<body>`. The opener
   * is therefore captured in `onOpenAutoFocus` (the last moment the trigger is
   * still focused) and the restore is performed explicitly on close.
   */
  const openerRef = useRef<Element | null>(null);

  const handleCloseAutoFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    if (restoreFocus(openerRef.current)) event.preventDefault();
  };

  return (
    <DialogPrimitive.Portal>
      <FocusCapture openerRef={openerRef} />
      <DialogPrimitive.Overlay
        className={cn('fixed inset-0 z-overlay bg-overlay', 'data-[state=open]:animate-fade-in')}
      />
      <DialogPrimitive.Content
        {...{ [OVERLAY_ATTRIBUTE]: '' }}
        // Radix relies on focus guards and aria-hidden for modal behavior, but
        // assistive technology still benefits from an explicit aria-modal.
        aria-modal="true"
        onCloseAutoFocus={handleCloseAutoFocus}
        className={cn(
          'fixed top-1/2 left-1/2 z-modal w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-line bg-surface-1 p-5 shadow-panel',
          'data-[state=open]:animate-fade-in focus:outline-none',
          COMPACT_SHEET_CLASS,
          SIZE_CLASS[size],
          className,
        )}
        {...(dismissible
          ? {}
          : {
              onEscapeKeyDown: (event: KeyboardEvent) => event.preventDefault(),
              onInteractOutside: (event: Event) => event.preventDefault(),
            })}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-lg font-semibold text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1.5 text-sm text-ink-secondary">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {hideCloseButton ? null : (
            <DialogPrimitive.Close asChild>
              <IconButton label="Close dialog" size="sm" className="-mt-1 -mr-1">
                <X size={16} />
              </IconButton>
            </DialogPrimitive.Close>
          )}
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
