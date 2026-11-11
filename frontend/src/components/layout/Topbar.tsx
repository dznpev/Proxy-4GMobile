import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../Icon';
import { Button } from '../ui/button';
import { FlagIcon } from '../ui/FlagIcon';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '../ui/popover';
import { Spinner } from '../ui/spinner';
import { StatusPill } from '../ui/StatusPill';
import { ROUTES } from '../../lib/constants';
import { statusSummary } from '../../lib/status';
import { useDashboard } from '../../app/providers/DashboardProvider';
import { useI18n } from '../../app/providers/I18nProvider';

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

  const { locale, setLocale, t } = useI18n();

  const closeActions = () => {
    setActionsOpen(false);
    window.requestAnimationFrame(() => actionsButtonRef.current?.focus());
  };

  const handleToggleLanguage = () => {
    const nextLocale = locale === 'en' ? 'vi' : 'en';
    void setLocale(nextLocale);
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
      ? { tone: 'danger' as const, label: t('status.summary.serviceOffline'), icon: 'alert' }
      : connection === 'loading'
        ? { tone: 'neutral' as const, label: t('status.summary.serviceConnecting'), icon: 'refresh' }
        : statusSummary(status, t);

  const device = status?.device;
  const rotationRunning = Boolean(status?.rotation?.running);
  const canRotate = Boolean(
    device?.connected && device?.daemon_running && !rotationRunning && !rotatePending,
  );

  const rotateTitle = rotationRunning
    ? t('status.rotation.disabled.running')
    : !device?.connected
      ? t('status.rotation.disabled.noDevice')
      : !device?.daemon_running
        ? t('status.rotation.disabled.daemon')
        : '';

  const eyebrowKey = `routes.${route}.eyebrow`;
  const titleKey = `routes.${route}.title`;
  const translatedEyebrow = t(eyebrowKey);
  const translatedTitle = t(titleKey);
  const eyebrow = translatedEyebrow !== eyebrowKey ? translatedEyebrow : meta.eyebrow;
  const title = translatedTitle !== titleKey ? translatedTitle : meta.title;

  return (
    <header className="sticky top-0 z-30 flex min-h-[76px] items-center gap-4 border-b border-border bg-[rgba(247,247,248,0.94)] px-8 py-3 backdrop-blur-[8px] max-[800px]:min-h-0 max-[800px]:flex-wrap max-[800px]:gap-2 max-[800px]:px-4 max-[800px]:py-2.5 max-[520px]:px-2">
      <Button
        ref={menuButtonRef}
        className="min-[1025px]:hidden max-[1025px]:min-h-11 max-[1025px]:min-w-11"
        id="menu-toggle"
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('topbar.openNavigation')}
        aria-controls="sidebar"
        aria-expanded={menuOpen ? 'true' : 'false'}
        onClick={onMenuToggle}
      >
        <Icon name="menu" />
      </Button>

      <div className="min-w-0 max-[800px]:flex-1">
        <p className="eyebrow" id="page-eyebrow">
          {eyebrow}
        </p>
        <h1
          className="mt-px text-3xl font-semibold tracking-[-0.025em] max-[640px]:tracking-[-0.02em]"
          id="page-title"
        >
          {title}
        </h1>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 max-[800px]:gap-1.5">
        <StatusPill
          className="max-[640px]:hidden"
          tone={summary.tone}
          label={summary.label}
        />
        <Button
          id="language-btn"
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:min-h-11 max-[520px]:hidden gap-1.5 font-medium"
          aria-label={`${t('topbar.language')}: ${locale.toUpperCase()}`}
          title={locale === 'en' ? t('topbar.switchToVietnamese') : t('topbar.switchToEnglish')}
          onClick={handleToggleLanguage}
        >
          <FlagIcon code={locale === 'en' ? 'us' : 'vn'} />
          <span className="font-semibold text-xs tracking-wider">{locale === 'en' ? 'EN' : 'VI'}</span>
        </Button>
        <Button
          id="refresh-btn"
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:min-h-11 max-[520px]:hidden"
          loading={refreshing}
          aria-label={t('topbar.refreshStatus')}
          onClick={() => void refreshAll({ spinner: true })}
        >
          {refreshing ? null : <Icon name="refresh" />}
          <span>{t('topbar.refresh')}</span>
        </Button>
        <Button
          id="rotate-btn"
          type="button"
          size="sm"
          className="pointer-coarse:min-h-11 max-[520px]:hidden"
          loading={rotatePending}
          disabled={!canRotate}
          aria-label={t('topbar.rotateNow')}
          title={rotateTitle}
          onClick={() => void startRotation()}
        >
          {rotatePending ? null : <Icon name="refresh" />}
          <span>{t('topbar.rotate')}</span>
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
                    ? t('topbar.processing')
                    : t('topbar.openQuickActions')
                }
                title={t('topbar.quickActions')}
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
              {t('topbar.quickActions')}
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
                <span>{t('topbar.refresh')}</span>
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
                <span>{t('topbar.rotate')}</span>
              </Button>
              <Button
                id="mobile-language-btn"
                className="min-h-11 w-full justify-start gap-2"
                type="button"
                variant="outline"
                aria-label={t('topbar.language')}
                onClick={() => {
                  closeActions();
                  handleToggleLanguage();
                }}
              >
                <FlagIcon code={locale === 'en' ? 'us' : 'vn'} />
                <span>
                  {t('topbar.language')}:{' '}
                  {locale === 'en' ? t('topbar.languageEnglish') : t('topbar.languageVietnamese')}
                </span>
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
