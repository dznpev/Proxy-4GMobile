import type {
  ActionResponse,
  CheckResponse,
  HistoryResponse,
  LogsResponse,
  RotateResponse,
  Settings,
  SettingsResponse,
  StatusResponse,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Translation key used when the client generated the message itself. */
  readonly fallbackKey?: string;

  constructor(message: string, status = 0, code = 'network_error', fallbackKey?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fallbackKey = fallbackKey;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeout?: number;
}

async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeout = 12_000 } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(path, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: unknown = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const errorPayload = payload as { error?: { message?: string; code?: string } } | null;
      const message = errorPayload?.error?.message ?? '';
      throw new ApiError(
        message,
        response.status,
        errorPayload?.error?.code ?? 'http_error',
        'errors.requestFailed',
      );
    }
    if (payload === null) {
      throw new ApiError('', response.status, 'invalid_json', 'errors.invalidJson');
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('', 0, 'timeout', 'errors.timeout');
    }
    throw new ApiError('', 0, 'network_error', 'errors.network');
  } finally {
    window.clearTimeout(timer);
  }
}

export const dashboardApi = {
  status: () => api<StatusResponse>('/api/status'),
  logs: (after = 0, limit = 500) =>
    api<LogsResponse>(`/api/logs?after=${encodeURIComponent(after)}&limit=${limit}`),
  history: () => api<HistoryResponse>('/api/history'),
  settings: () => api<SettingsResponse>('/api/settings'),
  rotate: () =>
    api<RotateResponse>('/api/rotate', { method: 'POST', body: {}, timeout: 15_000 }),
  check: () =>
    api<CheckResponse>('/api/check', { method: 'POST', body: {}, timeout: 25_000 }),
  saveSettings: (patch: Partial<Settings>) =>
    api<ActionResponse>('/api/settings', { method: 'POST', body: patch, timeout: 15_000 }),
  clearHistory: () => api<ActionResponse>('/api/history/clear', { method: 'POST', body: {} }),
  clearLogs: () => api<ActionResponse>('/api/logs/clear', { method: 'POST', body: {} }),
  resetUsage: () => api<ActionResponse>('/api/usage/reset', { method: 'POST', body: {} }),
  reconnect: () => api<ActionResponse>('/api/device/reconnect', { method: 'POST', body: {} }),
  setDeviceCharging: (enabled: boolean) =>
    api<{ ok: true; battery?: import('./types').BatteryInfo }>('/api/device/battery/charge', {
      method: 'POST',
      body: { enabled },
      timeout: 10_000,
    }),
  restartProxy: () => api<ActionResponse>('/api/proxy/restart', { method: 'POST', body: {} }),
};
