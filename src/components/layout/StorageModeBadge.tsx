import { Database } from 'lucide-react';

import { StatusPill, Tooltip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useStorageModeLabel } from '@/components/layout/storageMode';

/**
 * Storage mode pill (TASK-008).
 *
 * Always icon + words: the tone is never the only signal. Hidden on the
 * narrowest screens, where the drawer footer repeats the same information.
 */
export function StorageModeBadge({ className }: { className?: string }) {
  const { label, detail, tone } = useStorageModeLabel();

  return (
    <Tooltip content={detail}>
      <StatusPill
        tone={tone}
        icon={<Database size={12} strokeWidth={1.75} />}
        className={className}
      >
        {label}
        <span className="sr-only">. {detail}</span>
      </StatusPill>
    </Tooltip>
  );
}

/**
 * Plain-text variant for tight spaces (drawer footer, compact rail), where a
 * pill would wrap. Returns the same words as the pill's accessible name.
 */
export function StorageModeNote({ className }: { className?: string }) {
  const { label, detail } = useStorageModeLabel();

  return (
    <p className={cn('text-2xs leading-relaxed text-ink-muted', className)}>
      <span className="font-medium text-ink-secondary">{label}.</span> {detail}
    </p>
  );
}
