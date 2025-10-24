import { execFile } from 'node:child_process/promises';

export interface AudioProbeResult {
  format: string;
  bytes: number;
  channels: number;
  channelMask?: number;
  channelLabels: string[];
}

export interface ProbeAudioOptions {
  /** Optional override for the ffprobe binary path. */
  ffprobePath?: string;
  /** Additional environment variables forwarded to the probe process. */
  env?: NodeJS.ProcessEnv;
}

const CHANNEL_BIT_ORDER: number[] = [
  0x00000001,
  0x00000002,
  0x00000004,
  0x00000008,
  0x00000010,
  0x00000020,
  0x00000040,
  0x00000080,
  0x00000100,
  0x00000200,
  0x00000400,
  0x00000800,
  0x00001000,
  0x00002000,
  0x00004000,
  0x00008000,
  0x00010000,
  0x00020000,
  0x00040000,
  0x00080000,
  0x00100000,
  0x00200000,
  0x00400000,
  0x00800000,
  0x01000000,
  0x02000000,
  0x04000000,
  0x08000000,
  0x10000000,
];

const CHANNEL_BIT_LABELS: Record<number, string> = {
  0x00000001: 'L',
  0x00000002: 'R',
  0x00000004: 'C',
  0x00000008: 'LFE',
  0x00000010: 'Ls',
  0x00000020: 'Rs',
  0x00000040: 'Lc',
  0x00000080: 'Rc',
  0x00000100: 'Cs',
  0x00000200: 'Ls',
  0x00000400: 'Rs',
  0x00000800: 'Tc',
  0x00001000: 'Tfl',
  0x00002000: 'Tfc',
  0x00004000: 'Tfr',
  0x00008000: 'Tbl',
  0x00010000: 'Tbc',
  0x00020000: 'Tbr',
  0x00040000: 'Tfcl',
  0x00080000: 'Tfcr',
  0x00100000: 'Tsl',
  0x00200000: 'Tsr',
  0x00400000: 'Tblc',
  0x00800000: 'Tbrc',
  0x01000000: 'Llfe',
  0x02000000: 'Rlfe',
  0x04000000: 'Lsd',
  0x08000000: 'Rsd',
  0x10000000: 'Ts',
};

const CHANNEL_MASK_PRESETS: Record<number, string[]> = {
  0x00000004: ['C'],
  0x00000003: ['L', 'R'],
  0x00000007: ['L', 'R', 'C'],
  0x0000000b: ['L', 'R', 'LFE'],
  0x0000000f: ['L', 'R', 'C', 'LFE'],
  0x00000033: ['L', 'R', 'Ls', 'Rs'],
  0x00000037: ['L', 'R', 'C', 'Ls', 'Rs'],
  0x0000003f: ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'],
};

function fallbackChannelLabels(channelCount: number): string[] {
  return Array.from({ length: channelCount }, (_, index) =>
    `ch${String(index + 1).padStart(2, '0')}`,
  );
}

function normaliseFormatName(formatName?: string): string {
  if (!formatName) {
    return 'unknown';
  }

  const [primary] = formatName.split(',').map((value) => value.trim());
  return primary || 'unknown';
}

function parseChannelMask(stream: Record<string, unknown>): number | undefined {
  const candidates: Array<unknown> = [
    stream.channel_mask,
    stream.channel_layout,
    stream.channel_layouts,
    stream.tags && typeof stream.tags === 'object'
      ? (stream.tags as Record<string, unknown>).WAVEFORMATEXTENSIBLE_CHANNEL_MASK
      : undefined,
  ];

  for (const raw of candidates) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();

      if (/^0x[0-9a-f]+$/i.test(trimmed)) {
        return Number.parseInt(trimmed, 16);
      }

      if (/^\d+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10);
      }
    }
  }

  return undefined;
}

export function channelMaskToLabels(channelMask: number | undefined, channelCount: number): string[] {
  if (!channelMask || channelMask <= 0) {
    return fallbackChannelLabels(channelCount);
  }

  const preset = CHANNEL_MASK_PRESETS[channelMask];
  if (preset && preset.length === channelCount) {
    return preset.slice();
  }

  const labels: string[] = [];

  for (const bit of CHANNEL_BIT_ORDER) {
    if ((channelMask & bit) !== bit) {
      continue;
    }

    const label = CHANNEL_BIT_LABELS[bit];
    if (!label) {
      continue;
    }

    if (!labels.includes(label)) {
      labels.push(label);
    }

    if (labels.length === channelCount) {
      break;
    }
  }

  if (labels.length !== channelCount) {
    return fallbackChannelLabels(channelCount);
  }

  return labels;
}

export async function probeAudio(path: string, options: ProbeAudioOptions = {}): Promise<AudioProbeResult> {
  const binary = options.ffprobePath ?? 'ffprobe';
  const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', path];

  const { stdout } = await execFile(binary, args, {
    env: options.env,
    encoding: 'utf8',
  });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('Unable to parse ffprobe JSON output');
  }

  const format = payload.format as Record<string, unknown> | undefined;
  const formatName = normaliseFormatName(
    typeof format?.format_name === 'string' ? format?.format_name : undefined,
  );

  const bytes = Number.parseInt(
    typeof format?.size === 'string' ? format.size : '',
    10,
  );

  const streams = Array.isArray(payload.streams) ? payload.streams : [];
  const audioStream = streams.find(
    (stream): stream is Record<string, unknown> =>
      stream && typeof stream === 'object' && (stream as Record<string, unknown>).codec_type === 'audio',
  );

  if (!audioStream) {
    throw new Error('No audio stream found in probe output');
  }

  const channels = Number((audioStream as Record<string, unknown>).channels ?? 0);
  if (!Number.isFinite(channels) || channels <= 0) {
    throw new Error('Invalid channel count in probe output');
  }

  const channelMask = parseChannelMask(audioStream);

  return {
    format: formatName,
    bytes: Number.isNaN(bytes) ? 0 : bytes,
    channels,
    channelMask,
    channelLabels: channelMaskToLabels(channelMask, channels),
  };
}
