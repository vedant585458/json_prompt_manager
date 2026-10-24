import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '@/app/providers/theme-context';
import { THEME_PREFERENCES, type ThemePreference } from '@/styles/theme';
import { cn } from '@/lib/cn';

const OPTIONS: Record<ThemePreference, { label: string; Icon: typeof Sun }> = {
  system: { label: 'System', Icon: Monitor },
  dark: { label: 'Dark', Icon: Moon },
  light: { label: 'Light', Icon: Sun },
};

/**
 * Segmented theme control (TASK-002).
 *
 * A real control: it changes and persists the theme. TASK-003 rebuilds it on
 * the design-system primitives; logic and accessible naming stay here.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-line bg-surface-1 p-1',
        className,
      )}
    >
      {THEME_PREFERENCES.map((option) => {
        const { label, Icon } = OPTIONS[option];
        const active = preference === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => setPreference(option)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1.5 text-xs font-medium transition-colors duration-[var(--pf-duration-fast)]',
              active
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
