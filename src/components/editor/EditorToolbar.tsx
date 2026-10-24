import { AlignLeft, CornerDownRight, Minimize2, Redo2, Search, Undo2 } from 'lucide-react';

import { CopyButton } from '@/components/ui/CopyButton';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/cn';

/**
 * Toolbar for the JSON workspace (TASK-014).
 *
 * Every action here is also reachable from the keyboard and from CodeMirror
 * itself; the toolbar is the discoverable path, not the only one. Actions that
 * need valid JSON are disabled (not hidden) while a syntax error is present, so
 * the reason they cannot run stays visible.
 */

export interface EditorToolbarProps {
  readonly documentText: string;
  /** False while the text does not parse. */
  readonly canRewrite: boolean;
  readonly errorLine: number | null;
  readonly onFormat: () => void;
  readonly onMinify: () => void;
  readonly onFind: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onJumpToError: () => void;
  readonly onCopied: () => void;
}

export function EditorToolbar({
  documentText,
  canRewrite,
  errorLine,
  onFormat,
  onMinify,
  onFind,
  onUndo,
  onRedo,
  onJumpToError,
  onCopied,
}: EditorToolbarProps) {
  // Rewrites re-scan the text themselves, so a pending parse is not a reason to
  // block them; only a document that does not parse is.
  const needsValidJson = !canRewrite;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface-1 px-2 py-1.5">
      <div className="flex items-center gap-1" role="group" aria-label="Format the document">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Format JSON"
          disabled={needsValidJson}
          onClick={onFormat}
          leadingIcon={<AlignLeft size={14} strokeWidth={1.75} />}
        >
          <span className="hidden sm:inline">Format</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Minify JSON"
          disabled={needsValidJson}
          onClick={onMinify}
          leadingIcon={<Minimize2 size={14} strokeWidth={1.75} />}
        >
          <span className="hidden sm:inline">Minify</span>
        </Button>
      </div>

      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />

      <div className="flex items-center gap-1" role="group" aria-label="History">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Undo the last edit"
          onClick={onUndo}
          leadingIcon={<Undo2 size={14} strokeWidth={1.75} />}
        >
          <span className="hidden sm:inline">Undo</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Redo the last undone edit"
          onClick={onRedo}
          leadingIcon={<Redo2 size={14} strokeWidth={1.75} />}
        >
          <span className="hidden sm:inline">Redo</span>
        </Button>
      </div>

      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />

      <div className="flex items-center gap-1" role="group" aria-label="Find and copy">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Find in the document"
          onClick={onFind}
          leadingIcon={<Search size={14} strokeWidth={1.75} />}
        >
          <span className="hidden sm:inline">Find</span>
        </Button>
        <CopyButton
          value={documentText}
          variant="ghost"
          label="Copy all"
          copiedLabel="Copied"
          aria-label="Copy the whole document"
          onCopied={onCopied}
        />
      </div>

      {errorLine !== null ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Jump to the syntax error on line ${errorLine}`}
          onClick={onJumpToError}
          leadingIcon={<CornerDownRight size={14} strokeWidth={1.75} />}
          className="text-danger hover:text-danger"
        >
          <span className="hidden sm:inline">Jump to error</span>
        </Button>
      ) : null}

      <div className={cn('ml-auto flex items-center gap-2 pr-1 text-2xs text-ink-muted')}>
        <Kbd>Mod</Kbd>
        <Kbd>F</Kbd>
        <span className="hidden md:inline">finds</span>
      </div>
    </div>
  );
}
