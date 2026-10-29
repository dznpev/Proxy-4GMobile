import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const alertVariants = cva(
  'relative grid w-full grid-cols-1 items-start gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2.5 text-sm leading-relaxed has-[>svg]:grid-cols-[16px_1fr] sm:has-[>svg]:has-data-[slot=alert-action]:grid-cols-[16px_1fr_auto] sm:has-[>svg]:grid-cols-[16px_1fr] sm:has-data-[slot=alert-action]:grid-cols-[1fr_auto] [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg~[data-slot=alert-title]]:col-start-2 [&>svg~[data-slot=alert-description]]:col-start-2',
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      variant: {
        default:
          'border-border bg-card text-foreground [&>svg]:text-muted-foreground',
        error:
          'border-(--danger-border) bg-(--danger-bg) text-(--danger-fg) [&>svg]:text-(--danger-fg)',
        info: 'border-(--info-border) bg-(--info-bg) text-(--info-fg) [&>svg]:text-(--info-fg)',
        success:
          'border-(--success-border) bg-(--success-bg) text-(--success-fg) [&>svg]:text-(--success-fg)',
        warning:
          'border-(--warning-border) bg-(--warning-bg) text-(--warning-fg) [&>svg]:text-(--warning-fg)',
      },
    },
  },
);

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants>): React.ReactElement {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role="alert"
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('font-semibold', className)}
      data-slot="alert-title"
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('text-sm opacity-90', className)}
      data-slot="alert-description"
      {...props}
    />
  );
}

export function AlertAction({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn(
        'flex gap-1.5 max-sm:col-start-2 max-sm:row-start-3 max-sm:mt-1.5 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:self-center',
        className,
      )}
      data-slot="alert-action"
      {...props}
    />
  );
}
