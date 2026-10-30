import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Switch. The track keeps the dashboard's
 * 40x24px footprint and 18px thumb instead of coss's 38x22/36x20 scale, so
 * existing switch rows do not shift.
 */
export function Switch({
  className,
  ...props
}: SwitchPrimitive.Root.Props): React.ReactElement {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-(--border-control) p-0.5 outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-60',
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block size-[18px] rounded-full bg-card shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-150 data-checked:translate-x-4"
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}
