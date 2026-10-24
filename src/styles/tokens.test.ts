import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Structural checks on the design-token layer:
 * - the Tailwind bridge only references tokens that exist,
 * - every color token is defined for both themes (no half-themed color),
 * - the theme-independent scales are present,
 * - color values live only in tokens.css.
 */

const read = (file: string) => readFileSync(join(process.cwd(), 'src/styles', file), 'utf8');

const tokensCss = read('tokens.css');
const themeCss = read('theme.css');
const globalCss = read('global.css');

function themeBlock(startPattern: RegExp, css: string): Record<string, string> {
  const start = css.search(startPattern);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n}', open);
  const block = css.slice(open + 1, close);
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/--pf-([a-z0-9-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) result[name] = value.trim();
  }
  return result;
}

const darkTokens = themeBlock(/^:root,\n\[data-theme='dark'\] \{/m, tokensCss);
const lightTokens = themeBlock(/^\[data-theme='light'\] \{/m, tokensCss);

describe('theme token coverage', () => {
  it('defines a substantial palette for both themes', () => {
    expect(Object.keys(darkTokens).length).toBeGreaterThan(20);
    expect(Object.keys(lightTokens).length).toBeGreaterThan(20);
  });

  it('defines every dark token in the light theme as well', () => {
    const missing = Object.keys(darkTokens).filter((token) => !(token in lightTokens));
    expect(missing).toEqual([]);
  });

  it('overrides surfaces, text, accent, and state colors in the light theme', () => {
    for (const token of [
      'canvas',
      'surface-1',
      'surface-2',
      'ink',
      'ink-muted',
      'line-control',
      'accent',
      'accent-fill',
      'accent-foreground',
      'success',
      'warning',
      'danger',
      'info',
      'focus-ring',
    ]) {
      expect(darkTokens[token], `dark: ${token}`).toBeTruthy();
      expect(lightTokens[token], `light: ${token}`).toBeTruthy();
    }

    expect(darkTokens['canvas']).not.toBe(lightTokens['canvas']);
    expect(darkTokens['accent']).not.toBe(lightTokens['accent']);
    expect(darkTokens['ink']).not.toBe(lightTokens['ink']);
  });
});

describe('Tailwind theme bridge', () => {
  it('maps every color utility to a token defined in both themes', () => {
    const mappings = [...themeCss.matchAll(/--color-([a-z0-9-]+):\s*var\(--pf-([a-z0-9-]+)\)/g)];
    expect(mappings.length).toBeGreaterThan(20);

    const problems: string[] = [];
    for (const match of mappings) {
      const [, colorName, tokenName] = match;
      if (!colorName || !tokenName) continue;
      if (!(tokenName in darkTokens)) problems.push(`dark missing --pf-${tokenName}`);
      if (!(tokenName in lightTokens)) problems.push(`light missing --pf-${tokenName}`);
      if (colorName !== tokenName) problems.push(`--color-${colorName} maps to --pf-${tokenName}`);
    }
    expect(problems).toEqual([]);
  });

  it('bridges typography, radii, motion, and elevation to Tailwind', () => {
    for (const namespace of [
      '--font-sans',
      '--font-display',
      '--font-mono',
      '--text-3xl',
      '--radius-lg',
      '--ease-out-soft',
      '--animate-shimmer',
      '--shadow-panel',
    ]) {
      expect(themeCss).toContain(`${namespace}:`);
    }
  });

  it('defines the theme-dependent variant on the data-theme attribute', () => {
    expect(themeCss).toContain("@custom-variant dark (&:where([data-theme='dark']");
  });
});

describe('scale tokens', () => {
  it('defines spacing, radii, motion, layout, and stacking scales', () => {
    for (const token of [
      '--pf-space-1',
      '--pf-space-16',
      '--pf-radius-pill',
      '--pf-duration-fast',
      '--pf-container-max',
      '--pf-sidebar-width',
      '--pf-z-command',
      '--pf-font-mono',
      '--pf-text-3xl',
      '--pf-tracking-wide',
    ]) {
      expect(tokensCss).toContain(token);
    }
  });
});

describe('token discipline', () => {
  it('keeps color literals out of the theme bridge and global styles', () => {
    expect(themeCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(globalCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('guards reduced motion for both the OS and in-app preference', () => {
    expect(globalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalCss).toContain("[data-reduced-motion='true']");
  });

  it('keeps the storage key stable for the boot script and settings store', () => {
    const source = read('../styles/theme.ts');
    expect(source).toContain("THEME_STORAGE_KEY = 'promptforge.theme'");
  });
});
