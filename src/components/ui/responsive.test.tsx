/**
 * Responsive contracts (TASK-027).
 *
 * There is no real layout engine in jsdom, so these tests cannot measure a
 * viewport. What they can do is pin the classes that make the layout responsive:
 * a dialog becoming a bottom sheet, controls growing to a touch target, the main
 * column keeping clear of the home indicator, and the editor moving its
 * inspector out of the editing column on a single-pane viewport.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInMemoryRepositories } from '@/data';
import { createDefaultSettings, createPrompt } from '@/domain/factories';
import { createBlankDocument } from '@/domain/promptDocument';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SINGLE_PANE_QUERY } from '@/lib/useMediaQuery';
import { renderAppWithData } from '@/test/renderAppWithData';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A viewport narrower than the editor's two panes. */
function stubSinglePane() {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media === SINGLE_PANE_QUERY,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
}

describe('dialog on a compact viewport', () => {
  it('turns into a bottom sheet instead of a floating box', () => {
    const { container } = render(
      <Dialog open>
        <DialogContent title="Compact dialog" description="Opens from the bottom on a phone.">
          Body
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-sm:bottom-0');
    expect(dialog.className).toContain('max-sm:rounded-t-xl');
    expect(dialog.className).toContain('max-sm:w-full');
    // Clear of the home indicator.
    expect(dialog.className).toContain('env(safe-area-inset-bottom)');
    expect(within(dialog).getByText('Body')).toBeVisible();
    expect(container).toBeDefined();
  });
});

describe('touch targets', () => {
  it('grows buttons and icon buttons on a coarse pointer only', () => {
    render(
      <>
        <Button>Save</Button>
        <IconButton label="Close">
          <span aria-hidden="true">x</span>
        </IconButton>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Save' }).className).toContain(
      'pointer-coarse:min-h-11',
    );
    const icon = screen.getByRole('button', { name: 'Close' });
    expect(icon.className).toContain('pointer-coarse:min-h-11');
    expect(icon.className).toContain('pointer-coarse:min-w-11');
  });
});

describe('editor on a single-pane viewport', () => {
  it('keeps the inspector out of the editing column and opens it from a button', async () => {
    stubSinglePane();

    const user = userEvent.setup();
    const prompt = createPrompt({
      title: 'Compact prompt',
      content: createBlankDocument({ name: 'Compact prompt' }),
    });
    const repositories = await createInMemoryRepositories({
      settings: { ...createDefaultSettings(), onboardedAt: '2026-01-02T09:00:00.000Z' },
      prompts: [prompt],
    });

    renderAppWithData({ repositories, path: `/prompts/${prompt.id}` });

    const trigger = await screen.findByRole('button', { name: /^Inspector$/ });
    // The desktop pane is not rendered at all, so the inspector exists once.
    expect(screen.queryByRole('region', { name: /inspector/i })).toBeNull();

    await user.click(trigger);

    const sheet = await screen.findByRole('dialog');
    expect(
      within(sheet).getByText(/Structure, variables, and validation for the current draft/),
    ).toBeVisible();
    // The inspector panel itself came with it, not just the empty sheet chrome.
    expect(within(sheet).getAllByRole('heading', { name: 'Inspector' }).length).toBeGreaterThan(0);
  });
});
