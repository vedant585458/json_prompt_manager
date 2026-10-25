/**
 * Compact filter bar tests (TASK-027).
 *
 * On a phone the filter bar becomes one row: search, the view toggle, and a
 * "Filters" button that opens the rest in a sheet (a bottom sheet below 640 px).
 * These tests pin that behaviour and prove the sheet holds the same controls —
 * same labels, same handlers — rather than a second implementation.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FilterBar } from '@/components/library/FilterBar';
import { COMPACT_QUERY } from '@/lib/useMediaQuery';
import { EMPTY_LIBRARY_STATE, type LibraryState } from '@/routes/library/libraryQuery';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCompact() {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: media === COMPACT_QUERY,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
}

function state(overrides: Partial<LibraryState> = {}): LibraryState {
  return { ...EMPTY_LIBRARY_STATE, ...overrides };
}

function renderBar(
  onChange: (patch: Partial<LibraryState>) => void,
  overrides: Partial<LibraryState> = {},
) {
  return render(
    <FilterBar
      state={state(overrides)}
      onChange={onChange}
      onClear={() => {}}
      searchInputRef={{ current: null }}
      resultCount={2}
      totalCount={5}
      view="grid"
      onViewChange={() => {}}
      folderName={null}
      collectionName={null}
    />,
  );
}

describe('FilterBar on a compact viewport', () => {
  it('keeps search and the view toggle out, and moves the rest behind Filters', async () => {
    stubCompact();
    const user = userEvent.setup();
    renderBar(() => {});

    expect(screen.getByLabelText('Search prompts')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Card view' })).toBeVisible();
    expect(screen.getByText('2 of 5 prompts')).toBeVisible();

    // Nothing else is on the screen until the sheet opens.
    expect(screen.queryByLabelText('Sort prompts')).toBeNull();
    expect(screen.queryByLabelText('Filter by status')).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Filters/ }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByLabelText('Sort prompts')).toBeVisible();
    expect(within(sheet).getByLabelText('Filter by status')).toBeVisible();
    expect(within(sheet).getByLabelText('Filter by document health')).toBeVisible();
    expect(within(sheet).getByLabelText('Filter by last edited')).toBeVisible();
    expect(within(sheet).getByRole('checkbox', { name: 'Archived' })).toBeVisible();
    expect(within(sheet).getByRole('checkbox', { name: 'Favorites' })).toBeVisible();

    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports the number of active filters and keeps chips reachable outside the sheet', () => {
    stubCompact();
    renderBar(() => {}, { tags: ['billing'], favorites: true });

    expect(screen.getByRole('button', { name: 'Filters (2)' })).toBeVisible();
    // Chips live outside the sheet, so an applied filter can be removed without
    // opening it.
    expect(screen.getByRole('button', { name: 'Remove filter: #billing' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove filter: Favorites' })).toBeVisible();
  });

  it('sends the same change through the sheet control as the inline one', async () => {
    stubCompact();
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar(onChange);

    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    const sheet = await screen.findByRole('dialog');
    await user.selectOptions(within(sheet).getByLabelText('Filter by status'), 'active');

    expect(onChange).toHaveBeenCalledWith({ status: 'active' });
  });
});

describe('FilterBar on a wide viewport', () => {
  it('renders every control inline with no Filters button', () => {
    renderBar(() => {});

    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
    expect(screen.getByLabelText('Sort prompts')).toBeVisible();
    expect(screen.getByLabelText('Filter by status')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Archived' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
