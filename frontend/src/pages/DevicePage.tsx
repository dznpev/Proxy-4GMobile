import { Icon } from '../components/Icon';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { useDashboard } from '../app/providers/DashboardProvider';
import { useI18n } from '../app/providers/I18nProvider';
import { DEVICE_STATUS_KEYS } from '../lib/constants';
import { formatClock, formatDuration } from '../lib/format';
import { deviceTone } from '../lib/status';

export function DevicePage() {
  const {
    status,
    now,
    reconnecting,
    restarting,
    togglingCharging,
    reconnectDevice,
    restartProxy,
    setDeviceCharging,
  } = useDashboard();
  const { t } = useI18n();

  const app = status?.app;
  const device = status?.device;
  const proxy = status?.proxy;
  const battery = device?.battery;
  const rotationRunning = Boolean(status?.rotation?.running);

  const tone = deviceTone(device);
  const deviceStatusKey =
    DEVICE_STATUS_KEYS[device?.status ?? ''] ?? 'status.device.disconnected';
  const label = t(deviceStatusKey);
  const badgeIcon =
    tone === 'success' ? 'check' : tone === 'info' ? 'refresh' : tone === 'danger' ? 'alert' : 'phone';

  const batteryTone =
    battery?.warning_level === 'danger'
      ? 'danger'
      : battery?.warning_level === 'warning'
        ? 'warning'
        : 'success';

  const batteryStatusLabels: Record<string, string> = {
    charging: t('status.battery.charging'),
    discharging: t('status.battery.discharging'),
    not_charging: t('status.battery.notCharging'),
    full: t('status.battery.full'),
    unknown: t('status.battery.unknown'),
  };

  const batteryPluggedLabels: Record<string, string> = {
    usb: t('status.battery.usb'),
    ac: t('status.battery.ac'),
    wireless: t('status.battery.wireless'),
    none: t('status.battery.none'),
  };

  const batteryHealthLabels: Record<string, string> = {
    good: t('status.battery.good'),
    overheat: t('status.battery.overheat'),
    dead: t('status.battery.dead'),
    over_voltage: t('status.battery.overVoltage'),
    cold: t('status.battery.cold'),
  };

  let adbLabel = t(deviceStatusKey);
  if (device?.status === 'ready') adbLabel = t('device.connectedUsb');
  if (device?.status === 'adb-missing' || app?.adb_available === false) {
    adbLabel = t('device.adbNotFound');
  }

  const hasError = Boolean(device?.error) && device?.status !== 'ready';

  const reconnectDisabled =
    !device?.serial || device?.status === 'preparing' || rotationRunning || reconnecting;
  const reconnectTitle = rotationRunning
    ? t('status.rotation.disabled.running')
    : reconnectDisabled
      ? t('device.reconnectDisabled')
      : '';

  const restartDisabled =
    !device?.connected || device?.status === 'preparing' || rotationRunning || restarting;
  const restartTitle = rotationRunning
    ? t('status.rotation.disabled.running')
    : restartDisabled
      ? t('device.restartDisabled')
      : '';

  return (
    <section className="page" data-page="device" aria-labelledby="device-page-title">
      <div className="page-lead">
        <div>
          <h2 className="page-section-title" id="device-page-title">
            {t('device.title')}
          </h2>
          <p className="page-lead-text">{t('device.lead')}</p>
        </div>
      </div>

      <div className="grid-2">
        <Card render={<article />} aria-labelledby="device-info-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('device.hardwareEyebrow')}</p>
              <CardTitle render={<h2 />} id="device-info-title">
                {t('device.infoTitle')}
              </CardTitle>
            </div>
            <CardAction className="flex items-center gap-1.5 flex-wrap">
              {device?.connected && (
                <Badge
                  tone={device.rooted ? 'success' : 'neutral'}
                  label={device.rooted ? t('overview.rooted') : t('overview.notRooted')}
                  icon={device.rooted ? 'check' : undefined}
                />
              )}
              <Badge tone={tone} label={label} icon={badgeIcon} />
            </CardAction>
          </CardHeader>

          <dl className="detail-list">
            <div>
              <dt>{t('device.serial')}</dt>
              <dd className="mono">{device?.serial || '—'}</dd>
            </div>
            <div>
              <dt>{t('device.model')}</dt>
              <dd>{device?.model || '—'}</dd>
            </div>
            <div>
              <dt>{t('device.android')}</dt>
              <dd>{device?.android || '—'}</dd>
            </div>
            <div>
              <dt>{t('device.abi')}</dt>
              <dd>{device?.abi || '—'}</dd>
            </div>
            <div>
              <dt>{t('device.rootAccess')}</dt>
              <dd>
                {device?.connected
                  ? device.rooted
                    ? t('device.rootedLong')
                    : t('device.notRootedLong')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('device.adbStatus')}</dt>
              <dd>{adbLabel}</dd>
            </div>
            <div>
              <dt>{t('device.daemon')}</dt>
              <dd>{device?.daemon_running ? t('device.running') : t('device.stopped')}</dd>
            </div>
            <div>
              <dt>{t('device.portForward')}</dt>
              <dd>
                {proxy?.forwarded
                  ? t('device.forwardedPort', { port: proxy.port || '—' })
                  : t('device.notForwarded')}
              </dd>
            </div>
            <div>
              <dt>{t('device.connectedSince')}</dt>
              <dd>
                {device?.since
                  ? `${formatDuration(Math.max(0, now - device.since))} · ${t('common.since', {
                      time: formatClock(device.since),
                    })}`
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className="inline-alert inline-alert-danger" role="alert" hidden={!hasError}>
            <strong>{t('device.attentionTitle')}</strong>
            <p>{device?.error}</p>
          </div>

          <CardFooter>
            <Button
              variant="outline"
              loading={reconnecting}
              disabled={reconnectDisabled}
              title={reconnectTitle}
              onClick={() => void reconnectDevice()}
            >
              {t('actions.reconnect')}
            </Button>
            <Button
              variant="outline"
              loading={restarting}
              disabled={restartDisabled}
              title={restartTitle}
              onClick={() => void restartProxy()}
            >
              {t('actions.restartDaemon')}
            </Button>
          </CardFooter>
        </Card>

        <Card render={<article />} aria-labelledby="battery-info-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('device.batteryEyebrow')}</p>
              <CardTitle render={<h2 />} id="battery-info-title">
                {t('device.batteryTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Badge
                tone={battery ? batteryTone : 'neutral'}
                icon={
                  battery?.warning_level === 'danger'
                    ? 'flame'
                    : battery?.warning_level === 'warning'
                      ? 'alert'
                      : 'battery'
                }
              >
                {battery?.temperature != null ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold font-numeric">{battery.temperature}°C</span>
                    <span className="opacity-40 font-normal">|</span>
                    <span>
                      {battery.warning_level === 'danger'
                        ? t('status.battery.overheating')
                        : battery.warning_level === 'warning'
                          ? t('status.battery.warm')
                          : t('status.battery.safe')}
                    </span>
                  </span>
                ) : (
                  <span>{t('status.battery.temperatureUnknown')}</span>
                )}
              </Badge>
            </CardAction>
          </CardHeader>

          <dl className="detail-list">
            <div>
              <dt>{t('device.batteryLevel')}</dt>
              <dd className="font-semibold font-numeric">
                {battery?.level != null ? `${battery.level}%` : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('device.batteryTemperature')}</dt>
              <dd className="font-semibold font-numeric">
                {battery?.temperature != null ? `${battery.temperature}°C` : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('device.chargeStatus')}</dt>
              <dd>
                {battery?.charging_disabled
                  ? t('status.battery.paused')
                  : battery?.status
                    ? batteryStatusLabels[battery.status] || battery.status
                    : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('device.powerSource')}</dt>
              <dd>{battery?.plugged ? batteryPluggedLabels[battery.plugged] || battery.plugged : '—'}</dd>
            </div>
            <div>
              <dt>{t('device.batteryHealth')}</dt>
              <dd>{battery?.health ? batteryHealthLabels[battery.health] || battery.health : '—'}</dd>
            </div>
            <div>
              <dt>{t('device.voltage')}</dt>
              <dd className="font-numeric">
                {battery?.voltage_mv ? `${(battery.voltage_mv / 1000).toFixed(2)} V` : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('device.cutoffMechanism')}</dt>
              <dd>
                {device?.rooted ? t('device.hardwareCutoff') : t('device.softwareCutoff')}
              </dd>
            </div>
            <div>
              <dt>{t('device.thermalProtection')}</dt>
              <dd>
                {battery?.warning_level === 'danger'
                  ? t('status.battery.protectionActive')
                  : t('status.battery.protectionAuto')}
              </dd>
            </div>
          </dl>

          {battery?.warning_level === 'danger' && (
            <div className="inline-alert inline-alert-danger" role="alert">
              <strong>{t('device.overheatTitle')}</strong>
              <p>
                {t('device.overheatBody')}
                {battery.charging_disabled
                  ? t('device.overheatDisabled')
                  : t('device.overheatAction')}
              </p>
            </div>
          )}

          {battery?.warning_level === 'warning' && (
            <div className="inline-alert" role="alert">
              <strong>{t('device.warmTitle')}</strong>
              <p>{t('device.warmBody')}</p>
            </div>
          )}

          <CardFooter>
            <Button
              variant="outline"
              loading={togglingCharging}
              disabled={!device?.connected || togglingCharging}
              onClick={() => void setDeviceCharging(Boolean(battery?.charging_disabled))}
            >
              {battery?.charging_disabled
                ? t('device.resumeCharging')
                : t('device.pauseCharging')}
            </Button>
          </CardFooter>
        </Card>

        <Card render={<article />} aria-labelledby="setup-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('device.setupEyebrow')}</p>
              <CardTitle render={<h2 />} id="setup-title">
                {t('device.setupTitle')}
              </CardTitle>
            </div>
          </CardHeader>

          <ol className="checklist">
            <li>
              <span className="check-index" aria-hidden="true">
                1
              </span>
              <div>
                <strong>{t('device.setupStep1Title')}</strong>
                <p>{t('device.setupStep1Body')}</p>
              </div>
            </li>
            <li>
              <span className="check-index" aria-hidden="true">
                2
              </span>
              <div>
                <strong>{t('device.setupStep2Title')}</strong>
                <p>{t('device.setupStep2Body')}</p>
              </div>
            </li>
            <li>
              <span className="check-index" aria-hidden="true">
                3
              </span>
              <div>
                <strong>{t('device.setupStep3Title')}</strong>
                <p>{t('device.setupStep3Body')}</p>
              </div>
            </li>
            <li>
              <span className="check-index" aria-hidden="true">
                4
              </span>
              <div>
                <strong>{t('device.setupStep4Title')}</strong>
                <p>{t('device.setupStep4Body')}</p>
              </div>
            </li>
          </ol>

          <div className="callout">
            <Icon name="alert" />
            <p>{t('device.callout')}</p>
          </div>
        </Card>
      </div>

      <Card render={<article />} aria-labelledby="troubleshoot-title">
        <CardHeader>
          <div>
            <p className="eyebrow">{t('device.troubleshootEyebrow')}</p>
            <CardTitle render={<h2 />} id="troubleshoot-title">
              {t('device.troubleshootTitle')}
            </CardTitle>
          </div>
        </CardHeader>
        <div className="grid-3 text-grid">
          <div>
            <h3>{t('device.noDeviceTitle')}</h3>
            <p>{t('device.noDeviceBody')}</p>
          </div>
          <div>
            <h3>{t('device.daemonTitle')}</h3>
            <p>{t('device.daemonBody')}</p>
          </div>
          <div>
            <h3>{t('device.internetTitle')}</h3>
            <p>{t('device.internetBody')}</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
