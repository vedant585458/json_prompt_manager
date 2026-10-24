import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import type { JsonTextStats, JsonSyntaxError } from '@/domain/jsonText';
import { cn } from '@/lib/cn';

/**
 * Status bar for the JSON workspace (TASK-014).
 *
 * Validity is stated in words as well as in color, and "checking" is its own
 * state: the bar never shows "Valid JSON" while a parse is still pending, which
 * is the difference between a quiet editor and a lying one.
 */

export interface EditorStatusBarProps {
  readonly caret: { line: number; column: number };
  readonly stats: JsonTextStats;
  readonly error: JsonSyntaxError | null;
  readonly checking: boolean;
  readonly indent: 2 | 4;
  readonly largeDocument: boolean;
  readonly draftOnly: boolean;
}

export function EditorStatusBar({
  caret,
  stats,
  error,
  checking,
  indent,
  largeDocument,
  draftOnly,
}: EditorStatusBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-line bg-surface-2 px-3 py-1.5 font-mono text-2xs text-ink-muted"
      aria-label="Editor status"
      role="status"
    >
      <span aria-label={`Caret at line ${caret.line}, column ${caret.column}`}>
        Ln {caret.line}, Col {caret.column}
      </span>
      <span>
        {stats.lines} {stats.lines === 1 ? 'line' : 'lines'}
      </span>
      <span>{stats.characters.toLocaleString()} chars</span>
      <span>{indent}-space indent</span>

      {checking ? (
        <Badge tone="neutral" className="ml-auto">
          Checking…
        </Badge>
      ) : error ? (
        <Badge tone="danger" className={cn('ml-auto gap-1')}>
          <AlertTriangle aria-hidden="true" size={11} />
          Syntax error
        </Badge>
      ) : (
        <Badge tone="success" className="ml-auto gap-1">
          <CheckCircle2 aria-hidden="true" size={11} />
          Valid JSON
        </Badge>
      )}

      {largeDocument ? (
        <span className="basis-full text-warning">
          Large document — parsing is deferred while you type.
        </span>
      ) : null}

      {draftOnly ? (
        <span className="basis-full">
          This is a draft in this tab. Nothing has been saved — saving arrives in TASK-015.
        </span>
      ) : null}
    </div>
  );
}
