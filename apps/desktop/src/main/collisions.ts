import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  CollisionCheckPayload,
  CollisionDetectionResult,
  CollisionResolutionResult,
  CollisionKind
} from '../shared/collisions';

interface CollisionMatch {
  kind: CollisionKind;
  files: string[];
}

function resolveOutputDirectory(inputFolder: string, outputDir?: string): string {
  if (outputDir && outputDir.trim().length > 0) {
    const trimmed = outputDir.trim();
    if (path.isAbsolute(trimmed)) {
      return path.resolve(trimmed);
    }
    return path.resolve(inputFolder, trimmed);
  }

  return path.resolve(inputFolder);
}

async function listEntries(directory: string) {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function detectZipCollisions(outputDir: string): Promise<CollisionMatch | null> {
  const entries = await listEntries(outputDir);
  const zipPattern = /^stems-(\d{2,})\.zip$/;
  const files = entries
    .filter((entry) => entry.isFile() && zipPattern.test(entry.name))
    .map((entry) => path.join(outputDir, entry.name))
    .sort();

  if (files.length === 0) {
    return null;
  }

  return {
    kind: 'zip',
    files
  };
}

async function detectSevenZipCollisions(outputDir: string): Promise<CollisionMatch | null> {
  const entries = await listEntries(outputDir);
  const volumePattern = /^stems\.7z(\.\d{3})?$/;
  const files = entries
    .filter((entry) => entry.isFile() && volumePattern.test(entry.name))
    .map((entry) => path.join(outputDir, entry.name))
    .sort();

  if (files.length === 0) {
    return null;
  }

  return {
    kind: '7z',
    files
  };
}

async function detectCollisions(outputDir: string, format: CollisionKind): Promise<CollisionMatch | null> {
  if (format === 'zip') {
    return detectZipCollisions(outputDir);
  }
  return detectSevenZipCollisions(outputDir);
}

async function deleteFiles(paths: string[]): Promise<number> {
  let deleted = 0;
  for (const filePath of paths) {
    try {
      await fs.unlink(filePath);
      deleted += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return deleted;
}

export async function detectOutputCollisions(
  payload: CollisionCheckPayload
): Promise<CollisionDetectionResult> {
  const outputDir = resolveOutputDirectory(payload.inputFolder, payload.outputDir);
  const match = await detectCollisions(outputDir, payload.format);

  return {
    hasCollisions: Boolean(match),
    kind: match?.kind,
    collisionCount: match?.files.length ?? 0,
    outputDir
  };
}

export async function overwriteOutputCollisions(
  payload: CollisionCheckPayload
): Promise<CollisionResolutionResult> {
  const outputDir = resolveOutputDirectory(payload.inputFolder, payload.outputDir);
  const match = await detectCollisions(outputDir, payload.format);

  if (!match) {
    return {
      deletedCount: 0,
      kind: undefined,
      outputDir
    };
  }

  const deletedCount = await deleteFiles(match.files);

  return {
    deletedCount,
    kind: match.kind,
    outputDir
  };
}
