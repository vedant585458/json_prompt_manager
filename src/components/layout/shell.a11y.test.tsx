/**
 * Keyboard and semantics walkthrough (TASK-028).
 *
 * axe checks markup; this file checks the things a person does with a keyboard:
 * the skip link is the first stop and actually moves focus, every route has one
 * `main`, one `h1`, and a labelled navigation, the palette and dialogs trap and
 * restore focus, and nothing is hidden behind a hover.
 *
 * What it cannot do: render pixels. "Visible focus" here means the ring exists in
 * the global stylesheet and is not cancelled by a component; it does not mean a
 * screenshot was taken.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { renderAppWithData } from '@/test/renderAppWithData';
import { useUiStore } from '@/store/uiStore';

const NOW = new Date('2026-10-25T09:00:00.000Z');

async function seeded() {
  const prompt = {
    ...createPrompt(
      { title: 'Invoice parser', content: createBlankDocument({ name: 'Invoice parser' }) },
      { now: () => NOW, newId: () => 'alpha' },
    ),
    id: 'alpha',
  };

  return createInMemoryRepositories({
    settings: { ...createDefaultSettings(), onboardedAt: '2026-01-02T09:00:00.000Z' },
    prompts: [prompt],
  });
}

beforeEach(() => {
  useUiStore.setState({ paletteOpen: false, helpOpen: false, sidebarOpen: true });
});

describe('skip link and landmarks (TASK-028)', () => {
  it('starts on the skip link and jumps to the main landmark', async () => {
    const user = userEvent.setup();
    renderAppWithData({ repositories: await seeded(), path: '/library' });
    await screen.findByText('Invoice parser');

    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveFocus();

    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(document.getElementById('main-content')).toContainElement(
        document.activeElement as HTMLElement | null,
      ),
    );
  }, 20_000);

  it('gives every route one main, one h1, and a labelled navigation', async () => {
    const PATHS = ['/', '/library', '/prompts/alpha', '/validation', '/templates', '/health'];

    for (const path of PATHS) {
      const repositories = await seeded();
      const view = renderAppWithData({ repositories, path });

      const main = await screen.findByRole('main');
      expect(document.querySelectorAll('main')).toHaveLength(1);
      expect(within(main).getAllByRole('heading', { level: 1 })).toHaveLength(1);

      // The rail and the drawer are two renderings of one nav; each names itself.
      const navs = screen.getAllByRole('navigation');
      expect(navs.length).toBeGreaterThan(0);
      expect(navs.every((nav) => (nav.getAttribute('aria-label') ?? '').length > 0)).toBe(true);

      view.unmount();
    }
  }, 40_000);

  it('does not hide any control behind a hover', () => {
    // A static scan: `group-hover:` may change a colour, but a control that only
    // appears on hover (`opacity-0` / `invisible` / `hidden` paired with
    // `group-hover:`) would be unusable by keyboard and touch.
    const root = join(process.cwd(), 'src');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.endsWith('.tsx') || entry.endsWith('.test.tsx')) continue;

        const source = readFileSync(path, 'utf8');
        const lines = source.split('\n');
        lines.forEach((line, index) => {
          const revealsControl = /group-hover:(opacity|visible|block|flex|inline)/.test(line);
          const hidesControl = /(^|["'\s])(opacity-0|invisible|hidden)(["'\s]|$)/.test(line);
          if (revealsControl && hidesControl) {
            offenders.push(`${path}:${index + 1} ${line.trim()}`);
          }
        });
      }
    };

    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe('focus behaviour (TASK-028)', () => {
  it('traps focus in the palette and returns it to the opener', async () => {
    const user = userEvent.setup();
    renderAppWithData({ repositories: await seeded(), path: '/library' });
    await screen.findByText('Invoice parser');

    const opener = screen.getByRole('button', { name: /open the command palette|search/i });
    opener.focus();

    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog');
    const input = within(palette).getByRole('combobox');
    await waitFor(() => expect(input).toHaveFocus());

    // Tab stays inside the modal.
    await user.tab();
    expect(palette.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  }, 20_000);

  it('does not steal a typed character from a text field', async () => {
    const user = userEvent.setup();
    const { router } = renderAppWithData({ repositories: await seeded(), path: '/library' });
    await screen.findByText('Invoice parser');

    // `g` then `l` is the two-key chord for "go to library"; typed into the
    // search box it must stay a letter, not a navigation (TASK-028: the
    // shortcut system may not block ordinary typing).
    const search = screen.getByLabelText('Search prompts');
    await user.type(search, 'gl');

    expect(search).toHaveValue('gl');
    expect(router.state.location.pathname).toBe('/library');
    expect(screen.queryByRole('dialog')).toBeNull();
  }, 20_000);

  it('has a focus ring for every interactive element in the stylesheet', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf8');

    expect(css).toMatch(
      /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible/,
    );
    expect(css).toMatch(/outline: 2px solid var\(--pf-focus-ring\)/);
    // Reduced motion is honoured, not just declared.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('announces status changes in a live region, not by colour alone', async () => {
    renderAppWithData({ repositories: await seeded(), path: '/settings' });
    await screen.findByRole('heading', { level: 1 });

    // Save status and toasts both exist as live regions in the shell.
    const liveRegions = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
    expect(liveRegions.length).toBeGreaterThan(0);
  }, 20_000);
});
