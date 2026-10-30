import type { Settings } from '../api/types';

export interface RouteMeta {
  title: string;
  eyebrow: string;
  documentTitle: string;
  icon: string;
}

export const ROUTES: Record<string, RouteMeta> = {
  overview: {
    title: 'Tổng quan',
    eyebrow: 'Bảng điều khiển',
    documentTitle: 'Tổng quan',
    icon: 'grid',
  },
  device: {
    title: 'Thiết bị',
    eyebrow: 'Phần cứng & ADB',
    documentTitle: 'Thiết bị',
    icon: 'phone',
  },
  history: {
    title: 'Lịch sử IP',
    eyebrow: 'Hoạt động xoay',
    documentTitle: 'Lịch sử IP',
    icon: 'history',
  },
  logs: {
    title: 'Nhật ký',
    eyebrow: 'Chẩn đoán',
    documentTitle: 'Nhật ký',
    icon: 'terminal',
  },
  settings: {
    title: 'Cài đặt',
    eyebrow: 'Cấu hình',
    documentTitle: 'Cài đặt',
    icon: 'settings',
  },
};

export const NAV_ITEMS = ['overview', 'device', 'history', 'logs', 'settings'] as const;

export const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Thủ công',
  auto: 'Tự động',
  legacy: 'Qua API',
};

export const DEVICE_STATUS_LABELS: Record<string, string> = {
  ready: 'Sẵn sàng',
  preparing: 'Đang kết nối',
  disconnected: 'Chưa kết nối',
  unauthorized: 'Chưa ủy quyền',
  'adb-missing': 'Thiếu ADB',
  error: 'Cần xử lý',
};

export const DEFAULT_SETTINGS: Settings = {
  auto_rotate_enabled: false,
  auto_rotate_interval_min: 30,
  rotate_method: 'airplane',
};

export const DEFAULT_SETTINGS_OPTIONS = {
  rotate_methods: ['airplane', 'data'],
  min_interval_min: 2,
  max_interval_min: 1440,
};

export const POLL_VISIBLE_MS = 2_500;
export const POLL_HIDDEN_MS = 10_000;
export const MAX_LOGS = 500;

export const TOAST_ICONS: Record<string, string> = {
  success: 'check',
  error: 'alert',
  warning: 'alert',
  info: 'wifi',
};
