import type { VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { alertVariants } from '@/components/ui/alertVariants';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';

export type AlertTone = NonNullable<VariantProps<typeof alertVariants>['tone']>;

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
} as const;

export interface AlertProps {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  /** Optional recovery or related action rendered under the message. */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  /** `assertive` is used for errors that block progress. */
  live?: 'polite' | 'assertive' | 'off';
}

/**
 * Alert (TASK-004).
 *
 * Tone is never the only signal: each variant renders a distinct icon and a
 * text title. Dismissal requires a labelled button, not a hover reveal.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
  live = 'off',
}: AlertProps) {
  const Icon = ICONS[tone];

  return (
    <div
      role={live === 'off' ? undefined : 'alert'}
      aria-live={live === 'off' ? undefined : live}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children ? <div className="mt-1 text-ink-secondary">{children}</div> : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
      {onDismiss ? (
        <IconButton
          label="Dismiss message"
          size="sm"
          className="-mt-1 -mr-1 text-current hover:bg-transparent hover:text-current"
          onClick={onDismiss}
        >
          <X size={14} />
        </IconButton>
      ) : null}
    </div>
  );
}

export interface InlineErrorProps {
  /** Message shown next to the control; associated by the caller's `aria-describedby`. */
  children: ReactNode;
  className?: string;
}

/** Compact field-level error text (TASK-004). */
export function InlineError({ children, className }: InlineErrorProps) {
  return (
    <p className={cn('mt-1.5 flex items-start gap-1.5 text-xs text-danger', className)}>
      <span aria-hidden="true">✕</span>
      <span>{children}</span>
    </p>
  );
}
