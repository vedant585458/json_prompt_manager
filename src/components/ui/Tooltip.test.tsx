import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';

function renderTooltip(content = 'Copy the JSON path') {
  return render(
    <TooltipProvider>
      <Tooltip content={content}>
        <button type="button">Copy path</button>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('Tooltip', () => {
  it('stays hidden until the trigger is focused', () => {
    renderTooltip();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus and describes the trigger', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Copy the JSON path');
    expect(screen.getByRole('button', { name: 'Copy path' })).toHaveAttribute(
      'aria-describedby',
      tooltip.id,
    );
  });

  it('closes with Escape and keeps the page usable', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    await screen.findByRole('tooltip');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument();
  });

  it('is reachable by pointer as well as keyboard', async () => {
    const user = userEvent.setup();
    renderTooltip('Restoring creates a new revision');

    await user.hover(screen.getByRole('button', { name: 'Copy path' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Restoring creates a new revision',
    );
  });
});
