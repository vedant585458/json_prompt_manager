import { createContext, useContext } from 'react';

import type { ResolvedTheme, ThemePreference } from '@/styles/theme';

export interface ThemeContextValue {
  /** What the user selected: follow the OS, or force dark/light. */
  preference: ThemePreference;
  /** The theme currently applied to the document. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }
  return value;
}
