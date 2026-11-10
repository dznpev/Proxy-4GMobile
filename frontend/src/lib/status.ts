import type { DeviceInfo, HistoryItem, StatusResponse, Tone } from '../api/types';

export type Translate = (
  keyPath: string,
  params?: Record<string, string | number>,
) => string;

export interface ToneLabel {
  tone: Tone;
  label: string;
  icon: string;
}

export function deviceTone(device: DeviceInfo | null | undefined): Tone {
  if (!device) return 'neutral';
  switch (device.status) {
    case 'ready':
      return 'success';
    case 'preparing':
      return 'info';
    case 'unauthorized':
    case 'adb-missing':
    case 'error':
      return 'danger';
    default:
      return 'warning';
  }
}

export function deviceNavState(device: DeviceInfo | null | undefined): string {
  if (!device) return 'off';
  if (device.status === 'ready') return 'on';
  if (device.status === 'preparing') return 'warn';
  if (['unauthorized', 'adb-missing', 'error'].includes(device.status)) return 'error';
  return 'off';
}

export function statusSummary(
  status: StatusResponse | null,
  t: Translate,
): ToneLabel {
  const device = status?.device;
  const proxy = status?.proxy;
  if (device?.status === 'ready') {
    if (proxy?.running) {
      return {
        tone: 'success',
        label: status?.app?.demo
          ? t('status.summary.proxyRunningDemo')
          : t('status.summary.proxyRunning'),
        icon: 'check',
      };
    }
    return {
      tone: 'warning',
      label: t('status.summary.daemonStopped'),
      icon: 'alert',
    };
  }
  if (device?.status === 'preparing') {
    return {
      tone: 'info',
      label: t('status.summary.connecting'),
      icon: 'refresh',
    };
  }
  if (device?.status === 'unauthorized') {
    return {
      tone: 'danger',
      label: t('status.summary.unauthorized'),
      icon: 'alert',
    };
  }
  if (device?.status === 'adb-missing') {
    return {
      tone: 'danger',
      label: t('status.summary.adbMissing'),
      icon: 'alert',
    };
  }
  if (device?.status === 'error') {
    return {
      tone: 'danger',
      label: t('status.summary.hardwareAttention'),
      icon: 'alert',
    };
  }
  return {
    tone: 'warning',
    label: t('status.summary.noDevice'),
    icon: 'phone',
  };
}

export function historyStatusBadge(
  status: HistoryItem['status'],
  t: Translate,
): ToneLabel {
  return status === 'success'
    ? { tone: 'success', label: t('common.success'), icon: 'check' }
    : { tone: 'danger', label: t('common.failed'), icon: 'alert' };
}
