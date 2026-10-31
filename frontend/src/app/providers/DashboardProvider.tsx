import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { dashboardApi } from '../../api/client';
import type {
  ActionResponse,
  HistoryItem,
  LogItem,
  RotationInfo,
  Settings,
  StatusResponse,
  Tone,
} from '../../api/types';
import { DEFAULT_SETTINGS, MAX_LOGS, POLL_HIDDEN_MS, POLL_VISIBLE_MS } from '../../lib/constants';
import { delay, errorMessage } from '../../lib/errors';
import { formatLatency } from '../../lib/format';
import { useConfirm } from './ConfirmProvider';
import { useToast } from './ToastProvider';

type ConnectionState = 'loading' | 'online' | 'offline';

export interface RotationTrace {
  id: string | null;
  lastStep: string | null;
}

export interface StatusSummary {
  tone: Tone;
  label: string;
}

interface DashboardContextValue {
  status: StatusResponse | null;
  connection: ConnectionState;
  statusError: string;
  now: number;
  logs: LogItem[];
  logsLoaded: boolean;
  history: HistoryItem[];
  historyLoaded: boolean;
  settings: Settings | null;
  rotationTrace: RotationTrace;
  refreshing: boolean;
  rotatePending: boolean;
  checking: boolean;
  reconnecting: boolean;
  restarting: boolean;
  togglingCharging: boolean;
  clearingHistory: boolean;
  clearingLogs: boolean;
  resettingUsage: boolean;
  autoPending: boolean;
  refreshAll: (options?: { spinner?: boolean }) => Promise<void>;
  startRotation: () => Promise<void>;
  checkConnection: () => Promise<void>;
  reconnectDevice: () => Promise<void>;
  setDeviceCharging: (enabled: boolean) => Promise<void>;
  restartProxy: () => Promise<void>;
  clearHistory: () => Promise<void>;
  clearLogs: () => Promise<void>;
  resetUsage: () => Promise<void>;
  toggleAutoRotate: (next: boolean) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<ActionResponse>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const { confirmAction } = useConfirm();
  const location = useLocation();
  const route = location.pathname.replace(/^\//, '') || 'overview';

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('loading');
  const [statusError, setStatusError] = useState('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rotationTrace, setRotationTrace] = useState<RotationTrace>({
    id: null,
    lastStep: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [rotatePending, setRotatePending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [togglingCharging, setTogglingCharging] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [resettingUsage, setResettingUsage] = useState(false);
  const [autoPending, setAutoPending] = useState(false);

  const clockOffsetRef = useRef(0);
  const statusRef = useRef<StatusResponse | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const logsRef = useRef<LogItem[]>([]);
  const historyRef = useRef<HistoryItem[]>([]);
  const logLastIdRef = useRef(0);
  const statusPromiseRef = useRef<Promise<boolean> | null>(null);
  const logsPromiseRef = useRef<Promise<boolean> | null>(null);
  const statusErrorRef = useRef('');
  const routeRef = useRef(route);
  const previousRouteRef = useRef<string | null>(null);
  const statusCountRef = useRef(0);
  const rotationIdRef = useRef<string | null>(null);
  const rotationStatusRef = useRef<string | null>(null);
  const rotationWasRunningRef = useRef(false);
  const rotatePendingRef = useRef(false);
  const autoPendingRef = useRef(false);
  const demoToastShownRef = useRef(false);
  const initialisedRef = useRef(false);
  const logsLoadedRef = useRef(false);
  const historyLoadedRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    logsLoadedRef.current = logsLoaded;
  }, [logsLoaded]);

  useEffect(() => {
    historyLoadedRef.current = historyLoaded;
  }, [historyLoaded]);

  const loadLogs = useCallback(
    async ({ reset = false, silent = false }: { reset?: boolean; silent?: boolean } = {}) => {
      if (logsPromiseRef.current) return logsPromiseRef.current;
      const after = reset ? 0 : logLastIdRef.current;

      const promise = (async () => {
        try {
          const payload = await dashboardApi.logs(after, MAX_LOGS);
          const items = Array.isArray(payload.items) ? payload.items : [];

          if (reset) {
            const next = items.slice(-MAX_LOGS);
            logsRef.current = next;
            setLogs(next);
            logLastIdRef.current = Number(payload.last_id) || 0;
          } else {
            const known = new Set(logsRef.current.map((item) => item.id));
            const merged = [...logsRef.current];
            items.forEach((item) => {
              if (!known.has(item.id)) merged.push(item);
            });
            merged.sort((a, b) => Number(a.id) - Number(b.id));
            const next = merged.slice(-MAX_LOGS);
            logsRef.current = next;
            setLogs(next);
            logLastIdRef.current = Math.max(
              logLastIdRef.current,
              Number(payload.last_id) || 0,
            );
          }

          logsLoadedRef.current = true;
          setLogsLoaded(true);
          return true;
        } catch (error) {
          if (!silent) {
            showToast('error', 'Không tải được nhật ký', errorMessage(error));
          }
          return false;
        } finally {
          logsPromiseRef.current = null;
        }
      })();

      logsPromiseRef.current = promise;
      return promise;
    },
    [showToast],
  );

  const loadHistory = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      try {
        const payload = await dashboardApi.history();
        const next = Array.isArray(payload.items) ? payload.items : [];
        historyRef.current = next;
        setHistory(next);
        historyLoadedRef.current = true;
        setHistoryLoaded(true);
        return true;
      } catch (error) {
        if (!silent) {
          showToast('error', 'Không tải được lịch sử', errorMessage(error));
        }
        return false;
      }
    },
    [showToast],
  );

  const loadSettings = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      try {
        const payload = await dashboardApi.settings();
        if (payload.settings) {
          settingsRef.current = payload.settings;
          setSettings(payload.settings);
        }
        return true;
      } catch (error) {
        if (!silent) {
          showToast('error', 'Không tải được cài đặt', errorMessage(error));
        }
        return false;
      }
    },
    [showToast],
  );

  const watchRotation = useCallback(
    (rotation: RotationInfo) => {
      statusCountRef.current += 1;
      if (!rotation?.id) return;

      const previousId = rotationIdRef.current;
      const previousStatus = rotationStatusRef.current;
      const wasRunning = rotationWasRunningRef.current;

      rotationIdRef.current = rotation.id;
      rotationStatusRef.current = rotation.status;

      if (rotation.running) {
        rotationWasRunningRef.current = true;
        setRotationTrace({ id: rotation.id, lastStep: rotation.step });
        if (rotatePendingRef.current) {
          rotatePendingRef.current = false;
          setRotatePending(false);
        }
        return;
      }

      if (statusCountRef.current <= 1) {
        rotationWasRunningRef.current = false;
        return;
      }

      const finished = rotation.status === 'success' || rotation.status === 'failed';
      const isNewJob = previousId !== rotation.id;
      const changedToFinished = previousStatus !== rotation.status && finished;
      const shouldAnnounce =
        finished && (wasRunning || isNewJob || changedToFinished || rotatePendingRef.current);

      rotationWasRunningRef.current = false;
      if (finished) {
        rotatePendingRef.current = false;
        setRotatePending(false);
      }

      if (!shouldAnnounce) return;

      if (rotation.status === 'success') {
        const changed = rotation.changed;
        showToast(
          'success',
          changed === false ? 'Xoay IP hoàn tất' : 'Đã xoay IP thành công',
          rotation.message || `IP mới: ${rotation.new_ip || '—'}`,
          7000,
        );
      } else {
        showToast(
          'error',
          'Xoay IP thất bại',
          rotation.message || 'Kiểm tra nhật ký để biết chi tiết.',
          8000,
        );
      }
      void loadHistory({ silent: true });
    },
    [loadHistory, showToast],
  );

  const handleServiceDown = useCallback((error: unknown) => {
    const message = errorMessage(error, 'Không kết nối được dịch vụ điều khiển.');
    statusErrorRef.current = message;
    setStatusError(message);
    setConnection('offline');
  }, []);

  const applyStatus = useCallback(
    (payload: StatusResponse) => {
      statusRef.current = payload;
      setStatus(payload);
      setConnection('online');
      statusErrorRef.current = '';
      setStatusError('');

      if (Number.isFinite(Number(payload?.server_time))) {
        clockOffsetRef.current = Number(payload.server_time) - Date.now() / 1000;
      }

      if (payload.settings) {
        settingsRef.current = payload.settings;
        setSettings(payload.settings);
      }

      watchRotation(payload.rotation);

      if (payload.app?.demo && !demoToastShownRef.current) {
        demoToastShownRef.current = true;
        showToast(
          'info',
          'Đang chạy chế độ DEMO',
          'Thiết bị và IP được mô phỏng, không kết nối điện thoại thật.',
          8000,
        );
      }
    },
    [showToast, watchRotation],
  );

  const loadStatus = useCallback(async () => {
    if (statusPromiseRef.current) return statusPromiseRef.current;

    const promise = (async () => {
      try {
        const payload = await dashboardApi.status();
        applyStatus(payload);
        return true;
      } catch (error) {
        handleServiceDown(error);
        return false;
      } finally {
        statusPromiseRef.current = null;
      }
    })();

    statusPromiseRef.current = promise;
    return promise;
  }, [applyStatus, handleServiceDown]);

  const refreshAll = useCallback(
    async ({ spinner = false }: { spinner?: boolean } = {}) => {
      if (spinner) setRefreshing(true);
      try {
        const ok = await loadStatus();
        const tasks: Array<Promise<boolean>> = [loadLogs({ silent: true })];
        if (routeRef.current === 'history') tasks.push(loadHistory({ silent: true }));
        if (routeRef.current === 'settings') tasks.push(loadSettings({ silent: true }));
        await Promise.allSettled(tasks);

        if (spinner && !ok) {
          showToast(
            'error',
            'Không làm mới được trạng thái',
            statusErrorRef.current || 'Kiểm tra kết nối dịch vụ.',
          );
        }
      } finally {
        if (spinner) setRefreshing(false);
      }
    },
    [loadHistory, loadLogs, loadSettings, loadStatus, showToast],
  );

  const startRotation = useCallback(async () => {
    if (rotatePendingRef.current) return;
    if (!statusRef.current?.device?.connected) {
      showToast(
        'warning',
        'Chưa có thiết bị',
        'Kết nối thiết bị Android trước khi xoay IP.',
      );
      return;
    }

    rotatePendingRef.current = true;
    setRotatePending(true);
    try {
      const response = await dashboardApi.rotate();
      if (response?.rotation) {
        setStatus((current) =>
          current ? { ...current, rotation: response.rotation } : current,
        );
      }
      showToast('info', 'Đã bắt đầu xoay IP', 'Tiến trình thường mất 10–25 giây.');
      await loadStatus();
      void loadLogs({ silent: true });
    } catch (error) {
      showToast('error', 'Không xoay được IP', errorMessage(error));
    } finally {
      rotatePendingRef.current = false;
      setRotatePending(false);
    }
  }, [loadLogs, loadStatus, showToast]);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const response = await dashboardApi.check();
      if (response.status) applyStatus(response.status);
      showToast(
        'success',
        'Đã kiểm tra kết nối',
        `${response.status?.network?.ip || '—'} · ${formatLatency(
          response.status?.network?.latency_ms,
        )}`,
      );
      void loadLogs({ silent: true });
    } catch (error) {
      showToast('error', 'Không kiểm tra được kết nối', errorMessage(error));
    } finally {
      setChecking(false);
    }
  }, [applyStatus, loadLogs, showToast]);

  const reconnectDevice = useCallback(async () => {
    setReconnecting(true);
    try {
      const response = await dashboardApi.reconnect();
      showToast(
        'info',
        'Đang kết nối lại thiết bị',
        response.message || 'Quá trình mất vài giây.',
      );
      await delay(900);
      await loadStatus();
      void loadLogs({ silent: true });
    } catch (error) {
      showToast('error', 'Không kết nối lại được thiết bị', errorMessage(error));
    } finally {
      setReconnecting(false);
    }
  }, [loadLogs, loadStatus, showToast]);

  const setDeviceCharging = useCallback(
    async (enabled: boolean) => {
      setTogglingCharging(true);
      try {
        await dashboardApi.setDeviceCharging(enabled);
        showToast(
          enabled ? 'success' : 'warning',
          enabled ? 'Đã bật lại sạc pin' : 'Đã ngắt sạc pin tạm thời',
          enabled
            ? 'Thiết bị tiếp tục nhận nguồn sạc.'
            : 'Đang ngắt sạc để bảo vệ pin tránh quá nhiệt.',
        );
        await loadStatus();
        void loadLogs({ silent: true });
      } catch (error) {
        showToast('error', 'Không điều khiển được sạc pin', errorMessage(error));
      } finally {
        setTogglingCharging(false);
      }
    },
    [loadLogs, loadStatus, showToast],
  );

  const restartProxy = useCallback(async () => {
    const confirmed = await confirmAction({
      title: 'Khởi động lại daemon proxy?',
      description:
        'Các kết nối đang dùng proxy có thể bị gián đoạn trong vài giây. Thiết bị vẫn được giữ kết nối.',
      confirmLabel: 'Khởi động lại',
      tone: 'danger',
    });
    if (!confirmed) return;

    setRestarting(true);
    try {
      const response = await dashboardApi.restartProxy();
      showToast(
        'info',
        'Đang khởi động lại daemon',
        response.message || 'Vui lòng chờ vài giây.',
      );
      await delay(1200);
      await loadStatus();
      void loadLogs({ silent: true });
    } catch (error) {
      showToast('error', 'Không khởi động lại được daemon', errorMessage(error));
    } finally {
      setRestarting(false);
    }
  }, [confirmAction, loadLogs, loadStatus, showToast]);

  const clearHistory = useCallback(async () => {
    const count = historyRef.current.length;
    if (!count) return;

    const confirmed = await confirmAction({
      title: 'Xóa toàn bộ lịch sử xoay IP?',
      description: `Sẽ xóa ${count} bản ghi trên máy tính. Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa lịch sử',
      tone: 'danger',
    });
    if (!confirmed) return;

    setClearingHistory(true);
    try {
      await dashboardApi.clearHistory();
      historyRef.current = [];
      setHistory([]);
      historyLoadedRef.current = true;
      setHistoryLoaded(true);
      showToast('success', 'Đã xóa lịch sử', 'Các lần xoay IP trước đây đã được xóa.');
      await loadStatus();
      void loadLogs({ silent: true });
    } catch (error) {
      showToast('error', 'Không xóa được lịch sử', errorMessage(error));
    } finally {
      setClearingHistory(false);
    }
  }, [confirmAction, loadLogs, loadStatus, showToast]);

  const clearLogs = useCallback(async () => {
    const confirmed = await confirmAction({
      title: 'Xóa toàn bộ nhật ký?',
      description:
        'Nhật ký hoạt động cục bộ sẽ bị xóa. Lịch sử xoay IP và cài đặt được giữ nguyên.',
      confirmLabel: 'Xóa nhật ký',
      tone: 'danger',
    });
    if (!confirmed) return;

    setClearingLogs(true);
    try {
      const response = await dashboardApi.clearLogs();
      logsRef.current = [];
      setLogs([]);
      logsLoadedRef.current = false;
      setLogsLoaded(false);
      logLastIdRef.current = Math.max(0, (Number(response.last_id) || 1) - 1);
      await loadLogs({ reset: true });
      showToast('success', 'Đã xóa nhật ký', 'Nhật ký mới sẽ bắt đầu từ bây giờ.');
    } catch (error) {
      showToast('error', 'Không xóa được nhật ký', errorMessage(error));
    } finally {
      setClearingLogs(false);
    }
  }, [confirmAction, loadLogs, showToast]);

  const resetUsage = useCallback(async () => {
    const confirmed = await confirmAction({
      title: 'Đặt lại thống kê data 4G hôm nay?',
      description:
        'Bộ đếm lưu lượng nhận và gửi trong ngày sẽ được đặt về 0. Cài đặt giới hạn gói cước được giữ nguyên.',
      confirmLabel: 'Đặt lại',
      tone: 'danger',
    });
    if (!confirmed) return;

    setResettingUsage(true);
    try {
      await dashboardApi.resetUsage();
      await loadStatus();
      showToast('success', 'Đã đặt lại dữ liệu 4G', 'Bộ đếm lưu lượng hôm nay đã được đặt lại.');
      void loadLogs({ silent: true });
    } catch (error) {
      showToast('error', 'Không đặt lại được dung lượng', errorMessage(error));
    } finally {
      setResettingUsage(false);
    }
  }, [confirmAction, loadLogs, loadStatus, showToast]);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    const response = await dashboardApi.saveSettings(patch);
    const next: Settings = response.settings ?? {
      ...(settingsRef.current ?? DEFAULT_SETTINGS),
      ...patch,
    };
    settingsRef.current = next;
    setSettings(next);
    setStatus((current) => {
      if (!current) return current;
      const updated: StatusResponse = {
        ...current,
        settings: next,
        auto_rotate: response.auto_rotate ?? current.auto_rotate,
      };
      statusRef.current = updated;
      return updated;
    });
    return response;
  }, []);

  const toggleAutoRotate = useCallback(
    async (next: boolean) => {
      if (autoPendingRef.current) return;
      autoPendingRef.current = true;
      setAutoPending(true);
      try {
        const response = await saveSettings({ auto_rotate_enabled: next });
        const interval =
          response.settings?.auto_rotate_interval_min ??
          settingsRef.current?.auto_rotate_interval_min ??
          30;
        showToast(
          'success',
          next ? 'Đã bật xoay IP tự động' : 'Đã tắt xoay IP tự động',
          next ? `Chu kỳ ${interval} phút.` : 'Lịch tự động đã dừng.',
        );
        await loadStatus();
      } catch (error) {
        showToast('error', 'Không đổi được lịch tự động', errorMessage(error));
      } finally {
        autoPendingRef.current = false;
        setAutoPending(false);
      }
    },
    [loadStatus, saveSettings, showToast],
  );

  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    void loadStatus();
    void loadLogs({ reset: true });
  }, [loadLogs, loadStatus]);

  useEffect(() => {
    const previous = previousRouteRef.current;
    previousRouteRef.current = route;
    if (previous === route) return;

    if (route === 'history' && !historyLoadedRef.current) void loadHistory();
    if (route === 'logs' && !logsLoadedRef.current) void loadLogs({ reset: true });
    if (route === 'settings') void loadSettings();
  }, [loadHistory, loadLogs, loadSettings, route]);

  useEffect(() => {
    let timer: number | null = null;
    let inFlight = false;
    let disposed = false;

    const schedule = (delayMs: number) => {
      if (timer !== null) window.clearTimeout(timer);
      if (disposed) return;
      timer = window.setTimeout(() => {
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (inFlight) return;
      inFlight = true;
      try {
        await loadStatus();
        await loadLogs({ silent: true });
      } finally {
        inFlight = false;
        schedule(document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) schedule(POLL_HIDDEN_MS);
      else void tick();
    };
    const onOnline = () => {
      void tick();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    schedule(POLL_VISIBLE_MS);

    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [loadLogs, loadStatus]);

  const now = Date.now() / 1000 + clockOffsetRef.current;

  const value = useMemo<DashboardContextValue>(
    () => ({
      status,
      connection,
      statusError,
      now,
      logs,
      logsLoaded,
      history,
      historyLoaded,
      settings,
      rotationTrace,
      refreshing,
      rotatePending,
      checking,
      reconnecting,
      restarting,
      togglingCharging,
      clearingHistory,
      clearingLogs,
      resettingUsage,
      autoPending,
      refreshAll,
      startRotation,
      checkConnection,
      reconnectDevice,
      setDeviceCharging,
      restartProxy,
      clearHistory,
      clearLogs,
      resetUsage,
      toggleAutoRotate,
      saveSettings,
    }),
    [
      autoPending,
      checking,
      clearHistory,
      clearLogs,
      clearingHistory,
      clearingLogs,
      connection,
      history,
      historyLoaded,
      logs,
      logsLoaded,
      now,
      reconnectDevice,
      refreshing,
      resetUsage,
      resettingUsage,
      restartProxy,
      restarting,
      rotatePending,
      rotationTrace,
      saveSettings,
      setDeviceCharging,
      settings,
      startRotation,
      status,
      statusError,
      toggleAutoRotate,
      togglingCharging,
      checkConnection,
      refreshAll,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard must be used inside DashboardProvider');
  return value;
}
