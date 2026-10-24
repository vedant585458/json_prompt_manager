#!/usr/bin/env node
/**
 * WCAG contrast gate for PromptForge design tokens (TASK-002).
 *
 * Parses the theme blocks in src/styles/tokens.css and verifies every
 * text/UI pairing the tokens are meant to support. Fails the process when a
 * pairing falls below its threshold, so the documented contrast table can
 * never silently drift from the CSS.
 *
 * Usage:
 *   npm run check:contrast            # human-readable report, exit 1 on failure
 *   npm run check:contrast -- --markdown   # Markdown table for docs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokensPath = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url));

/** @typedef {{ label: string, fg: string, bg: string, min: number, role: 'text' | 'ui' }} Pair */

const PAIRS = /** @type {Pair[]} */ ([
  { label: 'Primary text on canvas', fg: 'ink', bg: 'canvas', min: 4.5, role: 'text' },
  { label: 'Primary text on surface-1', fg: 'ink', bg: 'surface-1', min: 4.5, role: 'text' },
  { label: 'Primary text on surface-2', fg: 'ink', bg: 'surface-2', min: 4.5, role: 'text' },
  { label: 'Primary text on surface-3', fg: 'ink', bg: 'surface-3', min: 4.5, role: 'text' },
  {
    label: 'Secondary text on surface-1',
    fg: 'ink-secondary',
    bg: 'surface-1',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'Secondary text on surface-2',
    fg: 'ink-secondary',
    bg: 'surface-2',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'Secondary text on surface-3',
    fg: 'ink-secondary',
    bg: 'surface-3',
    min: 4.5,
    role: 'text',
  },
  { label: 'Muted text on surface-1', fg: 'ink-muted', bg: 'surface-1', min: 4.5, role: 'text' },
  { label: 'Muted text on surface-2', fg: 'ink-muted', bg: 'surface-2', min: 4.5, role: 'text' },
  { label: 'Muted text on surface-3', fg: 'ink-muted', bg: 'surface-3', min: 4.5, role: 'text' },
  { label: 'Accent text on surface-1', fg: 'accent', bg: 'surface-1', min: 4.5, role: 'text' },
  { label: 'Accent text on canvas', fg: 'accent', bg: 'canvas', min: 4.5, role: 'text' },
  { label: 'Accent text on accent-soft', fg: 'accent', bg: 'accent-soft', min: 4.5, role: 'text' },
  {
    label: 'JSON key on editor background',
    fg: 'editor-key',
    bg: 'editor-bg',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'JSON string on editor background',
    fg: 'editor-string',
    bg: 'editor-bg',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'JSON number on editor background',
    fg: 'editor-number',
    bg: 'editor-bg',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'JSON literal on editor background',
    fg: 'editor-literal',
    bg: 'editor-bg',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'JSON punctuation on editor background',
    fg: 'editor-punct',
    bg: 'editor-bg',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'Editor gutter on editor background',
    fg: 'editor-gutter',
    bg: 'editor-bg',
    min: 4.5,
    role: 'text',
  },
  {
    label: 'Accent-fill label',
    fg: 'accent-foreground',
    bg: 'accent-fill',
    min: 4.5,
    role: 'text',
  },
  { label: 'Success text on surface-1', fg: 'success', bg: 'surface-1', min: 4.5, role: 'text' },
  {
    label: 'Success text on success-soft',
    fg: 'success',
    bg: 'success-soft',
    min: 4.5,
    role: 'text',
  },
  { label: 'Warning text on surface-1', fg: 'warning', bg: 'surface-1', min: 4.5, role: 'text' },
  {
    label: 'Warning text on warning-soft',
    fg: 'warning',
    bg: 'warning-soft',
    min: 4.5,
    role: 'text',
  },
  { label: 'Danger text on surface-1', fg: 'danger', bg: 'surface-1', min: 4.5, role: 'text' },
  { label: 'Danger text on danger-soft', fg: 'danger', bg: 'danger-soft', min: 4.5, role: 'text' },
  { label: 'Info text on surface-1', fg: 'info', bg: 'surface-1', min: 4.5, role: 'text' },
  { label: 'Info text on info-soft', fg: 'info', bg: 'info-soft', min: 4.5, role: 'text' },
  {
    label: 'Control boundary on surface-1',
    fg: 'line-control',
    bg: 'surface-1',
    min: 3,
    role: 'ui',
  },
  { label: 'Strong boundary on surface-1', fg: 'line-strong', bg: 'surface-1', min: 3, role: 'ui' },
  { label: 'Focus ring on canvas', fg: 'focus-ring', bg: 'canvas', min: 3, role: 'ui' },
  { label: 'Focus ring on surface-1', fg: 'focus-ring', bg: 'surface-1', min: 3, role: 'ui' },
]);

