import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PreferencesStore, ArtistStore } from '../stores';
import { DEFAULT_PREFERENCES } from '../../shared/preferences';

function createTempDir(prefix: string) {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('PreferencesStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('stem-packer-prefs-');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('persists artist-related preference fields with round-trip cloning', async () => {
    const store = new PreferencesStore(tempDir);
    await store.load();

    const ignoreGlobs = ['**/*.bak', '**/*.tmp'];
    const updated = await store.set({
      targetSizeMB: 64,
      format: '7z',
      outputDir: 'exports',
      auto_split_multichannel_to_mono: true,
      ignore_enabled: false,
      ignore_globs: ignoreGlobs
    });

    expect(updated.ignore_globs).not.toBe(ignoreGlobs);
    expect(updated).toMatchObject({
      targetSizeMB: 64,
      format: '7z',
      outputDir: 'exports',
      auto_split_multichannel_to_mono: true,
      ignore_enabled: false,
    });

    const reloaded = new PreferencesStore(tempDir);
    await reloaded.load();
    const snapshot = reloaded.get();

    expect(snapshot.targetSizeMB).toBe(64);
    expect(snapshot.format).toBe('7z');
    expect(snapshot.outputDir).toBe('exports');
    expect(snapshot.auto_split_multichannel_to_mono).toBe(true);
    expect(snapshot.ignore_enabled).toBe(false);
    expect(snapshot.ignore_globs).toEqual(ignoreGlobs);
    expect(snapshot.ignore_globs).not.toBe(updated.ignore_globs);

    const defaults = new PreferencesStore(tempDir);
    await defaults.load();
    expect(defaults.get().targetSizeMB).not.toBe(DEFAULT_PREFERENCES.targetSizeMB);
  });
});

describe('ArtistStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('stem-packer-artist-');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('trims and persists artist profiles across reloads', async () => {
    const store = new ArtistStore(tempDir);
    await store.load();

    const saved = await store.set('  Stem Collective  ');
    expect(saved.artist).toBe('Stem Collective');

    const reloaded = new ArtistStore(tempDir);
    await reloaded.load();
    expect(reloaded.get().artist).toBe('Stem Collective');
  });
});
