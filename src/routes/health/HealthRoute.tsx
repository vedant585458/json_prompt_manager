import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ActivityTimeline } from '@/components/health/ActivityTimeline';
import { HealthAttentionList, StaleGroups } from '@/components/health/HealthAttentionList';
import { HealthDistribution } from '@/components/health/HealthDistribution';
import { HealthSummaryCards } from '@/components/health/HealthSummaryCards';
import { StorageUsage } from '@/components/health/StorageUsage';
import { buttonVariants } from '@/components/ui';
import { describeHealth, describeHealthThresholds, type HealthReport } from '@/domain/health';
import { ACTIVITY_LOG_LIMIT } from '@/domain/invariants';
import { useHealthData } from '@/features/health/useHealthData';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelativeTime } from '@/lib/dates';

/**
 * Health dashboard (TASK-025).
 *
 * Every number on this screen is recomputed from the records in this browser at
 * the instant printed in the header — no cached counts, no sampling, no polling.
 * Each attention row links to the prompt it names, and each distribution links
 * into the library view it counts, so a figure is never a dead end.
 *
 * The definitions at the bottom are part of the report, not documentation
 * elsewhere: "stale" and "invalid" only mean what is written there.
 */

function ReportHeader({
  report,
  refreshedAt,
  refresh,
}: {
  readonly report: HealthReport;
  readonly refreshedAt: Date;
  readonly refresh: () => void;
}) {
  const summary = describeHealth(report);
  const SummaryIcon = summary.tone === 'attention' ? AlertTriangle : CheckCircle2;

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="metadata-rail">Maintenance</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Health</h1>
        <p className="mt-2 flex max-w-prose items-start gap-2 text-sm leading-relaxed text-ink-secondary">
          <SummaryIcon
            aria-hidden="true"
            size={15}
            strokeWidth={1.75}
            className={cn(
              'mt-0.5 shrink-0',
              summary.tone === 'attention' ? 'text-danger' : 'text-success',
            )}
          />
          <span>{summary.text}</span>
        </p>
      </div>

      <div className="flex flex-col items-start gap-2 lg:items-end">
        <button
          type="button"
          onClick={refresh}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'gap-1.5')}
        >
          <RefreshCw aria-hidden="true" size={13} />
          Recompute
        </button>
        <p className="text-2xs leading-relaxed text-ink-muted">
          Computed{' '}
          <time dateTime={refreshedAt.toISOString()} title={formatDateTime(refreshedAt)}>
            {formatRelativeTime(refreshedAt, refreshedAt)}
          </time>{' '}
          · {formatDateTime(refreshedAt)}
        </p>
        <p className="text-2xs text-ink-muted">
          Stale after{' '}
          <Link
            to="/settings"
            className="rounded-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {describeHealthThresholds(report.thresholds)}
          </Link>{' '}
          · change in settings
        </p>
      </div>
    </header>
  );
}

const DEFINITIONS: readonly { readonly term: string; readonly meaning: string }[] = [
  {
    term: 'Will not parse',
    meaning:
      'The stored content fails the same JSON parse and document check the editor runs. These are the only prompts called invalid.',
  },
  {
    term: 'Fails its schema',
    meaning:
      'The document parses but the schema attached to the prompt rejects it. A different problem, listed separately.',
  },
  {
    term: 'Undeclared variable',
    meaning:
      'A {{placeholder}} appears in the text with no matching entry in the prompt’s variables list.',
  },
  {
    term: 'Unused variable',
    meaning: 'A declared variable that no authored string in the document references.',
  },
  {
    term: 'No description',
    meaning: 'The prompt record’s own description field is empty. The document is untouched.',
  },
  {
    term: 'Untouched',
    meaning:
      'Days since the prompt was last saved. Buckets are cumulative: passing a longer threshold also passes every shorter one.',
  },
  {
    term: 'Archived prompts',
    meaning:
      'Counted in the totals, then left out of every per-prompt metric — the archive is not the working set.',
  },
  {
    term: 'Activity',
    meaning: `Events written by real mutations, capped at the ${ACTIVITY_LOG_LIMIT} most recent. Nothing is seeded, and older events are pruned when a new one is written.`,
  },
];

