import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PREFERENCES, type Preferences } from '../shared/preferences';
import { DEFAULT_ARTIST, type ArtistProfile } from '../shared/artist';

export class PreferencesStore {
  private readonly filePath: string;
  private data: Preferences = { ...DEFAULT_PREFERENCES };

  constructor(userDataPath: string, filename = 'settings.json') {
    this.filePath = path.join(userDataPath, filename);
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<Preferences>;
      const { lastInputDir: _legacyLastInputDir, ...rest } = parsed as Partial<Preferences> & {
        lastInputDir?: unknown;
      };
      this.data = {
        ...DEFAULT_PREFERENCES,
        ...rest,
        ignore_globs: Array.isArray(rest.ignore_globs)
          ? [...rest.ignore_globs]
          : [...DEFAULT_PREFERENCES.ignore_globs]
      };
    } catch (error) {
      this.data = { ...DEFAULT_PREFERENCES };
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read preferences:', error);
      }
    }
  }

  get(): Preferences {
    return {
      ...this.data,
      ignore_globs: [...this.data.ignore_globs]
    };
  }

  async set(update: Partial<Preferences>): Promise<Preferences> {
    const nextIgnore =
      update.ignore_globs !== undefined
        ? [...update.ignore_globs]
        : [...this.data.ignore_globs];

    this.data = {
      ...this.data,
      ...update,
      ignore_globs: nextIgnore
    };

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    return this.get();
  }
}

export class ArtistStore {
  private readonly filePath: string;
  private data: ArtistProfile = { ...DEFAULT_ARTIST };

  constructor(userDataPath: string, filename = 'artist.json') {
    this.filePath = path.join(userDataPath, filename);
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<ArtistProfile>;
      this.data = {
        ...DEFAULT_ARTIST,
        ...parsed,
        artist: typeof parsed.artist === 'string' ? parsed.artist : DEFAULT_ARTIST.artist
      };
    } catch (error) {
      this.data = { ...DEFAULT_ARTIST };
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read artist profile:', error);
      }
    }
  }

  get(): ArtistProfile {
    return { ...this.data };
  }

  async set(artist: string): Promise<ArtistProfile> {
    const normalized = artist.trim();
    this.data = { artist: normalized };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    return this.get();
  }
}
