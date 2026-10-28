import type { RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../Icon';
import { StatusPill } from '../ui/StatusPill';
import { ROUTES } from '../../lib/constants';
import { statusSummary } from '../../lib/status';
import { useDashboard } from '../../app/providers/DashboardProvider';

interface TopbarProps {
  onMenuToggle: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  menuOpen: boolean;
}

export function Topbar({ onMenuToggle, menuButtonRef, menuOpen }: TopbarProps) {
  const { pathname } = useLocation();
  const route = pathname.replace(/^\//, '') || 'overview';
  const meta = ROUTES[route] ?? ROUTES.overview;

  const {
    status,
    connection,
    refreshing,
    rotatePending,
    refreshAll,
    startRotation,
  } = useDashboard();

  const summary =
    connection === 'offline'
      ? { tone: 'danger' as const, label: 'Mất kết nối dịch vụ' }
      : connection === 'loading'
        ? { tone: 'neutral' as const, label: 'Đang kết nối…' }
        : statusSummary(status);

  const device = status?.device;
  const rotationRunning = Boolean(status?.rotation?.running);
  const canRotate = Boolean(
    device?.connected && device?.daemon_running && !rotationRunning && !rotatePending,
  );

  const rotateTitle = rotationRunning
    ? 'Đang xoay IP, vui lòng chờ.'
    : !device?.connected
      ? 'Cần kết nối thiết bị trước khi xoay IP.'
      : !device?.daemon_running
        ? 'Daemon proxy chưa chạy. Hãy kết nối lại thiết bị.'
        : '';

  return (
    <header className="topbar">
      <button
        ref={menuButtonRef}
        className="icon-btn menu-toggle"
        id="menu-toggle"
        type="button"
        aria-label="Mở điều hướng"
        aria-controls="sidebar"
        aria-expanded={menuOpen ? 'true' : 'false'}
        onClick={onMenuToggle}
      >
        <Icon name="menu" />
      </button>

      <div className="page-heading">
        <p className="eyebrow" id="page-eyebrow">
          {meta.eyebrow}
        </p>
        <h1 className="page-title" id="page-title">
          {meta.title}
        </h1>
      </div>

      <div className="topbar-actions">
        <StatusPill tone={summary.tone} label={summary.label} />
        <button
          className={`btn btn-secondary${refreshing ? ' is-loading' : ''}`}
          id="refresh-btn"
          type="button"
          aria-label="Làm mới trạng thái"
          aria-busy={refreshing ? 'true' : 'false'}
          disabled={refreshing}
          onClick={() => void refreshAll({ spinner: true })}
        >
          <Icon name="refresh" />
          <span className="btn-label">Làm mới</span>
        </button>
        <button
          className="btn btn-primary"
          id="rotate-btn"
          type="button"
          aria-label="Xoay IP ngay"
          disabled={!canRotate}
          title={rotateTitle}
          onClick={() => void startRotation()}
        >
          <Icon name="refresh" />
          <span className="btn-label">Xoay IP</span>
        </button>
      </div>
    </header>
  );
}
