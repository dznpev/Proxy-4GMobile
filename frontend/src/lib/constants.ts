import type { Settings } from '../api/types';

export interface RouteMeta {
  title: string;
  eyebrow: string;
  documentTitle: string;
  icon: string;
}

/**
 * Route metadata. The title/eyebrow values are English fallbacks; views
 * resolve `routes.<key>.title` / `routes.<key>.eyebrow` from the active
 * catalog first so every locale stays in sync.
 */
export const ROUTES: Record<string, RouteMeta> = {
  overview: {
    title: 'Overview',
    eyebrow: 'Dashboard',
    documentTitle: 'Overview',
    icon: 'grid',
  },
  device: {
    title: 'Device',
    eyebrow: 'Hardware & ADB',
    documentTitle: 'Device',
    icon: 'phone',
  },
  history: {
    title: 'IP History',
    eyebrow: 'Rotation activity',
    documentTitle: 'IP History',
    icon: 'history',
  },
  logs: {
    title: 'Logs',
    eyebrow: 'Diagnostics',
    documentTitle: 'Logs',
    icon: 'terminal',
  },
  settings: {
    title: 'Settings',
    eyebrow: 'Configuration',
    documentTitle: 'Settings',
    icon: 'settings',
  },
};

export const NAV_ITEMS = ['overview', 'device', 'history', 'logs', 'settings'] as const;

/** Translation keys for the rotation trigger values returned by the API. */
export const TRIGGER_LABEL_KEYS: Record<string, string> = {
  manual: 'status.triggers.manual',
  auto: 'status.triggers.auto',
  legacy: 'status.triggers.legacy',
  other: 'status.triggers.other',
};

/** Translation keys for the device status values returned by the API. */
export const DEVICE_STATUS_KEYS: Record<string, string> = {
  ready: 'status.device.ready',
  preparing: 'status.device.preparing',
  disconnected: 'status.device.disconnected',
  unauthorized: 'status.device.unauthorized',
  'adb-missing': 'status.device.adbMissing',
  error: 'status.device.error',
};

export const DEFAULT_SETTINGS: Settings = {
  auto_rotate_enabled: false,
  auto_rotate_interval_min: 30,
  rotate_method: 'airplane',
  daily_data_limit_gb: 4,
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
