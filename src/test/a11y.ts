/**
 * Accessibility assertions (TASK-028).
 *
 * axe-core is the executable part of the accessibility review: it finds missing
 * names, broken ARIA, duplicate ids, and unlabelled controls without a human
 * looking at every screen. It is not a substitute for a keyboard walkthrough,
 * and it cannot check colour contrast in this environment (jsdom has no canvas
 * and no layout), which is why the palette is gated separately by
 * `npm run check:contrast`.
 *
 * Only `critical` and `serious` impact findings fail a test. `moderate` and
 * `minor` findings are reported by the dedicated suite in
 * `src/test/a11y.baseline.test.tsx` rather than silently ignored.
 */

import axe, { type AxeResults, type Result, type RunOptions } from 'axe-core';
import { expect } from 'vitest';

/**
 * Rules that cannot work without layout or a rendering engine, so running them in
 * jsdom would produce confident nonsense. They are listed here, in one place, so
 * nobody can claim they passed.
 *
 * - `color-contrast` needs real computed colours and geometry; the palette gate
 *   (`scripts/check-contrast.mjs`) covers it instead.
 * - `target-size` needs element geometry, which jsdom does not compute.
 * - `scrollable-region-focusable` and `nested-interactive` measure rendering.
 * - `label-content-name-mismatch` compares a name against *rendered* text, which
 *   jsdom cannot produce, so axe reports it as "incomplete" on every screen.
 * - `region` walks the whole document, which is the shell's job and is asserted
 *   by the landmarks test in `src/components/layout/shell.a11y.test.tsx`.
 */
export const UNSUPPORTED_IN_JSDOM = [
  'color-contrast',
  'color-contrast-enhanced',
  'target-size',
  'scrollable-region-focusable',
  'label-content-name-mismatch',
  'region',
] as const;

export interface A11yOptions {
  /** Rules to switch off on top of {@link UNSUPPORTED_IN_JSDOM}. */
  readonly disableRules?: readonly string[];
  /** Tags to run; defaults to the WCAG 2.2 A/AA set plus best practice. */
  readonly runTags?: readonly string[];
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Runs axe against an element (or the whole body) and returns its results. */
export async function runAxe(
  container?: Element | Document,
  options: A11yOptions = {},
): Promise<AxeResults> {
  const rules = Object.fromEntries(
    [...UNSUPPORTED_IN_JSDOM, ...(options.disableRules ?? [])].map((rule) => [
      rule,
      { enabled: false },
    ]),
  );

  const runOptions: RunOptions = {
    runOnly: { type: 'tag', values: [...(options.runTags ?? DEFAULT_TAGS)] },
    rules,
    reporter: 'v2',
  };

  return axe.run((container ?? document) as unknown as Element, runOptions);
}

/** Critical and serious findings, as one readable list. */
export function seriousProblems(results: AxeResults): readonly Result[] {
  return results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
}

function describe(violation: Result): string {
  const nodes = violation.nodes
    .slice(0, 3)
    .map((node) => `    ${node.target.join(' ')} — ${node.failureSummary?.split('\n')[0] ?? ''}`)
    .join('\n');
  const extra = violation.nodes.length > 3 ? `\n    …and ${violation.nodes.length - 3} more` : '';
  return `  ${violation.id} (${violation.impact}): ${violation.help}\n${nodes}${extra}`;
}

/**
 * Fails when axe finds a critical or serious violation.
 *
 * The message names each rule, its impact, and the offending selectors, so a
 * failure is actionable instead of "accessibility failed".
 */
export async function expectNoSeriousViolations(
  container: Element,
  options: A11yOptions = {},
): Promise<AxeResults> {
  const results = await runAxe(container, options);
  const problems = seriousProblems(results);

  if (problems.length > 0) {
    throw new Error(
      `axe found ${problems.length} critical/serious accessibility violation(s):\n${problems
        .map(describe)
        .join('\n')}`,
    );
  }

  expect(problems).toHaveLength(0);
  return results;
}

/** Module-scope guard: a failed assertion must not leave a pending promise. */
export function isUnsupportedRule(id: string): boolean {
  return (UNSUPPORTED_IN_JSDOM as readonly string[]).includes(id);
}
