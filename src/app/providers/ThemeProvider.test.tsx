import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { useTheme } from '@/app/providers/theme-context';
import { usePreferencesStore } from '@/store/preferences';
import { THEME_STORAGE_KEY } from '@/styles/theme';
import { mockMatchMedia } from '@/test/matchMedia';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

function Probe() {
  const { preference, resolved } = useTheme();
  return (
    <p>
      preference: {preference} resolved: {resolved}
    </p>
  );
}

function renderProvider(children = <Probe />) {
  return render(<ThemeProvider>{children}</ThemeProvider>);
}

beforeEach(() => {
  usePreferencesStore.setState({ themePreference: 'system', resolvedTheme: 'dark' });
});

describe('ThemeProvider', () => {
  it('applies the OS preference when the user follows the system', () => {
    mockMatchMedia(false);
    renderProvider();

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByText(/preference: system resolved: light/)).toBeInTheDocument();
  });

  it('defaults to dark on a dark OS preference', () => {
    mockMatchMedia(true);
    renderProvider();

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('reacts to OS changes while following the system', () => {
    const media = mockMatchMedia(true);
    renderProvider();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(media.listenerCount()).toBe(1);

    act(() => media.setMatches(false));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByText(/resolved: light/)).toBeInTheDocument();
  });

  it('stops following the OS once the user picks an explicit theme', async () => {
    const user = userEvent.setup();
    const media = mockMatchMedia(true);
    renderProvider(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(media.listenerCount()).toBe(0);

    act(() => media.setMatches(false));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('reflects the active preference on the theme control', async () => {
    const user = userEvent.setup();
    renderProvider(<ThemeToggle />);

    const systemButton = screen.getByRole('button', { name: 'System' });
    expect(systemButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('still applies the theme when persistence fails', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    renderProvider(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    setItem.mockRestore();
  });

  it('throws a clear error when useTheme is used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow(/useTheme must be used inside a ThemeProvider/);

    consoleError.mockRestore();
  });
});
