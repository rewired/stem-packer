import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

type ExecFilePromise = typeof import('node:child_process/promises').execFile;

const execFilePromise = promisify(execFileCallback);

export const execFile: ExecFilePromise = ((
  ...args
) => execFilePromise(...(args as Parameters<typeof execFileCallback>))) as ExecFilePromise;