function Definitions({ report }: { readonly report: HealthReport }) {
  return (
    <section
      id="health-definitions"
      aria-labelledby="health-definitions-title"
      className="rounded-lg border border-line bg-surface-1"
    >
      <div className="border-b border-line px-4 py-3.5 sm:px-5">
        <h2 id="health-definitions-title" className="text-sm font-semibold text-ink">
          What these numbers mean
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
          Each metric is a recomputation from stored records, measured at{' '}
          {formatDateTime(report.computedAt)} with thresholds of{' '}
          {describeHealthThresholds(report.thresholds)}.
        </p>
      </div>
      <dl className="divide-y divide-line">
        {DEFINITIONS.map((definition) => (
          <div key={definition.term} className="px-4 py-2.5 sm:px-5">
            <dt className="text-xs font-medium text-ink">{definition.term}</dt>
            <dd className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{definition.meaning}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-2xs text-ink-muted sm:px-5">
        <span>
          Oldest edit{' '}
          <span className="font-mono text-ink-secondary">
            {report.oldestEdit ? formatDateTime(report.oldestEdit) : '—'}
          </span>
        </span>
        <span>
          Newest edit{' '}
          <span className="font-mono text-ink-secondary">
            {report.newestEdit ? formatDateTime(report.newestEdit) : '—'}
          </span>
        </span>
        <span>
          Newest revision{' '}
          <span className="font-mono text-ink-secondary">
            {report.revisions.newestAt ? formatDateTime(report.revisions.newestAt) : '—'}
          </span>
        </span>
        <span>
          Newest activity{' '}
          <span className="font-mono text-ink-secondary">
            {report.activity.newestAt ? formatDateTime(report.activity.newestAt) : '—'}
          </span>
        </span>
      </div>
    </section>
  );
}

export function HealthRoute() {
  const { report, refreshedAt, refresh, activity } = useHealthData();

  return (
    <div className="space-y-4">
      <ReportHeader report={report} refreshedAt={refreshedAt} refresh={refresh} />

      <HealthSummaryCards report={report} />

      <div className="grid gap-3 xl:grid-cols-2">
        <HealthAttentionList
          id="health-invalid"
          title={`Documents that will not parse (${report.invalidDocuments.length})`}
          description="These prompts cannot be opened reliably in the editor until their JSON is repaired."
          items={report.invalidDocuments}
          emptyTitle="Every stored document parses"
          emptyDescription="The parser accepted every active prompt in this library."
          action={{ label: 'Filter the library', to: '/library?validation=unparsable' }}
          now={refreshedAt}
        />

        <HealthAttentionList
          id="health-schema"
          title={`Prompts failing an attached schema (${report.schemaMismatches.length})`}
          description="The document reads back, but the schema it points at rejects it."
          items={report.schemaMismatches}
          emptyTitle="No schema mismatches"
          emptyDescription="Every prompt with an attached schema satisfies it."
          action={{ label: 'Open validation', to: '/validation' }}
          now={refreshedAt}
        />

        <HealthAttentionList
          id="health-variables"
          title={`Undeclared variables (${report.unresolvedVariables.length})`}
          description="Placeholders used in the text with no declaration to fill them."
          items={report.unresolvedVariables}
          emptyTitle="Every placeholder is declared"
          emptyDescription="Nothing in the authored text references a variable that does not exist."
          now={refreshedAt}
        />

        <HealthAttentionList
          id="health-unused"
          title={`Unused variables (${report.unusedVariables.length})`}
          description="Declarations no authored string refers to. Harmless, but usually leftovers."
          items={report.unusedVariables}
          emptyTitle="No unused declarations"
          emptyDescription="Every declared variable appears at least once in the document."
          now={refreshedAt}
        />

        <HealthAttentionList
          id="health-descriptions"
          title={`Prompts without a description (${report.missingDescriptions.length})`}
          description="The library and search read this field; an empty one makes a prompt harder to find."
          items={report.missingDescriptions}
          emptyTitle="Every prompt has a description"
          emptyDescription="All active prompts carry text in their description field."
          now={refreshedAt}
        />

        <HealthDistribution
          id="health-collections"
          title="Prompts per collection"
          description="Active prompts only; a prompt in two collections counts in both."
          rows={report.collections}
          emptyTitle="No collections hold prompts"
          emptyDescription="Create a collection in the library to group prompts by purpose."
          hrefFor={(row) => `/library?collection=${encodeURIComponent(row.id)}`}
          remainder={{
            label: 'not in a collection',
            count: report.withoutCollection,
            href: '/library',
          }}
        />
      </div>

      <HealthDistribution
        id="health-folders"
        title="Prompts per folder"
        description="Active prompts grouped by their folder. Folders nest; the count is the prompt’s own folder."
        rows={report.folders}
        emptyTitle="No folders hold prompts"
        emptyDescription="Folders are optional; prompts can stay unfiled."
        hrefFor={(row) => `/library?folder=${encodeURIComponent(row.id)}`}
        remainder={{
          label: 'unfiled prompts',
          count: report.unfiled,
          href: '/library?folder=unfiled',
        }}
      />

      <div>
        <h2 className="metadata-rail mb-2 px-1">
          Untouched prompts · {describeHealthThresholds(report.thresholds)}
        </h2>
        <StaleGroups thresholds={report.thresholds} stale={report.stale} />
      </div>

      <ActivityTimeline events={activity} now={refreshedAt} />

      <div className="grid gap-3 xl:grid-cols-2">
        <Definitions report={report} />
        <StorageUsage />
      </div>
    </div>
  );
}
