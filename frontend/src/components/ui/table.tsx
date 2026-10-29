import type React from 'react';
import { cn } from '@/lib/utils';

export function Table({
  className,
  ...props
}: React.ComponentProps<'table'>): React.ReactElement {
  return (
    <div className="relative w-full overflow-x-auto" data-slot="table-container">
      <table
        className={cn(
          'w-full caption-bottom text-base [&_tbody_tr]:border-b [&_tbody_tr]:border-border [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-(--surface-raised) [&_td]:whitespace-nowrap [&_td]:px-2.5 [&_td]:py-[9px] [&_td]:align-middle [&_td]:text-(--text-secondary)',
          className,
        )}
        data-slot="table"
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<'thead'>): React.ReactElement {
  return (
    <thead
      className={cn(
        'bg-(--surface-raised) [&_th:first-child]:rounded-tl-[7px] [&_th:last-child]:rounded-tr-[7px] [&_tr]:border-b [&_tr]:border-border',
        className,
      )}
      data-slot="table-header"
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.ComponentProps<'tbody'>): React.ReactElement {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      data-slot="table-body"
      {...props}
    />
  );
}

export function TableFooter({
  className,
  ...props
}: React.ComponentProps<'tfoot'>): React.ReactElement {
  return (
    <tfoot
      className={cn(
        'border-t border-border bg-(--surface-raised) font-medium [&>tr]:last:border-b-0',
        className,
      )}
      data-slot="table-footer"
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: React.ComponentProps<'tr'>): React.ReactElement {
  return (
    <tr
      className={cn(
        'relative border-b border-border transition-colors hover:bg-(--surface-raised)',
        className,
      )}
      data-slot="table-row"
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ComponentProps<'th'>): React.ReactElement {
  return (
    <th
      className={cn(
        'h-[30px] whitespace-nowrap px-2.5 text-left align-middle text-xs font-semibold uppercase tracking-[0.055em] text-muted-foreground',
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.ComponentProps<'td'>): React.ReactElement {
  return (
    <td
      className={cn(
        'whitespace-nowrap px-2.5 py-[9px] align-middle',
        className,
      )}
      data-slot="table-cell"
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>): React.ReactElement {
  return (
    <caption
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      data-slot="table-caption"
      {...props}
    />
  );
}
