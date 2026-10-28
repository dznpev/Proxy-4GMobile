export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type DeviceStatus =
  | 'ready'
  | 'preparing'
  | 'disconnected'
  | 'unauthorized'
  | 'adb-missing'
  | 'error'
  | string;

export interface AppInfo {
  name: string;
  version: string;
  demo: boolean;
  adb_available: boolean;
  dashboard_url: string;
  proxy_url: string;
  data_dir: string;
  control_port: number;
  proxy_port: number;
  uptime_sec: number;
}

export interface DeviceInfo {
  connected: boolean;
  serial: string | null;
  status: DeviceStatus;
  model: string | null;
  android: string | null;
  abi: string | null;
  daemon_running: boolean;
  forwarded: boolean;
  since: number | null;
  last_seen: number | null;
  last_attempt: number | null;
  error: string | null;
}

export interface ProxyInfo {
  running: boolean;
  forwarded: boolean;
  port: number;
  url: string;
}

export type NetworkState =
  | 'unknown'
  | 'checking'
  | 'rotating'
  | 'online'
  | 'error'
  | 'offline'
  | string;

export interface NetworkInfo {
  state: NetworkState;
  ip: string | null;
  isp: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latency_ms: number | null;
  checked_at: number | null;
  error: string | null;
}

export type RotationStatus = 'idle' | 'running' | 'success' | 'failed' | string;

export interface RotationInfo {
  id: string | null;
  status: RotationStatus;
  step: string;
  progress: number;
  message: string;
  trigger: string | null;
  running: boolean;
  started_at: number | null;
  finished_at: number | null;
  duration_sec: number | null;
  old_ip: string | null;
  new_ip: string | null;
  changed: boolean | null;
}

export type RotateMethod = 'airplane' | 'data';

export interface Settings {
  auto_rotate_enabled: boolean;
  auto_rotate_interval_min: number;
  rotate_method: RotateMethod;
}

export interface AutoRotateInfo {
  enabled: boolean;
  interval_min: number;
  next_at: number | null;
}

export interface Stats {
  total: number;
  success: number;
  failed: number;
  success_rate: number | null;
  today: number;
  last_rotation_at: number | null;
  session_uptime_sec: number;
  app_uptime_sec: number;
}

export interface HistoryItem {
  id?: string;
  ts: number;
  trigger: string;
  status: 'success' | 'failed';
  old_ip: string | null;
  new_ip: string | null;
  isp: string | null;
  city: string | null;
  duration_sec: number | null;
  message?: string;
  changed?: boolean;
}

export interface StatusResponse {
  app: AppInfo;
  device: DeviceInfo;
  proxy: ProxyInfo;
  network: NetworkInfo;
  rotation: RotationInfo;
  auto_rotate: AutoRotateInfo;
  settings: Settings;
  stats: Stats;
  history: HistoryItem[];
  server_time: number;
}

export type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error' | string;

export interface LogItem {
  id: number;
  ts: number;
  time: string;
  level: LogLevel;
  source: string;
  message: string;
}

export interface LogsResponse {
  items: LogItem[];
  last_id: number;
}

export interface HistoryResponse {
  items: HistoryItem[];
  stats: Stats;
}

export interface SettingsOptions {
  rotate_methods: string[];
  min_interval_min: number;
  max_interval_min: number;
}

export interface SettingsResponse {
  settings: Settings;
  auto_rotate: AutoRotateInfo;
  options: SettingsOptions;
}

export interface RotateResponse {
  ok: true;
  rotation: RotationInfo;
}

export interface CheckResponse {
  ok: true;
  status: StatusResponse;
}

export interface ActionResponse {
  ok: true;
  message?: string;
  stats?: Stats;
  last_id?: number;
  settings?: Settings;
  auto_rotate?: AutoRotateInfo;
  options?: SettingsOptions;
}
