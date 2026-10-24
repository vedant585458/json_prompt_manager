import { Link, useLocation } from 'react-router-dom';

import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Not-found screen (TASK-008).
 *
 * A recovery screen, not a dead end: it echoes the address that failed and
 * offers two real destinations. It never claims the missing page "was moved"
 * because it has no way to know that.
 */
export function NotFoundRoute() {
  const { pathname } = useLocation();

  return (
    <div className="mx-auto w-full max-w-xl py-6">
      <p className="metadata-rail">404 · No such route</p>
      <h1 className="mt-2 font-display text-3xl leading-tight text-ink">
        Nothing lives at this address
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
        PromptForge could not match a screen to this path, so nothing was read or changed. Check the
        address, or start again from a screen that exists.
      </p>
      <p className="mt-3 text-xs text-ink-muted">
        Requested path:{' '}
        <code className="rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 text-ink-secondary">
          {pathname}
        </code>
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/" className={cn(buttonVariants({ variant: 'primary' }))}>
          Back to dashboard
        </Link>
        <Link to="/library" className={cn(buttonVariants({ variant: 'secondary' }))}>
          Open the library
        </Link>
      </div>
    </div>
  );
}
