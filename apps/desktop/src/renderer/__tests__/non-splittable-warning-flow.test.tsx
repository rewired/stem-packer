import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { StemPackerApi } from '../../preload/preload';
import type { Preferences } from '../../shared/preferences';

const MB = 1024 * 1024;

describe('non-splittable warning flow', () => {
  const baseFile = {
    name: 'oversized.mp3',
    relativePath: 'oversized.mp3',
    extension: '.mp3',
    sizeBytes: 70 * MB,
    fullPath: '/input/oversized.mp3'
  };

  function buildApi(preferences: Preferences): StemPackerApi {
    const sharedApi: Pick<
      StemPackerApi,
      | 'getAppInfo'
      | 'getArtist'
      | 'saveArtist'
      | 'onPackingProgress'
      | 'onPackingResult'
      | 'onPackingError'
      | 'detectCollisions'
      | 'overwriteCollisions'
      | 'startPacking'
      | 'cancelPacking'
      | 'resolveDroppedPaths'
    > = {
      getAppInfo: vi.fn().mockResolvedValue({ name: 'StemPacker', version: '0.0.0-test' }),
      getArtist: vi.fn().mockResolvedValue({ artist: '' }),
      saveArtist: vi.fn().mockResolvedValue({ artist: '' }),
      onPackingProgress: vi.fn().mockReturnValue(() => {}),
      onPackingResult: vi.fn().mockReturnValue(() => {}),
      onPackingError: vi.fn().mockReturnValue(() => {}),
      detectCollisions: vi.fn().mockResolvedValue({
        hasCollisions: false,
        kind: 'zip',
        collisionCount: 0,
        outputDir: '/tmp/exports'
      }),
      overwriteCollisions: vi.fn().mockResolvedValue({
        deletedCount: 0,
        kind: 'zip',
        outputDir: '/tmp/exports'
      }),
      startPacking: vi.fn(),
      cancelPacking: vi.fn().mockResolvedValue(false),
      resolveDroppedPaths: vi.fn().mockResolvedValue({ status: 'success', folderPath: '/input' })
    };

    return {
      ...sharedApi,
      getVersion: () => '0.0.0-test',
      getPreferences: vi.fn().mockResolvedValue(preferences),
      savePreferences: vi.fn().mockImplementation(async (update: Partial<Preferences>) => ({
        ...preferences,
        ...update
      })),
      chooseInputFolder: vi
        .fn()
        .mockResolvedValue({ canceled: false, folderPath: '/input' }),
      scanFolder: vi.fn().mockResolvedValue({
        folderPath: '/input',
        ignoredCount: 0,
        files: [baseFile],
        monoSplitTooLargeFiles: []
      })
    };
  }

  it('shows a critical warning badge in ZIP mode', async () => {
    const preferences: Preferences = {
      targetSizeMB: 50,
      format: 'zip',
      outputDir: '/tmp/exports',
      auto_split_multichannel_to_mono: false,
      ignore_enabled: true,
      ignore_globs: []
    };

    window.stemPacker = buildApi(preferences);

    render(<App />);

    const chooseFolderButton = await screen.findByRole('button', { name: 'Choose Folder' });
    await userEvent.click(chooseFolderButton);

    await waitFor(() => {
      expect(window.stemPacker.scanFolder).toHaveBeenCalledWith('/input');
    });

    const warningBadge = await screen.findByLabelText(
      'This file exceeds the configured ZIP size limit and cannot be split. Switch to 7z volumes.'
    );

    expect(warningBadge).toHaveAttribute('data-severity', 'critical');
    expect(warningBadge).toHaveTextContent('Exceeds ZIP limit');
  });

  it('hides non-splittable warnings when 7z mode is active', async () => {
    const preferences: Preferences = {
      targetSizeMB: 50,
      format: '7z',
      outputDir: '/tmp/exports',
      auto_split_multichannel_to_mono: false,
      ignore_enabled: true,
      ignore_globs: []
    };

    window.stemPacker = buildApi(preferences);

    render(<App />);

    const chooseFolderButton = await screen.findByRole('button', { name: 'Choose Folder' });
    await userEvent.click(chooseFolderButton);

    await waitFor(() => {
      expect(window.stemPacker.scanFolder).toHaveBeenCalledWith('/input');
    });

    expect(
      screen.queryByText('Exceeds ZIP limit')
    ).not.toBeInTheDocument();
  });
});
