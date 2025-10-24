import type { ComponentPropsWithoutRef } from 'react';

export interface IconProps extends ComponentPropsWithoutRef<'span'> {
  name: string;
}

export function Icon({ name, className = '', ...rest }: IconProps) {
  return (
    <span
      aria-hidden
      {...rest}
      className={`material-symbols-outlined ${className}`.trim()}
    >
      {name}
    </span>
  );
}
