import { Link, NavLink } from 'react-router-dom';
import type { RefObject } from 'react';
import { Icon } from '../Icon';
import { NAV_ITEMS, ROUTES } from '../../lib/constants';
import { deviceNavState, statusSummary } from '../../lib/status';
import { useDashboard } from '../../app/providers/DashboardProvider';

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

  const statusClass =
    connection === 'offline'
      ? 'is-error'
      : connection === 'loading'
        ? ''
        : summary.tone === 'success'
          ? 'is-online'
          : summary.tone === 'danger'
            ? 'is-error'
            : summary.tone === 'info'
              ? 'is-info'
              : summary.tone === 'warning'
                ? 'is-warning'
                : '';

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar${isMobile && open ? ' is-open' : ''}`}
      id="sidebar"
      aria-label="Điều hướng chính"
      inert={isMobile && !open}
    >
      <div className="sidebar-head">
        <Link className="brand" to="/overview" onClick={onNavigate}>
          <span className="brand-mark" aria-hidden="true">
            <Icon name="signal" />
          </span>
          <span className="brand-text">
            <span className="brand-name">4G Proxy</span>
            <span className="brand-sub">Bảng điều khiển</span>
          </span>
        </Link>
        <button
          ref={closeButtonRef}
          className="icon-btn icon-btn-inverse sidebar-close"
          id="sidebar-close"
          type="button"
          aria-label="Đóng điều hướng"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Không gian làm việc">
        <p className="nav-label">Không gian làm việc</p>
        {NAV_ITEMS.map((route) => (
          <NavLink key={route} className="nav-item" to={`/${route}`} onClick={onNavigate}>
            <Icon name={ROUTES[route].icon} />
            <span>{ROUTES[route].title}</span>
            {route === 'device' ? (
              <span
                className="nav-dot"
                id="nav-device-dot"
                data-state={deviceNavState(device)}
                aria-hidden="true"
              />
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className={`sidebar-status ${statusClass}`.trim()} id="sidebar-status">
          <span className="status-dot" aria-hidden="true" />
          <span>{summary.label}</span>
        </div>
        <p className="sidebar-meta">
          v{version} · cổng {port}
        </p>
        <p className="sidebar-meta">Dữ liệu lưu trên máy tính</p>
      </div>
    </aside>
  );
}
