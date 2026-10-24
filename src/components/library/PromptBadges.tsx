import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui';
import type { PromptStatus } from '@/domain/types';

const STATUS_TONE: Record<PromptStatus, BadgeTone> = {
  active: 'success',
  draft: 'neutral',
  deprecated: 'warning',
};

/** The stored status, spelled out rather than implied by a colour. */
export function StatusBadge({ status }: { readonly status: PromptStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

/**
 * Whether the stored document reads back.
 *
 * This is a statement about the current JSON only — the library never implies a
 * prompt is good because it parses (ADR-56).
 */
export function ParsabilityBadge({ parsable }: { readonly parsable: boolean }) {
  return (
    <Badge tone={parsable ? 'success' : 'danger'} className="gap-1">
      {parsable ? (
        <CheckCircle2 aria-hidden="true" size={10} strokeWidth={2} />
      ) : (
        <AlertTriangle aria-hidden="true" size={10} strokeWidth={2} />
      )}
      {parsable ? 'Parses' : 'Will not parse'}
    </Badge>
  );
}
