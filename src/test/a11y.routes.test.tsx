/**
 * axe-core route audit (TASK-028).
 *
 * One seeded library, every primary route, one axe run each. The assertion is the
 * task's acceptance criterion: no critical or serious violations. Findings of
 * `moderate` and `minor` impact are collected separately by
 * `src/test/a11y.baseline.test.tsx` so they cannot be silently dropped.
 *
 * What this cannot see, and therefore does not claim: colour contrast, target
 * size, and anything that needs real layout or a browser (see
 * `UNSUPPORTED_IN_JSDOM` in `src/test/a11y.ts`). The palette is gated by
 * `npm run check:contrast` instead.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import {
  createCollection,
  createDefaultSettings,
  createFolder,
  createPrompt,
  createPromptSchema,
  createRevision,
  createTestCase,
} from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { UNSUPPORTED_IN_JSDOM, expectNoSeriousViolations } from '@/test/a11y';
import { renderAppWithData } from '@/test/renderAppWithData';

const ONBOARDED_AT = '2026-01-02T09:00:00.000Z';
const NOW = new Date('2026-10-25T09:00:00.000Z');
const deps = { now: () => NOW, newId: () => 'generated' };

function seededPrompt(title: string, id: string) {
  return {
    ...createPrompt(
      {
        title,
        description: `${title} description.`,
        tags: ['support'],
        folderId: null,
        collectionIds: [],
        favorite: false,
        pinned: false,
        archived: false,
        content: createBlankDocument({ name: title }),
      },
      { now: () => NOW, newId: () => id },
    ),
    id,
  };
}

async function seed() {
  const alpha = seededPrompt('Invoice parser', 'alpha');
  const beta = seededPrompt('Escalation summary', 'beta');
  const schema = createPromptSchema(
    { name: 'Invoice', description: 'Amount.', schemaContent: { type: 'object' } },
    deps,
  );

  return createInMemoryRepositories({
    settings: { ...createDefaultSettings(), onboardedAt: ONBOARDED_AT },
    prompts: [alpha, beta],
    folders: [createFolder({ name: 'Support', parentId: null }, deps)],
    collections: [createCollection({ name: 'Billing', description: '' }, deps)],
    schemas: [schema],
    revisions: [
      createRevision(
        alpha,
        { revisionNumber: 1, kind: 'manual', label: 'First pass' },
        { ...deps, newId: () => 'rev-1' },
      ),
    ],
    testCases: [
      createTestCase(
        { promptId: alpha.id, name: 'Short invoice', inputValues: {} },
        { ...deps, newId: () => 'case-1' },
      ),
    ],
  });
}

interface Route {
  readonly name: string;
  readonly path: string;
  /** Text that must exist before the audit runs, so the screen is not a skeleton. */
  readonly ready: () => Promise<unknown>;
}

const ROUTES: readonly Route[] = [
  {
    name: 'dashboard',
    path: '/',
    ready: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'library',
    path: '/library',
    ready: () => screen.findByText('Invoice parser'),
  },
  {
    name: 'editor',
    path: '/prompts/alpha',
    ready: () => screen.findByLabelText(/^JSON document for /),
  },
  {
    name: 'composer',
    path: '/prompts/alpha/compose',
    ready: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'validation',
    path: '/validation',
    ready: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'templates',
    path: '/templates',
    ready: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'health',
    path: '/health',
    ready: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'settings',
    path: '/settings',
    ready: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'diff',
    path: '/diff?prompt=alpha',
    ready: () => screen.findByRole('heading', { level: 1 }),
  },
];

describe('axe: primary routes (TASK-028)', () => {
  for (const route of ROUTES) {
    it(`${route.name} has no critical or serious violations`, async () => {
      const repositories = await seed();
      renderAppWithData({ repositories, path: route.path });

      await route.ready();

      await expectNoSeriousViolations(document.body);
    }, 20_000);
  }

  it('the ask-for-help overlays are clean too', async () => {
    const repositories = await seed();
    renderAppWithData({ repositories, path: '/library' });
    await screen.findByText('Invoice parser');

    // The palette is the densest overlay in the app: a search field, a grouped
    // listbox, and placeholder text for an empty query.
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.keyboard('{Control>}k{/Control}');

    const dialog = await screen.findByRole('dialog');
    await expectNoSeriousViolations(dialog);
  }, 20_000);
});

describe('axe: the audit itself is working', () => {
  it('catches a control with no accessible name', async () => {
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    document.body.appendChild(button);

    await expect(expectNoSeriousViolations(document.body)).rejects.toThrow(/button-name/);
    button.remove();
  });

  it('leaves contrast and target size to the other gates, and says so', () => {
    expect(UNSUPPORTED_IN_JSDOM).toContain('color-contrast');
    expect(UNSUPPORTED_IN_JSDOM).toContain('target-size');
  });
});
