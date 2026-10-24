import { useEffect, useRef, type RefObject } from 'react';

import { routeLabel } from '@/components/layout/navigation';

/**
 * Per-route document chrome (TASK-008).
 *
 * - `document.title` always says where you are, so tabs and screen-reader page
 *   announcements are accurate.
 * - Scroll position resets on navigation but not on the first render.
 * - Focus moves to the main landmark after a navigation, which is how a
 *   single-page app announces a new screen without stealing focus on load.
 */
export function useRouteChrome(pathname: string, mainRef: RefObject<HTMLElement | null>): void {
  const firstRender = useRef(true);

  useEffect(() => {
    const label = routeLabel(pathname) ?? 'Not found';
    document.title = `${label} · PromptForge`;
  }, [pathname]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, mainRef]);
}
