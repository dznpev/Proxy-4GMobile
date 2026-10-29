import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import type { Tone } from '@/api/types';
import { cn } from '@/lib/utils';

const statusPillVariants = cva(
  'inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-sm font-semibold leading-none',
  {
    defaultVariants: {
      tone: 'neutral',
    },
    variants: {
      tone: {
        danger:
          'border-(--danger-border) bg-(--danger-bg) text-(--danger-fg)',
        info: 'border-(--info-border) bg-(--info-bg) text-(--info-fg)',
        neutral: 'border-border bg-muted text-(--text-secondary)',
        success:
          'border-(--success-border) bg-(--success-bg) text-(--success-fg)',
        warning:
          'border-(--warning-border) bg-(--warning-bg) text-(--warning-fg)',
      },
    },
  },
);

interface StatusPillProps extends VariantProps<typeof statusPillVariants> {
  tone: Tone;
  label: string;
  className?: string;
}

export function StatusPill({
  tone,
  label,
  className,
}: StatusPillProps): React.ReactElement {
  return (
    <span
      className={cn(statusPillVariants({ tone }), className)}
      data-slot="status-pill"
      role="status"
      aria-live="polite"
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
