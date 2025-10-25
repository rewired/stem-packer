function stripTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/, '');
}

function determineSeparator(path: string): '\\' | '/' {
  if (path.includes('\\') && !path.includes('/')) {
    return '\\';
  }

  return '/';
}

function extractPrefix(
  path: string,
  separator: '\\' | '/'
): { prefix: string; remainder: string } {
  if (/^\\\\[^\\]+\\[^\\]+/.test(path)) {
    const match = /^\\\\[^\\]+\\[^\\]+/.exec(path);
    if (match) {
      const prefix = match[0].endsWith('\\') ? match[0] : `${match[0]}\\`;
      return { prefix, remainder: path.slice(prefix.length) };
    }
  }

  if (/^[A-Za-z]:[\\/]/.test(path)) {
    const drive = path.slice(0, 2);
    const remainder = path.slice(3);
    return { prefix: `${drive}${separator}`, remainder };
  }

  if (path.startsWith('/')) {
    return { prefix: '/', remainder: path.slice(1) };
  }

  const firstSeparatorIndex = Math.max(path.indexOf('/'), path.indexOf('\\'));
  if (firstSeparatorIndex > 0) {
    const prefix = `${path.slice(0, firstSeparatorIndex + 1)}`;
    return { prefix, remainder: path.slice(firstSeparatorIndex + 1) };
  }

  return { prefix: '', remainder: path };
}

export function middleEllipsis(path: string, max = 48): string {
  if (max <= 0) {
    return '';
  }

  if (path.length <= max) {
    return path;
  }

  const trimmedPath = stripTrailingSeparators(path);
  if (trimmedPath.length <= max) {
    return trimmedPath;
  }

  const ellipsis = '…';
  if (max <= ellipsis.length + 1) {
    return `${trimmedPath.slice(0, max - 1)}${ellipsis}`;
  }

  const separator = determineSeparator(trimmedPath);
  const { prefix, remainder } = extractPrefix(trimmedPath, separator);

  if (!/[\\/]/.test(remainder)) {
    if (prefix) {
      if (remainder.length === 0) {
        const available = Math.max(max - ellipsis.length, 0);
        return available === 0 ? ellipsis.slice(0, max) : `${trimmedPath.slice(0, available)}${ellipsis}`;
      }

      const availableForLast = max - (prefix.length + ellipsis.length + separator.length);
      if (availableForLast <= 0) {
        const available = Math.max(max - ellipsis.length, 0);
        return available === 0 ? ellipsis.slice(0, max) : `${prefix.slice(0, available)}${ellipsis}`;
      }

      const truncated = remainder.slice(Math.max(remainder.length - availableForLast, 0));
      return `${prefix}${ellipsis}${separator}${truncated}`;
    }

    const available = Math.max(max - ellipsis.length, 0);
    if (available === 0) {
      return ellipsis.slice(0, max);
    }
    return `${trimmedPath.slice(0, available)}${ellipsis}`;
  }

  const segments = remainder
    .replace(/^[\\/]+/, '')
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    const available = Math.max(max - ellipsis.length, 0);
    if (available === 0) {
      return ellipsis.slice(0, max);
    }
    return `${trimmedPath.slice(0, available)}${ellipsis}`;
  }

  let headSegment: string | undefined;
  if (!prefix) {
    headSegment = segments.shift();
  }

  const leading = prefix || (headSegment ? `${headSegment}${separator}` : '');
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : headSegment ?? '';

  if (!leading || !lastSegment) {
    const available = Math.max(max - ellipsis.length, 0);
    if (available === 0) {
      return ellipsis.slice(0, max);
    }
    return `${trimmedPath.slice(0, available)}${ellipsis}`;
  }

  const base = `${leading}${ellipsis}${separator}${lastSegment}`;
  if (base.length <= max) {
    return base;
  }

  const availableForLast = max - (leading.length + ellipsis.length + separator.length);
  if (availableForLast <= 0) {
    const available = Math.max(max - ellipsis.length, 0);
    if (available === 0) {
      return ellipsis.slice(0, max);
    }
    return `${leading.slice(0, available)}${ellipsis}`;
  }

  const truncatedLastSegment = lastSegment.slice(Math.max(lastSegment.length - availableForLast, 0));
  return `${leading}${ellipsis}${separator}${truncatedLastSegment}`;
}
