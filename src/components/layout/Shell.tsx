import { useCallback, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { CommandLayer } from '@/components/command-palette/CommandLayer';
import { ImportDialogProvider } from '@/components/transfer/ImportDialogProvider';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { SkipLink } from '@/components/layout/SkipLink';
import { Topbar } from '@/components/layout/Topbar';
import { useRouteChrome } from '@/components/layout/useRouteChrome';
import { useUiStore } from '@/store/uiStore';

/**
 * Application shell (TASK-008).
 *
 * Skip link first, then a single `main` landmark that both the skip link and
 * route focus target. The rail is desktop-only; below `lg` the same navigation
 * lives in a drawer. The main column is `min-w-0` so long JSON and wide tables
 * (later tasks) can scroll inside their own regions instead of widening the
 * document at 360 px.
 */
export function Shell() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [restoreDrawerFocus, setRestoreDrawerFocus] = useState(true);

  // Collapsed state is interface state, not a preference: it lives for the
  // session and resets on reload.
  const railCollapsed = useUiStore((state) => !state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  useRouteChrome(pathname, mainRef);

  // Escape or the overlay returns focus to the menu button; choosing a
  // destination does not, because the new screen's main landmark takes focus.
  const dismissDrawer = useCallback(() => setMobileNavOpen(false), []);
  const closeDrawerAfterNavigation = useCallback(() => {
    setRestoreDrawerFocus(false);
    setMobileNavOpen(false);
  }, []);
  const openDrawer = useCallback(() => {
    setRestoreDrawerFocus(true);
    setMobileNavOpen(true);
  }, []);

  return (
    <ImportDialogProvider>
      <div className="flex min-h-dvh bg-canvas">
        <SkipLink />

        <Sidebar collapsed={railCollapsed} onToggle={toggleSidebar} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenNav={openDrawer} navOpen={mobileNavOpen} />

          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className="min-w-0 flex-1 px-4 py-8 focus:outline-none sm:px-6 lg:px-8 lg:py-10"
          >
            <Outlet />
          </main>
        </div>

        <CommandLayer />

        <MobileNav
          open={mobileNavOpen}
          onClose={dismissDrawer}
          onNavigate={closeDrawerAfterNavigation}
          restoreFocus={restoreDrawerFocus}
        />
      </div>
    </ImportDialogProvider>
  );
}
