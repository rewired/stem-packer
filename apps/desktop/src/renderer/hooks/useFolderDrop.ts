import { useCallback, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import {
  computeCommonAncestor,
  stripDirectorySeparators
} from '../utils/pathFormatting';
import type {
  DroppedFolderResolutionError,
  ResolveDroppedPathsResponse
} from '../../shared/drop';

type FileSystemEntry = {
  isDirectory: boolean;
};

type FileSystemItem = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

function normalizeFileUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'file:') {
      return null;
    }

    const host = url.host && url.host !== 'localhost' ? `//${url.host}` : '';
    let pathname = decodeURI(url.pathname);

    if (/^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }

    const rawPath = `${host}${pathname}`;
    const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
    return isWindows ? rawPath.replace(/\//g, '\\') : rawPath;
  } catch (error) {
    console.error('Failed to decode dropped URI', uri, error);
    return null;
  }
}

function parseUriList(dataTransfer: DataTransfer): string[] {
  const uriList = dataTransfer.getData('text/uri-list');
  if (!uriList) {
    return [];
  }

  return uriList
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map(normalizeFileUri)
    .filter((value): value is string => Boolean(value));
}

function parsePlainText(dataTransfer: DataTransfer): string[] {
  const text = dataTransfer.getData('text/plain');
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line.startsWith('file://')) {
        return normalizeFileUri(line);
      }
      return line;
    })
    .filter((value): value is string => Boolean(value));
}

function parseFileList(dataTransfer: DataTransfer): string[] {
  if (!dataTransfer.files || dataTransfer.files.length === 0) {
    return [];
  }

  return Array.from(dataTransfer.files)
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => typeof path === 'string' && path.length > 0);
}

function hasDirectoryEntry(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer?.items) {
    return false;
  }

  return Array.from(dataTransfer.items).some((item) => {
    const entry = (item as FileSystemItem).webkitGetAsEntry?.();
    return Boolean(entry?.isDirectory);
  });
}

export function extractPathsFromDataTransfer(dataTransfer: DataTransfer | null): string[] {
  if (!dataTransfer) {
    return [];
  }

  const fromUris = parseUriList(dataTransfer);
  if (fromUris.length > 0) {
    return fromUris;
  }

  const fromPlainText = parsePlainText(dataTransfer);
  if (fromPlainText.length > 0) {
    return fromPlainText;
  }

  return parseFileList(dataTransfer);
}

export function resolveDroppedFolder(paths: string[]): string | null {
  if (paths.length === 0) {
    return null;
  }

  const trimmed = paths
    .map((path) => path.trim())
    .filter((path) => path.length > 0);

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length === 1) {
    return stripDirectorySeparators(trimmed[0]);
  }

  const directoryCandidates = trimmed
    .filter((path) => /[\\/]+$/.test(path))
    .map((path) => stripDirectorySeparators(path));

  if (directoryCandidates.length === 1) {
    return directoryCandidates[0];
  }

  if (directoryCandidates.length > 1) {
    const ancestor = computeCommonAncestor(directoryCandidates);
    if (ancestor) {
      return ancestor;
    }
  }

  const ancestor = computeCommonAncestor(trimmed);
  if (ancestor) {
    return ancestor;
  }

  return stripDirectorySeparators(trimmed[0]);
}

export async function resolveDroppedFolderFromDataTransfer(
  dataTransfer: DataTransfer | null
): Promise<ResolveDroppedPathsResponse> {
  const paths = extractPathsFromDataTransfer(dataTransfer);
  const candidate = resolveDroppedFolder(paths);
  const response = await window.stemPacker.resolveDroppedPaths({
    paths,
    candidate,
    hasDirectoryEntry: hasDirectoryEntry(dataTransfer)
  });
  return response;
}

export async function resolveDroppedFolderFromDomEvent(
  event: DragEvent
): Promise<ResolveDroppedPathsResponse> {
  return resolveDroppedFolderFromDataTransfer(event.dataTransfer ?? null);
}

interface UseFolderDropOptions {
  disabled?: boolean;
  onFolderDrop: (folderPath: string) => Promise<void> | void;
  onDropError?: (reason: DroppedFolderResolutionError) => Promise<void> | void;
}

export function useFolderDrop({
  disabled,
  onFolderDrop,
  onDropError
}: UseFolderDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const clearDragState = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragEnter = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) {
        return;
      }
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
      }
      if (disabled) {
        return;
      }
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget as Node)) {
      return;
    }
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      clearDragState();
      if (disabled) {
        return;
      }

      try {
        const result = await resolveDroppedFolderFromDataTransfer(event.dataTransfer ?? null);
        if (result.status === 'success') {
          await onFolderDrop(result.folderPath);
        } else if (onDropError) {
          await onDropError(result.reason);
        }
      } catch (error) {
        console.error('Failed to process dropped folder', error);
        if (onDropError) {
          await onDropError('unknown');
        }
      }
    },
    [clearDragState, disabled, onDropError, onFolderDrop]
  );

  return {
    isDragging,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop
  } as const;
}
