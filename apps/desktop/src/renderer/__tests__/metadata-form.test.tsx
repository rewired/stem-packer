import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MetadataForm } from '../components/MetadataForm';
import {
  DEFAULT_INFO_TEXT_FORM,
  LICENSE_OPTIONS,
  type InfoTextFormState
} from '../../shared/info';

function MetadataFormHarness() {
  const [fields, setFields] = useState<InfoTextFormState>(DEFAULT_INFO_TEXT_FORM);

  return (
    <MetadataForm
      fields={fields}
      onChange={(update) => setFields((prev) => ({ ...prev, ...update }))}
    />
  );
}

describe('MetadataForm', () => {
  it('keeps metadata labels visible after entering values', async () => {
    render(<MetadataFormHarness />);

    const user = userEvent.setup();
    const titleInput = screen.getByLabelText('Title');
    const titleLabel = screen.getByText('Title');

    expect(titleLabel).toBeVisible();

    await user.type(titleInput, 'Song Name');

    expect(titleInput).toHaveValue('Song Name');
    expect(titleLabel).toBeVisible();
    expect(titleLabel).toHaveClass('label-text');
  });

  it('renders license selector as a combobox with localized options', async () => {
    render(<MetadataFormHarness />);

    const licenseSelect = screen.getByRole('combobox', { name: 'License' });
    expect(licenseSelect).toBeInTheDocument();

    const optionElements = within(licenseSelect).getAllByRole('option');
    const optionValues = optionElements.map((option) => (option as HTMLOptionElement).value);

    expect(optionValues).toEqual(['', ...LICENSE_OPTIONS.map((option) => option.value)]);
    expect(optionElements[0]).toHaveTextContent('Select a license');
    expect(optionElements.slice(1).map((option) => option.textContent?.trim())).toEqual([
      'All rights reserved',
      'Creative Commons Attribution 4.0 (CC BY 4.0)',
      'Creative Commons Attribution (CC BY)',
      'Creative Commons Zero (CC0)'
    ]);

    const user = userEvent.setup();
    await user.selectOptions(licenseSelect, 'CC0');

    expect(licenseSelect).toHaveValue('CC0');
  });
});
