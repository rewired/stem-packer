import type { ComponentPropsWithoutRef, CSSProperties } from 'react';

export interface IconProps extends ComponentPropsWithoutRef<'span'> {
  name: string;
  fill?: 0 | 1;
  weight?: number;
  grade?: number;
  opticalSize?: number;
}

type IconCustomProperty =
  | '--icon-fill'
  | '--icon-weight'
  | '--icon-grade'
  | '--icon-optical-size';

type IconStyle = CSSProperties & Partial<Record<IconCustomProperty, string | number>>;

export function Icon({
  name,
  className = '',
  fill,
  weight,
  grade,
  opticalSize,
  style,
  ...rest
}: IconProps) {
  const variationProperties: Partial<Record<IconCustomProperty, string | number>> = {};

  if (typeof fill === 'number') {
    variationProperties['--icon-fill'] = fill;
  }

  if (typeof weight === 'number') {
    variationProperties['--icon-weight'] = weight;
  }

  if (typeof grade === 'number') {
    variationProperties['--icon-grade'] = grade;
  }

  if (typeof opticalSize === 'number') {
    variationProperties['--icon-optical-size'] = opticalSize;
  }

  const hasVariations = Object.keys(variationProperties).length > 0;
  const resolvedStyle = hasVariations
    ? ({ ...(style ? (style as IconStyle) : {}), ...variationProperties } as IconStyle)
    : style;

  return (
    <span
      aria-hidden
      style={resolvedStyle}
      {...rest}
      className={`material-symbols-outlined ${className}`.trim()}
    >
      {name}
    </span>
  );
}
