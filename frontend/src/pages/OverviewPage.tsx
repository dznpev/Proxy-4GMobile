import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RotationInfo, Tone } from '../api/types';
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
import { Switch } from '../components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import { HistoryRows } from '../components/data/HistoryRows';
import { LogList } from '../components/data/LogList';
import { useDashboard } from '../app/providers/DashboardProvider';
import { useI18n } from '../app/providers/I18nProvider';
import { useCopy } from '../app/hooks/useCopy';
import { DEVICE_STATUS_KEYS } from '../lib/constants';
import {
  formatClock,
  formatCountdown,
  formatDuration,
  formatBytes,
  formatLatency,
  formatLocation,
  formatRelative,
} from '../lib/format';

const ROTATION_STEPS = ['preparing', 'network-off', 'network-on', 'verifying'] as const;

const STEP_LABEL_KEYS: Record<string, string> = {
  preparing: 'status.rotation.stepLabels.preparing',
  'network-off': 'status.rotation.stepLabels.networkOff',
  'network-on': 'status.rotation.stepLabels.networkOn',
  waiting: 'status.rotation.stepLabels.waiting',
  verifying: 'status.rotation.stepLabels.verifying',
};

const STEP_NAME_KEYS: Record<string, string> = {
  preparing: 'status.rotation.steps.preparing',
  'network-off': 'status.rotation.steps.networkOff',
  'network-on': 'status.rotation.steps.networkOn',
  verifying: 'status.rotation.steps.verify',
};

/** Builds the class list for the four rotation steps. */
function rotationStepClasses(
  rotation: RotationInfo | null | undefined,
  traceId: string | null,
  traceStep: string | null,
): string[] {
  const status = rotation?.status;
  const running = Boolean(rotation?.running);
  const classes = ROTATION_STEPS.map(() => '');

  if (status === 'success') {
    return classes.map(() => 'is-done');
  }

  if (status === 'failed' && !running) {
    const failedStep = traceId && traceId === rotation?.id ? traceStep : null;
    let errorIndex = ROTATION_STEPS.length - 1;
    if (failedStep === 'preparing') errorIndex = 0;
    else if (failedStep === 'network-off') errorIndex = 1;
    else if (failedStep === 'network-on' || failedStep === 'waiting') errorIndex = 2;
    else if (failedStep === 'verifying') errorIndex = 3;

    classes.forEach((_, index) => {
      if (index < errorIndex) classes[index] = 'is-done';
      if (index === errorIndex) classes[index] = 'is-error';
    });
    return classes;
  }

  if (running) {
    const step = rotation?.step ?? '';
    let activeIndex = ROTATION_STEPS.indexOf(step as (typeof ROTATION_STEPS)[number]);
    if (step === 'waiting') activeIndex = -1;
    if (step === 'done') activeIndex = ROTATION_STEPS.length;
    classes.forEach((_, index) => {
      if (index < activeIndex) classes[index] = 'is-done';
      if (index === activeIndex) classes[index] = 'is-active';
    });
    if (step === 'done') return classes.map(() => 'is-done');
  }

  return classes;
}

