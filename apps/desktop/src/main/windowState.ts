import { app, BrowserWindow, screen } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const WINDOW_STATE_FILE = 'window-state.json';
const SAVE_DEBOUNCE_MS = 200;
export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface StoredWindowState {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

function getStateFilePath() {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeStoredState(state: StoredWindowState): StoredWindowState {
  const sanitized: StoredWindowState = {};

  if (typeof state.width === 'number' && Number.isFinite(state.width)) {
    sanitized.width = state.width;
  }

  if (typeof state.height === 'number' && Number.isFinite(state.height)) {
    sanitized.height = state.height;
  }

  if (typeof state.x === 'number' && Number.isFinite(state.x)) {
    sanitized.x = Math.trunc(state.x);
  }

  if (typeof state.y === 'number' && Number.isFinite(state.y)) {
    sanitized.y = Math.trunc(state.y);
  }

  return sanitized;
}

function clampToPrimaryDisplay(
  state: StoredWindowState,
  defaults: Pick<WindowState, 'width' | 'height'>
): WindowState {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  const widthCandidate = Math.trunc(state.width ?? defaults.width);
  const heightCandidate = Math.trunc(state.height ?? defaults.height);

  const width = clamp(widthCandidate, 100, workArea.width);
  const height = clamp(heightCandidate, 100, workArea.height);

  const result: WindowState = { width, height };

  if (typeof state.x === 'number' && typeof state.y === 'number') {
    const maxX = workArea.x + workArea.width - width;
    const maxY = workArea.y + workArea.height - height;

    result.x = clamp(state.x, workArea.x, maxX);
    result.y = clamp(state.y, workArea.y, maxY);
  }

  return result;
}

async function readStoredState(): Promise<StoredWindowState | undefined> {
  try {
    const filePath = getStateFilePath();
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as StoredWindowState;
    return sanitizeStoredState(parsed);
  } catch {
    return undefined;
  }
}

async function writeState(bounds: WindowState) {
  try {
    const filePath = getStateFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
      }),
      'utf-8'
    );
  } catch {
    // Swallow persistence errors to avoid crashing the app on disk issues.
  }
}

export async function loadWindowState(
  defaults: Pick<WindowState, 'width' | 'height'>
): Promise<WindowState> {
  const stored = await readStoredState();
  return clampToPrimaryDisplay(stored ?? {}, defaults);
}

export function trackWindowState(window: BrowserWindow) {
  let saveTimeout: NodeJS.Timeout | undefined;

  const scheduleSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      if (window.isDestroyed()) {
        return;
      }

      const bounds = window.getBounds();
      void writeState(bounds);
    }, SAVE_DEBOUNCE_MS);
  };

  window.on('resize', scheduleSave);
  window.on('move', scheduleSave);
  window.on('close', () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = undefined;
    }

    if (window.isDestroyed()) {
      return;
    }

    const bounds = window.getBounds();
    void writeState(bounds);
  });
}
