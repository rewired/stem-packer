import type { ArchiveFormat } from './preferences';

export type CollisionKind = Extract<ArchiveFormat, 'zip' | '7z'>;

export interface CollisionCheckPayload {
  inputFolder: string;
  format: CollisionKind;
  outputDir?: string;
}

export interface CollisionDetectionResult {
  hasCollisions: boolean;
  kind?: CollisionKind;
  collisionCount: number;
  outputDir: string;
}

export interface CollisionResolutionResult {
  deletedCount: number;
  kind?: CollisionKind;
  outputDir: string;
}
