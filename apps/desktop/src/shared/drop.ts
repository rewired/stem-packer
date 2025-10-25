export type DroppedFolderResolutionError =
  | 'empty'
  | 'not_directory'
  | 'not_found'
  | 'unknown';

export interface ResolveDroppedPathsRequest {
  paths: string[];
  candidate: string | null;
  hasDirectoryEntry: boolean;
}

export type ResolveDroppedPathsResponse =
  | { status: 'success'; folderPath: string }
  | { status: 'error'; reason: DroppedFolderResolutionError };
