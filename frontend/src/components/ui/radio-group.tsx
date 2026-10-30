import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export function RadioGroup({
  className,
  ...props
}: RadioGroupPrimitive.Props): React.ReactElement {
  return (
    <RadioGroupPrimitive
      className={cn('flex flex-col gap-1.5', className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

/*
 * Dense adaptation of the coss Radio: 15px like the legacy native radio,
 * black filled circle with a white dot when checked.
 */
export function Radio({
  className,
  ...props
}: RadioPrimitive.Root.Props): React.ReactElement {
  return (
    <RadioPrimitive.Root
      className={cn(
        'relative inline-flex size-[15px] shrink-0 items-center justify-center rounded-full border border-input bg-card outline-none transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-60',
        className,
      )}
      data-slot="radio"
      {...props}
    >
      <RadioPrimitive.Indicator
        className="absolute -inset-px flex size-[15px] items-center justify-center rounded-full before:size-[7px] before:rounded-full before:bg-primary-foreground data-unchecked:hidden data-checked:bg-primary"
        data-slot="radio-indicator"
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroupPrimitive, RadioPrimitive, Radio as RadioGroupItem };
