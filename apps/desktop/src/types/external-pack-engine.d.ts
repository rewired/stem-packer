declare module 'node:child_process/promises' {
  import type { ExecFileOptions, ChildProcess } from 'node:child_process';
  export function execFile(
    file: string,
    args?: readonly string[] | null,
    options?: ExecFileOptions,
  ): Promise<{ stdout: string; stderr: string; child?: ChildProcess }>;
}

declare module 'picomatch' {
  type Options = Record<string, unknown>;
  type Matcher = (input: string) => boolean;
  function picomatch(pattern: string | string[], options?: Options): Matcher;
  export default picomatch;
}

declare module 'yazl' {
  import type { ReadStream } from 'node:fs';
  import type { Readable } from 'node:stream';

  export class ZipFile {
    outputStream: Readable;
    addBuffer(buffer: Buffer, metadataPath: string, options?: { mtime?: Date }): void;
    addReadStream(stream: ReadStream, metadataPath: string, options?: { mtime?: Date }): void;
    end(): void;
  }
}

declare module '7zip-bin' {
  export const path7za: string;
}
