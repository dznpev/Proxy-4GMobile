import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Card. The dashboard card owns its padding
 * (20px, then 16/12px on narrow screens), 10px radius, border, surface and
 * shadow; header/footer only carry the spacing from the legacy
 * `.card-head` / `.card-foot` rules.
 */
export function Card({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
  const defaultProps = {
    className: cn(
      'relative flex min-w-0 flex-col rounded-[var(--app-radius-lg)] border border-border bg-card p-5 text-card-foreground shadow-[var(--shadow-1)] max-[640px]:p-4 max-[520px]:p-3',
      className,
    ),
    'data-slot': 'card',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
}

export function CardHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
  const defaultProps = {
    className: cn(
      'mb-4 flex items-start justify-between gap-3 [&>div]:min-w-0 [&_.eyebrow]:mb-0.5 max-[640px]:mb-3',
      className,
    ),
    'data-slot': 'card-header',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
}

export function CardTitle({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
  const defaultProps = {
    className: cn(
      'font-heading text-2xl leading-[1.5] font-semibold tracking-[-0.012em] text-foreground',
      className,
    ),
    'data-slot': 'card-title',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
}

export function CardAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
  const defaultProps = {
    className: cn(
      'inline-flex shrink-0 items-center justify-end self-start',
      className,
    ),
    'data-slot': 'card-action',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
}

export function CardContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
  const defaultProps = {
    className: cn('flex-1', className),
    'data-slot': 'card-content',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
}

export function CardFooter({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
  const defaultProps = {
    className: cn(
      'mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3',
      className,
    ),
    'data-slot': 'card-footer',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
}
