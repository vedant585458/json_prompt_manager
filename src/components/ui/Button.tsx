import type { VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/buttonVariants';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

/**
 * Button (TASK-003).
 *
 * Variants are intentionally small in number and tied to meaning: `primary` is
 * the accent fill (one per region), `secondary` is the default action,
 * `ghost` is for toolbars, and `danger` is destructive. Loading keeps the
 * accessible name and reports `aria-busy` while blocking activation.
 */

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends ComponentPropsWithRef<'button'>, ButtonVariantProps {
  /** Shows a spinner and blocks activation; the label stays available to AT. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Additional status text announced while loading, e.g. "Saving prompt". */
  loadingLabel?: string;
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  leadingIcon,
  trailingIcon,
  loadingLabel,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const iconSize = size === 'lg' ? 16 : size === 'sm' ? 12 : 14;

  const button = (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Spinner size={iconSize} className="text-current" />
      ) : leadingIcon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {!loading && trailingIcon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );

  // The pending action is announced separately so the button's accessible name
  // stays stable ("Saving" does not become "Saving Saving prompt").
  if (!loading || !loadingLabel) return button;

  return (
    <>
      {button}
      <span role="status" aria-live="polite" className="sr-only">
        {loadingLabel}
      </span>
    </>
  );
}
