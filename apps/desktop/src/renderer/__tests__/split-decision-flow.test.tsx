import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { StemPackerApi } from '../../preload/preload';
import type { Preferences } from '../../shared/preferences';
import type { CollisionCheckPayload, CollisionDetectionResult } from '../../shared/collisions';

const basePreferences: Preferences = {
  targetSizeMB: 8,
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
      name: 'Mixdown.wav',
      relativePath: 'Mixdown.wav',
      extension: '.wav',
      sizeBytes: 20 * 1024 * 1024,
      fullPath: '/projects/session/Mixdown.wav',
      channels: 2
    }
  ],
  monoSplitTooLargeFiles: []
};

describe('multichannel split decision flow', () => {
  const savePreferences = vi.fn<
    (update: Partial<Preferences>) => Promise<Preferences>
  >();
  const detectCollisions = vi.fn<
    (payload: CollisionCheckPayload) => Promise<CollisionDetectionResult>
  >();
  const scanFolder = vi.fn<(folder: string) => Promise<typeof scanResult>>();
  const overwriteCollisions = vi.fn();

  beforeEach(() => {
    savePreferences.mockReset();
    detectCollisions.mockReset();
    scanFolder.mockReset();

    savePreferences.mockImplementation(async (update) => ({
      ...basePreferences,
      ...update
    }));

    detectCollisions.mockResolvedValue({
      hasCollisions: false,
      kind: 'zip',
      collisionCount: 0,
      outputDir: basePreferences.outputDir
    });

    scanFolder.mockResolvedValue(scanResult);

    overwriteCollisions.mockReset();
    overwriteCollisions.mockResolvedValue({
      deletedCount: 0,
      kind: 'zip',
      outputDir: basePreferences.outputDir
    });

    const api: StemPackerApi = {
      getVersion: () => '0.0.0-test',
      getAppInfo: vi.fn().mockResolvedValue({ name: 'StemPacker', version: '0.0.0-test' }),
      getPreferences: vi.fn().mockResolvedValue(basePreferences),
      scanFolder,
      chooseInputFolder: vi.fn().mockResolvedValue({
        canceled: false,
        folderPath: scanResult.folderPath
      }),
      savePreferences,
      detectCollisions,
      overwriteCollisions: overwriteCollisions as StemPackerApi['overwriteCollisions'],
      getArtist: vi.fn().mockResolvedValue({ artist: '' }),
      saveArtist: vi.fn().mockResolvedValue({ artist: '' }),
      startPacking: vi.fn(),
      cancelPacking: vi.fn().mockResolvedValue(false),
      onPackingProgress: vi.fn().mockReturnValue(() => {}),
      onPackingResult: vi.fn().mockReturnValue(() => {}),
      onPackingError: vi.fn().mockReturnValue(() => {}),
      resolveDroppedPaths: vi
        .fn()
        .mockResolvedValue({ status: 'success', folderPath: scanResult.folderPath })
    };

    window.stemPacker = api;
  });

  it('allows enabling mono splits directly from the dialog', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));

    const heading = await screen.findByText('Oversized multichannel stems detected');
    const dialog = heading.closest('dialog');
    expect(dialog).not.toBeNull();

    await userEvent.click(
      within(dialog as HTMLDialogElement).getByRole('button', {
        name: 'Split into mono files',
        hidden: true
      })
    );

    await waitFor(() => {
      expect(savePreferences).toHaveBeenCalledWith({
        auto_split_multichannel_to_mono: true
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Oversized multichannel stems detected')).not.toBeInTheDocument();
    });

    expect(scanFolder).toHaveBeenCalledTimes(2);
  });

  it('switches to 7z volumes without re-prompting', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));

    const heading = await screen.findByText('Oversized multichannel stems detected');
    const dialog = heading.closest('dialog');
    expect(dialog).not.toBeNull();

    await userEvent.click(
      within(dialog as HTMLDialogElement).getByRole('button', {
        name: 'Use 7z volumes',
        hidden: true
      })
    );

    await waitFor(() => {
      expect(savePreferences).toHaveBeenCalledWith({ format: '7z' });
    });

    await waitFor(() => {
      expect(detectCollisions).toHaveBeenLastCalledWith({
        inputFolder: scanResult.folderPath,
        format: '7z',
        outputDir: basePreferences.outputDir
      });
    });

    expect(scanFolder).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Oversized multichannel stems detected')).not.toBeInTheDocument();
  });

  it('returns to the idle state when cancelled', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));

    const heading = await screen.findByText('Oversized multichannel stems detected');
    const dialog = heading.closest('dialog');
    expect(dialog).not.toBeNull();

    const cancelButtons = within(dialog as HTMLDialogElement).getAllByRole('button', {
      name: 'Cancel and choose another folder',
      hidden: true
    });

    await userEvent.click(cancelButtons[0]);

    await screen.findByText('Action cancelled.');
    expect(screen.queryByText('Oversized multichannel stems detected')).not.toBeInTheDocument();
    expect(screen.queryAllByText('Mixdown.wav')).toHaveLength(0);
    expect(savePreferences).not.toHaveBeenCalled();
  });
});
