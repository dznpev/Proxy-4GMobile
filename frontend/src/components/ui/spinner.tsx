import type React from 'react';
import { cn } from '@/lib/utils';

export function Spinner({
  className,
  ...props
}: React.ComponentProps<'span'>): React.ReactElement {
  return (
    <span
      aria-label="Đang xử lý"
      className={cn(
        'inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
      role="status"
      {...props}
    />
  );
}
