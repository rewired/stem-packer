import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { StemPackerApi } from '../../preload/preload';
import type { Preferences } from '../../shared/preferences';
import type { PackingProgressEvent, PackingResult } from '../../shared/packing';

describe('renderer packing workflow', () => {
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
      relativePath: 'demo.wav',
      extension: '.wav',
      sizeBytes: 1024,
      fullPath: '/input/demo.wav'
    }
  ];

  let progressListener: ((event: PackingProgressEvent) => void) | undefined;
  let resultListener: ((result: PackingResult) => void) | undefined;
  let errorListener: ((error: { name: string; message: string }) => void) | undefined;

  beforeEach(() => {
    progressListener = undefined;
    resultListener = undefined;
    errorListener = undefined;

    const api: StemPackerApi = {
      getVersion: () => '0.0.0-test',
      getAppInfo: vi.fn().mockResolvedValue({ name: 'StemPacker', version: '0.0.0-test' }),
      getPreferences: vi.fn().mockResolvedValue({ ...basePreferences }),
      scanFolder: vi.fn().mockResolvedValue({ folderPath: '/input', ignoredCount: 0, files: scanFiles }),
      chooseInputFolder: vi.fn().mockResolvedValue({ canceled: false, folderPath: '/input' }),
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
      onPackingProgress: vi.fn().mockImplementation((listener) => {
        progressListener = listener;
        return vi.fn();
      }),
      onPackingResult: vi.fn().mockImplementation((listener) => {
        resultListener = listener;
        return vi.fn();
      }),
      onPackingError: vi.fn().mockImplementation((listener) => {
        errorListener = listener;
        return vi.fn();
      })
    };

    window.stemPacker = api;
  });

  it('starts packing, shows progress, and handles cancellation', async () => {
    render(<App />);

    const chooseFolderButton = await screen.findByRole('button', { name: 'Choose Folder' });
    await userEvent.click(chooseFolderButton);

    await waitFor(() => {
      expect(window.stemPacker.scanFolder).toHaveBeenCalledWith('/input');
    });

    const packButton = await screen.findByRole('button', { name: 'Start Packing' });
    await userEvent.click(packButton);

    await waitFor(() => {
      expect(window.stemPacker.startPacking).toHaveBeenCalled();
    });

    expect(window.stemPacker.startPacking).toHaveBeenCalledWith({
      folderPath: '/input',
      files: scanFiles,
      info: {
        title: '',
        artist: '',
        album: '',
        bpm: '',
        key: '',
        license: '',
        attribution: ''
      },
      artist: ''
    });

    expect(progressListener).toBeTypeOf('function');

    await act(async () => {
      progressListener?.({
        state: 'packing',
        current: 1,
        total: 3,
        percent: 33,
        message: 'Packing 1/3',
        currentArchive: 'stems-01.zip'
      });
    });

    await screen.findByText('Packing in progress');
    await screen.findByRole('progressbar', { name: 'Packing progress' });

    const cancelButton = await screen.findByRole('button', { name: 'Cancel Packing' });
    await userEvent.click(cancelButton);
    expect(window.stemPacker.cancelPacking).toHaveBeenCalledTimes(1);

    await act(async () => {
      progressListener?.({
        state: 'cancelled',
        current: 1,
        total: 3,
        percent: 33,
        message: 'Cancelled',
        currentArchive: null
      });
    });

    const cancelledNotices = await screen.findAllByText('Packing cancelled.');
    expect(cancelledNotices.length).toBeGreaterThan(0);
  });

  it('renders success and error states from IPC events', async () => {
    render(<App />);

    const chooseFolderButton = await screen.findByRole('button', { name: 'Choose Folder' });
    await userEvent.click(chooseFolderButton);
    await waitFor(() => {
      expect(window.stemPacker.scanFolder).toHaveBeenCalledWith('/input');
    });

    const packButton = await screen.findByRole('button', { name: 'Start Packing' });
    await userEvent.click(packButton);

    await waitFor(() => {
      expect(window.stemPacker.startPacking).toHaveBeenCalled();
    });

    expect(resultListener).toBeTypeOf('function');
    expect(errorListener).toBeTypeOf('function');

    const result: PackingResult = {
      format: 'zip',
      outputPaths: ['/tmp/exports/stems-01.zip'],
      plan: []
    };

    await act(async () => {
      resultListener?.(result);
    });
    await screen.findByText('Packing finished. Created 1 output file(s).');

    await act(async () => {
      errorListener?.({ name: 'TestError', message: 'Something went wrong' });
    });

    await waitFor(() => {
      expect(screen.getByText('Packing failed. Try again.')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});

