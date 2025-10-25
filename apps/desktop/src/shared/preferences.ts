export const AUDIO_EXTENSIONS = [
  '.wav',
  '.wave',
  '.aif',
  '.aiff',
  '.flac',
  '.mp3',
  '.ogg',
  '.oga',
  '.opus',
  '.aac',
  '.m4a',
  '.wma',
  '.alac',
  '.ape'
];

export type ArchiveFormat = 'zip' | '7z';

export interface Preferences {
  targetSizeMB: number;
  format: ArchiveFormat;
  outputDir: string;
  auto_split_multichannel_to_mono: boolean;
  ignore_enabled: boolean;
  ignore_globs: string[];
}

export interface AppInfo {
  name: string;
  version: string;
}

export interface AudioFileItem {
  name: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  fullPath: string;
  channels?: number;
}

export interface ScanResult {
  folderPath: string;
  files: AudioFileItem[];
  ignoredCount: number;
}

export interface ChooseFolderResult {
  canceled: boolean;
  folderPath?: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  targetSizeMB: 50,
  format: 'zip',
  outputDir: '',
  auto_split_multichannel_to_mono: false,
  ignore_enabled: true,
  ignore_globs: [
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/~*',
    '**/*.tmp',
    '**/*.bak',
    '**/.git/**',
    '**/*.cue',
    '**/*.m3u*'
  ]
};

