import { Link, NavLink, useLocation } from 'react-router-dom';
import type { RefObject } from 'react';
import { Icon } from '../Icon';
import { Button } from '../ui/button';
import {
  Sidebar as SidebarSurface,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../ui/sidebar';
import { NAV_ITEMS, ROUTES } from '../../lib/constants';
import { deviceNavState, statusSummary } from '../../lib/status';
import { useDashboard } from '../../app/providers/DashboardProvider';
import { cn } from '../../lib/utils';

interface SidebarProps {
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
  onNavigate: () => void;
  sidebarRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}

export function Sidebar({
  open,
  isMobile,
  onClose,
  onNavigate,
  sidebarRef,
  closeButtonRef,
}: SidebarProps) {
  const { status, connection } = useDashboard();
  const { pathname } = useLocation();
  const activeRoute = pathname.replace(/^\//, '') || 'overview';
  const app = status?.app;
  const device = status?.device;
  const version = app?.version || '2.0.0';

  let port: string | number = app?.control_port ?? '—';
  try {
    const dashboardUrl = new URL(app?.dashboard_url || window.location.origin);
    port = dashboardUrl.port || app?.control_port || '—';
  } catch {
    port = app?.control_port || '—';
  }

  const summary =
    connection === 'offline'
      ? { tone: 'danger' as const, label: 'Mất kết nối dịch vụ' }
      : connection === 'loading'
        ? { tone: 'neutral' as const, label: 'Đang kết nối…' }
        : statusSummary(status);

  const statusDotClass =
    connection === 'offline' || summary.tone === 'danger'
      ? 'bg-[#f87171]'
      : connection === 'loading'
        ? 'bg-(--text-on-dark-subtle)'
        : summary.tone === 'success'
          ? 'bg-[#4ade80]'
          : summary.tone === 'warning'
            ? 'bg-[#fbbf24]'
            : summary.tone === 'info'
              ? 'bg-[#60a5fa]'
              : 'bg-(--text-on-dark-subtle)';

  const deviceState = deviceNavState(device);
  const deviceDotClass =
    deviceState === 'on'
      ? 'bg-[#4ade80]'
      : deviceState === 'warn'
        ? 'bg-[#fbbf24]'
        : deviceState === 'error'
          ? 'bg-[#f87171]'
          : 'bg-[#52525b]';

  return (
    <SidebarSurface
      ref={sidebarRef}
      id="sidebar"
      aria-label="Điều hướng chính"
      inert={isMobile && !open}
      className={cn(
        isMobile
          ? 'fixed inset-y-0 left-0 w-[min(284px,86vw)] shadow-[var(--shadow-overlay)] transition-[transform,visibility] duration-200 ease-out'
          : 'sticky top-0 w-[236px]',
        isMobile && (open ? 'visible translate-x-0' : 'invisible -translate-x-full'),
      )}
    >
      <SidebarHeader>
        <Link
          className="flex min-h-11 flex-1 items-center gap-2.5 rounded-lg text-sidebar-accent-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
          to="/overview"
          onClick={onNavigate}
        >
          <span
            className="grid size-[34px] flex-none place-items-center rounded-lg bg-sidebar-accent-foreground text-sidebar"
            aria-hidden="true"
          >
            <Icon name="signal" className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col leading-[1.25]">
            <span className="text-xl font-semibold tracking-[-0.01em]">4G Proxy</span>
            <span className="mt-px text-xs font-medium tracking-[0.055em] text-(--text-on-dark-subtle) uppercase">
              Bảng điều khiển
            </span>
          </span>
        </Link>
        <Button
          ref={closeButtonRef}
          id="sidebar-close"
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar min-[1025px]:hidden"
          aria-label="Đóng điều hướng"
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Không gian làm việc">
          <SidebarGroup>
            <SidebarGroupLabel>Không gian làm việc</SidebarGroupLabel>
            <SidebarMenu>
              {NAV_ITEMS.map((route) => {
                const isActive = route === activeRoute;
                return (
                  <SidebarMenuItem key={route}>
                    <SidebarMenuButton
                      isActive={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      render={<NavLink to={`/${route}`} onClick={onNavigate} />}
                    >
                      <Icon
                        name={ROUTES[route].icon}
                        className="size-[17px] shrink-0 text-(--text-on-dark-subtle) transition-colors group-hover/menu-button:text-sidebar-accent-foreground group-data-[active=true]/menu-button:text-sidebar-accent-foreground"
                      />
                      <span className="truncate">{ROUTES[route].title}</span>
                      {route === 'device' ? (
                        <SidebarMenuBadge
                          id="nav-device-dot"
                          data-state={deviceState}
                          aria-hidden="true"
                          className={deviceDotClass}
                        />
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border pt-5">
        <div
          className="flex min-h-6 items-center gap-1.5 text-xs font-medium text-sidebar-foreground"
          id="sidebar-status"
        >
          <span
            className={cn('size-1.5 flex-none rounded-full', statusDotClass)}
            aria-hidden="true"
          />
          <span>{summary.label}</span>
        </div>
        <p className="text-xs leading-normal text-(--text-on-dark-subtle)">
          v{version} · cổng {port}
        </p>
        <p className="text-xs leading-normal text-(--text-on-dark-subtle)">
          Dữ liệu lưu trên máy tính
        </p>
      </SidebarFooter>
    </SidebarSurface>
  );
}
