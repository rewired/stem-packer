import { describe, expect, it } from 'vitest';
import { extractPathsFromDataTransfer, resolveDroppedFolder } from '../hooks/useFolderDrop';

function createFileList(entries: Array<Partial<File> & { path?: string }>): FileList {
  const files = entries.map((entry) => entry as File & { path?: string });
  const fileList: Record<number, File & { path?: string }> & {
    length: number;
    item: (index: number) => (File & { path?: string }) | null;
    [Symbol.iterator]: () => IterableIterator<File & { path?: string }>;
  } = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    }
  } as never;

  files.forEach((file, index) => {
    fileList[index] = file;
  });

  return fileList as unknown as FileList;
}

function createDataTransferStub(options: {
  uriList?: string;
  plainText?: string;
  files?: Array<Partial<File> & { path?: string }>;
}): DataTransfer {
  const { uriList, plainText, files } = options;

  return {
    getData: (type: string) => {
      if (type === 'text/uri-list') {
        return uriList ?? '';
      }
      if (type === 'text/plain') {
        return plainText ?? '';
      }
      return '';
    },
    files: createFileList(files ?? []),
    items: [] as unknown as DataTransferItemList,
    types: []
  } as unknown as DataTransfer;
}

describe('useFolderDrop helpers', () => {
  it('extracts paths from text/uri-list payloads', () => {
    const dataTransfer = createDataTransferStub({
      uriList: 'file:///Users/test/Audio%20File.wav\n'
    });

    expect(extractPathsFromDataTransfer(dataTransfer)).toEqual([
      '/Users/test/Audio File.wav'
    ]);
  });

  it('extracts paths from plain text payloads', () => {
    const dataTransfer = createDataTransferStub({
      plainText: 'C:/Projects/Stems/song.wav\r\n'
    });

    expect(extractPathsFromDataTransfer(dataTransfer)).toEqual([
      'C:/Projects/Stems/song.wav'
    ]);
  });

  it('falls back to dropped file entries when no text data is available', () => {
    const dataTransfer = createDataTransferStub({
      files: [{ path: '/input/session/song.wav' }]
    });

    expect(extractPathsFromDataTransfer(dataTransfer)).toEqual([
      '/input/session/song.wav'
    ]);
  });

  it('returns the common ancestor when multiple nested files are provided', () => {
    const folder = resolveDroppedFolder([
      '/input/session/Sub1/Stems 1.wav',
      '/input/session/Sub2/Nested/Stems 2.wav'
    ]);
    expect(folder).toBe('/input/session');
  });

  it('prefers explicit directory hints', () => {
    const folder = resolveDroppedFolder(['C:/Projects/Stems/', 'C:/Projects/Stems/song.wav']);
    expect(folder).toBe('C:/Projects/Stems');
  });

  it('returns a single POSIX directory without computing an ancestor', () => {
    const folder = resolveDroppedFolder(['/input/session/']);
    expect(folder).toBe('/input/session');
  });

  it('returns a single Windows directory without computing an ancestor', () => {
    const folder = resolveDroppedFolder(['C:\\Projects\\Stems\\']);
    expect(folder).toBe('C:\\Projects\\Stems');
  });
});
