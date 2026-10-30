import type * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Label: 11px/600 in the dashboard's secondary
 * text color, matching the legacy `.field > label` treatment.
 */
export function Label({
  className,
  ...props
}: React.ComponentProps<'label'>): React.ReactElement {
  return (
    <label
      className={cn(
        'inline-flex w-fit items-center gap-2 font-semibold text-sm text-(--text-secondary)',
        className,
      )}
      data-slot="label"
      {...props}
    />
  );
}
