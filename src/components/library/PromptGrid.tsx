import type { ReactNode } from 'react';

import { PromptCard } from '@/components/library/PromptCard';
import type { PromptMatch } from '@/domain/search';
import type { Prompt } from '@/domain/types';

export interface PromptGridProps {
  readonly prompts: readonly Prompt[];
  readonly parsableIds: ReadonlySet<string>;
  readonly matches: ReadonlyMap<string, PromptMatch>;
  readonly query: string;
  readonly now: Date;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleSelected: (id: string) => void;
  /** Rendered in place of the grid when there is nothing to show. */
  readonly empty: ReactNode;
  /** Distinguishes the pinned list from the main results in the a11y tree. */
  readonly label?: string;
}

/** Card view of the library (TASK-011). */
export function PromptGrid({
  prompts,
  parsableIds,
  matches,
  query,
  now,
  selectedIds,
  onToggleSelected,
  empty,
  label = 'Prompts',
}: PromptGridProps) {
  if (prompts.length === 0) return <>{empty}</>;

  return (
    <ul aria-label={`${label}, card view`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {prompts.map((prompt) => (
        <PromptCard
          key={prompt.id}
          prompt={prompt}
          parsable={parsableIds.has(prompt.id)}
          query={query}
          match={matches.get(prompt.id)}
          now={now}
          selected={selectedIds.has(prompt.id)}
          onToggleSelected={onToggleSelected}
        />
      ))}
    </ul>
  );
}
