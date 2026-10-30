import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Dense adaptation of the coss Sidebar. The dashboard keeps its fixed 236px
 * dark rail and its own mobile drawer/focus trap, so this file only carries
 * the structural and menu pieces used by the shell. Collapsible icon mode,
 * cookies, tooltips and the Sheet-based mobile variant are intentionally
 * omitted to preserve the existing shell behavior.
 */

export function Sidebar({
  className,
  ...props
}: React.ComponentProps<'aside'>): React.ReactElement {
  return (
    <aside
      className={cn(
        'z-40 flex h-dvh flex-col gap-6 overflow-y-auto bg-sidebar px-4 py-5 text-sidebar-foreground',
        className,
      )}
      data-slot="sidebar"
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('flex items-center gap-2', className)}
      data-slot="sidebar-header"
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', className)}
      data-slot="sidebar-content"
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('mt-auto flex flex-col gap-1', className)}
      data-slot="sidebar-footer"
      {...props}
    />
  );
}

export function SidebarGroup({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('relative flex w-full min-w-0 flex-col', className)}
      data-slot="sidebar-group"
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn(
        'mb-2 flex h-5 items-center px-0.5 text-xs font-semibold tracking-[0.085em] text-(--text-on-dark-subtle) uppercase',
        className,
      )}
      data-slot="sidebar-group-label"
      {...props}
    />
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.ComponentProps<'ul'>): React.ReactElement {
  return (
    <ul
      className={cn('flex w-full min-w-0 flex-col gap-0.5', className)}
      data-slot="sidebar-menu"
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentProps<'li'>): React.ReactElement {
  return (
    <li
      className={cn('group/menu-item relative', className)}
      data-slot="sidebar-menu-item"
      {...props}
    />
  );
}

export function SidebarMenuButton({
  isActive = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<'button'> & {
  isActive?: boolean;
}): React.ReactElement {
  const defaultProps = {
    className: cn(
      'peer/menu-button group/menu-button relative flex min-h-10 w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-left text-base font-medium text-sidebar-foreground outline-none transition-[background-color,color] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[active=true]:before:absolute data-[active=true]:before:inset-y-2.5 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-accent-foreground max-[1024px]:min-h-11',
      className,
    ),
    'data-active': isActive,
    'data-slot': 'sidebar-menu-button',
    ...(render ? {} : { type: 'button' as const }),
  };

  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(defaultProps, props),
    render,
  });
}

export function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-1/2 right-2.5 size-1.5 min-w-1.5 -translate-y-1/2 rounded-full',
        className,
      )}
      data-slot="sidebar-menu-badge"
      {...props}
    />
  );
}
