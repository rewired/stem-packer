import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { StemPackerApi } from '../../preload/preload';
import type { Preferences } from '../../shared/preferences';
import type {
  CollisionCheckPayload,
  CollisionDetectionResult,
  CollisionResolutionResult
} from '../../shared/collisions';

const basePreferences: Preferences = {
  targetSizeMB: 50,
  format: 'zip',
  outputDir: '/tmp/stems',
  auto_split_multichannel_to_mono: false,
  ignore_enabled: true,
  ignore_globs: ['**/.DS_Store']
};

const scanResult = {
  folderPath: '/projects/session',
  ignoredCount: 0,
  files: [
    {
      name: 'Kick.wav',
      relativePath: 'Kick.wav',
      extension: '.wav',
      sizeBytes: 1_024,
      fullPath: '/projects/session/Kick.wav'
    }
  ],
  monoSplitTooLargeFiles: []
};

describe('overwrite / abort flow', () => {
  const overwriteCollisions = vi.fn<(payload: CollisionCheckPayload) => Promise<CollisionResolutionResult>>();
  const detectCollisions = vi.fn<(payload: CollisionCheckPayload) => Promise<CollisionDetectionResult>>();
  const savePreferences = vi.fn();

  beforeEach(() => {
    overwriteCollisions.mockReset();
    detectCollisions.mockReset();
    savePreferences.mockReset();

    const api: StemPackerApi = {
      getVersion: () => '0.0.0-test',
      getAppInfo: vi.fn().mockResolvedValue({ name: 'StemPacker', version: '0.0.0-test' }),
      getPreferences: vi.fn().mockResolvedValue(basePreferences),
      scanFolder: vi.fn().mockResolvedValue(scanResult),
      chooseInputFolder: vi.fn().mockResolvedValue({
        canceled: false,
        folderPath: scanResult.folderPath
      }),
      savePreferences: savePreferences.mockResolvedValue(basePreferences),
      detectCollisions: detectCollisions,
      overwriteCollisions: overwriteCollisions.mockResolvedValue({
        deletedCount: 2,
        kind: 'zip',
        outputDir: basePreferences.outputDir
      }),
      getArtist: vi.fn().mockResolvedValue({ artist: '' }),
      saveArtist: vi.fn().mockResolvedValue({ artist: '' }),
      startPacking: vi.fn(),
      cancelPacking: vi.fn().mockResolvedValue(false),
      onPackingProgress: vi.fn().mockReturnValue(() => {}),
      onPackingResult: vi.fn().mockReturnValue(() => {}),
      onPackingError: vi.fn().mockReturnValue(() => {})
    };

    window.stemPacker = api;
  });

  it('allows the user to ignore the warning and overwrite collisions', async () => {
    detectCollisions.mockResolvedValue({
      hasCollisions: true,
      kind: 'zip',
      collisionCount: 2,
      outputDir: basePreferences.outputDir
    });

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));

    await screen.findByText('StemPacker outputs already exist');

    await userEvent.click(screen.getByRole('button', { name: 'Ignore and overwrite', hidden: true }));

    await waitFor(() => {
      expect(overwriteCollisions).toHaveBeenCalledTimes(1);
    });

    expect(overwriteCollisions).toHaveBeenCalledWith({
      inputFolder: scanResult.folderPath,
      format: basePreferences.format,
      outputDir: basePreferences.outputDir
    });

    await screen.findByText('Removed existing StemPacker outputs.');
    expect(screen.queryByText('StemPacker outputs already exist')).not.toBeInTheDocument();
  });

  it('aborts the selection and clears the UI when requested', async () => {
    detectCollisions.mockResolvedValue({
      hasCollisions: true,
      kind: '7z',
      collisionCount: 3,
      outputDir: basePreferences.outputDir
    });

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));

    const heading = await screen.findByText('StemPacker outputs already exist');
    const dialog = heading.closest('dialog');
    expect(dialog).not.toBeNull();
    expect(screen.getAllByText('Kick.wav').length).toBeGreaterThan(0);

    await userEvent.click(
      within(dialog as HTMLElement).getAllByRole('button', { name: 'Abort', hidden: true })[0]
    );

    await screen.findByText('Action cancelled.');
    await waitFor(() => {
      expect(screen.queryAllByText('Kick.wav')).toHaveLength(0);
    });
    expect(detectCollisions).toHaveBeenCalledTimes(1);
    expect(overwriteCollisions).not.toHaveBeenCalled();
    expect(savePreferences).not.toHaveBeenCalled();
  });
});
