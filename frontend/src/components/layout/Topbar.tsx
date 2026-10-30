import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../Icon';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '../ui/popover';
import { Spinner } from '../ui/spinner';
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeActions = () => {
    setActionsOpen(false);
    window.requestAnimationFrame(() => actionsButtonRef.current?.focus());
  };

  // Close the mobile action popover when the inline buttons return at 521px.
  useEffect(() => {
    const inlineActions = window.matchMedia('(min-width: 521px)');
    const closeOnInline = () => {
      if (inlineActions.matches) setActionsOpen(false);
    };
    closeOnInline();
    inlineActions.addEventListener('change', closeOnInline);
    return () => inlineActions.removeEventListener('change', closeOnInline);
  }, []);

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
    <header className="sticky top-0 z-30 flex min-h-[76px] items-center gap-4 border-b border-border bg-[rgba(247,247,248,0.94)] px-8 py-3 backdrop-blur-[8px] max-[800px]:min-h-0 max-[800px]:flex-wrap max-[800px]:gap-2 max-[800px]:px-4 max-[800px]:py-2.5 max-[520px]:px-2">
      <Button
        ref={menuButtonRef}
        className="min-[1025px]:hidden max-[1025px]:min-h-11 max-[1025px]:min-w-11"
        id="menu-toggle"
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Mở điều hướng"
        aria-controls="sidebar"
        aria-expanded={menuOpen ? 'true' : 'false'}
        onClick={onMenuToggle}
      >
        <Icon name="menu" />
      </Button>

      <div className="min-w-0 max-[800px]:flex-1">
        <p className="eyebrow" id="page-eyebrow">
          {meta.eyebrow}
        </p>
        <h1
          className="mt-px text-3xl font-semibold tracking-[-0.025em] max-[640px]:tracking-[-0.02em]"
          id="page-title"
        >
          {meta.title}
        </h1>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 max-[800px]:gap-1.5">
        <StatusPill
          className="max-[640px]:hidden"
          tone={summary.tone}
          label={summary.label}
        />
        <Button
          id="refresh-btn"
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:min-h-11 max-[520px]:hidden"
          loading={refreshing}
          aria-label="Làm mới trạng thái"
          onClick={() => void refreshAll({ spinner: true })}
        >
          {refreshing ? null : <Icon name="refresh" />}
          <span>Làm mới</span>
        </Button>
        <Button
          id="rotate-btn"
          type="button"
          size="sm"
          className="pointer-coarse:min-h-11 max-[520px]:hidden"
          loading={rotatePending}
          disabled={!canRotate}
          aria-label="Xoay IP ngay"
          title={rotateTitle}
          onClick={() => void startRotation()}
        >
          {rotatePending ? null : <Icon name="refresh" />}
          <span>Xoay IP</span>
        </Button>

        <Popover onOpenChange={setActionsOpen} open={actionsOpen}>
          <PopoverTrigger
            render={
              <Button
                ref={actionsButtonRef}
                className="hidden max-[520px]:inline-flex max-[520px]:size-11 data-[popup-open]:border-(--border-control) data-[popup-open]:bg-accent"
                id="topbar-actions-btn"
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={
                  refreshing || rotatePending
                    ? 'Đang xử lý thao tác'
                    : 'Mở thao tác nhanh'
                }
                title="Thao tác nhanh"
              />
            }
          >
            {refreshing || rotatePending ? (
              <Spinner className="size-4" />
            ) : (
              <Icon name="more-horizontal" />
            )}
          </PopoverTrigger>
          <PopoverContent className="w-[min(17rem,calc(100vw-1rem))]">
            <PopoverTitle className="px-1.5 pb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Thao tác nhanh
            </PopoverTitle>
            <div className="grid gap-1.5">
              <Button
                className="min-h-11 w-full justify-start"
                type="button"
                variant="outline"
                loading={refreshing}
                onClick={() => {
                  closeActions();
                  void refreshAll({ spinner: true });
                }}
              >
                {refreshing ? null : <Icon name="refresh" />}
                <span>Làm mới</span>
              </Button>
              <Button
                className="min-h-11 w-full justify-start"
                type="button"
                loading={rotatePending}
                disabled={!canRotate}
                title={rotateTitle}
                onClick={() => {
                  closeActions();
                  void startRotation();
                }}
              >
                {rotatePending ? null : <Icon name="refresh" />}
                <span>Xoay IP</span>
              </Button>
            </div>
            {rotateTitle ? (
              <p className="px-1.5 pt-2 text-sm leading-snug text-muted-foreground">
                {rotateTitle}
              </p>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
