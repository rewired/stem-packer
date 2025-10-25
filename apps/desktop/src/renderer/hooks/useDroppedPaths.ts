import { useCallback, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { computeCommonAncestor, stripDirectorySeparators } from '../utils/pathFormatting';

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

function extractDroppedPaths(event: ReactDragEvent<HTMLDivElement>): string[] {
  return extractPathsFromDataTransfer(event.dataTransfer ?? null);
}

export function extractPathsFromDomDrop(event: DragEvent): string[] {
  return extractPathsFromDataTransfer(event.dataTransfer ?? null);
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

interface UseDroppedPathsOptions {
  disabled?: boolean;
  onPathsSelected: (paths: string[]) => void;
}

export function useDroppedPaths({ disabled, onPathsSelected }: UseDroppedPathsOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
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

  const handleDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (disabled) {
        return;
      }

      const paths = extractDroppedPaths(event);
      if (paths.length > 0) {
        onPathsSelected(paths);
      }
    },
    [disabled, onPathsSelected]
  );

  return { isDragging, handleDragOver, handleDragLeave, handleDrop };
}

export function parseDroppedEvent(
  event: ReactDragEvent<HTMLDivElement>
): string[] {
  return extractDroppedPaths(event);
}
