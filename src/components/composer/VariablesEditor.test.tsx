import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VariablesEditor } from '@/components/composer/VariablesEditor';
import type { ComposerIssue, ComposerVariable } from '@/domain/composer';

/**
 * §10.1 gap fill (TASK-029): `VariablesEditor` was the least-covered composer
 * surface (21 % of lines) because it was only exercised through the composer
 * screen. These tests drive it directly, including the paths the screen never
 * reaches: unreadable entries, issues on another row, and the disabled state.
 */

function variable(overrides: Partial<ComposerVariable> = {}): ComposerVariable {
  return {
    name: 'topic',
    type: 'string',
    required: true,
    description: '',
    extras: {},
    ...overrides,
  };
}

function setup({
  variables = [variable()],
  issues = [] as readonly ComposerIssue[],
  disabled = false,
}: {
  variables?: readonly ComposerVariable[];
  issues?: readonly ComposerIssue[];
  disabled?: boolean;
} = {}) {
  const onChange = vi.fn();
  const onInvalidJsonChange = vi.fn();

  const view = render(
    <VariablesEditor
      variables={variables}
      issues={issues}
      onChange={onChange}
      onInvalidJsonChange={onInvalidJsonChange}
      disabled={disabled}
    />,
  );

  return { ...view, onChange, onInvalidJsonChange };
}

describe('VariablesEditor', () => {
  it('explains that there are no variables yet', () => {
    setup({ variables: [] });

    expect(screen.getByText(/No variables yet/)).toBeVisible();
    expect(screen.queryByRole('group', { name: /Variable/ })).toBeNull();
  });

  it('gives each variable its own fieldset with a numbered legend', () => {
    setup({ variables: [variable({ name: 'topic' }), variable({ name: 'tone' })] });

    const groups = screen.getAllByRole('group', { name: /Variable \d/ });
    expect(groups).toHaveLength(2);
    expect(within(groups[0]!).getByLabelText(/Name/)).toHaveValue('topic');
    expect(within(groups[1]!).getByLabelText(/Name/)).toHaveValue('tone');
  });

  it('reports an edited name without touching the other rows', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      variables: [variable({ name: 'topic' }), variable({ name: 'tone' })],
    });

    await user.type(screen.getAllByLabelText(/Name/)[1]!, 's');

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'topic' }),
      expect.objectContaining({ name: 'tones' }),
    ]);
  });

  it('changes a variable’s declared type from the select', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.selectOptions(screen.getByLabelText('Type'), 'number');

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: 'number' })]);
  });

  it('toggles required and keeps the rest of the row', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByRole('checkbox', { name: 'Required' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'topic', required: false }),
    ]);
  });

  it('appends a blank declaration when a variable is added', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ variables: [variable()] });

    await user.click(screen.getByRole('button', { name: /Add a variable/ }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'topic' }),
      { name: '', type: 'string', required: true, description: '', extras: {} },
    ]);
  });

  it('moves a variable up and refuses to move the first one up or the last one down', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      variables: [variable({ name: 'first' }), variable({ name: 'second' })],
    });

    expect(screen.getByRole('button', { name: 'Move variable 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move variable 2 down' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move variable 2 up' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'second' }),
      expect.objectContaining({ name: 'first' }),
    ]);
  });

  it('removes only the chosen variable', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      variables: [variable({ name: 'first' }), variable({ name: 'second' })],
    });

    await user.click(screen.getByRole('button', { name: 'Remove variable 1' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'second' })]);
  });

  it('shows a name error against its own row and not against the other one', () => {
    setup({
      variables: [variable({ name: 'topic' }), variable({ name: '1bad' })],
      issues: [
        {
          field: 'variables',
          severity: 'error',
          path: 'variables[1].name',
          message: 'A variable name must start with a letter or underscore.',
        },
      ],
    });

    const groups = screen.getAllByRole('group', { name: /Variable \d/ });
    expect(within(groups[1]!).getByText(/must start with a letter or underscore/)).toBeVisible();
    expect(within(groups[0]!).queryByText(/must start with a letter or underscore/)).toBeNull();
  });

  it('shows a default-value error and any other issue with its own severity', () => {
    setup({
      issues: [
        {
          field: 'variables',
          severity: 'error',
          path: 'variables[0].defaultValue',
          message: 'The default is a number, but the type is text.',
        },
        {
          field: 'variables',
          severity: 'warning',
          path: 'variables[0].description',
          message: 'Add a description.',
        },
      ],
    });

    expect(screen.getByText('The default is a number, but the type is text.')).toBeVisible();
    expect(screen.getByText('Add a description.')).toBeVisible();
  });

  it('keeps an unreadable entry as written instead of offering controls it cannot honour', () => {
    setup({ variables: [variable({ unreadable: 'not an object' })] });

    expect(screen.getByText(/not an object, so it cannot be edited here/)).toBeVisible();
    expect(screen.queryByLabelText(/Name/)).toBeNull();
    expect(screen.queryByLabelText('Default value')).toBeNull();
    // It can still be removed, which is the only edit that makes sense.
    expect(screen.getByRole('button', { name: 'Remove variable 1' })).toBeEnabled();
  });

  it('applies a parsed default value and reports invalid JSON instead of dropping it', async () => {
    const user = userEvent.setup();
    const { onChange, onInvalidJsonChange } = setup();

    const field = screen.getByLabelText('Default value');
    await user.clear(field);
    await user.type(field, '{{"a": 1}');

    await user.type(field, '}');

    expect(onInvalidJsonChange).toHaveBeenCalledWith('variables[0].defaultValue', false);
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ defaultValue: { a: 1 } }),
    ]);
  });

  it('blocks saving while the default value does not parse', async () => {
    const user = userEvent.setup();
    const { onChange, onInvalidJsonChange } = setup();

    const field = screen.getByLabelText('Default value');
    await user.type(field, '{{');

    expect(screen.getByText(/Not applied/)).toBeVisible();
    expect(onInvalidJsonChange).toHaveBeenCalledWith('variables[0].defaultValue', true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables every control when the editor is read-only', () => {
    setup({ disabled: true });

    expect(screen.getByLabelText(/Name/)).toBeDisabled();
    expect(screen.getByLabelText('Type')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Required' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add a variable/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove variable 1' })).toBeDisabled();
  });
});
