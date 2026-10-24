import { CornerDownRight } from 'lucide-react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import type { JsonSyntaxError } from '@/domain/jsonText';

/**
 * Syntax error panel (TASK-014).
 *
 * The panel states the exact location the scanner reported and offers to move
 * the caret there. It never replaces or "repairs" the text: the document the
 * user typed stays exactly as they left it while the error is on screen.
 */

export interface JsonErrorPanelProps {
  readonly error: JsonSyntaxError;
  readonly onJump: (offset: number) => void;
}

export function JsonErrorPanel({ error, onJump }: JsonErrorPanelProps) {
  return (
    <Alert
      tone="danger"
      live="assertive"
      title={`This is not valid JSON — line ${error.line}, column ${error.column}`}
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onJump(error.offset)}
          leadingIcon={<CornerDownRight size={14} strokeWidth={1.75} />}
        >
          Go to line {error.line}
        </Button>
      }
    >
      <p>{error.message}</p>
      <p className="mt-1 text-ink-muted">
        Your text is unchanged. The tree view and formatting are unavailable until the document
        parses.
      </p>
    </Alert>
  );
}
