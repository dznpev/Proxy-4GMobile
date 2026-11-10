import type { SVGProps } from 'react';
import { cn } from '../../lib/utils';

export type FlagCode = 'us' | 'vn' | 'en' | 'vi';

export interface FlagIconProps extends SVGProps<SVGSVGElement> {
  code: FlagCode;
  className?: string;
  size?: number | string;
}

/**
 * Crisp vector SVG flag icons for US and Vietnam.
 * 16x12 viewbox (4:3 aspect ratio), clean stripes, mathematically precise stars,
 * sharp borders, zero emoji.
 */
export function FlagIcon({
  code,
  className,
  size,
  width,
  height,
  ...props
}: FlagIconProps) {
  const normalized = code === 'en' ? 'us' : code === 'vi' ? 'vn' : code;
  const isVn = normalized === 'vn';

  const w = size ?? width ?? 16;
  const h = size ? (typeof size === 'number' ? Math.round((size * 3) / 4) : size) : (height ?? 12);

  return (
    <svg
      viewBox="0 0 16 12"
      width={w}
      height={h}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-flag={normalized}
      className={cn(
        'inline-block shrink-0 rounded-[2px] overflow-hidden align-middle shadow-[0_0_0_1px_rgba(0,0,0,0.12)]',
        className,
      )}
      {...props}
    >
      {isVn ? (
        // Vietnam (VN) flag: Red field (#DA251D) with central golden yellow 5-point star (#FFFF00)
        <>
          <rect width="16" height="12" fill="#DA251D" />
          <polygon
            points="8,2.4 8.81,4.89 11.42,4.89 9.31,6.43 10.12,8.91 8,7.38 5.88,8.91 6.69,6.43 4.58,4.89 7.19,4.89"
            fill="#FFFF00"
          />
        </>
      ) : (
        // United States (US) flag: 13 stripes, blue canton, and crisp vector stars
        <>
          <rect width="16" height="12" fill="#FFFFFF" />
          <path
            fill="#B22234"
            d="M0 0h16v0.923H0z M0 1.846h16v0.923H0z M0 3.692h16v0.923H0z M0 5.538h16v0.923H0z M0 7.385h16v0.923H0z M0 9.231h16v0.923H0z M0 11.077h16v0.923H0z"
          />
          <rect width="7" height="6.462" fill="#002868" />
          <path
            fill="#FFFFFF"
            d="M1.20 0.74 L1.28 0.99 L1.54 0.99 L1.33 1.14 L1.41 1.39 L1.20 1.24 L0.99 1.39 L1.07 1.14 L0.86 0.99 L1.12 0.99 Z M2.60 0.74 L2.68 0.99 L2.94 0.99 L2.73 1.14 L2.81 1.39 L2.60 1.24 L2.39 1.39 L2.47 1.14 L2.26 0.99 L2.52 0.99 Z M4.00 0.74 L4.08 0.99 L4.34 0.99 L4.13 1.14 L4.21 1.39 L4.00 1.24 L3.79 1.39 L3.87 1.14 L3.66 0.99 L3.92 0.99 Z M5.40 0.74 L5.48 0.99 L5.74 0.99 L5.53 1.14 L5.61 1.39 L5.40 1.24 L5.19 1.39 L5.27 1.14 L5.06 0.99 L5.32 0.99 Z M1.90 1.84 L1.98 2.09 L2.24 2.09 L2.03 2.24 L2.11 2.49 L1.90 2.34 L1.69 2.49 L1.77 2.24 L1.56 2.09 L1.82 2.09 Z M3.30 1.84 L3.38 2.09 L3.64 2.09 L3.43 2.24 L3.51 2.49 L3.30 2.34 L3.09 2.49 L3.17 2.24 L2.96 2.09 L3.22 2.09 Z M4.70 1.84 L4.78 2.09 L5.04 2.09 L4.83 2.24 L4.91 2.49 L4.70 2.34 L4.49 2.49 L4.57 2.24 L4.36 2.09 L4.62 2.09 Z M1.20 2.94 L1.28 3.19 L1.54 3.19 L1.33 3.34 L1.41 3.59 L1.20 3.44 L0.99 3.59 L1.07 3.34 L0.86 3.19 L1.12 3.19 Z M2.60 2.94 L2.68 3.19 L2.94 3.19 L2.73 3.34 L2.81 3.59 L2.60 3.44 L2.39 3.59 L2.47 3.34 L2.26 3.19 L2.52 3.19 Z M4.00 2.94 L4.08 3.19 L4.34 3.19 L4.13 3.34 L4.21 3.59 L4.00 3.44 L3.79 3.59 L3.87 3.34 L3.66 3.19 L3.92 3.19 Z M5.40 2.94 L5.48 3.19 L5.74 3.19 L5.53 3.34 L5.61 3.59 L5.40 3.44 L5.19 3.59 L5.27 3.34 L5.06 3.19 L5.32 3.19 Z M1.90 4.04 L1.98 4.29 L2.24 4.29 L2.03 4.44 L2.11 4.69 L1.90 4.54 L1.69 4.69 L1.77 4.44 L1.56 4.29 L1.82 4.29 Z M3.30 4.04 L3.38 4.29 L3.64 4.29 L3.43 4.44 L3.51 4.69 L3.30 4.54 L3.09 4.69 L3.17 4.44 L2.96 4.29 L3.22 4.29 Z M4.70 4.04 L4.78 4.29 L5.04 4.29 L4.83 4.44 L4.91 4.69 L4.70 4.54 L4.49 4.69 L4.57 4.44 L4.36 4.29 L4.62 4.29 Z M1.20 5.14 L1.28 5.39 L1.54 5.39 L1.33 5.54 L1.41 5.79 L1.20 5.64 L0.99 5.79 L1.07 5.54 L0.86 5.39 L1.12 5.39 Z M2.60 5.14 L2.68 5.39 L2.94 5.39 L2.73 5.54 L2.81 5.79 L2.60 5.64 L2.39 5.79 L2.47 5.54 L2.26 5.39 L2.52 5.39 Z M4.00 5.14 L4.08 5.39 L4.34 5.39 L4.13 5.54 L4.21 5.79 L4.00 5.64 L3.79 5.79 L3.87 5.54 L3.66 5.39 L3.92 5.39 Z M5.40 5.14 L5.48 5.39 L5.74 5.39 L5.53 5.54 L5.61 5.79 L5.40 5.64 L5.19 5.79 L5.27 5.54 L5.06 5.39 L5.32 5.39 Z"
          />
        </>
      )}
    </svg>
  );
}

export default FlagIcon;
