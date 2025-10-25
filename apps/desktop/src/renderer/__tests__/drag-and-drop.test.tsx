import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { StemPackerApi } from '../../preload/preload';
import type { Preferences } from '../../shared/preferences';

describe('renderer drag-and-drop handling', () => {
  const basePreferences: Preferences = {
    targetSizeMB: 50,
    format: 'zip',
    outputDir: '/tmp/exports',
    auto_split_multichannel_to_mono: false,
    ignore_enabled: true,
    ignore_globs: ['**/.DS_Store']
  };

  const scanFiles = [
    {
      name: 'demo.wav',
      relativePath: 'session/demo.wav',
      extension: '.wav',
      sizeBytes: 2048,
      fullPath: '/input/session/demo.wav'
    }
  ];

  let scanFolderMock: ReturnType<typeof vi.fn>;
  let resolveDroppedPathsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scanFolderMock = vi
      .fn()
      .mockResolvedValue({
        folderPath: '/input/session',
        ignoredCount: 0,
        files: scanFiles,
        monoSplitTooLargeFiles: []
      });

    resolveDroppedPathsMock = vi.fn().mockResolvedValue({
      status: 'success',
      folderPath: '/input/session'
    });

    const api: StemPackerApi = {
      getVersion: () => '0.0.0-test',
      getAppInfo: vi.fn().mockResolvedValue({ name: 'StemPacker', version: '0.0.0-test' }),
      getPreferences: vi.fn().mockResolvedValue({ ...basePreferences }),
      scanFolder: scanFolderMock as unknown as StemPackerApi['scanFolder'],
      chooseInputFolder: vi.fn().mockResolvedValue({ canceled: true, folderPath: null }),
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
      onPackingProgress: vi
        .fn()
        .mockImplementation(() => vi.fn()),
      onPackingResult: vi
        .fn()
        .mockImplementation(() => vi.fn()),
      onPackingError: vi
        .fn()
        .mockImplementation(() => vi.fn()),
      resolveDroppedPaths: resolveDroppedPathsMock as unknown as StemPackerApi['resolveDroppedPaths']
    };

    window.stemPacker = api;
  });

  it('scans the resolved root folder when nested files are dropped', async () => {
    render(<App />);

    const dropLabel = await screen.findByText('Drop a folder of stems');
    const dropTarget = dropLabel.closest('div[role="presentation"]');
    expect(dropTarget).not.toBeNull();

    const dataTransfer = {
      getData: (type: string) =>
        type === 'text/uri-list'
          ? [
              'file:///input/session/Sub1/Stems%201.wav',
              'file:///input/session/Sub2/Nested/Stems%202.wav'
            ].join('\n')
          : '',
      files: [] as unknown as FileList
    };

    await act(async () => {
      fireEvent.drop(dropTarget!, { dataTransfer });
    });

    await waitFor(() => {
      expect(scanFolderMock).toHaveBeenCalledWith('/input/session');
    });

    expect(resolveDroppedPathsMock).toHaveBeenCalledTimes(1);
    expect(resolveDroppedPathsMock).toHaveBeenCalledWith({
      candidate: '/input/session',
      hasDirectoryEntry: false,
      paths: [
        '/input/session/Sub1/Stems 1.wav',
        '/input/session/Sub2/Nested/Stems 2.wav'
      ]
    });
  });

  it('shows a warning toast when files are dropped', async () => {
    resolveDroppedPathsMock.mockResolvedValueOnce({
      status: 'error',
      reason: 'not_directory'
    });

    render(<App />);

    const dropLabel = await screen.findByText('Drop a folder of stems');
    const dropTarget = dropLabel.closest('div[role="presentation"]');
    expect(dropTarget).not.toBeNull();

    const dataTransfer = {
      getData: (type: string) => (type === 'text/plain' ? '/input/session/song.wav' : ''),
      files: [] as unknown as FileList
    };

    await act(async () => {
      fireEvent.drop(dropTarget!, { dataTransfer });
    });

    expect(scanFolderMock).not.toHaveBeenCalled();
    await screen.findByText('Only folders can be imported. Drop a folder to continue.');
  });
});

