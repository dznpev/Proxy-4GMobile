import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { IconSprite } from '../components/IconSprite';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { Banners } from '../components/layout/Banners';
import { ROUTES } from '../lib/constants';
import { useDashboard } from './providers/DashboardProvider';
import { useI18n } from './providers/I18nProvider';
import { useMediaQuery } from './hooks/useMediaQuery';

export function AppShell({ children }: { children: ReactNode }) {
  const { status, connection } = useDashboard();
  const { t } = useI18n();
  const location = useLocation();
  const route = location.pathname.replace(/^\//, '') || 'overview';
  const meta = ROUTES[route] ?? ROUTES.overview;

  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);
  const firstRouteRef = useRef(true);

  useEffect(() => {
    const key = `routes.${route}.documentTitle`;
    const translated = t(key);
    const title = translated !== key ? translated : meta.documentTitle;
    document.title = t('app.documentTitle', { title });
  }, [meta.documentTitle, route, t]);

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
      restoreFocusRef.current = restoreFocus && focusWasInside;
      setSidebarOpen(false);
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
    if (isMobile && sidebarOpen) {
      const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
    if (!sidebarOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      menuButtonRef.current?.focus();
    }
    return undefined;
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
    restoreFocusRef.current = false;
    setSidebarOpen(false);
  }, [location.pathname]);

  const version = status?.app?.version || '2.0.0';
  const busy = connection === 'loading';

  return (
    <>
      <IconSprite />
      <div className="grid min-h-dvh grid-cols-1 min-[1025px]:grid-cols-[236px_minmax(0,1fr)]">
        <Sidebar
          open={sidebarOpen}
          isMobile={isMobile}
          onClose={() => closeSidebar()}
          onNavigate={() => closeSidebar(false)}
          sidebarRef={sidebarRef}
          closeButtonRef={closeButtonRef}
        />

        {isMobile && sidebarOpen ? (
          <div
            className="fixed inset-0 z-[35] bg-black/[0.42]"
            id="sidebar-scrim"
            aria-hidden="true"
            onClick={() => closeSidebar()}
          />
        ) : null}

        <div className="min-w-0" inert={isMobile && sidebarOpen}>
          <Topbar
            onMenuToggle={toggleSidebar}
            menuButtonRef={menuButtonRef}
            menuOpen={isMobile && sidebarOpen}
          />

          <main
            id="main"
            ref={mainRef}
            className="mx-auto w-full max-w-[1500px] px-8 pt-6 pb-10 max-[800px]:px-4 max-[800px]:pt-4 max-[800px]:pb-8 max-[520px]:px-2"
            tabIndex={-1}
            aria-busy={busy}
          >
            <Banners />
            {children}
            <footer className="flex items-center justify-between gap-4 pt-5 text-xs text-muted-foreground max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-1">
              <span>{t('app.footerVersion', { version })}</span>
              <span>{t('app.footerPrivacy')}</span>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
