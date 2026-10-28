import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { IconSprite } from '../components/IconSprite';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { Banners } from '../components/layout/Banners';
import { ROUTES } from '../lib/constants';
import { useDashboard } from './providers/DashboardProvider';
import { useMediaQuery } from './hooks/useMediaQuery';

export function AppShell({ children }: { children: ReactNode }) {
  const { status, connection } = useDashboard();
  const location = useLocation();
  const route = location.pathname.replace(/^\//, '') || 'overview';
  const meta = ROUTES[route] ?? ROUTES.overview;

  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const firstRouteRef = useRef(true);

  useEffect(() => {
    document.title = `${meta.documentTitle} · 4G Mobile Proxy`;
  }, [meta.documentTitle]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', isMobile && sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const closeSidebar = useCallback(
    (restoreFocus = true) => {
      if (!sidebarOpen) return;
      const focusWasInside = sidebarRef.current?.contains(document.activeElement) ?? false;
      setSidebarOpen(false);
      if (restoreFocus && focusWasInside) menuButtonRef.current?.focus();
    },
    [sidebarOpen],
  );

  const openSidebar = useCallback(() => {
    if (!isMobile) return;
    setSidebarOpen(true);
  }, [isMobile]);

  const toggleSidebar = useCallback(() => {
    if (sidebarOpen) closeSidebar();
    else openSidebar();
  }, [closeSidebar, openSidebar, sidebarOpen]);

  useEffect(() => {
    if (isMobile && sidebarOpen) closeButtonRef.current?.focus();
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSidebar();
        return;
      }
      if (event.key !== 'Tab') return;

      const sidebar = sidebarRef.current;
      if (!sidebar) return;
      const focusable = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeSidebar, isMobile, sidebarOpen]);

  useEffect(() => {
    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    setSidebarOpen(false);
  }, [location.pathname]);

  const version = status?.app?.version || '2.0.0';
  const busy = connection === 'loading';

  return (
    <>
      <IconSprite />
      <div className="app-shell">
        <Sidebar
          open={sidebarOpen}
          isMobile={isMobile}
          onClose={() => closeSidebar()}
          onNavigate={() => closeSidebar(false)}
          sidebarRef={sidebarRef}
          closeButtonRef={closeButtonRef}
        />

        <div
          className="scrim"
          id="sidebar-scrim"
          hidden={!isMobile || !sidebarOpen}
          onClick={() => closeSidebar()}
        />

        <div className="shell-main">
          <Topbar
            onMenuToggle={toggleSidebar}
            menuButtonRef={menuButtonRef}
            menuOpen={isMobile && sidebarOpen}
          />

          <main id="main" ref={mainRef} tabIndex={-1} aria-busy={busy}>
            <Banners />
            {children}
            <footer className="app-footer">
              <span>4G Mobile Proxy · {version}</span>
              <span>Dữ liệu cục bộ · không gửi lên máy chủ</span>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
