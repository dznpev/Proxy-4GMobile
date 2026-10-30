import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import type * as React from 'react';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Checkbox: 15px like the legacy native
 * checkbox, using the dashboard's sprite for the check mark.
 */
export function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props): React.ReactElement {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'relative inline-flex size-[15px] shrink-0 items-center justify-center rounded-[3px] border border-input bg-card outline-none transition-[border-color,background-color] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-60',
        className,
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-primary-foreground data-unchecked:hidden"
        data-slot="checkbox-indicator"
      >
        <Icon name="check" className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
