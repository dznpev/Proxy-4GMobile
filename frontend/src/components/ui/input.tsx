import type * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Input. The dashboard keeps the native input
 * element (the `nativeInput` branch in coss) so refs, number inputs and
 * browser autofill behave exactly as before. Sizes match the legacy form
 * controls: 36px default, 30px small, 40px large, with a 7px radius.
 */
export interface InputProps
  extends Omit<React.ComponentPropsWithRef<'input'>, 'size'> {
  size?: 'sm' | 'default' | 'lg';
}

const inputSizes: Record<NonNullable<InputProps['size']>, string> = {
  default: 'h-9 px-2.5',
  sm: 'h-[30px] px-2',
  lg: 'h-10 px-3',
};

export function Input({
  className,
  size = 'default',
  ...props
}: InputProps): React.ReactElement {
  return (
    <input
      className={cn(
        'w-full min-w-0 rounded-[7px] border border-input bg-card text-base text-foreground shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground hover:border-(--text-secondary) focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-(--danger-fg) focus-visible:aria-invalid:border-(--danger-fg) [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
        inputSizes[size],
        className,
      )}
      data-slot="input"
      {...props}
    />
  );
}
