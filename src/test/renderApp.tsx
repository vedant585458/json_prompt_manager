import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { routes } from '@/app/router';
import { createDefaultSettings } from '@/domain/factories';
import { getInitialPreferences, usePreferencesStore } from '@/store/preferencesStore';
import { useUiStore } from '@/store/uiStore';

/**
 * Renders the real application at a given path (TASK-008).
 *
 * Uses a memory router so tests never touch browser history, and returns the
 * router so a test can assert navigation. The data layer still boots for real —
 * in jsdom that means the labelled ephemeral adapter.
 *
 * The UI and preference stores are singletons, so they are reset first: a test
 * that leaves the palette open or switches to the light theme must not change
 * the starting state of the next one.
 */
export function renderAppAt(path = '/') {
  const preferences = getInitialPreferences();
  const defaults = createDefaultSettings();

  useUiStore.setState({
    sidebarOpen: true,
    rightPanel: 'none',
    paletteOpen: false,
    helpOpen: false,
    recentCommandIds: [],
    selectedPromptId: null,
    selectedPromptIds: [],
  });

  usePreferencesStore.setState({
    themePreference: preferences.themePreference,
    resolvedTheme: preferences.resolvedTheme,
    density: defaults.density,
    indentSize: defaults.indentSize,
    autosaveEnabled: defaults.autosaveEnabled,
    autosaveDelayMs: defaults.autosaveDelayMs,
    reducedMotion: defaults.reducedMotion,
  });

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(<App router={router} />);
  return { ...utils, router };
}
