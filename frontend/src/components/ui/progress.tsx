import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const progressVariants = cva(
  'block h-1.5 w-full appearance-none overflow-hidden rounded-full border-0 bg-(--surface-sunken) [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-(--surface-sunken) [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-200',
  {
    defaultVariants: {
      tone: 'default',
    },
    variants: {
      tone: {
        default: '',
        error:
          '[&::-moz-progress-bar]:bg-(--danger-solid) [&::-webkit-progress-value]:bg-(--danger-solid)',
        success:
          '[&::-moz-progress-bar]:bg-(--success-solid) [&::-webkit-progress-value]:bg-(--success-solid)',
      },
    },
  },
);

interface ProgressProps
  extends React.ComponentProps<'progress'>,
    VariantProps<typeof progressVariants> {}

export function Progress({
  className,
  tone,
  ...props
}: ProgressProps): React.ReactElement {
  return (
    <progress
      className={cn(progressVariants({ tone }), className)}
      data-slot="progress"
      {...props}
    />
  );
}
