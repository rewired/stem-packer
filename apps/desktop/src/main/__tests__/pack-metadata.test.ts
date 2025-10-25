import { describe, expect, it } from 'vitest';
import { createTranslator } from '@stem-packer/i18n';
import { INFO_TXT_LABELS } from '../info-labels';
import {
  createInfoTextEntry,
  createPackMetadataEntry,
  type PackMetadataOutput,
  type PackMetadataOptions,
} from '../pack-metadata';
import type { InfoTextFields } from '../../shared/info';

describe('createPackMetadataEntry', () => {
  it('serializes pack metadata with channel annotations', () => {
    const outputs: PackMetadataOutput[] = [
      {
        relativePath: 'mix/session_L.wav',
        sizeBytes: 123456,
        derivedFrom: 'mix/session.wav',
        channelIndex: 0,
        channelLabel: 'L',
        channelMapSource: 'mask',
      },
      {
        relativePath: 'mix/session_R.wav',
        sizeBytes: 123456,
        derivedFrom: 'mix/session.wav',
        channelIndex: 1,
        channelLabel: 'R',
        channelMapSource: 'mask',
      },
      {
        relativePath: 'mix/vocals.wav',
        sizeBytes: 98765,
      },
    ];

    const options: PackMetadataOptions = {
      format: 'zip',
      targetSizeMB: 50,
      autoSplitMultichannelToMono: true,
      info: {
        title: 'Example Song',
        artist: 'Stem Collective',
        album: 'LP',
        bpm: 120,
        key: 'Am',
        license: 'CC-BY',
        attribution: 'Mixed by StemPack',
      },
      outputs,
      sources: [
        {
          relativePath: 'mix/session.wav',
          channelCount: 6,
          channelMapSource: 'mask',
        },
        {
          relativePath: 'mix/vocals.wav',
          channelCount: 1,
        },
      ],
      generatedAt: new Date('2024-01-01T00:00:00Z'),
      schemaVersion: 2,
    };

    const entry = createPackMetadataEntry(options);
    expect(entry.entryName).toBe('PACK-METADATA.json');
    expect(Buffer.isBuffer(entry.content)).toBe(true);

    const payload = JSON.parse((entry.content as Buffer).toString('utf8')) as {
      schemaVersion: number;
      generatedAt: string;
      pack: { format: string; targetSizeMB: number; autoSplitMultichannelToMono: boolean };
      info: InfoTextFields;
      files: Array<{ [key: string]: unknown }>;
    };

    expect(payload.schemaVersion).toBe(2);
    expect(payload.generatedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(payload.pack).toEqual({
      format: 'zip',
      targetSizeMB: 50,
      autoSplitMultichannelToMono: true,
    });
    expect(payload.info).toEqual({
      title: 'Example Song',
      artist: 'Stem Collective',
      album: 'LP',
      bpm: '120',
      key: 'Am',
      license: 'CC-BY',
      attribution: 'Mixed by StemPack',
    });

    expect(payload.files).toHaveLength(3);

    const sessionEntries = payload.files.filter(
      (file) => file.derivedFrom === 'mix/session.wav',
    );
    expect(sessionEntries).toHaveLength(2);
    for (const file of sessionEntries) {
      expect(file.splitStrategy).toBe('mono-per-channel');
      expect(file.originalChannelCount).toBe(6);
      expect(file.channelMapSource).toBe('mask');
      expect(typeof file.channelIndex).toBe('number');
      expect(typeof file.channelLabel).toBe('string');
    }

    const vocals = payload.files.find((file) => file.relativePath === 'mix/vocals.wav');
    expect(vocals).toEqual({
      relativePath: 'mix/vocals.wav',
      sizeBytes: 98765,
      originalChannelCount: 1,
      splitStrategy: 'none',
      derivedFrom: null,
      channelIndex: null,
      channelLabel: null,
      channelMapSource: null,
    });
  });

  it('falls back to derived counts and unknown map source when probes are missing', () => {
    const outputs: PackMetadataOutput[] = [
      {
        relativePath: 'mix/session_L.wav',
        sizeBytes: 321,
        derivedFrom: 'mix/session.wav',
        channelIndex: 0,
        channelLabel: 'L',
      },
      {
        relativePath: 'mix/session_R.wav',
        sizeBytes: 322,
        derivedFrom: 'mix/session.wav',
        channelIndex: 1,
        channelLabel: 'R',
      },
    ];

    const entry = createPackMetadataEntry({
      format: '7z',
      targetSizeMB: 75,
      autoSplitMultichannelToMono: false,
      info: {},
      outputs,
    });

    const payload = JSON.parse((entry.content as Buffer).toString('utf8')) as {
      files: Array<{ [key: string]: unknown }>;
    };

    expect(payload.files).toEqual([
      {
        relativePath: 'mix/session_L.wav',
        sizeBytes: 321,
        originalChannelCount: 2,
        splitStrategy: 'mono-per-channel',
        derivedFrom: 'mix/session.wav',
        channelIndex: 0,
        channelLabel: 'L',
        channelMapSource: 'unknown',
      },
      {
        relativePath: 'mix/session_R.wav',
        sizeBytes: 322,
        originalChannelCount: 2,
        splitStrategy: 'mono-per-channel',
        derivedFrom: 'mix/session.wav',
        channelIndex: 1,
        channelLabel: 'R',
        channelMapSource: 'unknown',
      },
    ]);
  });
});

describe('createInfoTextEntry', () => {
  it('produces a UTF-8 buffer without BOM using fixed English labels', () => {
    const entry = createInfoTextEntry({
      title: 'Session',
      artist: 'Composer',
      album: 'EP',
      bpm: 90,
      key: 'Dm',
      license: 'CC0',
      attribution: 'Engineered by Stem',
    });

    expect(entry.entryName).toBe('INFO.txt');
    expect(Buffer.isBuffer(entry.content)).toBe(true);

    const buffer = entry.content as Buffer;
    expect(buffer.slice(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);

    const text = buffer.toString('utf8');
    const lines = text.trimEnd().split('\n');
    expect(lines).toEqual([
      `${INFO_TXT_LABELS.title}: Session`,
      `${INFO_TXT_LABELS.artist}: Composer`,
      `${INFO_TXT_LABELS.album}: EP`,
      `${INFO_TXT_LABELS.bpm}: 90`,
      `${INFO_TXT_LABELS.key}: Dm`,
      `${INFO_TXT_LABELS.license}: CC0`,
      `${INFO_TXT_LABELS.attribution}: Engineered by Stem`,
    ]);
  });

  it('keeps the Key label untranslated even when locale is non-English', () => {
    const translator = createTranslator('de');
    expect(translator('button_choose_folder')).toBe('Ordner auswählen');

    const entry = createInfoTextEntry({ key: 'Am' });
    const text = (entry.content as Buffer).toString('utf8');
    expect(text).toContain(`${INFO_TXT_LABELS.key}: Am`);
  });
});
