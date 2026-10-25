import { FileJson } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CopyButton, buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface ComposerPreviewProps {
  readonly json: string;
  /** The prompt being edited, when there is one; a new draft has no editor yet. */
  readonly promptId?: string | null;
  /** Top-level fields the form does not render, named so nothing is a surprise. */
  readonly preserved: readonly string[];
  readonly largeDocument?: boolean;
}

/**
 * Read-only JSON preview (TASK-017).
 *
 * The form is the editor here; this panel shows exactly what the document looks
 * like right now and hands off to the raw editor for anything the form cannot
 * express. It never becomes a second editable surface with a second save path.
 */
export function ComposerPreview({
  json,
  promptId,
  preserved,
  largeDocument = false,
}: ComposerPreviewProps) {
  return (
    <aside aria-label="JSON preview" className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-medium tracking-wide text-ink uppercase">JSON preview</h2>
          <p className="text-2xs text-ink-muted">Read-only. The form above is what edits it.</p>
        </div>
        <CopyButton value={json} label="Copy JSON" size="sm" variant="secondary" />
      </div>

      <pre
        tabIndex={0}
        // A scrollable block needs to be reachable by keyboard *and* named, and
        // a bare `pre` is `role=generic`, where a name is prohibited. A region
        // accepts a name and tells assistive technology what the scroller holds.
        role="region"
        aria-label="Current prompt document"
        className="max-h-[28rem] min-w-0 overflow-auto rounded-md border border-line bg-surface-sunken p-3 font-mono text-2xs leading-relaxed text-ink-secondary"
      >
        {json}
      </pre>

      {largeDocument ? (
        <p className="text-2xs text-ink-muted">
          This document is large; the preview shows all of it, but editing it here may be slow. The
          raw editor is the better place for a document this size.
        </p>
      ) : null}

      {preserved.length > 0 ? (
        <p className="text-2xs text-ink-muted">
          {preserved.length === 1 ? 'One field is' : `${preserved.length} fields are`} outside this
          form ({preserved.join(', ')}) and {preserved.length === 1 ? 'is' : 'are'} kept exactly as
          written.
        </p>
      ) : null}

      {promptId ? (
        <Link
          to={`/prompts/${promptId}`}
          className={cn(
            buttonVariants({ variant: 'secondary', size: 'sm' }),
            'w-full justify-center',
          )}
        >
          <FileJson size={14} aria-hidden="true" />
          Open in the JSON editor
        </Link>
      ) : (
        <p className="text-2xs text-ink-muted">
          Creating the prompt stores this document; after that, “Open in the JSON editor” appears
          here.
        </p>
      )}
    </aside>
  );
}
