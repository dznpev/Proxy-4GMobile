import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RotationInfo, Tone } from '../api/types';
import { Icon } from '../components/Icon';
import { Badge } from '../components/ui/Badge';
import { HistoryRows } from '../components/data/HistoryRows';
import { LogList } from '../components/data/LogList';
import { useDashboard } from '../app/providers/DashboardProvider';
import { useCopy } from '../app/hooks/useCopy';
import { DEVICE_STATUS_LABELS } from '../lib/constants';
import {
  formatClock,
  formatCountdown,
  formatDuration,
  formatLatency,
  formatLocation,
  formatRelative,
} from '../lib/format';

const ROTATION_STEPS = ['preparing', 'network-off', 'network-on', 'verifying'] as const;

const STEP_LABELS: Record<string, string> = {
  preparing: 'Bước 1/4 · Chuẩn bị',
  'network-off': 'Bước 2/4 · Ngắt mạng',
  'network-on': 'Bước 3/4 · Kết nối lại',
  waiting: 'Bước 3/4 · Chờ nhà mạng cấp IP',
  verifying: 'Bước 4/4 · Xác minh IP',
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
  const copy = useCopy();
  const [autoChoice, setAutoChoice] = useState<boolean | null>(null);

  const app = status?.app;
  const device = status?.device;
  const proxy = status?.proxy;
  const network = status?.network;
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
    label: 'Chưa kết nối',
    icon: 'alert',
  };
  if (device) {
    if (device.status === 'ready' && proxy?.running) {
      session = { tone: 'success', label: 'Đang hoạt động', icon: 'check' };
    } else if (device.status === 'ready') {
      session = { tone: 'warning', label: 'Daemon đã dừng', icon: 'alert' };
    } else if (device.status === 'preparing') {
      session = { tone: 'info', label: 'Đang kết nối', icon: 'refresh' };
    } else if (['unauthorized', 'adb-missing', 'error'].includes(device.status)) {
      session = { tone: 'danger', label: 'Cần xử lý', icon: 'alert' };
    } else {
      session = { tone: 'neutral', label: 'Chưa kết nối', icon: 'phone' };
    }
  }

  const ip = network?.ip || '—';
  const isp = network?.isp || '—';
  const location = network ? formatLocation(network) : '—';
  const proxyUrl = app?.proxy_url || proxy?.url || 'http://127.0.0.1:8080';

  let checked = 'Chưa kiểm tra kết nối';
  if (rotating) checked = 'Đang chờ IP mới sau khi xoay…';
  else if (checkingNetwork) checked = 'Đang kiểm tra kết nối…';
  else if (onlineNetwork && network?.checked_at) {
    checked = `Cập nhật ${formatRelative(network.checked_at, now)} · ${formatClock(
      network.checked_at,
    )}`;
  } else if (network?.state === 'error' && network.error) {
    checked = network.error;
  } else if (network?.state === 'offline') {
    checked = 'Thiết bị đã ngắt kết nối.';
  }

  let ipHint = 'Chưa có kết nối';
  if (rotating) ipHint = 'Đang chờ nhà mạng cấp IP mới';
  else if (checkingNetwork) ipHint = 'Đang kiểm tra…';
  else if (onlineNetwork && network?.checked_at) {
    ipHint = `Cập nhật ${formatRelative(network.checked_at, now)}`;
  } else if (network?.state === 'error') ipHint = 'Không xác minh được IP';

  let ispHint = 'Chưa xác định';
  if (network?.country) {
    ispHint = [network.country, network.region].filter(Boolean).join(' · ');
  } else if (onlineNetwork) {
    ispHint = 'Đã kết nối Internet';
  }

  const uptime = Number(stats?.session_uptime_sec) || 0;
  let uptimeHint = 'Chưa kết nối thiết bị';
  if (device?.since) uptimeHint = `Kết nối từ ${formatClock(device.since)}`;
  else if (device?.status === 'preparing') uptimeHint = 'Đang thiết lập phiên proxy';
  else if (rotationRunning) uptimeHint = 'Phiên đang được làm mới';

  const total = Number(stats?.total) || 0;
  const success = Number(stats?.success) || 0;
  const rate = stats?.success_rate;

  const canRotate = Boolean(
    device?.connected && device?.daemon_running && !rotationRunning && !rotatePending,
  );
  const rotateDisabledReason = rotationRunning
    ? 'Đang xoay IP, vui lòng chờ.'
    : !device?.connected
      ? 'Cần kết nối thiết bị trước khi xoay IP.'
      : !device?.daemon_running
        ? 'Daemon proxy chưa chạy. Hãy kết nối lại thiết bị.'
        : '';

  const stepClasses = rotationStepClasses(rotation, rotationTrace.id, rotationTrace.lastStep);

  let rotateStatus = 'Sẵn sàng xoay IP';
  if (rotationRunning) rotateStatus = rotation?.message || 'Đang xoay IP…';
  else if (rotationSucceeded) rotateStatus = rotation?.message || 'Đã xoay IP thành công';
  else if (rotationFailed && !rotationRunning) {
    rotateStatus = rotation?.message || 'Xoay IP thất bại';
  }

  let rotateDetail = 'IP mới được xác minh sau khi kết nối lại 4G.';
  if (rotationRunning) {
    const stepLabel = STEP_LABELS[rotation?.step ?? ''] || 'Đang xử lý';
    rotateDetail = `${stepLabel} · ${Math.round(progress)}%`;
  } else if (rotationSucceeded) {
    const from = rotation?.old_ip || '—';
    const to = rotation?.new_ip || '—';
    rotateDetail = `${from} → ${to} · ${formatDuration(rotation?.duration_sec)}`;
  } else if (rotationFailed && !rotationRunning) {
    rotateDetail =
      rotation?.duration_sec != null
        ? `Dừng sau ${formatDuration(rotation.duration_sec)}.`
        : 'Kiểm tra nhật ký để biết chi tiết.';
  }

  const autoEnabled = Boolean(auto?.enabled ?? status?.settings?.auto_rotate_enabled ?? false);
  const autoInterval = Number(
    auto?.interval_min ?? status?.settings?.auto_rotate_interval_min ?? 30,
  );
  const autoNextAt = auto?.next_at ?? null;
  const deviceConnected = Boolean(device?.connected);

  let autoNextInline = 'Đang tắt';
  if (autoEnabled) {
    if (autoNextAt) {
      autoNextInline = `Sau ${formatCountdown(autoNextAt, now)} · ${formatClock(autoNextAt)}`;
    } else if (!deviceConnected) {
      autoNextInline = 'Chờ thiết bị kết nối';
    } else {
      autoNextInline = 'Đang lên lịch…';
    }
  }

  let autoNextSummary = 'Tự động: đang tắt';
  if (autoEnabled) {
    autoNextSummary = autoNextAt
      ? `Tự động: lần tới sau ${formatCountdown(autoNextAt, now)}`
      : 'Tự động: chờ thiết bị kết nối';
  }

  const autoChecked = autoChoice ?? autoEnabled;
  const autoBusy = autoPending || autoChoice !== null;

  const handleAutoToggle = async (checked: boolean) => {
    setAutoChoice(checked);
    await toggleAutoRotate(checked);
    setAutoChoice(null);
  };

  const ready = device?.status === 'ready';
  let deviceSub = 'Cắm cáp USB và bật gỡ lỗi USB';
  if (ready) {
    const details = [
      device.android ? `Android ${device.android}` : null,
      device.abi,
    ].filter(Boolean);
    deviceSub = details.join(' · ') || 'Thiết bị đã sẵn sàng';
  } else if (device?.status === 'preparing') {
    deviceSub = 'Đang đồng bộ daemon proxy…';
  } else if (device?.error) {
    deviceSub = device.error;
  }

  const deviceConnectionLabel = ready
    ? proxy?.forwarded
      ? 'USB · đã forward cổng'
      : 'USB · chưa forward'
    : DEVICE_STATUS_LABELS[device?.status ?? ''] || 'Chưa kết nối';

  const reconnectDisabled =
    !device?.serial || device?.status === 'preparing' || rotationRunning || reconnecting;
  const reconnectTitle = rotationRunning
    ? 'Đang xoay IP, vui lòng chờ hoàn tất.'
    : reconnectDisabled
      ? 'Cần phát hiện thiết bị trước khi kết nối lại.'
      : '';

  const recentHistory = (status?.history ?? []).slice(0, 5);
  const recentLogs = logs.slice(-6);

  return (
    <section className="page" data-page="overview" aria-labelledby="page-title">
      <div className="page-lead">
        <p className="page-lead-text">
          Theo dõi phiên proxy 4G, xoay IP và xử lý sự cố thiết bị từ một nơi.
        </p>
        <p className="meta-text" id="last-updated">
          {status ? `Cập nhật ${formatClock(now)}` : 'Đang tải trạng thái…'}
        </p>
      </div>

      <div className="hero-grid">
        <article className="card status-card" aria-labelledby="session-title">
          <header className="card-head">
            <div>
              <p className="eyebrow">Kết nối</p>
              <h2 id="session-title">Phiên proxy</h2>
            </div>
            <Badge tone={session.tone} label={session.label} icon={session.icon} />
          </header>

          <div className="endpoint-row">
            <div className="endpoint-copy">
              <span className="endpoint-label">HTTP proxy</span>
              <code>{proxyUrl}</code>
            </div>
            <button
              className="icon-btn"
              type="button"
              aria-label="Sao chép địa chỉ proxy"
              title="Sao chép địa chỉ proxy"
              onClick={() => void copy(proxyUrl)}
            >
              <Icon name="copy" />
            </button>
          </div>

          <dl className="meta-grid">
            <div className="meta-item">
              <dt>IP công khai</dt>
              <dd className="mono">{ip}</dd>
            </div>
            <div className="meta-item">
              <dt>Nhà mạng</dt>
              <dd>{isp}</dd>
            </div>
            <div className="meta-item">
              <dt>Vị trí</dt>
              <dd>{location}</dd>
            </div>
            <div className="meta-item">
              <dt>Độ trễ</dt>
              <dd>{formatLatency(network?.latency_ms)}</dd>
            </div>
          </dl>

          <footer className="card-foot">
            <span className="meta-text">{checked}</span>
            <button
              className={`btn btn-ghost btn-sm${checking ? ' is-loading' : ''}`}
              type="button"
              aria-label="Kiểm tra lại kết nối"
              aria-busy={checking ? 'true' : 'false'}
              disabled={!device?.connected || rotating || checking}
              title={
                rotating
                  ? 'Đang xoay IP, không thể kiểm tra lúc này.'
                  : !device?.connected
                    ? 'Cần kết nối thiết bị trước khi kiểm tra.'
                    : ''
              }
              onClick={() => void checkConnection()}
            >
              <Icon name="wifi" />
              <span>Kiểm tra lại</span>
            </button>
          </footer>
        </article>

        <article
          className={`card rotate-card${rotationRunning ? ' is-running' : ''}${
            rotationSucceeded ? ' is-success' : ''
          }${rotationFailed && !rotationRunning ? ' is-error' : ''}`}
          aria-labelledby="rotate-title"
        >
          <header className="card-head">
            <div>
              <p className="eyebrow">Đổi IP</p>
              <h2 id="rotate-title">Xoay IP</h2>
            </div>
            <Badge
              tone={autoEnabled ? 'success' : 'neutral'}
              label={autoEnabled ? 'Tự động bật' : 'Tự động tắt'}
            />
          </header>

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

          <ol className="steps" aria-label="Tiến trình xoay IP">
            {ROTATION_STEPS.map((step, index) => (
              <li key={step} className={stepClasses[index]} data-step={step}>
                <span className="step-dot">{index + 1}</span>
                <span>{['Chuẩn bị', 'Ngắt mạng', 'Kết nối lại', 'Xác minh'][index]}</span>
              </li>
            ))}
          </ol>

          <progress
            className={`progress${rotationSucceeded ? ' is-success' : ''}${
              rotationFailed ? ' is-error' : ''
            }`}
            max={100}
            value={progress}
            aria-label="Tiến độ xoay IP"
          >
            {Math.round(progress)}%
          </progress>

          <footer className="card-foot">
            <span className="meta-text">{autoNextSummary}</span>
            <button
              className={`btn btn-primary${rotatePending ? ' is-loading' : ''}`}
              type="button"
              disabled={!canRotate}
              title={rotateDisabledReason}
              aria-busy={rotatePending ? 'true' : 'false'}
              onClick={() => void startRotation()}
            >
              <Icon name="refresh" />
              <span>Xoay IP ngay</span>
            </button>
          </footer>
        </article>
      </div>

      <div className="stat-grid">
        <article className="card stat-card">
          <div className="stat-head">
            <span className="stat-label">IP hiện tại</span>
            <Icon name="wifi" />
          </div>
          <p className="stat-value mono">{ip}</p>
          <p className="stat-hint">{ipHint}</p>
        </article>
        <article className="card stat-card">
          <div className="stat-head">
            <span className="stat-label">Nhà mạng</span>
            <Icon name="signal" />
          </div>
          <p className="stat-value">{isp}</p>
          <p className="stat-hint">{ispHint}</p>
        </article>
        <article className="card stat-card">
          <div className="stat-head">
            <span className="stat-label">Phiên hoạt động</span>
            <Icon name="clock" />
          </div>
          <p className="stat-value">{device?.since ? formatDuration(uptime) : '—'}</p>
          <p className="stat-hint">{uptimeHint}</p>
        </article>
        <article className="card stat-card">
          <div className="stat-head">
            <span className="stat-label">Tỷ lệ xoay</span>
            <Icon name="check" />
          </div>
          <p className="stat-value">{rate == null ? '—' : `${rate}%`}</p>
          <p className="stat-hint">
            {total ? `${success}/${total} lần thành công` : 'Chưa có dữ liệu'}
          </p>
        </article>
      </div>

      <div className="content-grid">
        <article className="card" aria-labelledby="device-summary-title">
          <header className="card-head">
            <div>
              <p className="eyebrow">Thiết bị</p>
              <h2 id="device-summary-title">Android qua ADB</h2>
            </div>
            <Link className="text-link" to="/device">
              Chi tiết <Icon name="arrow-right" />
            </Link>
          </header>

          <div className="device-line">
            <div className="device-avatar" aria-hidden="true">
              <Icon name="phone" />
            </div>
            <div>
              <p className="device-name">{device?.model || 'Chưa phát hiện thiết bị'}</p>
              <p className="meta-text">{deviceSub}</p>
            </div>
          </div>

          <dl className="compact-list">
            <div>
              <dt>Serial</dt>
              <dd className="mono">{device?.serial || '—'}</dd>
            </div>
            <div>
              <dt>Daemon</dt>
              <dd>{device?.daemon_running ? 'Đang chạy' : 'Đã dừng'}</dd>
            </div>
            <div>
              <dt>Kết nối</dt>
              <dd>{deviceConnectionLabel}</dd>
            </div>
          </dl>

          <footer className="card-foot">
            <button
              className={`btn btn-secondary btn-sm${reconnecting ? ' is-loading' : ''}`}
              type="button"
              disabled={reconnectDisabled}
              title={reconnectTitle}
              aria-busy={reconnecting ? 'true' : 'false'}
              onClick={() => void reconnectDevice()}
            >
              Kết nối lại
            </button>
            <Link className="text-link" to="/device">
              Xử lý sự cố
            </Link>
          </footer>
        </article>

        <article className="card" aria-labelledby="quickstart-title">
          <header className="card-head">
            <div>
              <p className="eyebrow">Bắt đầu</p>
              <h2 id="quickstart-title">Dùng proxy</h2>
            </div>
          </header>
          <p className="meta-text">
            Trỏ công cụ của bạn vào proxy HTTP trên máy tính. Hỗ trợ HTTP và HTTPS qua CONNECT.
          </p>
          <div className="code-block">
            <code>curl -x http://127.0.0.1:8080 https://api.ipify.org</code>
            <button
              className="icon-btn"
              type="button"
              aria-label="Sao chép lệnh curl"
              title="Sao chép lệnh"
              onClick={() =>
                void copy('curl -x http://127.0.0.1:8080 https://api.ipify.org')
              }
            >
              <Icon name="copy" />
            </button>
          </div>
          <ul className="bullet-list">
            <li>
              Proxy chỉ lắng nghe trên <code>127.0.0.1</code>.
            </li>
            <li>Xoay IP không làm gián đoạn dashboard.</li>
            <li>
              API tương thích: <code>/rotate</code> và <code>/status</code>.
            </li>
          </ul>
        </article>

        <article className="card" aria-labelledby="auto-summary-title">
          <header className="card-head">
            <div>
              <p className="eyebrow">Lịch</p>
              <h2 id="auto-summary-title">Tự động xoay</h2>
            </div>
            <Badge
              tone={autoEnabled ? 'success' : 'neutral'}
              label={autoEnabled ? 'Bật' : 'Tắt'}
            />
          </header>

          <div className="switch-row">
            <div>
              <p className="switch-label" id="auto-toggle-label">
                Tự động xoay IP
              </p>
              <p className="meta-text" id="auto-toggle-help">
                Tự xoay theo chu kỳ khi thiết bị đang kết nối.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoChecked}
                disabled={autoBusy}
                aria-labelledby="auto-toggle-label"
                aria-describedby="auto-toggle-help"
                onChange={(event) => void handleAutoToggle(event.currentTarget.checked)}
              />
              <span className="switch-track" aria-hidden="true">
                <span className="switch-thumb" />
              </span>
            </label>
          </div>

          <dl className="compact-list">
            <div>
              <dt>Chu kỳ</dt>
              <dd>{autoInterval} phút</dd>
            </div>
            <div>
              <dt>Lần tiếp theo</dt>
              <dd>{autoNextInline}</dd>
            </div>
          </dl>

          <footer className="card-foot">
            <Link className="text-link" to="/settings">
              Mở cài đặt
            </Link>
          </footer>
        </article>
      </div>

      <div className="split-grid">
        <article className="card" aria-labelledby="recent-history-title">
          <header className="card-head">
            <div>
              <p className="eyebrow">Lịch sử</p>
              <h2 id="recent-history-title">Lần xoay gần đây</h2>
            </div>
            <Link className="text-link" to="/history">
              Xem tất cả
            </Link>
          </header>
          <div className="table-wrap" hidden={recentHistory.length === 0}>
            <table className="data-table">
              <caption className="visually-hidden">Năm lần xoay IP gần nhất</caption>
              <thead>
                <tr>
                  <th scope="col">Thời gian</th>
                  <th scope="col">IP mới</th>
                  <th scope="col">Nhà mạng</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <HistoryRows items={recentHistory} compact />
              </tbody>
            </table>
          </div>
          <div className="empty-inline" hidden={recentHistory.length > 0}>
            <p>Chưa có lần xoay IP nào.</p>
          </div>
        </article>

        <article className="card" aria-labelledby="recent-logs-title">
          <header className="card-head">
            <div>
              <p className="eyebrow">Hoạt động</p>
              <h2 id="recent-logs-title">Nhật ký gần đây</h2>
            </div>
            <Link className="text-link" to="/logs">
              Xem tất cả
            </Link>
          </header>
          <LogList items={recentLogs} compact ariaLabel="Nhật ký gần đây" />
          <div className="empty-inline" hidden={recentLogs.length > 0}>
            <p>Chưa có hoạt động nào.</p>
          </div>
        </article>
      </div>
    </section>
  );
}