const css = readFileSync(tokensPath, 'utf8');

/** Extract `--pf-*: #hex;` declarations from a named block. */
function readBlock(startPattern) {
  const startIndex = css.search(startPattern);
  if (startIndex === -1) {
    throw new Error(`Could not find theme block: ${startPattern}`);
  }
  const openIndex = css.indexOf('{', startIndex);
  const closeIndex = css.indexOf('\n}', openIndex);
  const block = css.slice(openIndex + 1, closeIndex);
  /** @type {Record<string, string>} */
  const tokens = {};
  for (const match of block.matchAll(/--pf-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
    const [, name, value] = match;
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

const dark = readBlock(/^:root,\n\[data-theme='dark'\] \{/m);
const light = readBlock(/^\[data-theme='light'\] \{/m);

function channelLuminance(hex) {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const channels = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex, bgHex) {
  const [lighter, darker] = [channelLuminance(fgHex), channelLuminance(bgHex)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

const markdown = process.argv.includes('--markdown');

/** @type {{ theme: string, results: { pair: Pair, ratio: number, pass: boolean }[] }[]} */
const themes = [
  { theme: 'Dark', palette: dark },
  { theme: 'Light', palette: light },
];

let failures = 0;
const rows = [];

for (const { theme, palette } of themes) {
  for (const pair of PAIRS) {
    const fg = palette[pair.fg];
    const bg = palette[pair.bg];
    if (!fg || !bg) {
      console.error(`Missing token for "${pair.label}" (${pair.fg} / ${pair.bg}) in ${theme}`);
      failures += 1;
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    const pass = ratio >= pair.min;
    if (!pass) failures += 1;
    rows.push({ theme, pair, ratio, pass, fg, bg });
  }
}

if (markdown) {
  console.log('| Pair | Role | Dark | Light | Minimum |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const pair of PAIRS) {
    const darkRow = rows.find((row) => row.theme === 'Dark' && row.pair.label === pair.label);
    const lightRow = rows.find((row) => row.theme === 'Light' && row.pair.label === pair.label);
    const value = (row) => (row ? `${row.ratio.toFixed(2)}:1 ${row.pass ? '✓' : '✗'}` : '—');
    console.log(
      `| ${pair.label} | ${pair.role === 'text' ? 'Text' : 'UI'} | ${value(darkRow)} | ${value(
        lightRow,
      )} | ${pair.min}:1 |`,
    );
  }
} else {
  console.log('PromptForge contrast gate — src/styles/tokens.css\n');
  for (const { theme } of themes) {
    console.log(`=== ${theme} theme ===`);
    for (const row of rows.filter((entry) => entry.theme === theme)) {
      const status = row.pass ? 'PASS' : 'FAIL';
      console.log(
        `${status}  ${row.ratio.toFixed(2).padStart(5)}:1  min ${row.pair.min}:1  ${row.pair.label}`,
      );
    }
    console.log('');
  }
}

if (failures > 0) {
  console.error(`Contrast gate failed: ${failures} pairing(s) below threshold.`);
  process.exit(1);
}

console.log(`Contrast gate passed: ${rows.length} pairings verified across both themes.`);
