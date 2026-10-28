interface IconProps {
  name: string;
  className?: string;
}

/** Renders an SVG `<use>` reference against the inline sprite. */
export function Icon({ name, className = 'icon' }: IconProps) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
