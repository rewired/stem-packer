import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { FilesTable } from '../components/FilesTable';
import { TranslationProvider } from '../hooks/useTranslation';
import type { AudioFileItem } from '../../shared/preferences';

function renderWithTranslations(ui: ReactElement) {
  return render(<TranslationProvider locale="en">{ui}</TranslationProvider>);
}

describe('FilesTable', () => {
  const baseFile: AudioFileItem = {
    name: 'mix.wav',
    relativePath: 'mix.wav',
    extension: '.wav',
    sizeBytes: 1024,
    fullPath: '/input/mix.wav',
    channels: 2
  };

  it('shows a mono split badge and legend for predicted candidates', () => {
    renderWithTranslations(
      <FilesTable
        files={[baseFile]}
        monoSplitCandidates={[baseFile]}
        showMonoSplitLegend
      />
    );

    expect(screen.getByText('mono split')).toBeInTheDocument();
    expect(
      screen.getByText('This stereo file will be split into mono tracks during ZIP packing.')
    ).toBeInTheDocument();
  });

  it('hides the mono split badge when no candidates exist', () => {
    renderWithTranslations(<FilesTable files={[baseFile]} />);

    expect(screen.queryByText('mono split')).not.toBeInTheDocument();
  });
});
