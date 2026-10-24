import { LayoutTemplate, Plus, Search } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { ActivityRail } from '@/components/dashboard/ActivityRail';
import { AttentionList } from '@/components/dashboard/AttentionList';
import { FirstRunPanel } from '@/components/dashboard/FirstRunPanel';
import { PinnedRail } from '@/components/dashboard/PinnedRail';
import { FavoritesList, LibraryEmptyNotice, RecentList } from '@/components/dashboard/RecentList';
import { StatStrip } from '@/components/dashboard/StatStrip';
import { TemplatePreview } from '@/components/dashboard/TemplatePreview';
import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { buttonVariants, Kbd } from '@/components/ui';
import { createDefaultSettings } from '@/domain/factories';
import { PALETTE_SHORTCUT } from '@/lib/commands/coreCommands';
import {
  ariaKeyshortcuts,
  detectPlatform,
  parseShortcut,
  shortcutTokens,
} from '@/lib/commands/shortcuts';
import { cn } from '@/lib/cn';
import { formatLongDate, greetingFor } from '@/lib/dates';
import { useDataStoreApi } from '@/store/dataStoreContext';
import { describeDashboardSummary } from '@/store/dashboard';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';

/** Greeting, date, one-line summary, and the three ways in. */
function DashboardHeader({ summary, now }: { readonly summary: string; readonly now: Date }) {
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const paletteShortcut = useMemo(() => parseShortcut(PALETTE_SHORTCUT), []);
  const paletteKeys = useMemo(
    () => shortcutTokens(paletteShortcut, detectPlatform())[0] ?? [],
    [paletteShortcut],
  );

  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="metadata-rail">
          {greetingFor(now)} · {formatLongDate(now)}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Dashboard</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">{summary}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/composer"
          className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}
        >
          <Plus aria-hidden="true" size={15} />
          New prompt
        </Link>
        <Link
          to="/templates"
          className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'gap-2')}
        >
          <LayoutTemplate aria-hidden="true" size={15} />
          From template
        </Link>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-keyshortcuts={ariaKeyshortcuts(paletteShortcut)}
          className={cn(buttonVariants({ variant: 'ghost', size: 'md' }), 'gap-2')}
        >
          <Search aria-hidden="true" size={15} />
          Search
          <span className="hidden items-center gap-1 sm:flex" aria-hidden="true">
            {paletteKeys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        </button>
      </div>
    </header>
  );
}

/**
 * Dashboard (TASK-010).
 *
 * The landing screen reads stored records and nothing else: counts, recents,
 * pinned prompts, favorites, template previews, parse failures, and the recent
 * activity log. Every value is derived at render time, every tile links to the
 * view it counts, and the first-run guide is shown only while onboarding is
 * unset.
 */
export function DashboardRoute() {
  const store = useDataStoreApi();
  const data = useDashboardData();
  const settings = store((state) => state.settings);
  const saveSettings = store((state) => state.saveSettings);
  const now = useMemo(() => new Date(), []);
  const summary = describeDashboardSummary(data.counts);

  const dismissFirstRun = useCallback(async () => {
    const base = store.getState().settings ?? createDefaultSettings();
    // `toSettings` preserves the fields this screen does not own (seedVersion)
    // and adopts the live theme and editor preferences.
    const next = usePreferencesStore.getState().toSettings(base);
    await saveSettings({ ...next, onboardedAt: new Date().toISOString() });
  }, [saveSettings, store]);

  const showFirstRun = settings !== null && settings.onboardedAt === null;

  return (
    <div className="flex flex-col gap-5">
      <DashboardHeader summary={summary} now={now} />

      {showFirstRun ? <FirstRunPanel onDismiss={dismissFirstRun} /> : null}

      <StatStrip counts={data.counts} />

      {data.isEmpty ? <LibraryEmptyNotice /> : null}

      <PinnedRail prompts={data.pinned} now={now} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <RecentList prompts={data.recent} now={now} libraryEmpty={data.isEmpty} />
          <AttentionList items={data.attention} now={now} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <FavoritesList prompts={data.favorites} now={now} />
          <ActivityRail events={data.activity} now={now} />
        </div>
      </div>

      <TemplatePreview templates={data.templates} />
    </div>
  );
}
