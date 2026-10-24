import { TooltipProvider } from '@/components/ui';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { DataBootstrap } from '@/app/DataBootstrap';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { DesignGallery } from '@/routes/design/DesignGallery';

/**
 * Temporary application root (TASK-003, extended in TASK-007).
 *
 * The design gallery is still the only implemented screen. It now runs inside
 * the real data lifecycle — storage selection, seeding, hydration — and behind
 * the application error boundary, so both are exercised by the dev server.
 * TASK-008 replaces the gallery with the router and moves it to `/design`.
 */
export function App() {
  return (
    <TooltipProvider>
      <ToastProvider>
        <ErrorBoundary>
          <DataBootstrap>
            <DesignGallery />
          </DataBootstrap>
        </ErrorBoundary>
      </ToastProvider>
    </TooltipProvider>
  );
}
