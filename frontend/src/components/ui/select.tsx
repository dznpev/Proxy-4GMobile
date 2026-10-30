import { Select as SelectPrimitive } from '@base-ui/react/select';
import type * as React from 'react';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Select. The trigger keeps the dashboard's
 * 36px control height and 7px radius; the popup uses the card surface,
 * overlay shadow and 30px rows so the option list stays compact. The popup
 * drops below the trigger by default so an inline label stays readable.
 */
export const Select = SelectPrimitive.Root;

export function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props): React.ReactElement {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'relative inline-flex h-9 w-full min-w-[150px] cursor-pointer select-none items-center justify-between gap-2 rounded-[7px] border border-input bg-card px-2.5 text-left text-base text-foreground outline-none transition-[border-color,box-shadow] hover:border-(--text-secondary) focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:border-border data-disabled:bg-muted data-disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon">
        <Icon name="chevrons-up-down" className="size-4 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props): React.ReactElement {
  return (
    <SelectPrimitive.Value
      className={cn(
        'flex-1 truncate text-left data-placeholder:text-muted-foreground',
        className,
      )}
      data-slot="select-value"
      {...props}
    />
  );
}

export function SelectPopup({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'start',
  alignOffset = 0,
  alignItemWithTrigger = false,
  anchor,
  portalProps,
  ...props
}: SelectPrimitive.Popup.Props & {
  portalProps?: SelectPrimitive.Portal.Props;
  side?: SelectPrimitive.Positioner.Props['side'];
  sideOffset?: SelectPrimitive.Positioner.Props['sideOffset'];
  align?: SelectPrimitive.Positioner.Props['align'];
  alignOffset?: SelectPrimitive.Positioner.Props['alignOffset'];
  alignItemWithTrigger?: SelectPrimitive.Positioner.Props['alignItemWithTrigger'];
  anchor?: SelectPrimitive.Positioner.Props['anchor'];
}): React.ReactElement {
  return (
    <SelectPrimitive.Portal {...portalProps}>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50 select-none"
        data-slot="select-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          className="origin-(--transform-origin) text-foreground outline-none"
          data-slot="select-popup"
          {...props}
        >
          <div className="min-w-(--anchor-width) rounded-[7px] border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-overlay)]">
            <SelectPrimitive.List
              className={cn(
                'max-h-(--available-height) overflow-y-auto',
                className,
              )}
              data-slot="select-list"
            >
              {children}
            </SelectPrimitive.List>
          </div>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props): React.ReactElement {
  return (
    <SelectPrimitive.Item
      className={cn(
        'grid min-h-[30px] cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-1.5 rounded-[5px] py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-disabled:opacity-60 data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        className,
      )}
      data-slot="select-item"
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        className="col-start-1"
        data-slot="select-item-indicator"
      >
        <Icon name="check" className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2 min-w-0 truncate">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { SelectPrimitive, SelectPopup as SelectContent };