export function OverviewPage() {
  const {
    status,
    now,
    logs,
    rotationTrace,
    rotatePending,
    checking,
    reconnecting,
    autoPending,
    startRotation,
    checkConnection,
    reconnectDevice,
    toggleAutoRotate,
  } = useDashboard();
  const { t } = useI18n();
  const copy = useCopy();
  const [autoChoice, setAutoChoice] = useState<boolean | null>(null);

  const app = status?.app;
  const device = status?.device;
  const proxy = status?.proxy;
  const network = status?.network;
  const dataUsage = status?.data_usage;
  const rotation = status?.rotation;
  const stats = status?.stats;
  const auto = status?.auto_rotate;

  const rotating = Boolean(rotation?.running) || network?.state === 'rotating';
  const checkingNetwork = network?.state === 'checking';
  const onlineNetwork = network?.state === 'online';
  const rotationRunning = Boolean(rotation?.running);
  const rotationSucceeded = rotation?.status === 'success';
  const rotationFailed = rotation?.status === 'failed';
  const progress = Math.max(0, Math.min(100, Number(rotation?.progress) || 0));

  let session: { tone: Tone; label: string; icon: string } = {
    tone: 'neutral',
    label: t('status.session.disconnected'),
    icon: 'alert',
  };
  if (device) {
    if (device.status === 'ready' && proxy?.running) {
      session = { tone: 'success', label: t('status.session.active'), icon: 'check' };
    } else if (device.status === 'ready') {
      session = { tone: 'warning', label: t('status.session.daemonStopped'), icon: 'alert' };
    } else if (device.status === 'preparing') {
      session = { tone: 'info', label: t('status.session.connecting'), icon: 'refresh' };
    } else if (['unauthorized', 'adb-missing', 'error'].includes(device.status)) {
      session = { tone: 'danger', label: t('status.session.needsAttention'), icon: 'alert' };
    } else {
      session = { tone: 'neutral', label: t('status.session.disconnected'), icon: 'phone' };
    }
  }

  const ip = network?.ip || '—';
  const isp = network?.isp || '—';
  const location = network ? formatLocation(network) : '—';
  const proxyUrl = app?.proxy_url || proxy?.url || 'http://127.0.0.1:8080';

  let checked = t('status.network.unknown');
  if (rotating) checked = t('status.network.rotating');
  else if (checkingNetwork) checked = t('status.network.checking');
  else if (onlineNetwork && network?.checked_at) {
    checked = t('common.updatedRelativeAt', {
      relative: formatRelative(network.checked_at, now),
      time: formatClock(network.checked_at),
    });
  } else if (network?.state === 'error' && network.error) {
    checked = network.error;
  } else if (network?.state === 'offline') {
    checked = t('status.network.offline');
  }

  let ipHint = t('status.network.noConnection');
  if (rotating) ipHint = t('status.network.waitingIp');
  else if (checkingNetwork) ipHint = t('status.network.checkingShort');
  else if (onlineNetwork && network?.checked_at) {
    ipHint = t('common.updatedRelative', {
      relative: formatRelative(network.checked_at, now),
    });
  } else if (network?.state === 'error') ipHint = t('status.network.error');

  let ispHint = t('common.unknown');
  if (network?.country) {
    ispHint = [network.country, network.region].filter(Boolean).join(' · ');
  } else if (onlineNetwork) {
    ispHint = t('status.network.connected');
  }

  const uptime = Number(stats?.session_uptime_sec) || 0;
  let uptimeHint = t('overview.uptimeDisconnected');
  if (device?.since) {
    uptimeHint = t('overview.uptimeSince', { time: formatClock(device.since) });
  } else if (device?.status === 'preparing') {
    uptimeHint = t('overview.uptimePreparing');
  } else if (rotationRunning) {
    uptimeHint = t('overview.uptimeRefreshing');
  }

  const total = Number(stats?.total) || 0;
  const success = Number(stats?.success) || 0;
  const rate = stats?.success_rate;

  const canRotate = Boolean(
    device?.connected && device?.daemon_running && !rotationRunning && !rotatePending,
  );
  const rotateDisabledReason = rotationRunning
    ? t('status.rotation.disabled.running')
    : !device?.connected
      ? t('status.rotation.disabled.noDevice')
      : !device?.daemon_running
        ? t('status.rotation.disabled.daemon')
        : '';

  const stepClasses = rotationStepClasses(rotation, rotationTrace.id, rotationTrace.lastStep);

  let rotateStatus = t('status.rotation.ready');
  if (rotationRunning) rotateStatus = rotation?.message || t('status.rotation.inProgress');
  else if (rotationSucceeded) rotateStatus = rotation?.message || t('status.rotation.completed');
  else if (rotationFailed && !rotationRunning) {
    rotateStatus = rotation?.message || t('status.rotation.failedMessage');
  }

  let rotateDetail = t('status.rotation.verifyAfterReconnect');
  if (rotationRunning) {
    const stepKey =
      STEP_LABEL_KEYS[rotation?.step ?? ''] ?? 'status.rotation.processing';
    rotateDetail = t('status.rotation.stepProgress', {
      step: t(stepKey),
      progress: Math.round(progress),
    });
  } else if (rotationSucceeded) {
    const from = rotation?.old_ip || '—';
    const to = rotation?.new_ip || '—';
    rotateDetail = `${from} → ${to} · ${formatDuration(rotation?.duration_sec)}`;
  } else if (rotationFailed && !rotationRunning) {
    rotateDetail =
      rotation?.duration_sec != null
        ? t('status.rotation.stoppedAfter', {
            duration: formatDuration(rotation.duration_sec),
          })
        : t('status.rotation.failedHint');
  }

  const autoEnabled = Boolean(auto?.enabled ?? status?.settings?.auto_rotate_enabled ?? false);
  const autoInterval = Number(
    auto?.interval_min ?? status?.settings?.auto_rotate_interval_min ?? 30,
  );
  const autoNextAt = auto?.next_at ?? null;
  const deviceConnected = Boolean(device?.connected);

  let autoNextInline = t('overview.autoNextInlineOff');
  if (autoEnabled) {
    if (autoNextAt) {
      autoNextInline = t('overview.autoNextInline', {
        countdown: formatCountdown(autoNextAt, now),
        time: formatClock(autoNextAt),
      });
    } else if (!deviceConnected) {
      autoNextInline = t('overview.autoNextWaitingDevice');
    } else {
      autoNextInline = t('overview.autoNextScheduling');
    }
  }

  let autoNextSummary = t('overview.autoNextOff');
  if (autoEnabled) {
    autoNextSummary = autoNextAt
      ? t('overview.autoNextIn', { countdown: formatCountdown(autoNextAt, now) })
      : t('overview.autoNextWaiting');
  }

  const autoChecked = autoChoice ?? autoEnabled;
  const autoBusy = autoPending || autoChoice !== null;

  const handleAutoToggle = async (checked: boolean) => {
    setAutoChoice(checked);
    await toggleAutoRotate(checked);
    setAutoChoice(null);
  };

  const ready = device?.status === 'ready';
  let deviceSub = t('overview.readyHint');
  if (ready) {
    const details = [
      device.android ? `Android ${device.android}` : null,
      device.abi,
    ].filter(Boolean);
    deviceSub = details.join(' · ') || t('overview.readyDetails');
  } else if (device?.status === 'preparing') {
    deviceSub = t('overview.syncingDaemon');
  } else if (device?.error) {
    deviceSub = device.error;
  }

  const deviceConnectionLabel = ready
    ? proxy?.forwarded
      ? t('overview.usbForwarded')
      : t('overview.usbNotForwarded')
    : t(DEVICE_STATUS_KEYS[device?.status ?? ''] ?? 'status.device.disconnected');

  const reconnectDisabled =
    !device?.serial || device?.status === 'preparing' || rotationRunning || reconnecting;
  const reconnectTitle = rotationRunning
    ? t('status.rotation.disabled.running')
    : reconnectDisabled
      ? t('overview.reconnectDisabled')
      : '';

  const recentHistory = (status?.history ?? []).slice(0, 5);
  const recentLogs = logs.slice(-6);

  return (
    <section className="page" data-page="overview" aria-labelledby="page-title">
      <div className="page-lead">
        <p className="page-lead-text">{t('overview.lead')}</p>
        <p className="meta-text" id="last-updated">
          {status
            ? t('common.updated', { time: formatClock(now) })
            : t('overview.loadingStatus')}
        </p>
      </div>

      <div className="hero-grid">
        <Card
          render={<article />}
          className="status-card"
          aria-labelledby="session-title"
        >
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.sessionEyebrow')}</p>
              <CardTitle render={<h2 />} id="session-title">
                {t('overview.sessionTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Badge
                tone={session.tone}
                label={session.label}
                icon={session.icon}
              />
            </CardAction>
          </CardHeader>

          <div className="endpoint-row">
            <div className="endpoint-copy">
              <span className="endpoint-label">{t('overview.httpProxy')}</span>
              <code>{proxyUrl}</code>
            </div>
            <button
              className="icon-btn"
              type="button"
              aria-label={t('actions.copyProxy')}
              title={t('actions.copyProxy')}
              onClick={() => void copy(proxyUrl)}
            >
              <Icon name="copy" />
            </button>
          </div>

          <dl className="meta-grid">
            <div className="meta-item">
              <dt>{t('overview.publicIp')}</dt>
              <dd className="mono">{ip}</dd>
            </div>
            <div className="meta-item">
              <dt>{t('overview.carrier')}</dt>
              <dd>{isp}</dd>
            </div>
            <div className="meta-item">
              <dt>{t('overview.location')}</dt>
              <dd>{location}</dd>
            </div>
            <div className="meta-item">
              <dt>{t('overview.latency')}</dt>
              <dd>{formatLatency(network?.latency_ms)}</dd>
            </div>
          </dl>

          <CardFooter>
            <span className="meta-text">{checked}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('actions.checkAgain')}
              loading={checking}
              disabled={!device?.connected || rotating}
              title={
                rotating
                  ? t('overview.checkTitleRunning')
                  : !device?.connected
                    ? t('overview.checkTitleNoDevice')
                    : ''
              }
              onClick={() => void checkConnection()}
            >
              {checking ? null : <Icon name="wifi" />}
              <span>{t('actions.checkAgain')}</span>
            </Button>
          </CardFooter>
        </Card>

        <Card
          render={<article />}
          className={`rotate-card${rotationRunning ? ' is-running' : ''}${
            rotationSucceeded ? ' is-success' : ''
          }${rotationFailed && !rotationRunning ? ' is-error' : ''}`}
          aria-labelledby="rotate-title"
        >
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.rotateEyebrow')}</p>
              <CardTitle render={<h2 />} id="rotate-title">
                {t('overview.rotateTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Badge
                tone={autoEnabled ? 'success' : 'neutral'}
                label={autoEnabled ? t('overview.autoOn') : t('overview.autoOff')}
              />
            </CardAction>
          </CardHeader>

          <div className="rotate-summary">
            <div className="rotate-icon" aria-hidden="true">
              <Icon name="refresh" />
            </div>
            <div className="rotate-copy">
              <p className="rotate-status" role="status" aria-live="polite">
                {rotateStatus}
              </p>
              <p className="meta-text">{rotateDetail}</p>
            </div>
          </div>

          <ol className="steps" aria-label={t('overview.rotationSteps')}>
            {ROTATION_STEPS.map((step, index) => (
              <li key={step} className={stepClasses[index]} data-step={step}>
                <span className="step-dot">{index + 1}</span>
                <span>{t(STEP_NAME_KEYS[step])}</span>
              </li>
            ))}
          </ol>

          <Progress
            className="mt-3"
            max={100}
            value={progress}
            tone={rotationSucceeded ? 'success' : rotationFailed ? 'error' : 'default'}
            aria-label={t('overview.rotationProgress')}
          >
            {Math.round(progress)}%
          </Progress>

          <CardFooter>
            <span className="meta-text">{autoNextSummary}</span>
            <Button
              loading={rotatePending}
              disabled={!canRotate}
              title={rotateDisabledReason}
              onClick={() => void startRotation()}
            >
              {rotatePending ? null : <Icon name="refresh" />}
              <span>{t('actions.rotateNow')}</span>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="stat-grid">
        <Card render={<article />} className="px-5 py-4">
          <div className="stat-head">
            <span className="stat-label">{t('overview.currentIp')}</span>
            <Icon name="wifi" />
          </div>
          <p className="stat-value mono">{ip}</p>
          <p className="stat-hint">{ipHint}</p>
        </Card>
        <Card render={<article />} className="px-5 py-4">
          <div className="stat-head">
            <span className="stat-label">{t('overview.isp')}</span>
            <Icon name="signal" />
          </div>
          <p className="stat-value">{isp}</p>
          <p className="stat-hint">{ispHint}</p>
        </Card>
        <Card render={<article />} className="px-5 py-4">
          <div className="stat-head">
            <span className="stat-label">{t('overview.sessionUptime')}</span>
            <Icon name="clock" />
          </div>
          <p className="stat-value">{device?.since ? formatDuration(uptime) : '—'}</p>
          <p className="stat-hint">{uptimeHint}</p>
        </Card>
        <Card render={<article />} className="px-5 py-4">
          <div className="stat-head">
            <span className="stat-label">{t('overview.rotationRate')}</span>
            <Icon name="check" />
          </div>
          <p className="stat-value">{rate == null ? '—' : `${rate}%`}</p>
          <p className="stat-hint">
            {total
              ? t('common.successCount', { success, total })
              : t('overview.noData')}
          </p>
        </Card>
      </div>

      <div className="grid-2">
        <Card render={<article />} aria-labelledby="device-summary-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.deviceEyebrow')}</p>
              <CardTitle render={<h2 />} id="device-summary-title">
                {t('overview.deviceTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Link className="text-link" to="/device">
                {t('actions.details')} <Icon name="arrow-right" />
              </Link>
            </CardAction>
          </CardHeader>

          <div className="device-line">
            <div className="device-avatar" aria-hidden="true">
              <Icon name="phone" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="device-name">{device?.model || t('overview.noDevice')}</p>
                {device?.battery && (
                  <Badge
                    size="sm"
                    tone={
                      device.battery.warning_level === 'danger'
                        ? 'danger'
                        : device.battery.warning_level === 'warning'
                          ? 'warning'
                          : 'neutral'
                    }
                    label={`${device.battery.temperature != null ? `${device.battery.temperature}°C` : '—'}${
                      device.battery.warning_level === 'danger'
                        ? ` ${t('status.battery.overheating')}`
                        : device.battery.warning_level === 'warning'
                          ? ` ${t('status.battery.warm')}`
                          : ''
                    }`}
                    icon={
                      device.battery.warning_level === 'danger'
                        ? 'flame'
                        : device.battery.warning_level === 'warning'
                          ? 'alert'
                          : 'battery'
                    }
                  />
                )}
              </div>
              <p className="meta-text">{deviceSub}</p>
            </div>
          </div>

          <dl className="compact-list">
            <div>
              <dt>{t('overview.serial')}</dt>
              <dd className="mono">{device?.serial || '—'}</dd>
            </div>
            <div>
              <dt>{t('overview.daemon')}</dt>
              <dd>{device?.daemon_running ? t('overview.running') : t('overview.stopped')}</dd>
            </div>
            <div>
              <dt>{t('overview.connection')}</dt>
              <dd>{deviceConnectionLabel}</dd>
            </div>
            {device?.connected && (
              <div>
                <dt>{t('overview.root')}</dt>
                <dd>
                  <Badge
                    size="sm"
                    tone={device.rooted ? 'success' : 'neutral'}
                    label={device.rooted ? t('overview.rooted') : t('overview.notRooted')}
                  />
                </dd>
              </div>
            )}
            {device?.battery && (
              <div>
                <dt>{t('overview.batteryLevel')}</dt>
                <dd className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold">
                    {device.battery.level != null ? `${device.battery.level}%` : '—'}
                  </span>
                  {device.battery.charging_disabled ? (
                    <Badge
                      size="sm"
                      tone="warning"
                      label={t('status.battery.chargingDisabled')}
                      icon="alert"
                    />
                  ) : device.battery.status === 'charging' ? (
                    <Badge
                      size="sm"
                      tone="neutral"
                      label={t('status.battery.usbCharging')}
                      icon="zap"
                    />
                  ) : device.battery.plugged === 'usb' ? (
                    <Badge
                      size="sm"
                      tone="neutral"
                      label={t('status.battery.usbPort')}
                      icon="zap"
                    />
                  ) : null}
                </dd>
              </div>
            )}
          </dl>

          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              loading={reconnecting}
              disabled={reconnectDisabled}
              title={reconnectTitle}
              onClick={() => void reconnectDevice()}
            >
              {t('actions.reconnect')}
            </Button>
            <Link className="text-link" to="/device">
              {t('actions.troubleshoot')}
            </Link>
          </CardFooter>
        </Card>

        <Card render={<article />} aria-labelledby="data-usage-summary-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.dataEyebrow')}</p>
              <CardTitle render={<h2 />} id="data-usage-summary-title">
                {t('overview.dataTitle')}
              </CardTitle>
            </div>
            <CardAction>
              {dataUsage && (
                <Badge
                  tone={dataUsage.exceeded ? 'danger' : dataUsage.warning ? 'warning' : 'success'}
                  label={
                    dataUsage.exceeded
                      ? t('status.dataUsage.highSpeedExhausted')
                      : dataUsage.warning
                        ? t('status.dataUsage.almostOut')
                        : `${dataUsage.usage_percent}%`
                  }
                  icon={dataUsage.exceeded || dataUsage.warning ? 'alert' : 'signal'}
                />
              )}
            </CardAction>
          </CardHeader>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold font-numeric">
                  {formatBytes(dataUsage?.today_total_bytes)}
                </span>
                <span className="text-xs text-(--text-secondary) ml-1.5">
                  {dataUsage?.daily_limit_gb && dataUsage.daily_limit_gb > 0
                    ? t('overview.dataUsageLimit', { limit: dataUsage.daily_limit_gb })
                    : t('common.used')}
                </span>
              </div>
              {dataUsage?.daily_limit_gb && dataUsage.daily_limit_gb > 0 ? (
                <span className="text-xs font-semibold text-(--text-secondary)">
                  {dataUsage.usage_percent}%
                </span>
              ) : null}
            </div>

            {dataUsage?.daily_limit_gb && dataUsage.daily_limit_gb > 0 ? (
              <Progress
                max={100}
                value={Math.min(100, dataUsage.usage_percent)}
                tone={dataUsage.exceeded ? 'error' : 'default'}
                aria-label={t('overview.dataUsageProgress')}
              />
            ) : null}
          </div>

          <dl className="compact-list mt-3">
            <div>
              <dt>{t('status.dataUsage.download')}</dt>
              <dd className="font-semibold">{formatBytes(dataUsage?.today_rx_bytes)}</dd>
            </div>
            <div>
              <dt>{t('status.dataUsage.upload')}</dt>
              <dd className="font-semibold">{formatBytes(dataUsage?.today_tx_bytes)}</dd>
            </div>
            <div>
              <dt>{t('status.dataUsage.carrierLimit')}</dt>
              <dd>
                {dataUsage?.daily_limit_gb && dataUsage.daily_limit_gb > 0
                  ? t('status.dataUsage.limitPerDay', { limit: dataUsage.daily_limit_gb })
                  : t('status.dataUsage.noLimit')}
              </dd>
            </div>
          </dl>

          <CardFooter>
            <Link className="text-link" to="/settings">
              {t('overview.dataPlanSettings')}
            </Link>
          </CardFooter>
        </Card>

        <Card render={<article />} aria-labelledby="auto-summary-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.autoEyebrow')}</p>
              <CardTitle render={<h2 />} id="auto-summary-title">
                {t('overview.autoTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Badge
                tone={autoEnabled ? 'success' : 'neutral'}
                label={autoEnabled ? t('common.on') : t('common.off')}
              />
            </CardAction>
          </CardHeader>

          <div className="switch-row">
            <div>
              <p className="switch-label" id="auto-toggle-label">
                {t('overview.autoToggleLabel')}
              </p>
              <p className="meta-text" id="auto-toggle-help">
                {t('overview.autoToggleHelp')}
              </p>
            </div>
            <Switch
              checked={autoChecked}
              disabled={autoBusy}
              aria-labelledby="auto-toggle-label"
              aria-describedby="auto-toggle-help"
              onCheckedChange={(checked) => void handleAutoToggle(checked)}
            />
          </div>

          <dl className="compact-list">
            <div>
              <dt>{t('overview.interval')}</dt>
              <dd>{t('common.minutesValue', { count: autoInterval })}</dd>
            </div>
            <div>
              <dt>{t('overview.nextRun')}</dt>
              <dd>{autoNextInline}</dd>
            </div>
          </dl>

          <CardFooter>
            <Link className="text-link" to="/settings">
              {t('overview.openSettings')}
            </Link>
          </CardFooter>
        </Card>

        <Card render={<article />} aria-labelledby="quickstart-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.quickstartEyebrow')}</p>
              <CardTitle render={<h2 />} id="quickstart-title">
                {t('overview.quickstartTitle')}
              </CardTitle>
            </div>
          </CardHeader>
          <p className="meta-text">{t('overview.quickstartText')}</p>
          <div className="code-block">
            <code>curl -x http://127.0.0.1:8080 https://api.ipify.org</code>
            <button
              className="icon-btn"
              type="button"
              aria-label={t('actions.copyCurl')}
              title={t('actions.copyCurlTitle')}
              onClick={() =>
                void copy('curl -x http://127.0.0.1:8080 https://api.ipify.org')
              }
            >
              <Icon name="copy" />
            </button>
          </div>
          <ul className="bullet-list">
            <li>{t('overview.quickstartBulletLocal')}</li>
            <li>{t('overview.quickstartBulletRotate')}</li>
            <li>{t('overview.quickstartBulletApi')}</li>
          </ul>
        </Card>
      </div>

      <div className="split-grid">
        <Card render={<article />} aria-labelledby="recent-history-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.recentHistoryEyebrow')}</p>
              <CardTitle render={<h2 />} id="recent-history-title">
                {t('overview.recentHistoryTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Link className="text-link" to="/history">
                {t('overview.viewAll')}
              </Link>
            </CardAction>
          </CardHeader>
          {/* The compact table drops the ISP column on small screens. */}
          {recentHistory.length > 0 ? (
            <Table className="max-[640px]:[&_th:nth-child(3)]:hidden max-[640px]:[&_td:nth-child(3)]:hidden">
              <TableCaption className="visually-hidden">
                {t('overview.recentHistoryCaption')}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('history.colTime')}</TableHead>
                  <TableHead scope="col">{t('history.colNewIp')}</TableHead>
                  <TableHead scope="col">{t('history.colIsp')}</TableHead>
                  <TableHead scope="col">{t('history.colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <HistoryRows items={recentHistory} compact />
              </TableBody>
            </Table>
          ) : (
            <div className="empty-inline">
              <p>{t('overview.noHistory')}</p>
            </div>
          )}
        </Card>

        <Card render={<article />} aria-labelledby="recent-logs-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('overview.recentLogsEyebrow')}</p>
              <CardTitle render={<h2 />} id="recent-logs-title">
                {t('overview.recentLogsTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Link className="text-link" to="/logs">
                {t('overview.viewAll')}
              </Link>
            </CardAction>
          </CardHeader>
          <LogList items={recentLogs} compact ariaLabel={t('logs.recentAriaLabel')} />
          {recentLogs.length === 0 ? (
            <div className="empty-inline">
              <p>{t('overview.noLogs')}</p>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
