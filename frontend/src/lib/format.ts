import { translate } from './i18n';
import type { Locale } from '../locales/en';

/**
 * Formatters are plain functions called from render paths without access to
 * the React context, so the active locale is kept in module state and updated
 * by `I18nProvider` on every render.
 */
let activeLocale: Locale = 'en';

export function setFormatLocale(locale: Locale): void {
  activeLocale = locale;
}

function t(keyPath: string, params?: Record<string, string | number>): string {
  return translate(activeLocale, keyPath, params);
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const CLOCK_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const FORMATTERS: Record<
  Locale,
  {
    dateTime: Intl.DateTimeFormat;
    date: Intl.DateTimeFormat;
    clock: Intl.DateTimeFormat;
  }
> = {
  en: {
    dateTime: new Intl.DateTimeFormat('en-GB', DATE_TIME_OPTIONS),
    date: new Intl.DateTimeFormat('en-GB', DATE_OPTIONS),
    clock: new Intl.DateTimeFormat('en-GB', CLOCK_OPTIONS),
  },
  vi: {
    dateTime: new Intl.DateTimeFormat('vi-VN', DATE_TIME_OPTIONS),
    date: new Intl.DateTimeFormat('vi-VN', DATE_OPTIONS),
    clock: new Intl.DateTimeFormat('vi-VN', CLOCK_OPTIONS),
  },
};

export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return FORMATTERS[activeLocale].dateTime.format(new Date(Number(timestamp) * 1000));
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return FORMATTERS[activeLocale].date.format(new Date(Number(timestamp) * 1000));
}

export function formatClock(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return FORMATTERS[activeLocale].clock.format(new Date(Number(timestamp) * 1000));
}

export function formatRelative(
  timestamp: number | null | undefined,
  nowSeconds: number,
): string {
  if (!timestamp) return '—';
  const diff = Math.max(0, nowSeconds - Number(timestamp));
  if (diff < 5) return t('common.justNow');
  if (diff < 60) return t('common.secondsAgo', { count: Math.round(diff) });
  if (diff < 3600) return t('common.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86_400) return t('common.hoursAgo', { count: Math.floor(diff / 3600) });
  if (diff < 604_800) return t('common.daysAgo', { count: Math.floor(diff / 86_400) });
  return formatDate(timestamp);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const total = Math.max(0, Math.round(Number(seconds)));
  if (total < 60) return t('common.durationSeconds', { count: total });
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) {
    return rest
      ? t('common.durationMinutesSeconds', { minutes, seconds: rest })
      : t('common.durationMinutes', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes
      ? t('common.durationHoursMinutes', { hours, minutes: remainingMinutes })
      : t('common.durationHours', { hours });
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours
    ? t('common.durationDaysHours', { days, hours: remainingHours })
    : t('common.durationDays', { days });
}

export function formatLatency(milliseconds: number | null | undefined): string {
  if (milliseconds == null) return '—';
  const value = Number(milliseconds);
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)} ms`;
}

export function formatCountdown(
  timestamp: number | null | undefined,
  nowSeconds: number,
): string {
  if (!timestamp) return '—';
  const diff = Number(timestamp) - nowSeconds;
  if (diff <= 0) return t('common.countdownSoon');
  if (diff < 60) return t('common.countdownUnderMinute');
  if (diff < 3600) return t('common.countdownMinutes', { count: Math.ceil(diff / 60) });
  const hours = Math.floor(diff / 3600);
  const minutes = Math.ceil((diff % 3600) / 60);
  return minutes
    ? t('common.countdownHoursMinutes', { hours, minutes })
    : t('common.countdownHours', { hours });
}

export function formatLocation(network: {
  city?: string | null;
  country?: string | null;
}): string {
  const parts = [network.city, network.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export function formatEndpoint(url: string | null | undefined): string {
  return url || '—';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(Number(bytes)) || bytes === 0) return '0 B';
  const val = Number(bytes);
  if (val < 1024) return `${Math.round(val)} B`;
  if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB`;
  if (val < 1024 * 1024 * 1024) return `${(val / (1024 * 1024)).toFixed(1)} MB`;
  return `${(val / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
