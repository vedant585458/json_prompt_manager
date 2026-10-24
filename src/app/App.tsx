import { TooltipProvider } from '@/components/ui';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { DesignGallery } from '@/routes/design/DesignGallery';

/**
 * Temporary application root (TASK-003).
 *
 * The design gallery is the only implemented screen. TASK-008 introduces the
 * router and mounts this component at `/design`; until then it is the root view
 * so the primitives can be reviewed in a real browser.
 */
export function App() {
  return (
    <TooltipProvider>
      <ToastProvider>
        <DesignGallery />
      </ToastProvider>
    </TooltipProvider>
  );
}
