import { AlertTriangle, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTheme } from '@/app/providers/theme-context';
import { Card, Field, RadioGroup, Select, StatusPill, Switch } from '@/components/ui';
import { HEALTH_THRESHOLD_OPTIONS, describeHealthThresholds } from '@/domain/health';
import { AUTOSAVE_DELAY } from '@/domain/invariants';
import type { HealthThresholds } from '@/domain/types';
import { THEME_PREFERENCES, type ThemePreference } from '@/styles/theme';
import { describeDataError, useDataStore } from '@/store/dataStore';
import { usePreferencesStore } from '@/store/preferencesStore';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

const THEME_LABELS: Record<ThemePreference, { label: string; hint: string }> = {
  dark: { label: 'Dark', hint: 'The default: layered neutrals, chartreuse accent.' },
  light: { label: 'Light', hint: 'Warm paper tones for bright rooms.' },
  system: { label: 'System', hint: 'Follow the operating system setting.' },
};

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
] as const;

/** Day choices for one threshold, with the current value added if it is unusual. */
function thresholdOptions(key: keyof HealthThresholds, current: number) {
  const choices = HEALTH_THRESHOLD_OPTIONS[key];
  const values = choices.includes(current)
    ? [...choices]
    : [...choices, current].sort((a, b) => a - b);
  return values.map((days) => ({ value: String(days), label: `${days} days` }));
}

const DELAY_OPTIONS = [
  { value: '500', label: '0.5 seconds' },
  { value: String(AUTOSAVE_DELAY.defaultValue), label: '0.9 seconds (default)' },
  { value: '1500', label: '1.5 seconds' },
  { value: '3000', label: '3 seconds' },
] as const;

/**
 * Settings (TASK-008).
 *
 * Only the preferences that exist: theme, editor density, and autosave. Each
 * change applies immediately and is written through the settings repository;
 * the status line reports exactly what happened, including when storage is
 * ephemeral and the value will not survive a reload.
 */
