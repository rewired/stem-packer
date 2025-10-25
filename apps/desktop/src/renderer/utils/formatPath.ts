export function middleEllipsis(path: string, max = 48): string {
  if (max <= 0) {
    return '';
  }

  if (path.length <= max) {
    return path;
  }

  const ellipsis = '…';
  if (max <= ellipsis.length + 1) {
    return `${path.slice(0, max - 1)}${ellipsis}`;
  }

  const sliceLength = max - ellipsis.length;
  const startLength = Math.ceil(sliceLength / 2);
  const endLength = Math.floor(sliceLength / 2);

  return `${path.slice(0, startLength)}${ellipsis}${path.slice(path.length - endLength)}`;
}
