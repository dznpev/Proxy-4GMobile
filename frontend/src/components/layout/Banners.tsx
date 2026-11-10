import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '../ui/alert';
import { Button, buttonVariants } from '../ui/button';
import { useDashboard } from '../../app/providers/DashboardProvider';
import { useI18n } from '../../app/providers/I18nProvider';

type BannerVariant = 'error' | 'info' | 'warning';

type Translate = (keyPath: string, params?: Record<string, string | number>) => string;

function deviceBannerCopy(
  status: string,
  error: string | null,
  adbAvailable: boolean,
  t: Translate,
): { title: string; text: string; variant: BannerVariant; icon: string } {
  switch (status) {
    case 'preparing':
      return {
        title: t('banners.preparingTitle'),
        text: t('banners.preparingText'),
        variant: 'info',
        icon: 'refresh',
      };
    case 'unauthorized':
      return {
        title: t('banners.unauthorizedTitle'),
        text: t('banners.unauthorizedText'),
        variant: 'warning',
        icon: 'phone',
      };
    case 'adb-missing':
      return {
        title: t('banners.adbMissingTitle'),
        text: t('banners.adbMissingText'),
        variant: 'warning',
        icon: 'alert',
      };
    case 'error':
      return {
        title: t('banners.setupErrorTitle'),
        text: error
          ? error
          : adbAvailable === false
            ? t('banners.setupErrorAdb')
            : t('banners.setupErrorGeneric'),
        variant: 'error',
        icon: 'alert',
      };
    default:
      return {
        title: t('banners.noDeviceTitle'),
        text: t('banners.noDeviceText'),
        variant: 'warning',
        icon: 'phone',
      };
  }
}

export function Banners() {
  const { status, connection, statusError, refreshAll } = useDashboard();
  const { t } = useI18n();

  if (connection === 'offline') {
    return (
      <Alert className="mb-3" id="service-banner" variant="error">
        <Icon name="alert" />
        <AlertTitle>{t('banners.serviceTitle')}</AlertTitle>
        <AlertDescription>
          {statusError || t('banners.serviceFallback')}
        </AlertDescription>
        <AlertAction>
          <Button
            id="banner-retry"
            size="sm"
            variant="outline"
            className="pointer-coarse:min-h-11"
            onClick={() => void refreshAll({ spinner: true })}
          >
            {t('banners.retry')}
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (connection !== 'online' || !status) {
    return null;
  }

  if (status.device.battery?.warning_level === 'danger') {
    return (
      <Alert className="mb-3" id="thermal-banner" variant="error">
        <Icon name="flame" />
        <AlertTitle>
          {t('banners.thermalTitle', { temperature: status.device.battery.temperature ?? '—' })}
        </AlertTitle>
        <AlertDescription>
          {t('banners.thermalBody')}
          {status.device.battery.charging_disabled
            ? t('banners.thermalDisabled')
            : t('banners.thermalAction')}
        </AlertDescription>
        <AlertAction>
          <Link
            className={buttonVariants({
              size: 'sm',
              variant: 'outline',
              className: 'pointer-coarse:min-h-11',
            })}
            id="thermal-banner-link"
            to="/device"
          >
            {t('banners.manageBattery')}
          </Link>
        </AlertAction>
      </Alert>
    );
  }

  if (status.device.status === 'ready') {
    return null;
  }

  const copy = deviceBannerCopy(
    status.device.status,
    status.device.error,
    status.app.adb_available,
    t,
  );

  return (
    <Alert className="mb-3" id="device-banner" variant={copy.variant}>
      <Icon name={copy.icon} />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>{copy.text}</AlertDescription>
      <AlertAction>
        <Link
          className={buttonVariants({
            size: 'sm',
            variant: 'outline',
            className: 'pointer-coarse:min-h-11',
          })}
          id="device-banner-link"
          to="/device"
        >
          {t('banners.viewDevice')}
        </Link>
      </AlertAction>
    </Alert>
  );
}
