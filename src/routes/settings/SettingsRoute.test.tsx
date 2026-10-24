import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDataStore } from '@/store/dataStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { renderAppAt } from '@/test/renderApp';

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

  it('does not invent a save button: changes are applied as they change', async () => {
    await openSettings();

    expect(screen.queryByRole('button', { name: /^save/i })).toBeNull();
    expect(screen.getByText(/there is no save button to forget/i)).toBeInTheDocument();
  });
});
