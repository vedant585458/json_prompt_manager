import {
  Archive,
  FileQuestion,
  FileText,
  History,
  Layers,
  ListChecks,
  ShieldAlert,
  Variable,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { HealthReport } from '@/domain/health';
import { cn } from '@/lib/cn';
import { libraryFilterHref } from '@/lib/libraryLinks';

interface HealthCard {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  readonly icon: LucideIcon;
  /** A real destination, or `null` when there is nowhere exact to go. */
  readonly to: string | null;
  /** True for counts that are problems rather than inventory. */
  readonly problem?: boolean;
}

function hintFor(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The health report's headline numbers (TASK-025).
 *
 * Every value is read from `HealthReport`, never recomputed here, and every
 * card that can link does: the invalid-document card opens the library filtered
 * to documents that will not parse, the archived card opens the archive. A card
 * whose metric has no exact filter is deliberately not a link, so nothing looks
 * clickable that is not.
 */
export function HealthSummaryCards({ report }: { readonly report: HealthReport }) {
  const cards: readonly HealthCard[] = [
    {
      key: 'active',
      label: 'Active prompts',
      value: report.totals.active,
      hint: `${report.totals.all} stored in total`,
      icon: Layers,
      to: '/library',
    },
    {
      key: 'archived',
      label: 'Archived',
      value: report.totals.archived,
      hint: 'outside the working set',
      icon: Archive,
      to: libraryFilterHref('archived'),
    },
    {
      key: 'invalid',
      label: 'Will not parse',
      value: report.invalidDocuments.length,
      hint: hintFor(report.invalidDocuments.length, 'document', 'documents'),
      icon: FileQuestion,
      to: '/library?validation=unparsable',
      problem: true,
    },
    {
      key: 'schema',
      label: 'Fail their schema',
      value: report.schemaMismatches.length,
      hint: hintFor(report.schemaMismatches.length, 'prompt', 'prompts'),
      icon: ShieldAlert,
      to: '/validation',
      problem: true,
    },
    {
      key: 'unresolved',
      label: 'Undeclared variables',
      value: report.unresolvedVariables.length,
      hint: 'used in the text, never declared',
      icon: Variable,
      to: null,
      problem: true,
    },
    {
      key: 'unused',
      label: 'Unused variables',
      value: report.unusedVariables.length,
      hint: 'declared, never used',
      icon: ListChecks,
      to: null,
    },
    {
      key: 'descriptions',
      label: 'No description',
      value: report.missingDescriptions.length,
      hint: 'empty description field',
      icon: FileText,
      to: null,
    },
    {
      key: 'revisions',
      label: 'Revisions',
      value: report.revisions.total,
      hint: `${report.revisions.promptsWithHistory} ${
        report.revisions.promptsWithHistory === 1 ? 'prompt has' : 'prompts have'
      } history`,
      icon: History,
      to: libraryFilterHref('snapshots'),
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const alert = card.problem === true && card.value > 0;

        const body = (
          <>
            <span className="flex items-center gap-1.5 text-ink-muted group-hover:text-ink-secondary">
              <Icon aria-hidden="true" size={13} strokeWidth={1.75} />
              <span className="metadata-rail">{card.label}</span>
            </span>
            <span
              className={cn(
                'font-display text-2xl leading-none tabular',
                alert ? 'text-danger' : 'text-ink',
              )}
            >
              {card.value}
            </span>
            <span className="text-2xs leading-relaxed text-ink-muted">{card.hint}</span>
          </>
        );

        const shell = cn(
          'flex h-full flex-col gap-1 rounded-lg border bg-surface-1 px-3.5 py-3',
          'transition-colors duration-[var(--pf-duration-fast)]',
          alert ? 'border-danger/40' : 'border-line',
        );

        return (
          <li key={card.key} className="min-w-0">
            {card.to === null ? (
              <div className={shell}>{body}</div>
            ) : (
              <Link
                to={card.to}
                className={cn(
                  shell,
                  'group hover:border-line-strong hover:bg-surface-2',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
              >
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
