import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

/**
 * The inline boot script in index.html is what prevents a flash of the wrong
 * theme: it sets data-theme before the first paint. It cannot import the TS
 * theme module, so these tests execute it in a sandbox to prove its behavior
 * and catch drift from src/styles/theme.ts.
 */

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
  (match) => match[1] ?? '',
);
const bootScript: string = inlineScripts[0] ?? '';

interface BootResult {
  attributes: Record<string, string>;
  style: Record<string, string>;
}

function runBootScript(options: {
  stored?: string | null;
  prefersDark?: boolean;
  storageThrows?: boolean;
}): BootResult {
  const { stored = null, prefersDark = true, storageThrows = false } = options;
  const attributes: Record<string, string> = {};
  const style: Record<string, string> = {};

  const sandbox = {
    window: {
      localStorage: {
        getItem: () => {
          if (storageThrows) throw new Error('storage blocked');
          return stored;
        },
      },
      matchMedia: (query: string) => ({ matches: prefersDark, media: query }),
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
        style,
      },
    },
  };

  runInNewContext(bootScript, sandbox);
  return { attributes, style };
}

describe('theme boot script', () => {
  it('is present in index.html before the application module', () => {
    expect(bootScript).toBeTruthy();
    expect(bootScript).toContain('promptforge.theme');
    expect(html.indexOf(bootScript ?? '')).toBeLessThan(html.indexOf('/src/main.tsx'));
  });

  it('applies the OS preference when no preference is stored', () => {
    expect(runBootScript({ prefersDark: true }).attributes['data-theme']).toBe('dark');
    expect(runBootScript({ prefersDark: false }).attributes['data-theme']).toBe('light');
  });

  it('applies a stored preference over the OS preference', () => {
    expect(runBootScript({ stored: 'light', prefersDark: true }).attributes['data-theme']).toBe(
      'light',
    );
    expect(runBootScript({ stored: 'dark', prefersDark: false }).attributes['data-theme']).toBe(
      'dark',
    );
  });

  it('ignores corrupt stored values', () => {
    expect(runBootScript({ stored: 'sepia', prefersDark: false }).attributes['data-theme']).toBe(
      'light',
    );
    expect(
      runBootScript({ stored: '{"theme":"light"}', prefersDark: true }).attributes['data-theme'],
    ).toBe('dark');
  });

  it('sets color-scheme alongside the theme attribute', () => {
    const result = runBootScript({ stored: 'light', prefersDark: true });
    expect(result.attributes['data-theme']).toBe('light');
    expect(result.style.colorScheme).toBe('light');
  });

  it('falls back to dark when storage access throws', () => {
    const result = runBootScript({ storageThrows: true, prefersDark: false });
    expect(result.attributes['data-theme']).toBe('dark');
    expect(result.style.colorScheme).toBe('dark');
  });
});
