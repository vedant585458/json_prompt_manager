import type { ComponentPropsWithRef } from 'react';

import { controlVariants } from '@/components/ui/controlStyles';
import { cn } from '@/lib/cn';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  /** Applies the monospace face for structured content (JSON, templates). */
  mono?: boolean;
  autoResize?: boolean;
}

export function Textarea({
  size,
  invalid = false,
  mono = false,
  autoResize = false,
  className,
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        controlVariants({ size, invalid }),
        'min-h-20 resize-y leading-relaxed',
        mono && 'font-mono text-xs',
        autoResize && 'field-sizing-content resize-none',
        className,
      )}
      aria-invalid={invalid ? true : props['aria-invalid']}
      {...props}
    />
  );
}
