import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { App } from '@/app/App';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

describe('App foundation proof', () => {
  it('renders a single top-level heading and states its scope honestly', () => {
    renderApp();

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Prompt Observatory' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/this page proves the tokens/i)).toBeVisible();
    expect(screen.getByText(/foundation preview only/i)).toBeVisible();
  });

  it('renders every token section', () => {
    renderApp();

    for (const heading of [
      'Layered surfaces',
      'Type hierarchy',
      'Semantic states',
      'Accent and focus',
      'Spacing and radii',
      'Elevation, motion, and loading',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
  });

  it('exposes only the working theme control as a button', () => {
    renderApp();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'Color theme' })).toBeInTheDocument();
    expect(buttons.map((button) => button.textContent)).toEqual(['System', 'Dark', 'Light']);
  });

  it('switches and persists the theme from the header control', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('promptforge.theme')).toBe('light');
  });

  it('keeps state and semantics without bypassing landmarks', () => {
    renderApp();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders without React console errors or warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderApp();

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
