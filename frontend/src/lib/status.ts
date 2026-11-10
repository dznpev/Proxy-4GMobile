import type { DeviceInfo, HistoryItem, StatusResponse, Tone } from '../api/types';

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
  t?: (keyPath: string) => string,
): ToneLabel {
  const device = status?.device;
  const proxy = status?.proxy;
  if (device?.status === 'ready') {
    if (proxy?.running) {
      return {
        tone: 'success',
        label: t
          ? status?.app?.demo
            ? t('status.summary.proxyRunningDemo')
            : t('status.summary.proxyRunning')
          : status?.app?.demo
            ? 'Proxy đang chạy · DEMO'
            : 'Proxy đang chạy',
        icon: 'check',
      };
    }
    return {
      tone: 'warning',
      label: t ? t('status.summary.daemonStopped') : 'Daemon proxy đã dừng',
      icon: 'alert',
    };
  }
  if (device?.status === 'preparing') {
    return {
      tone: 'info',
      label: t ? t('status.summary.connecting') : 'Đang kết nối thiết bị…',
      icon: 'refresh',
    };
  }
  if (device?.status === 'unauthorized') {
    return {
      tone: 'danger',
      label: t ? t('status.summary.unauthorized') : 'Thiết bị chưa ủy quyền',
      icon: 'alert',
    };
  }
  if (device?.status === 'adb-missing') {
    return {
      tone: 'danger',
      label: t ? t('status.summary.adbMissing') : 'Không tìm thấy ADB',
      icon: 'alert',
    };
  }
  if (device?.status === 'error') {
    return {
      tone: 'danger',
      label: t ? t('status.summary.hardwareAttention') : 'Phần cứng cần chú ý',
      icon: 'alert',
    };
  }
  return {
    tone: 'warning',
    label: t ? t('status.summary.noDevice') : 'Chưa có thiết bị',
    icon: 'phone',
  };
}

export function historyStatusBadge(status: HistoryItem['status']): ToneLabel {
  return status === 'success'
    ? { tone: 'success', label: 'Thành công', icon: 'check' }
    : { tone: 'danger', label: 'Thất bại', icon: 'alert' };
}
