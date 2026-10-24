import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

import { Button, buttonVariants, ErrorState } from '@/components/ui';
import { cn } from '@/lib/cn';

function describe(error: unknown): { title: string; description: string; detail?: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: `The router returned ${error.status}`,
      description:
        'This address could not be rendered. Nothing in your library was changed. Return to the dashboard and try again from there.',
      detail: `${error.status} ${error.statusText}`.trim(),
    };
  }

  const resolved =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown route failure.');

  return {
    title: 'This screen failed to render',
    description:
      'A screen threw while rendering. Prompts already saved in this browser are still there — nothing is deleted by this screen. Reload, or go back to the dashboard.',
    detail: `${resolved.name}: ${resolved.message}`,
  };
}

/**
 * Route error screen (TASK-008).
 *
 * Wired as the router's `errorElement`, so a render failure in one route shows
 * a readable recovery screen instead of a blank page. Deliberately independent
 * of the shell: if the shell is what failed, this must still render.
 */
export function RouteErrorScreen() {
  const error = useRouteError();
  const { title, description, detail } = describe(error);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-xl">
        <p className="font-mono text-2xs tracking-[0.14em] text-ink-muted uppercase">
          PromptForge · Recovery
        </p>
        <h1 className="mt-2 font-display text-2xl leading-tight text-ink">{title}</h1>

        <ErrorState
          className="mt-5"
          title={title}
          description={description}
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          }
          secondaryAction={
            <Link to="/" reloadDocument className={cn(buttonVariants({ variant: 'secondary' }))}>
              Back to dashboard
            </Link>
          }
          detail={detail}
        />
      </div>
    </main>
  );
}
