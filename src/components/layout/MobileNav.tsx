import { NavList } from '@/components/layout/NavList';
import { StorageModeNote } from '@/components/layout/StorageModeBadge';
import { Kbd, Sheet } from '@/components/ui';

export interface MobileNavProps {
  readonly open: boolean;
  /** Dismissal by Escape, the close button, or the overlay. */
  readonly onClose: () => void;
  /** A destination was chosen: the route, not the menu button, takes focus. */
  readonly onNavigate?: () => void;
  /** Passed to `Sheet`; `false` when the drawer is closing because of a navigation. */
  readonly restoreFocus?: boolean;
}

/**
 * Drawer navigation for narrow viewports (TASK-008).
 *
 * Built on `Sheet`, so focus moves into the drawer, Tab is trapped inside it,
 * Escape closes it, and focus returns to the menu button. Navigation closes the
 * drawer explicitly — a link click is a route change, not a reason to keep a
 * modal panel over the new page.
 */
export function MobileNav({
  open,
  onClose,
  onNavigate = onClose,
  restoreFocus = true,
}: MobileNavProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      side="left"
      restoreFocusOnClose={restoreFocus}
      title="Navigation"
      description="Every workspace, drawn from the same list as the desktop rail."
    >
      <NavList onNavigate={onNavigate} />

      <div className="mt-6 space-y-2 border-t border-line pt-4">
        <p className="flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted">
          <Kbd>Tab</Kbd> moves through this drawer · <Kbd>Esc</Kbd> closes it
        </p>
        <StorageModeNote />
      </div>
    </Sheet>
  );
}
