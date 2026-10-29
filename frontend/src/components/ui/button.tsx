import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-semibold text-base outline-none transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 data-loading:select-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 px-[calc(--spacing(3)-1px)]',
        icon: 'size-9',
        'icon-sm': 'size-[30px]',
        'icon-xs': 'size-6 rounded-md',
        lg: 'h-10 px-[calc(--spacing(3.5)-1px)]',
        sm: 'h-[30px] gap-1.5 px-[calc(--spacing(2.5)-1px)] text-sm',
        xl: 'h-11 px-[calc(--spacing(4)-1px)] text-lg',
        xs: 'h-6 gap-1 rounded-md px-2 text-xs',
      },
      variant: {
        default:
          'border-primary bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
        destructive:
          'border-destructive bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80',
        'destructive-outline':
          'border-border bg-card text-destructive-foreground hover:border-destructive/32 hover:bg-destructive/4',
        ghost:
          'border-transparent bg-transparent text-foreground hover:bg-accent active:bg-accent',
        link: 'border-transparent bg-transparent text-foreground underline-offset-4 hover:underline',
        outline:
          'border-border bg-card text-foreground hover:border-(--border-control) hover:bg-(--surface-raised) active:bg-accent',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80',
      },
    },
  },
);

export interface ButtonProps extends useRender.ComponentProps<'button'> {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] = render
    ? undefined
    : 'button';

  const defaultProps = {
    children: (
      <>
        {loading ? (
          <Spinner
            className="size-3.5"
            data-slot="button-loading-indicator"
          />
        ) : null}
        {children}
      </>
    ),
    className: cn(buttonVariants({ className, size, variant })),
    'aria-busy': loading ? true : undefined,
    'aria-disabled': loading || undefined,
    'data-loading': loading ? '' : undefined,
    'data-slot': 'button',
    disabled: isDisabled,
    type: typeValue,
  };

  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(defaultProps, props),
    render,
  });
}
