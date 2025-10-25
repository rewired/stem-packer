import type {
  SevenZipPackResult,
  SevenZipProgress,
  ZipPackResult,
  ZipProgress,
} from '@stem-packer/pack-engine';
import type { AudioFileItem, ArchiveFormat } from './preferences';
import type { InfoTextFields } from './info';

export type PackingProgressEvent = ZipProgress | SevenZipProgress;

export interface PackingRequest {
  folderPath: string;
  files: AudioFileItem[];
  info: InfoTextFields;
  artist?: string;
}

export type PackingResult =
  | ({ format: Extract<ArchiveFormat, 'zip'> } & ZipPackResult)
  | ({ format: Extract<ArchiveFormat, '7z'> } & SevenZipPackResult);
