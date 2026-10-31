import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import type { Tone } from '@/api/types';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-semibold leading-none outline-none [&_svg:not([class*='size-'])]:size-3 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: 'default',
      tone: 'neutral',
    },
    variants: {
      size: {
        default: 'h-[22px]',
        sm: 'h-5',
      },
      tone: {
        danger:
          'border-destructive/32 bg-destructive/8 text-destructive-foreground',
        info: 'border-info/32 bg-info/8 text-info-foreground',
        neutral: 'border-border bg-muted text-(--text-secondary)',
        success: 'border-success/32 bg-success/8 text-success-foreground',
        warning: 'border-warning/32 bg-warning/8 text-warning-foreground',
      },
    },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  tone: Tone;
  label?: string;
  icon?: string;
  id?: string;
  hidden?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Badge({
  tone,
  label,
  icon,
  id,
  hidden,
  className,
  size,
  children,
}: BadgeProps): React.ReactElement {
  return (
    <span
      className={cn(badgeVariants({ size, tone }), className)}
      data-slot="badge"
      hidden={hidden}
      id={id}
    >
      {icon ? <Icon name={icon} /> : null}
      {children ?? (label ? <span>{label}</span> : null)}
    </span>
  );
}
