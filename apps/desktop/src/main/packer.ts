import { type AudioFileItem, type Preferences } from '../shared/preferences';
import { createIgnoreMatcher } from './ignore';

export function filterPackableFiles(
  files: AudioFileItem[],
  preferences: Preferences
): AudioFileItem[] {
  const shouldIgnore = createIgnoreMatcher(preferences.ignore_enabled, preferences.ignore_globs);
  return files.filter((file) => !shouldIgnore(file.relativePath));
}
