import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Popover. The surface shares the card radius,
 * border and overlay shadow; placement defaults to below the trigger and
 * right-aligned so topbar action menus stay inside narrow viewports.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverTitle = PopoverPrimitive.Title;

export function PopoverContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 6,
  align = 'end',
  alignOffset = 0,
  ...props
}: PopoverPrimitive.Popup.Props & {
  side?: PopoverPrimitive.Positioner.Props['side'];
  sideOffset?: PopoverPrimitive.Positioner.Props['sideOffset'];
  align?: PopoverPrimitive.Positioner.Props['align'];
  alignOffset?: PopoverPrimitive.Positioner.Props['alignOffset'];
}): React.ReactElement {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="z-50"
        data-slot="popover-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            'w-64 origin-(--transform-origin) rounded-[10px] border border-border bg-popover p-2 text-popover-foreground shadow-[var(--shadow-overlay)] outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none',
            className,
          )}
          data-slot="popover"
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}