export function SettingsRoute() {
  const { preference, setPreference } = useTheme();
  const density = usePreferencesStore((state) => state.density);
  const autosaveEnabled = usePreferencesStore((state) => state.autosaveEnabled);
  const autosaveDelayMs = usePreferencesStore((state) => state.autosaveDelayMs);
  const setDensity = usePreferencesStore((state) => state.setDensity);
  const setAutosaveEnabled = usePreferencesStore((state) => state.setAutosaveEnabled);
  const setAutosaveDelay = usePreferencesStore((state) => state.setAutosaveDelay);
  const healthThresholds = usePreferencesStore((state) => state.healthThresholds);
  const setHealthThresholds = usePreferencesStore((state) => state.setHealthThresholds);

  const mode = useDataStore((state) => state.mode);
  const saveSettings = useDataStore((state) => state.saveSettings);

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = useCallback(
    (apply: () => void) => {
      apply();
      setStatus('saving');
      setFailure(null);

      void (async () => {
        try {
          const base = useDataStore.getState().settings ?? undefined;
          await saveSettings(usePreferencesStore.getState().toSettings(base));
          if (mounted.current) setStatus('saved');
        } catch (error) {
          if (!mounted.current) return;
          setStatus('failed');
          setFailure(describeDataError(error));
        }
      })();
    },
    [saveSettings],
  );

  const statusMessage: string =
    status === 'saving'
      ? 'Saving preference…'
      : status === 'saved'
        ? mode === 'durable'
          ? 'Saved to this browser.'
          : 'Applied for this session only — storage is in memory, so this resets on reload.'
        : status === 'failed'
          ? 'The change applies now but could not be saved.'
          : 'Changes apply immediately and save to this browser.';

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="metadata-rail">Preferences</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">Settings</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-secondary">
          These preferences are stored with your library. They apply right away — there is no save
          button to forget.
        </p>
      </header>

      <div aria-live="polite" className="mt-5 flex flex-wrap items-center gap-2">
        <StatusPill
          tone={status === 'failed' ? 'danger' : status === 'saved' ? 'success' : 'info'}
          icon={
            status === 'failed' ? (
              <AlertTriangle size={12} strokeWidth={1.75} />
            ) : status === 'saved' ? (
              <CheckCircle2 size={12} strokeWidth={1.75} />
            ) : (
              <SlidersHorizontal size={12} strokeWidth={1.75} />
            )
          }
        >
          {status === 'failed' ? 'Not saved' : status === 'saved' ? 'Saved' : 'Preferences'}
        </StatusPill>
        <p className="text-xs text-ink-muted">{statusMessage}</p>
      </div>
      {failure ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-danger">
          {failure}
        </p>
      ) : null}

      <div className="mt-8 space-y-5">
        <Card as="section" aria-labelledby="settings-theme" className="space-y-4">
          <div>
            <h2 id="settings-theme" className="text-sm font-semibold text-ink">
              Color theme
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Dark is the designed default. Both themes use the same tokens and pass the contrast
              checks.
            </p>
          </div>
          <RadioGroup
            label="Color theme"
            name="theme-preference"
            value={preference}
            onValueChange={(next) => {
              const candidate = next as ThemePreference;
              if (!THEME_PREFERENCES.includes(candidate)) return;
              persist(() => setPreference(candidate));
            }}
            options={THEME_PREFERENCES.map((option) => ({
              value: option,
              label: THEME_LABELS[option].label,
              hint: THEME_LABELS[option].hint,
            }))}
          />
        </Card>

        <Card as="section" aria-labelledby="settings-density" className="space-y-4">
          <div>
            <h2 id="settings-density" className="text-sm font-semibold text-ink">
              Editor density
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Compact tightens line spacing in editors and lists. Applied when the editor ships.
            </p>
          </div>
          <RadioGroup
            label="Editor density"
            name="editor-density"
            orientation="horizontal"
            value={density}
            onValueChange={(next) => {
              if (next !== 'comfortable' && next !== 'compact') return;
              persist(() => setDensity(next));
            }}
            options={DENSITY_OPTIONS.map((option) => ({ ...option }))}
          />
        </Card>

        <Card as="section" aria-labelledby="settings-autosave" className="space-y-4">
          <div>
            <h2 id="settings-autosave" className="text-sm font-semibold text-ink">
              Autosave
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Autosave writes after you stop typing. Manual saves always remain available.
            </p>
          </div>

          <Switch
            id="autosave-enabled"
            name="autosave-enabled"
            label="Autosave changes"
            hint="When off, edits stay in the editor until you save."
            checked={autosaveEnabled}
            onCheckedChange={(checked) => persist(() => setAutosaveEnabled(checked))}
          />

          <Field
            label="Autosave delay"
            hint={
              autosaveEnabled
                ? `How long to wait after the last keystroke (${AUTOSAVE_DELAY.min}–${AUTOSAVE_DELAY.max} ms).`
                : 'Turn autosave on to use a delay.'
            }
          >
            {(control) => (
              <Select
                {...control}
                disabled={!autosaveEnabled}
                options={DELAY_OPTIONS.map((option) => ({ ...option }))}
                value={String(autosaveDelayMs)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  persist(() => setAutosaveDelay(next));
                }}
              />
            )}
          </Field>
        </Card>
        <Card as="section" aria-labelledby="settings-health" className="space-y-4">
          <div>
            <h2 id="settings-health" className="text-sm font-semibold text-ink">
              Health thresholds
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              The ages at which the health dashboard calls a prompt untouched (
              {describeHealthThresholds(healthThresholds)}). The buckets are cumulative, and every
              report prints the values it used.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Attention after" hint="Surfaced for a look.">
              {(control) => (
                <Select
                  {...control}
                  options={thresholdOptions('attentionDays', healthThresholds.attentionDays)}
                  value={String(healthThresholds.attentionDays)}
                  onChange={(event) =>
                    persist(() =>
                      setHealthThresholds({
                        ...healthThresholds,
                        attentionDays: Number(event.target.value),
                      }),
                    )
                  }
                />
              )}
            </Field>

            <Field label="Stale after" hint="Second bucket, counted separately.">
              {(control) => (
                <Select
                  {...control}
                  options={thresholdOptions('staleDays', healthThresholds.staleDays)}
                  value={String(healthThresholds.staleDays)}
                  onChange={(event) =>
                    persist(() =>
                      setHealthThresholds({
                        ...healthThresholds,
                        staleDays: Number(event.target.value),
                      }),
                    )
                  }
                />
              )}
            </Field>

            <Field label="Dormant after" hint="Longest bucket.">
              {(control) => (
                <Select
                  {...control}
                  options={thresholdOptions('dormantDays', healthThresholds.dormantDays)}
                  value={String(healthThresholds.dormantDays)}
                  onChange={(event) =>
                    persist(() =>
                      setHealthThresholds({
                        ...healthThresholds,
                        dormantDays: Number(event.target.value),
                      }),
                    )
                  }
                />
              )}
            </Field>
          </div>

          <p className="text-2xs leading-relaxed text-ink-muted">
            Day counts only — the health report compares them with the last save time of each
            prompt. Archived prompts are never counted as untouched.
          </p>
        </Card>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-muted">
        Editor indentation and reduced-motion preferences are stored already but get their controls
        with the editor (TASK-014). Preferences never leave this browser.
      </p>
    </div>
  );
}
