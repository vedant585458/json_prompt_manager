import type { ReactNode } from 'react';

import type { SelectionToggle } from '@/components/library/SelectionCheckbox';
import { PromptRow } from '@/components/library/PromptRow';
import type { PromptActionHandlers } from '@/components/prompts/PromptActionsMenu';
import type { PromptMatch } from '@/domain/search';
import type { Prompt } from '@/domain/types';

export interface PromptListProps {
  readonly prompts: readonly Prompt[];
  readonly parsableIds: ReadonlySet<string>;
  /** Schema error counts by prompt id (TASK-016). */
  readonly schemaIssueCounts?: ReadonlyMap<string, number>;
  readonly matches: ReadonlyMap<string, PromptMatch>;
  readonly query: string;
  readonly now: Date;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleSelected: SelectionToggle;
  readonly empty: ReactNode;
  /** Distinguishes the pinned list from the main results in the a11y tree. */
  readonly label?: string;
  readonly actions: PromptActionHandlers;
}

/** Dense list view of the library (TASK-011). */
export function PromptList({
  prompts,
  parsableIds,
  schemaIssueCounts,
  matches,
  query,
  now,
  selectedIds,
  onToggleSelected,
  empty,
  label = 'Prompts',
  actions,
}: PromptListProps) {
  if (prompts.length === 0) return <>{empty}</>;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-1">
      <div
        aria-hidden="true"
        className="hidden items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-1.5 font-mono text-2xs tracking-wide text-ink-muted uppercase sm:flex"
      >
        <span>Prompt · status · document</span>
        <span>Tags · last edited</span>
      </div>

      <ul aria-label={`${label}, list view`} className="divide-y divide-line">
        {prompts.map((prompt) => (
          <PromptRow
            key={prompt.id}
            prompt={prompt}
            parsable={parsableIds.has(prompt.id)}
            schemaIssueCount={schemaIssueCounts?.get(prompt.id) ?? 0}
            query={query}
            match={matches.get(prompt.id)}
            now={now}
            selected={selectedIds.has(prompt.id)}
            onToggleSelected={onToggleSelected}
            actions={actions}
          />
        ))}
      </ul>
    </div>
  );
}
