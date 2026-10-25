/**
 * Form semantics (TASK-028).
 *
 * "Every validation error is associated, summarized, and announced; required
 * fields are announced" is a claim about behaviour, not markup, so it is tested
 * by looking at the DOM a screen reader would read: the label association, the
 * `aria-describedby` ids, the live role on the message, and the `required` flag
 * on the control itself.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox, Field, Input, RadioGroup, Select, Switch, Textarea } from '@/components/ui';

describe('Field (TASK-028)', () => {
  it('associates the label, the hint, and the error with the control', () => {
    render(
      <Field label="Title" hint="Shown in the library." error="A title is required." required>
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText(/^Title/);
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const described = describedBy.split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described.join(' ')).toContain('Shown in the library.');
    expect(described.join(' ')).toContain('A title is required.');
  });

  it('announces the error and marks the field required', () => {
    render(
      <Field label="Slug" error="Only letters and dashes." required>
        {(control) => <Input {...control} />}
      </Field>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Only letters and dashes.');
    expect(screen.getByLabelText(/^Slug/)).toBeRequired();
    // The asterisk is decoration; the required state comes from the attribute.
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('says "Optional" for a field that is not required, instead of leaving it ambiguous', () => {
    render(<Field label="Notes">{(control) => <Textarea {...control} />}</Field>);

    expect(screen.getByText('Optional')).toBeVisible();
    expect(screen.getByLabelText('Notes')).not.toBeRequired();
  });

  it('can hide the label visually without losing it', () => {
    render(
      <Field label="Search" hideLabel>
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText('Search');
    expect(input).toBeVisible();
    expect(document.querySelector('label')?.className).toContain('sr-only');
  });
});

describe('discrete controls (TASK-028)', () => {
  it('gives a checkbox an accessible name from its label', () => {
    render(<Checkbox id="archived" name="archived" label="Archived" />);
    expect(screen.getByRole('checkbox', { name: 'Archived' })).toBeVisible();
  });

  it('labels a select and announces its value', () => {
    render(
      <Select
        aria-label="Filter by status"
        value="all"
        onChange={() => {}}
        options={[
          { value: 'all', label: 'All statuses' },
          { value: 'active', label: 'Active' },
        ]}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Filter by status' });
    expect(select).toHaveValue('all');
  });

  it('gives a switch and a radio group their roles and names', () => {
    render(
      <>
        <Switch id="autosave" name="autosave" checked onChange={() => {}} label="Autosave" />
        <RadioGroup
          label="Theme"
          value="dark"
          onValueChange={() => {}}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
        />
      </>,
    );

    expect(screen.getByRole('switch', { name: 'Autosave' })).toBeVisible();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });
});
