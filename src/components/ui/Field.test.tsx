import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(<Field label="Prompt name">{(control) => <Input {...control} />}</Field>);

    expect(screen.getByLabelText('Prompt name')).toHaveAttribute('id');
  });

  it('links hint and error text through aria-describedby', () => {
    render(
      <Field label="Endpoint" hint="Must be HTTPS." error="Endpoint must not be empty.">
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText('Endpoint');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const describedIds = describedBy.split(' ');

    expect(describedIds).toHaveLength(2);
    for (const id of describedIds) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(screen.getByText('Must be HTTPS.')).toHaveAttribute('id', describedIds[0]);
    const errorNode = document.getElementById(describedIds[1] as string);
    expect(errorNode).toHaveTextContent('Endpoint must not be empty.');
  });

  it('marks the control invalid only when an error exists', () => {
    const { rerender } = render(<Field label="Name">{(control) => <Input {...control} />}</Field>);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');

    rerender(
      <Field label="Name" error="Name is required.">
        {(control) => <Input {...control} />}
      </Field>,
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('communicates required state to assistive technology', () => {
    render(
      <Field label="Objective" required>
        {(control) => <Input {...control} />}
      </Field>,
    );

    expect(screen.getByLabelText(/Objective/)).toBeRequired();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps user input when a validation error appears', async () => {
    const user = userEvent.setup();

    function Harness() {
      const value = 'Structured extraction';
      return (
        <Field label="Prompt name" error="That name is already in use.">
          {(control) => <Input {...control} defaultValue={value} />}
        </Field>
      );
    }

    render(<Harness />);

    const input = screen.getByLabelText('Prompt name');
    expect(input).toHaveValue('Structured extraction');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await user.type(input, ' v2');
    expect(input).toHaveValue('Structured extraction v2');
    expect(screen.getByText('That name is already in use.')).toBeInTheDocument();
  });

  it('supports hiding the label visually without losing the accessible name', () => {
    render(
      <Field label="Search" hideLabel>
        {(control) => <Input {...control} />}
      </Field>,
    );

    const label = screen.getByText('Search');
    expect(label.className).toContain('sr-only');
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('works with a textarea control', () => {
    render(
      <Field label="Instructions" hint="One instruction per line.">
        {(control) => <Textarea {...control} rows={3} />}
      </Field>,
    );

    const textarea = screen.getByLabelText('Instructions');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.getAttribute('aria-describedby')).toBeTruthy();
  });
});
