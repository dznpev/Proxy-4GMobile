const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const clockFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return dateTimeFormatter.format(new Date(Number(timestamp) * 1000));
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return dateFormatter.format(new Date(Number(timestamp) * 1000));
}

export function formatClock(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return clockFormatter.format(new Date(Number(timestamp) * 1000));
}

export function formatRelative(
  timestamp: number | null | undefined,
  nowSeconds: number,
): string {
  if (!timestamp) return '—';
  const diff = Math.max(0, nowSeconds - Number(timestamp));
  if (diff < 5) return 'vừa xong';
  if (diff < 60) return `${Math.round(diff)} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604_800) return `${Math.floor(diff / 86_400)} ngày trước`;
  return formatDate(timestamp);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const total = Math.max(0, Math.round(Number(seconds)));
  if (total < 60) return `${total} giây`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days} ngày ${remainingHours} giờ` : `${days} ngày`;
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
  if (diff <= 0) return 'sắp tới';
  if (diff < 60) return 'dưới 1 phút';
  if (diff < 3600) return `${Math.ceil(diff / 60)} phút`;
  const hours = Math.floor(diff / 3600);
  const minutes = Math.ceil((diff % 3600) / 60);
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
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
