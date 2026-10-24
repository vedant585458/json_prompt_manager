import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, type ButtonProps } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';

type CopyState = 'idle' | 'copied' | 'error';

const RESET_DELAY_MS = 2000;

async function writeToClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable');
  }
  await navigator.clipboard.writeText(text);
}

interface CopyAction {
  state: CopyState;
  copy: () => void;
}

/**
 * Copies text and reports the real outcome.
 *
 * Failure is surfaced, never swallowed: if the clipboard API is unavailable or
 * the write is rejected, the control announces an error rather than a false
 * "Copied".
 */
function useCopy(text: string, onCopied?: () => void): CopyAction {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void writeToClipboard(text).then(
      () => {
        setState('copied');
        onCopied?.();
        timer.current = setTimeout(() => setState('idle'), RESET_DELAY_MS);
      },
      () => {
        setState('error');
        timer.current = setTimeout(() => setState('idle'), RESET_DELAY_MS);
      },
    );
  }, [text, onCopied]);

  return { state, copy };
}

const STATE_TEXT: Record<CopyState, string> = {
  idle: '',
  copied: 'Copied to clipboard',
  error: 'Copy failed — clipboard unavailable',
};

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** Text written to the clipboard. */
  value: string;
  label?: string;
  copiedLabel?: string;
  onCopied?: () => void;
}

/** Labelled copy button (TASK-003). */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  onCopied,
  variant = 'secondary',
  size = 'sm',
  ...props
}: CopyButtonProps) {
  const { state, copy } = useCopy(value, onCopied);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={copy}
        leadingIcon={
          state === 'copied' ? (
            <Check size={14} strokeWidth={2.5} className="text-success" />
          ) : (
            <Copy size={14} strokeWidth={1.75} />
          )
        }
        {...props}
      >
        {state === 'copied' ? copiedLabel : label}
      </Button>
      <span aria-live="polite" className="sr-only">
        {STATE_TEXT[state]}
      </span>
    </>
  );
}

export interface CopyIconButtonProps {
  value: string;
  label?: string;
  onCopied?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Icon-only copy control (TASK-003), used in dense rows and toolbars. */
export function CopyIconButton({
  value,
  label = 'Copy',
  onCopied,
  size = 'sm',
  className,
}: CopyIconButtonProps) {
  const { state, copy } = useCopy(value, onCopied);

  return (
    <>
      <IconButton
        label={state === 'copied' ? 'Copied' : label}
        size={size}
        className={className}
        onClick={copy}
      >
        {state === 'copied' ? (
          <Check size={14} strokeWidth={2.5} className="text-success" />
        ) : (
          <Copy size={14} strokeWidth={1.75} />
        )}
      </IconButton>
      <span aria-live="polite" className="sr-only">
        {STATE_TEXT[state]}
      </span>
    </>
  );
}
