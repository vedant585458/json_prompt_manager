import { FilePlus2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DashboardSection, SectionEmpty } from '@/components/dashboard/DashboardSection';
import { PromptRow } from '@/components/dashboard/PromptRow';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Prompt } from '@/domain/types';

export interface PromptListSectionProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly action?: { readonly label: string; readonly to: string };
  readonly prompts: readonly Prompt[];
  readonly now: Date;
  readonly showPinnedMark?: boolean;
  readonly empty: {
    readonly title: string;
    readonly description: string;
    readonly action?: { readonly label: string; readonly to: string };
  };
}

/**
 * A titled list of prompts with an honest empty state (TASK-010).
 *
 * Rows are the shared `PromptRow`, so recent, favorites, and any later list
 * behave identically and every row goes to a real prompt route.
 */
export function PromptListSection({
  id,
  title,
  description,
  action,
  prompts,
  now,
  showPinnedMark = false,
  empty,
}: PromptListSectionProps) {
  return (
    <DashboardSection id={id} title={title} description={description} action={action}>
      {prompts.length === 0 ? (
        <SectionEmpty title={empty.title} description={empty.description} action={empty.action} />
      ) : (
        <ul className="p-1.5">
          {prompts.map((prompt) => (
            <PromptRow key={prompt.id} prompt={prompt} now={now} showPinnedMark={showPinnedMark} />
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

export interface RecentListProps {
  readonly prompts: readonly Prompt[];
  readonly now: Date;
  /** True when the whole library is empty, not just this list. */
  readonly libraryEmpty: boolean;
}

/** The five prompts edited most recently. */
export function RecentList({ prompts, now, libraryEmpty }: RecentListProps) {
  return (
    <PromptListSection
      id="dashboard-recent"
      title="Recently edited"
      description="The last five live prompts you touched."
      action={{ label: 'All prompts', to: '/library' }}
      prompts={prompts}
      now={now}
      showPinnedMark
      empty={{
        title: libraryEmpty ? 'No prompts yet' : 'Nothing edited yet',
        description: libraryEmpty
          ? 'Create the first one, or start from a template and make it yours.'
          : 'Everything in the library is archived. Archived prompts stay out of this list until you restore them.',
        action: libraryEmpty
          ? { label: 'Create a prompt', to: '/composer' }
          : { label: 'Browse the library', to: '/library' },
      }}
    />
  );
}

export interface FavoritesListProps {
  readonly prompts: readonly Prompt[];
  readonly now: Date;
}

/** Starred prompts, for the shortcut the dashboard exists to provide. */
export function FavoritesList({ prompts, now }: FavoritesListProps) {
  return (
    <DashboardSection
      id="dashboard-favorites"
      title="Favorites"
      description="Starred prompts, always one click away."
      action={{ label: 'Filter library', to: '/library?filter=favorites' }}
    >
      {prompts.length === 0 ? (
        <SectionEmpty
          title="No favorites yet"
          description="Star a prompt in the library and it will be pinned to this list."
          action={{ label: 'Open the library', to: '/library' }}
        />
      ) : (
        <ul className="p-1.5">
          {prompts.map((prompt) => (
            <PromptRow key={prompt.id} prompt={prompt} now={now} />
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

/** Shown instead of the dashboard's lists when the library is empty. */
export function LibraryEmptyNotice({ className }: { readonly className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed border-line bg-surface-1 p-5',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted"
        >
          <FilePlus2 size={16} strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">This library is empty</p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-muted">
            Everything below fills in as you create prompts. Nothing is imported or generated for
            you, and nothing leaves this device.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/composer" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
          New prompt
        </Link>
        <Link to="/templates" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
          Start from a template
        </Link>
      </div>
    </div>
  );
}
