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

export type SheetSide = 'right' | 'left' | 'bottom';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  side?: SheetSide;
  /** Content below the header; scrolls independently of the page. */
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /**
   * Whether closing returns focus to the opener. `false` is for a drawer that
   * closes *because* the user navigated: the new screen's focus target should
   * win, not the button that opened the drawer.
   */
  restoreFocusOnClose?: boolean;
}

/**
 * Sheet (TASK-004).
 *
 * A side panel for inspectors, secondary workflows, and the mobile navigation
 * rail. On narrow viewports a `right` sheet becomes a bottom sheet
 * automatically (CSS only, no JS media query), which keeps it reachable with a
 * thumb. `left` is a full-height drawer at every width.
 *
 * `SheetContent` is exported separately so future tasks can compose a sheet
 * without re-declaring the portal and overlay treatment.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  children,
  footer,
  className,
  restoreFocusOnClose = true,
}: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={title}
        description={description}
        side={side}
        className={className}
        footer={footer}
        restoreFocusOnClose={restoreFocusOnClose}
      >
        {children}
      </SheetContent>
    </DialogPrimitive.Root>
  );
}

export interface SheetContentProps extends Omit<
  ComponentPropsWithRef<typeof DialogPrimitive.Content>,
  'title'
> {
  title: string;
  description?: ReactNode;
  side?: SheetSide;
  footer?: ReactNode;
  children: ReactNode;
  /** See `SheetProps.restoreFocusOnClose`. */
  restoreFocusOnClose?: boolean;
}

export function SheetContent({
  title,
  description,
  side = 'right',
  footer,
  className,
  children,
  restoreFocusOnClose = true,
  onCloseAutoFocus,
  ...props
}: SheetContentProps) {
  // Same opener capture as DialogContent: sheets open from external state.
  const openerRef = useRef<Element | null>(null);

  const handleCloseAutoFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    if (!restoreFocusOnClose) return;
    if (restoreFocus(openerRef.current)) event.preventDefault();
  };

  return (
    <DialogPrimitive.Portal>
      <FocusCapture openerRef={openerRef} />
      <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-overlay" />
      <DialogPrimitive.Content
        {...{ [OVERLAY_ATTRIBUTE]: '' }}
        aria-modal="true"
        onCloseAutoFocus={handleCloseAutoFocus}
        className={cn(
          'fixed z-modal flex flex-col border-line bg-surface-1 shadow-panel focus:outline-none',
          side === 'left'
            ? ['inset-y-0 left-0 h-full w-[min(20rem,85vw)] border-r']
            : side === 'right'
              ? [
                  'inset-y-0 right-0 h-full w-[min(26rem,100vw)] border-l',
                  // Phones: slide up from the bottom instead of a cramped side rail.
                  'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[85dvh]',
                  'max-sm:w-full max-sm:rounded-t-lg max-sm:border-t max-sm:border-l-0',
                ]
              : [
                  'inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-lg border-t',
                  'sm:inset-x-auto sm:right-0 sm:inset-y-0 sm:h-full sm:max-h-full sm:w-[min(26rem,100vw)]',
                  'sm:rounded-t-none sm:rounded-l-lg sm:border-t-0 sm:border-l',
                ],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-md font-semibold text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-xs text-ink-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <IconButton label="Close panel" size="sm">
              <X size={16} />
            </IconButton>
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
