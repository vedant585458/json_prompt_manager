import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SimpleTabs } from '@/components/ui/Tabs';

const items = [
  { value: 'validation', label: 'Validation', content: 'Validation panel' },
  { value: 'variables', label: 'Variables', content: 'Variables panel' },
  { value: 'history', label: 'History', content: 'History panel' },
  { value: 'graph', label: 'Graph', content: 'Graph panel', disabled: true },
] as const;

function renderTabs() {
  return render(<SimpleTabs label="Inspector sections" items={items} />);
}

describe('Tabs', () => {
  it('exposes a labelled tab list with correct relationships', () => {
    renderTabs();

    expect(screen.getByRole('tablist', { name: 'Inspector sections' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    const selected = screen.getByRole('tab', { name: 'Validation' });
    expect(selected).toHaveAttribute('aria-selected', 'true');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Validation panel');
    expect(selected).toHaveAttribute('aria-controls', panel.id);
  });

  it('selects tabs with ArrowRight and keeps a single tab stop', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Validation' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Variables' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Variables panel');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Validation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('wraps keyboard navigation and skips disabled tabs', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Graph' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Validation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('activates a tab when clicked', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('History panel');
  });
});
