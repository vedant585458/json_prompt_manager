import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Badge, StatusPill } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Kbd, ShortcutHint } from '@/components/ui/Kbd';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Select } from '@/components/ui/Select';
import { Separator } from '@/components/ui/Separator';
import { Spinner } from '@/components/ui/Spinner';
import { Card, Surface } from '@/components/ui/Surface';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

describe('Checkbox', () => {
  it('toggles by label click and reports checked state', async () => {
    const user = userEvent.setup();
    render(<Checkbox name="meta" label="Include metadata" hint="Tags and timestamps." />);

    const checkbox = screen.getByRole('checkbox', { name: 'Include metadata' });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute('aria-describedby', 'meta-hint');

    await user.click(screen.getByText('Include metadata'));
    expect(checkbox).toBeChecked();
  });

  it('supports the indeterminate state', () => {
    render(<Checkbox name="bulk" label="Select all" checked="indeterminate" />);
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'data-state',
      'indeterminate',
    );
  });
});

describe('Switch', () => {
  it('is a switch with an announced state and toggles', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Switch
        name="autosave"
        label="Autosave changes"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    const control = screen.getByRole('switch', { name: 'Autosave changes' });
    expect(control).toHaveAttribute('aria-checked', 'false');

    await user.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('RadioGroup', () => {
  it('is a single tab stop that moves focus with arrow keys and selects with Space', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        name="pin"
        label="Pin this prompt"
        defaultValue="no"
        onValueChange={onValueChange}
        options={[
          { value: 'yes', label: 'Pin' },
          { value: 'no', label: 'Do not pin' },
        ]}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Pin this prompt' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Do not pin' })).toBeChecked();

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Do not pin' })).toHaveFocus();

    // Roving focus: Radix moves focus inside a timeout rather than synchronously.
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Pin' })).toHaveFocus());

    await user.keyboard(' ');
    expect(onValueChange).toHaveBeenCalledWith('yes');
    expect(screen.getByRole('radio', { name: 'Pin' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Do not pin' })).not.toBeChecked();
  });

  it('selects by clicking the label', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        name="visibility"
        label="Visibility"
        defaultValue="private"
        onValueChange={onValueChange}
        options={[
          { value: 'public', label: 'Public', hint: 'Anyone with the link.' },
          { value: 'private', label: 'Private' },
        ]}
      />,
    );

    await user.click(screen.getByText('Public'));

    expect(onValueChange).toHaveBeenCalledWith('public');
    expect(screen.getByRole('radio', { name: /Public/ })).toBeChecked();
  });
});

describe('Select', () => {
  it('renders options, honours a placeholder, and stays keyboard operable', async () => {
    const user = userEvent.setup();
    render(
      <Select
        aria-label="Output format"
        placeholder="Choose a format"
        defaultValue=""
        options={[
          { value: 'json', label: 'JSON' },
          { value: 'markdown', label: 'Markdown', disabled: true },
        ]}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Output format' });
    expect(screen.getByRole('option', { name: 'Choose a format' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Markdown' })).toBeDisabled();

    await user.selectOptions(select, 'json');
    expect(select).toHaveValue('json');
  });
});

describe('Input and Textarea', () => {
  it('accepts typing and forwards ARIA invalid only when requested', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Input aria-label="Title" />
        <Input aria-label="Broken" invalid />
        <Textarea aria-label="Notes" mono />
      </>,
    );

    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.type(title, 'Structured extraction');
    expect(title).toHaveValue('Structured extraction');
    expect(title).not.toHaveAttribute('aria-invalid');

    expect(screen.getByRole('textbox', { name: 'Broken' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: 'Notes' }).className).toContain('font-mono');
  });

  it('renders a decorative adornment without duplicating the label', () => {
    render(<Input aria-label="Search" adornment={<span data-testid="glyph" />} />);
    expect(screen.getByTestId('glyph').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
  });
});

describe('Badge and StatusPill', () => {
  it('renders a badge with a count', () => {
    render(
      <Badge tone="danger" count={3}>
        Invalid
      </Badge>,
    );
    const badge = screen.getByText('Invalid').closest('span');
    expect(badge).toHaveTextContent('Invalid3');
    expect(badge?.className).toContain('text-danger');
  });

  it('pairs semantic status with an icon hidden from assistive technology', () => {
    render(
      <StatusPill tone="success" icon={<svg data-testid="icon" />}>
        Valid JSON
      </StatusPill>,
    );

    expect(screen.getByText('Valid JSON')).toBeInTheDocument();
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('ProgressBar', () => {
  it('exposes determinate progress with an accessible name', () => {
    render(<ProgressBar label="Revisions loaded" value={7} max={10} caption="Loaded" />);

    const bar = screen.getByRole('progressbar', { name: 'Revisions loaded' });
    expect(bar).toHaveAttribute('aria-valuenow', '7');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(bar).toHaveAttribute('aria-valuetext', '70%');
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('clamps out-of-range values', () => {
    render(<ProgressBar label="Clamped" value={150} max={100} />);
    const bar = screen.getByRole('progressbar', { name: 'Clamped' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('Spinner', () => {
  it('is decorative unless it carries a label', () => {
    const { rerender } = render(<Spinner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<Spinner label="Loading prompts" />);
    expect(screen.getByRole('status', { name: 'Loading prompts' })).toBeInTheDocument();
  });
});

describe('Separator, Kbd, Surface, Card', () => {
  it('announces a semantic separator and hides decorative ones', () => {
    const { rerender } = render(<Separator orientation="vertical" />);
    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');

    rerender(<Separator decorative />);
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('renders keyboard hints as kbd elements', () => {
    render(<ShortcutHint keys={['⌘', 'K']} />);
    expect(screen.getAllByText(/⌘|K/).every((node) => node.tagName === 'KBD')).toBe(true);
  });

  it('renders surface variants and an article card when asked', () => {
    render(
      <>
        <Surface variant="sunken" padding="md" data-testid="surface">
          editor
        </Surface>
        <Card as="article" variant="interactive" padding="lg" data-testid="card">
          card
        </Card>
      </>,
    );

    expect(screen.getByTestId('surface').className).toContain('bg-surface-sunken');
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('ARTICLE');
    expect(card.className).toContain('p-5');
    expect(card.className).toContain('hover:border-line-strong');
  });

  it('keeps Kbd semantics', () => {
    render(<Kbd>?</Kbd>);
    expect(screen.getByText('?').tagName).toBe('KBD');
  });
});
