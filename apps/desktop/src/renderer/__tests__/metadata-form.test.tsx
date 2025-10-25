import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { MetadataForm } from '../components/MetadataForm';
import { DEFAULT_INFO_TEXT_FORM, type InfoTextFormState } from '../../shared/info';

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
});
