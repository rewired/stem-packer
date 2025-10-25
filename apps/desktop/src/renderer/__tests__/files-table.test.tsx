import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { TranslationProvider } from '../hooks/useTranslation';
import type { AudioFileItem } from '../../shared/preferences';
import { FilesTable } from '../components/FilesTable';
import type { ExcessNonSplittablePrediction } from '../../main/estimator';

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

  it('renders non-splittable warnings before the filename with severity styling', () => {
    const warningPrediction: ExcessNonSplittablePrediction = {
      fileId: baseFile.relativePath,
      bytes: baseFile.sizeBytes,
      severity: 'warning'
    };
    const criticalFile: AudioFileItem = {
      name: 'lead.mp3',
      relativePath: 'lead.mp3',
      extension: '.mp3',
      sizeBytes: 2048,
      fullPath: '/input/lead.mp3'
    };
    const criticalPrediction: ExcessNonSplittablePrediction = {
      fileId: criticalFile.relativePath,
      bytes: criticalFile.sizeBytes,
      severity: 'critical'
    };

    renderWithTranslations(
      <FilesTable
        files={[baseFile, criticalFile]}
        nonSplittableWarnings={new Map([
          [warningPrediction.fileId, warningPrediction],
          [criticalPrediction.fileId, criticalPrediction]
        ])}
      />
    );

    const badges = screen.getAllByLabelText(
      'This file exceeds the configured ZIP size limit and cannot be split. Switch to 7z volumes.'
    );

    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveAttribute('data-severity', 'warning');
    expect(badges[1]).toHaveAttribute('data-severity', 'critical');

    const warningRow = screen.getByText('mix.wav').closest('tr');
    const criticalRow = screen.getByText('lead.mp3').closest('tr');

    expect(warningRow?.querySelector('div')?.firstElementChild).toBe(badges[0]);
    expect(criticalRow?.querySelector('div')?.firstElementChild).toBe(badges[1]);
  });

  it('provides accessible tooltip text for non-splittable warnings', () => {
    const prediction: ExcessNonSplittablePrediction = {
      fileId: baseFile.relativePath,
      bytes: baseFile.sizeBytes,
      severity: 'critical'
    };

    renderWithTranslations(
      <FilesTable
        files={[baseFile]}
        nonSplittableWarnings={new Map([[prediction.fileId, prediction]])}
      />
    );

    const badge = screen.getByLabelText(
      'This file exceeds the configured ZIP size limit and cannot be split. Switch to 7z volumes.'
    );

    expect(badge).toHaveAttribute('title', 'Switch to 7z volumes');
    expect(badge).toHaveAttribute('data-severity', 'critical');
  });

  it('keeps the table header sticky with fixed column sizing', () => {
    renderWithTranslations(<FilesTable files={[baseFile]} />);

    const table = screen.getByRole('table');
    const header = table.querySelector('thead');

    expect(header).not.toBeNull();
    expect(header).toHaveClass('sticky', 'top-0', 'bg-base-100', 'z-10');

    const [nameHeader, typeHeader, sizeHeader, actionHeader] = within(header!).getAllByRole(
      'columnheader'
    );

    expect(nameHeader).toHaveClass('w-1/2');
    expect(typeHeader).toHaveClass('w-20');
    expect(sizeHeader).toHaveClass('w-24', 'text-right', 'tabular-nums');
    expect(actionHeader).toHaveClass('w-16', 'text-right');
  });

  it('right-aligns numeric cells with tabular spacing', () => {
    renderWithTranslations(<FilesTable files={[baseFile]} />);

    const sizeCell = screen.getByText('1.0 KB').closest('td');

    expect(sizeCell).not.toBeNull();
    expect(sizeCell).toHaveClass('text-right', 'tabular-nums');
  });
});
