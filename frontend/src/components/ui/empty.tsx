import type React from 'react';
import { cn } from '@/lib/utils';

export function Empty({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center text-balance',
        className,
      )}
      data-slot="empty"
      {...props}
    />
  );
}

export function EmptyHeader({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('flex max-w-md flex-col items-center text-center', className)}
      data-slot="empty-header"
      {...props}
    />
  );
}

export function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: 'default' | 'icon';
}): React.ReactElement {
  return (
    <div
      className={cn(
        'relative mb-1 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
        variant === 'icon' &&
          'size-10 rounded-full bg-(--surface-sunken) text-muted-foreground [&_svg:not([class*=size-])]:size-[19px]',
        className,
      )}
      data-slot="empty-media"
      data-variant={variant}
      {...props}
    />
  );
}

export function EmptyTitle({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('text-xl font-semibold leading-snug', className)}
      data-slot="empty-title"
      {...props}
    />
  );
}

export function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<'p'>): React.ReactElement {
  return (
    <p
      className={cn(
        'text-sm text-muted-foreground [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
        className,
      )}
      data-slot="empty-description"
      {...props}
    />
  );
}

export function EmptyContent({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-sm flex-col items-center gap-2 text-sm text-balance',
        className,
      )}
      data-slot="empty-content"
      {...props}
    />
  );
}
