import { ScanSearch } from 'lucide-react';

import { Badge, Button } from '@/components/ui';
import { countQuality, type QualityFinding } from '@/domain/quality';

export interface QualityChipProps {
  /** Visible findings, after dismissals. */
  readonly findings: readonly QualityFinding[];
  /** Opens the inspector tab. The chip never edits anything. */
  readonly onOpen: () => void;
}

function summaryOf(counts: ReturnType<typeof countQuality>): string {
  if (counts.total === 0) return 'no findings';
  if (counts.errors > 0) {
    return `${counts.errors} ${counts.errors === 1 ? 'error' : 'errors'}`;
  }
  if (counts.warnings > 0) {
    return `${counts.warnings} ${counts.warnings === 1 ? 'warning' : 'warnings'}`;
  }
  return `${counts.suggestions} ${counts.suggestions === 1 ? 'suggestion' : 'suggestions'}`;
}

/**
 * Editor header summary of the quality review (TASK-024).
 *
 * A count with words, not a bare number and not a score: the chip says how many
 * findings of which severity the inspector is holding, and opens the tab. Status
 * is carried by the text as well as the tone, so it survives colour blindness.
 */
export function QualityChip({ findings, onOpen }: QualityChipProps) {
  const counts = countQuality(findings);
  const tone = counts.errors > 0 ? 'danger' : counts.warnings > 0 ? 'warning' : 'neutral';
  const summary = summaryOf(counts);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onOpen}
      aria-label={`Quality review: ${summary}. Opens the inspector tab.`}
    >
      <ScanSearch aria-hidden="true" size={12} />
      Quality
      <Badge tone={tone}>{summary}</Badge>
    </Button>
  );
}
