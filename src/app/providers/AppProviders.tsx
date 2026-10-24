import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/app/ErrorBoundary';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { TooltipProvider } from '@/components/ui';

/**
 * Provider composition (TASK-008).
 *
 * Order matters: the theme must wrap everything that renders themed surfaces,
 * tooltips and toasts are used by any screen, and the error boundary sits
 * innermost so a screen failure keeps the providers' chrome (and its own
 * recovery screen) usable.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ToastProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
