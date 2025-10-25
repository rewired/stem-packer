import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { StemPackerApi } from '../../preload/preload';
import type { Preferences } from '../../shared/preferences';

describe('renderer layout tabs', () => {
  const basePreferences: Preferences = {
    targetSizeMB: 50,
    format: 'zip',
    outputDir: '/tmp/stems',
    auto_split_multichannel_to_mono: false,
    ignore_enabled: true,
    ignore_globs: ['**/.DS_Store']
  };

  beforeEach(() => {
    const api: StemPackerApi = {
      getVersion: () => '0.0.0-test',
      getAppInfo: vi.fn().mockResolvedValue({ name: 'StemPacker', version: '0.0.0-test' }),
      getPreferences: vi.fn().mockResolvedValue({ ...basePreferences }),
      scanFolder: vi
        .fn()
        .mockResolvedValue({
          folderPath: '',
          ignoredCount: 0,
          files: [],
          monoSplitTooLargeFiles: []
        }),
      chooseInputFolder: vi.fn().mockResolvedValue({ canceled: true, folderPath: '' }),
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
      startPacking: vi.fn(),
      cancelPacking: vi.fn().mockResolvedValue(false),
      onPackingProgress: vi.fn().mockReturnValue(() => {}),
      onPackingResult: vi.fn().mockReturnValue(() => {}),
      onPackingError: vi.fn().mockReturnValue(() => {})
    };

    window.stemPacker = api;
  });

  it('renders the pack tab content by default', async () => {
    render(<App />);

    const packTab = await screen.findByRole('tab', { name: 'Pack Stems' });
    const preferencesTab = screen.getByRole('tab', { name: 'Preferences' });

    expect(packTab).toHaveAttribute('aria-selected', 'true');
    expect(preferencesTab).toHaveAttribute('aria-selected', 'false');
    await screen.findByRole('button', { name: 'Choose Folder' });
    expect(document.getElementById('pack-panel')).not.toHaveAttribute('hidden');
    expect(document.getElementById('preferences-panel')).toHaveAttribute('hidden');
  });

  it('switches panels when selecting the preferences tab', async () => {
    render(<App />);

    const preferencesTab = await screen.findByRole('tab', { name: 'Preferences' });
    await userEvent.click(preferencesTab);

    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('preferences-panel')).not.toHaveAttribute('hidden');
    expect(document.getElementById('pack-panel')).toHaveAttribute('hidden');
    await screen.findByRole('button', { name: 'Save Preferences' });

    const packTab = screen.getByRole('tab', { name: 'Pack Stems' });
    await userEvent.click(packTab);

    expect(packTab).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('pack-panel')).not.toHaveAttribute('hidden');
    expect(document.getElementById('preferences-panel')).toHaveAttribute('hidden');
  });
});
