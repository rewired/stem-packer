import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { StemPackerApi } from '../../preload/preload';
import type { Preferences } from '../../shared/preferences';

describe('empty folder scan handling', () => {
  const basePreferences: Preferences = {
    targetSizeMB: 50,
    format: 'zip',
    outputDir: '/tmp/exports',
    auto_split_multichannel_to_mono: false,
    ignore_enabled: true,
    ignore_globs: ['**/.DS_Store']
  };

  let scanFolderMock: ReturnType<typeof vi.fn>;
  let chooseInputFolderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scanFolderMock = vi.fn().mockResolvedValue({
      folderPath: '/input/empty',
      ignoredCount: 0,
      files: [],
      monoSplitTooLargeFiles: []
    });

    chooseInputFolderMock = vi
      .fn()
      .mockResolvedValue({ canceled: false, folderPath: '/input/empty' });

    const api: StemPackerApi = {
      getVersion: () => '0.0.0-test',
      getAppInfo: vi.fn().mockResolvedValue({ name: 'StemPacker', version: '0.0.0-test' }),
      getPreferences: vi.fn().mockResolvedValue({ ...basePreferences }),
      scanFolder: scanFolderMock as unknown as StemPackerApi['scanFolder'],
      chooseInputFolder: chooseInputFolderMock as unknown as StemPackerApi['chooseInputFolder'],
      savePreferences: vi.fn().mockImplementation(async (update: Partial<Preferences>) => ({
        ...basePreferences,
        ...update
      })),
      detectCollisions: vi.fn().mockResolvedValue({
        hasCollisions: false,
        kind: 'zip',
        collisionCount: 0,
        outputDir: basePreferences.outputDir
      }),
      overwriteCollisions: vi.fn().mockResolvedValue({
        deletedCount: 0,
        kind: 'zip',
        outputDir: basePreferences.outputDir
      }),
      getArtist: vi.fn().mockResolvedValue({ artist: '' }),
      saveArtist: vi.fn().mockResolvedValue({ artist: '' }),
      startPacking: vi.fn().mockResolvedValue({
        format: 'zip',
        outputPaths: ['/tmp/exports/stems-01.zip'],
        plan: []
      }),
      cancelPacking: vi.fn().mockResolvedValue(true),
      onPackingProgress: vi.fn().mockImplementation(() => vi.fn()),
      onPackingResult: vi.fn().mockImplementation(() => vi.fn()),
      onPackingError: vi.fn().mockImplementation(() => vi.fn()),
      resolveDroppedPaths: vi.fn().mockResolvedValue({
        status: 'success',
        folderPath: '/input/empty'
      })
    };

    window.stemPacker = api;
  });

  it('defers the empty state until an empty scan completes and shows an error toast', async () => {
    render(<App />);

    const packPanel = await screen.findByRole('tabpanel', { name: 'Pack Stems' });
    expect(
      within(packPanel).queryByText('No supported audio files found in the folder.')
    ).toBeNull();

    const chooseButton = await within(packPanel).findByRole('button', { name: 'Choose Folder' });

    await act(async () => {
      fireEvent.click(chooseButton);
    });

    await waitFor(() => {
      expect(chooseInputFolderMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(scanFolderMock).toHaveBeenCalledWith('/input/empty');
    });

    await waitFor(() => {
      const inlineMessage = within(packPanel).getByText(
        'No supported audio files found in the folder.'
      );
      expect(inlineMessage).toBeInTheDocument();
    });

    const messages = screen.getAllByText('No supported audio files found in the folder.');
    expect(messages.some((node) => node.closest('.alert'))).toBe(true);
  });
});

