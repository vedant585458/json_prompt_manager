import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings } from '@/domain/factories';
import { useDataStore } from '@/store/dataStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { renderAppAt } from '@/test/renderApp';
import { renderAppWithData } from '@/test/renderAppWithData';
import { stubDownloads } from '@/test/downloads';
import { createTransferFixture } from '@/test/transferFixture';

async function openSettings() {
  const user = userEvent.setup();
  const result = renderAppAt('/settings');
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  return { ...result, user };
}

describe('settings route', () => {
  it('applies the theme immediately and reports where it was saved', async () => {
    const { user } = await openSettings();

    await user.click(screen.getByRole('radio', { name: 'Light' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(usePreferencesStore.getState().themePreference).toBe('light');

    // jsdom has no IndexedDB, so the honest message is "session only".
    expect(await screen.findByText(/Applied for this session only/i)).toBeInTheDocument();
    expect(useDataStore.getState().settings?.theme).toBe('light');
  });

  it('wires editor density to the preferences store and the settings record', async () => {
    const { user } = await openSettings();

    await user.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(usePreferencesStore.getState().density).toBe('compact');

    await screen.findByText(/Applied for this session only/i);
    expect(useDataStore.getState().settings?.density).toBe('compact');
  });

  it('disables the autosave delay while autosave is off, then saves both values', async () => {
    const { user } = await openSettings();

    const autosave = screen.getByRole('switch', { name: 'Autosave changes' });
    const delay = screen.getByLabelText('Autosave delay');
    expect(delay).toBeEnabled();

    await user.click(autosave);

    expect(usePreferencesStore.getState().autosaveEnabled).toBe(false);
    expect(delay).toBeDisabled();
    expect(screen.getByText(/Turn autosave on to use a delay/i)).toBeInTheDocument();

    await user.click(autosave);
    expect(delay).toBeEnabled();

    await user.selectOptions(delay, '1500');
    expect(usePreferencesStore.getState().autosaveDelayMs).toBe(1500);

    await screen.findByText(/Applied for this session only/i);
    expect(useDataStore.getState().settings?.autosaveDelayMs).toBe(1500);
  });

  it('saves health thresholds to the settings record', async () => {
    const { user } = await openSettings();

    const attention = screen.getByLabelText('Attention after');
    await user.selectOptions(attention, '45');

    expect(usePreferencesStore.getState().healthThresholds.attentionDays).toBe(45);

    await screen.findByText(/Applied for this session only/i);
    expect(useDataStore.getState().settings?.healthThresholds.attentionDays).toBe(45);
    // The other two thresholds keep their stored values.
    expect(useDataStore.getState().settings?.healthThresholds.staleDays).toBe(60);
  });

  it('does not invent a save button: changes are applied as they change', async () => {
    await openSettings();

    expect(screen.queryByRole('button', { name: /^save/i })).toBeNull();
    expect(screen.getByText(/there is no save button to forget/i)).toBeInTheDocument();
  });

  it('downloads a full backup that holds the library and nothing private', async () => {
    const downloads = stubDownloads();
    try {
      const fixture = createTransferFixture();
      const repositories = await createInMemoryRepositories({
        prompts: fixture.prompts,
        folders: fixture.folders,
        collections: fixture.collections,
        schemas: fixture.schemas,
        snippets: fixture.snippets,
        templates: fixture.templates,
        testCases: fixture.testCases,
        revisions: fixture.revisions,
        settings: { ...createDefaultSettings(), onboardedAt: '2026-01-02T09:00:00.000Z' },
      });

      const { store } = renderAppWithData({ repositories, path: '/settings', mode: 'durable' });
      const user = userEvent.setup();

      expect(await screen.findByRole('heading', { name: 'Your data' })).toBeVisible();
      expect(screen.getByText(/2 prompts and 2 snapshots/)).toBeVisible();

      await user.click(screen.getByRole('button', { name: 'Download a backup' }));

      expect(await screen.findByText('Backup downloaded')).toBeVisible();
      expect(downloads.lastFileName()).toMatch(/^promptforge-backup-\d{4}-\d{2}-\d{2}\.json$/);

      const blob = downloads.createObjectURL.mock.calls[0]?.[0];
      const parsed = JSON.parse((await blob?.text()) ?? '{}') as {
        manifest: { scope: string; counts: { prompts: number } };
        prompts: unknown[];
      };

      expect(parsed.manifest.scope).toBe('library');
      expect(parsed.manifest.counts.prompts).toBe(2);
      expect(parsed.prompts).toHaveLength(2);

      // The export is recorded, and it changed nothing else.
      await waitFor(() => expect(store.getState().activity[0]?.type).toBe('exported'));
      expect(store.getState().prompts).toHaveLength(2);
    } finally {
      downloads.restore();
    }
  });

  it('opens the one import dialog from the data card', async () => {
    const repositories = await createInMemoryRepositories({
      settings: { ...createDefaultSettings(), onboardedAt: '2026-01-02T09:00:00.000Z' },
    });

    renderAppWithData({ repositories, path: '/settings', mode: 'durable' });
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: 'Your data' });
    await user.click(screen.getByRole('button', { name: 'Import from file' }));

    expect(await screen.findByRole('heading', { name: 'Import from a file' })).toBeVisible();
  });
});
