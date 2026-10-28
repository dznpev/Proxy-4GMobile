/* 4G Mobile Proxy — dashboard controller (vanilla ES modules, no build step). */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const ROUTES = {
  overview: {
    title: 'Tổng quan',
    eyebrow: 'Bảng điều khiển',
    documentTitle: 'Tổng quan',
  },
  device: {
    title: 'Thiết bị',
    eyebrow: 'Phần cứng & ADB',
    documentTitle: 'Thiết bị',
  },
  history: {
    title: 'Lịch sử IP',
    eyebrow: 'Hoạt động xoay',
    documentTitle: 'Lịch sử IP',
  },
  logs: {
    title: 'Nhật ký',
    eyebrow: 'Chẩn đoán',
    documentTitle: 'Nhật ký',
  },
  settings: {
    title: 'Cài đặt',
    eyebrow: 'Cấu hình',
    documentTitle: 'Cài đặt',
  },
};

const TRIGGER_LABELS = {
  manual: 'Thủ công',
  auto: 'Tự động',
  legacy: 'Qua API',
};

const DEVICE_STATUS_LABELS = {
  ready: 'Sẵn sàng',
  preparing: 'Đang kết nối',
  disconnected: 'Chưa kết nối',
  unauthorized: 'Chưa ủy quyền',
  'adb-missing': 'Thiếu ADB',
  error: 'Cần xử lý',
};

const SUCCESS_ICON = 'i-check';
const ALERT_ICON = 'i-alert';
const REFRESH_ICON = 'i-refresh';
const WIFI_ICON = 'i-wifi';
const PHONE_ICON = 'i-phone';

const POLL_VISIBLE_MS = 2500;
const POLL_HIDDEN_MS = 10000;
const MAX_LOGS = 500;

const state = {
  route: 'overview',
  status: null,
  statusError: '',
  connection: 'loading',
  pollTimer: null,
  pollInFlight: false,
  initialised: false,
  lastStatusAt: 0,
  clockOffset: 0,
  logs: [],
  logLastId: 0,
  logsLoaded: false,
  logLevel: 'all',
  logQuery: '',
  logFollow: true,
  history: [],
  historyStats: null,
  historyFilter: 'all',
  historyLoaded: false,
  settings: null,
  settingsDirty: false,
  settingsSaving: false,
  settingsSavedText: '',
  statusPromise: null,
  logsPromise: null,
  autoPending: false,
  rotatePending: false,
  sidebarOpen: false,
  statusCount: 0,
  rotationId: null,
  rotationStatus: null,
  rotationWasRunning: false,
  lastRotationStep: null,
  rotationStepId: null,
};

/* -- Small helpers -------------------------------------------------------- */

function setText(element, value) {
  if (!element) return;
  const next = value == null ? '' : String(value);
  if (element.textContent !== next) element.textContent = next;
}

function toggleHidden(element, hidden) {
  if (element) element.hidden = Boolean(hidden);
}

function svgIcon(id, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

function setBadge(element, tone, label, iconId) {
  if (!element) return;
  element.className = `badge badge-${tone}`;
  const children = [];
  if (iconId) children.push(svgIcon(iconId));
  const text = document.createElement('span');
  text.textContent = label;
  children.push(text);
  element.replaceChildren(...children);
}

function setStatusPill(pill, textElement, tone, label) {
  if (!pill) return;
  pill.className = `status-pill status-${tone}`;
  setText(textElement, label);
}

function setSidebarStatus(tone, label) {
  const element = $('#sidebar-status');
  const normalized = tone === 'success' ? 'online' : tone === 'danger' ? 'error' : tone;
  if (element) {
    element.className = normalized ? `sidebar-status is-${normalized}` : 'sidebar-status';
  }
  setText($('#sidebar-status-text'), label);
}

function plural(count, singular) {
  return `${count} ${singular}`;
}

/* -- Formatting ----------------------------------------------------------- */

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

function nowSeconds() {
  return Date.now() / 1000 + state.clockOffset;
}

function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  return dateTimeFormatter.format(new Date(Number(timestamp) * 1000));
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return dateFormatter.format(new Date(Number(timestamp) * 1000));
}

function formatClock(timestamp) {
  if (!timestamp) return '—';
  return clockFormatter.format(new Date(Number(timestamp) * 1000));
}

function formatRelative(timestamp) {
  if (!timestamp) return '—';
  const diff = Math.max(0, nowSeconds() - Number(timestamp));
  if (diff < 5) return 'vừa xong';
  if (diff < 60) return `${Math.round(diff)} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return formatDate(timestamp);
}

function formatDuration(seconds) {
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

function formatLatency(milliseconds) {
  if (milliseconds == null) return '—';
  const value = Number(milliseconds);
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value)} ms`;
}

function formatCountdown(timestamp) {
  if (!timestamp) return '—';
  const diff = Number(timestamp) - nowSeconds();
  if (diff <= 0) return 'sắp tới';
  if (diff < 60) return 'dưới 1 phút';
  if (diff < 3600) return `${Math.ceil(diff / 60)} phút`;
  const hours = Math.floor(diff / 3600);
  const minutes = Math.ceil((diff % 3600) / 60);
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

function formatLocation(network) {
  if (!network) return '—';
  const parts = [network.city, network.country].filter(Boolean);
  if (!parts.length) return '—';
  return parts.join(', ');
}

function formatEndpoint(url) {
  return url || '—';
}

/* -- HTTP ----------------------------------------------------------------- */

class ApiError extends Error {
  constructor(message, status = 0, code = 'network_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function api(path, { method = 'GET', body, timeout = 12000 } = {}) {
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
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        payload?.error?.message || `Yêu cầu thất bại (HTTP ${response.status}).`;
      throw new ApiError(message, response.status, payload?.error?.code || 'http_error');
    }
    if (payload === null) {
      throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', response.status, 'invalid_json');
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new ApiError('Máy chủ phản hồi quá lâu. Vui lòng thử lại.', 0, 'timeout');
    }
    throw new ApiError(
      'Không kết nối được dịch vụ điều khiển. Kiểm tra cửa sổ terminal.',
      0,
      'network_error',
    );
  } finally {
    window.clearTimeout(timer);
  }
}

/* -- Toasts --------------------------------------------------------------- */

const TOAST_ICONS = {
  success: SUCCESS_ICON,
  error: ALERT_ICON,
  warning: ALERT_ICON,
  info: WIFI_ICON,
};

function showToast(tone, title, message = '', timeout = 6000) {
  const region = $('#toast-region');
  if (!region) return;
  const safeTone = TOAST_ICONS[tone] ? tone : 'info';

  const toast = document.createElement('div');
  toast.className = `toast toast-${safeTone}`;
  toast.setAttribute('role', safeTone === 'error' ? 'alert' : 'status');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'toast-icon';
  iconWrap.append(svgIcon(TOAST_ICONS[safeTone]));

  const body = document.createElement('div');
  body.className = 'toast-body';
  const heading = document.createElement('p');
  heading.className = 'toast-title';
  heading.textContent = title;
  body.append(heading);
  if (message) {
    const detail = document.createElement('p');
    detail.className = 'toast-message';
    detail.textContent = message;
    body.append(detail);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Đóng thông báo');
  close.append(svgIcon('i-close'));

  let timer = null;
  const dismiss = () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
    toast.remove();
  };
  close.addEventListener('click', dismiss);

  toast.append(iconWrap, body, close);
  region.append(toast);
  while (region.children.length > 4) region.firstElementChild.remove();
  timer = window.setTimeout(dismiss, timeout);
  toast.addEventListener('mouseenter', () => {
    if (timer) window.clearTimeout(timer);
    timer = null;
  });
  toast.addEventListener('mouseleave', () => {
    if (!timer) timer = window.setTimeout(dismiss, 2500);
  });
}

/* -- Confirmation dialog -------------------------------------------------- */

function confirmAction({
  title,
  description,
  confirmLabel = 'Xác nhận',
  tone = 'danger',
} = {}) {
  const dialog = $('#confirm-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(description || title || 'Xác nhận thao tác?'));
  }
  if (dialog.open) return Promise.resolve(false);

  setText($('#dialog-title'), title || 'Xác nhận thao tác');
  setText($('#dialog-description'), description || 'Thao tác này không thể hoàn tác.');

  const confirmButton = $('#dialog-confirm');
  const cancelButton = $('#dialog-cancel');
  if (confirmButton) {
    confirmButton.textContent = confirmLabel;
    confirmButton.className = `btn btn-${tone}`;
  }
  if (cancelButton) cancelButton.textContent = 'Hủy';

  dialog.returnValue = '';
  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue === 'confirm');
    };
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    window.setTimeout(() => (tone === 'danger' ? cancelButton : confirmButton)?.focus(), 0);
  });
}

/* -- Clipboard ------------------------------------------------------------ */

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'copy-fallback';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

async function copyText(text, label = 'Đã sao chép') {
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) copied = fallbackCopy(text);
  if (copied) {
    showToast('success', label, text, 3500);
  } else {
    showToast('error', 'Không sao chép được', 'Hãy chọn và sao chép nội dung thủ công.');
  }
  return copied;
}

/* -- Button loading ------------------------------------------------------- */

function setLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('is-loading', Boolean(loading));
  button.setAttribute('aria-busy', loading ? 'true' : 'false');
  button.disabled = Boolean(loading);
}

/* -- Routing -------------------------------------------------------------- */

const mobileQuery = window.matchMedia('(max-width: 1024px)');

function readRoute() {
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return Object.prototype.hasOwnProperty.call(ROUTES, value) ? value : 'overview';
}

function applyRoute(route, { focus = true } = {}) {
  const meta = ROUTES[route] || ROUTES.overview;
  state.route = route;

  $$('.page').forEach((page) => {
    page.hidden = page.dataset.page !== route;
  });

  $$('.nav-item').forEach((item) => {
    if (item.dataset.route === route) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  setText($('#page-title'), meta.title);
  setText($('#page-eyebrow'), meta.eyebrow);
  document.title = `${meta.documentTitle} · 4G Mobile Proxy`;

  if (focus) {
    const main = $('#main');
    main?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  closeSidebar({ restoreFocus: false });

  if (route === 'history' && !state.historyLoaded) loadHistory();
  if (route === 'logs' && !state.logsLoaded) loadLogs({ reset: true });
  if (route === 'settings') loadSettings();
}

function navigate(route) {
  if (!ROUTES[route]) route = 'overview';
  if (readRoute() === route) {
    applyRoute(route);
    return;
  }
  window.location.hash = `#/${route}`;
}

/* -- Sidebar -------------------------------------------------------------- */

function isMobileSidebar() {
  return mobileQuery.matches;
}

function syncSidebarMode() {
  const sidebar = $('#sidebar');
  const toggle = $('#menu-toggle');
  if (!sidebar) return;
  document.body.classList.toggle('sidebar-open', isMobileSidebar() && state.sidebarOpen);

  if (!isMobileSidebar()) {
    state.sidebarOpen = false;
    sidebar.classList.remove('is-open');
    sidebar.inert = false;
    toggleHidden($('#sidebar-scrim'), true);
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    return;
  }

  sidebar.classList.toggle('is-open', state.sidebarOpen);
  sidebar.inert = !state.sidebarOpen;
  toggleHidden($('#sidebar-scrim'), !state.sidebarOpen);
  if (toggle) toggle.setAttribute('aria-expanded', state.sidebarOpen ? 'true' : 'false');
}

function openSidebar() {
  if (!isMobileSidebar()) return;
  state.sidebarOpen = true;
  syncSidebarMode();
  $('#sidebar-close')?.focus();
}

function closeSidebar({ restoreFocus = true } = {}) {
  if (!state.sidebarOpen) {
    syncSidebarMode();
    return;
  }
  const focusWasInside = $('#sidebar')?.contains(document.activeElement);
  state.sidebarOpen = false;
  syncSidebarMode();
  if (restoreFocus && focusWasInside) $('#menu-toggle')?.focus();
}

function trapSidebarFocus(event) {
  if (event.key !== 'Tab' || !state.sidebarOpen || !isMobileSidebar()) return;
  const sidebar = $('#sidebar');
  const focusable = $$(
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    sidebar,
  ).filter((element) => !element.hidden && element.getClientRects().length > 0);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* -- Status tone helpers -------------------------------------------------- */

function deviceTone(device) {
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

function deviceNavState(device) {
  if (!device) return 'off';
  if (device.status === 'ready') return 'on';
  if (device.status === 'preparing') return 'warn';
  if (['unauthorized', 'adb-missing', 'error'].includes(device.status)) return 'error';
  return 'off';
}

function statusSummary(status) {
  const device = status?.device || {};
  const proxy = status?.proxy || {};
  if (device.status === 'ready') {
    if (proxy.running) {
      return { tone: 'success', label: status?.app?.demo ? 'Proxy đang chạy · DEMO' : 'Proxy đang chạy' };
    }
    return { tone: 'warning', label: 'Daemon proxy đã dừng' };
  }
  if (device.status === 'preparing') return { tone: 'info', label: 'Đang kết nối thiết bị…' };
  if (device.status === 'unauthorized') return { tone: 'danger', label: 'Thiết bị chưa ủy quyền' };
  if (device.status === 'adb-missing') return { tone: 'danger', label: 'Không tìm thấy ADB' };
  if (device.status === 'error') return { tone: 'danger', label: 'Phần cứng cần chú ý' };
  return { tone: 'warning', label: 'Chưa có thiết bị' };
}

/* -- Service failure ------------------------------------------------------ */

function renderServiceDown(error) {
  state.connection = 'offline';
  state.statusError = error?.message || 'Không kết nối được dịch vụ điều khiển.';

  const banner = $('#service-banner');
  toggleHidden(banner, false);
  setText($('#service-banner-text'), state.statusError);
  setStatusPill($('#header-status'), $('#header-status-text'), 'danger', 'Mất kết nối dịch vụ');
  setSidebarStatus('error', 'Mất kết nối dịch vụ');

  const deviceBanner = $('#device-banner');
  toggleHidden(deviceBanner, true);

  const refresh = $('#refresh-btn');
  refresh?.classList.remove('is-loading');
  refresh?.removeAttribute('aria-busy');

  ['#rotate-btn', '#rotate-now', '#check-btn', '#device-reconnect-summary', '#device-reconnect-page', '#proxy-restart'].forEach(
    (selector) => {
      const element = $(selector);
      if (element) element.disabled = true;
    },
  );

  const main = $('#main');
  main?.setAttribute('aria-busy', 'false');
  setText($('#last-updated'), 'Không cập nhật được trạng thái');
}

/* -- Render: status ------------------------------------------------------- */

function renderStatus(status) {
  state.status = status;
  state.connection = 'online';
  state.statusError = '';
  state.lastStatusAt = Date.now();
  if (Number.isFinite(Number(status?.server_time))) {
    state.clockOffset = Number(status.server_time) - Date.now() / 1000;
  }

  const app = status.app || {};
  const device = status.device || {};
  const proxy = status.proxy || {};
  const network = status.network || {};
  const rotation = status.rotation || {};
  const stats = status.stats || {};
  const settings = status.settings || {};
  state.settings = settings;

  toggleHidden($('#service-banner'), true);

  const summary = statusSummary(status);
  setStatusPill($('#header-status'), $('#header-status-text'), summary.tone, summary.label);
  setSidebarStatus(summary.tone === 'neutral' ? '' : summary.tone, summary.label);
  setText($('#last-updated'), `Cập nhật ${formatClock(nowSeconds())}`);

  const navDot = $('#nav-device-dot');
  if (navDot) navDot.dataset.state = deviceNavState(device);

  // Application meta.
  const version = app.version || '2.0.0';
  setText($('#app-version'), version);
  setText($('#app-footer-version'), version);
  setText($('#about-version'), version);
  const dashboardUrl = app.dashboard_url || window.location.origin;
  setText($('#about-dashboard'), dashboardUrl);
  setText($('#about-proxy'), app.proxy_url || '—');
  setText($('#about-data'), app.data_dir || '—');
  toggleHidden($('#about-demo'), !app.demo);
  try {
    setText($('#app-port'), new URL(dashboardUrl).port || app.control_port || '—');
  } catch {
    setText($('#app-port'), app.control_port || '—');
  }

  renderDevice(device, proxy, app);
  renderNetwork(network, device, rotation);
  renderRotation(rotation, device, proxy);
  renderStats(stats, device, network, rotation);
  renderAutoState(status.auto_rotate || {}, settings);
  renderDevicePage(device, proxy, app);
  renderBanners(device, app);
  renderDeviceSummary(device, proxy);

  renderRecentHistory(Array.isArray(status.history) ? status.history : []);
  renderRecentLogs();

  if (state.route === 'settings' && !state.settingsDirty) {
    applySettingsForm(settings);
  }
  if (state.route === 'settings') renderSettingsBadge(settings);

  watchRotation(rotation);

  const main = $('#main');
  main?.setAttribute('aria-busy', 'false');
}

function renderBanners(device, app) {
  const banner = $('#device-banner');
  if (!banner) return;
  if (device.status === 'ready') {
    toggleHidden(banner, true);
    return;
  }

  toggleHidden(banner, false);
  banner.className = 'banner banner-warning';
  const title = $('#device-banner-title');
  const text = $('#device-banner-text');
  const link = $('#device-banner-link');
  if (link) link.textContent = 'Xem thiết bị';

  switch (device.status) {
    case 'preparing':
      setText(title, 'Đang thiết lập thiết bị');
      setText(text, 'Đang đồng bộ daemon proxy và kiểm tra kết nối 4G. Quá trình mất vài giây.');
      break;
    case 'unauthorized':
      setText(title, 'Thiết bị chưa được ủy quyền');
      setText(text, 'Mở khóa điện thoại và chọn “Luôn cho phép từ máy tính này” trong hộp thoại gỡ lỗi USB.');
      break;
    case 'adb-missing':
      setText(title, 'Không tìm thấy ADB');
      setText(text, 'Cài Android Platform Tools và thêm adb vào PATH, sau đó khởi động lại ứng dụng.');
      break;
    case 'error':
      setText(title, 'Không thiết lập được proxy');
      setText(
        text,
        device.error
          ? device.error
          : app?.adb_available === false
            ? 'Kiểm tra ADB và kết nối USB.'
            : 'Mở trang Thiết bị để xem chi tiết.',
      );
      break;
    default:
      setText(title, 'Chưa có thiết bị Android');
      setText(text, 'Cắm cáp USB, bật Gỡ lỗi USB và ủy quyền cho máy tính.');
      break;
  }
}

function renderDeviceSummary(device, proxy) {
  const ready = device.status === 'ready';
  setText($('#device-model'), device.model || 'Chưa phát hiện thiết bị');
  if (ready) {
    const details = [device.android ? `Android ${device.android}` : null, device.abi].filter(Boolean);
    setText($('#device-sub'), details.join(' · ') || 'Thiết bị đã sẵn sàng');
  } else if (device.status === 'preparing') {
    setText($('#device-sub'), 'Đang đồng bộ daemon proxy…');
  } else if (device.error) {
    setText($('#device-sub'), device.error);
  } else {
    setText($('#device-sub'), 'Cắm cáp USB và bật gỡ lỗi USB');
  }
  setText($('#device-serial'), device.serial || '—');
  setText($('#device-daemon'), device.daemon_running ? 'Đang chạy' : 'Đã dừng');
  if (ready) {
    setText($('#device-connection'), proxy.forwarded ? 'USB · đã forward cổng' : 'USB · chưa forward');
  } else {
    setText($('#device-connection'), DEVICE_STATUS_LABELS[device.status] || 'Chưa kết nối');
  }

  const reconnect = $('#device-reconnect-summary');
  if (reconnect) {
    reconnect.disabled =
      !device.serial || device.status === 'preparing' || Boolean(state.status?.rotation?.running);
    reconnect.title = reconnect.disabled
      ? state.status?.rotation?.running
        ? 'Đang xoay IP, vui lòng chờ hoàn tất.'
        : 'Cần phát hiện thiết bị trước khi kết nối lại.'
      : '';
  }
}

function renderDevice(device, proxy) {
  const badge = $('#device-page-badge');
  const tone = deviceTone(device);
  const label = DEVICE_STATUS_LABELS[device.status] || 'Chưa kết nối';
  setBadge(badge, tone, label, tone === 'success' ? SUCCESS_ICON : tone === 'info' ? REFRESH_ICON : tone === 'danger' ? ALERT_ICON : PHONE_ICON);

  const sessionBadge = $('#session-badge');
  if (device.status === 'ready' && proxy.running) {
    setBadge(sessionBadge, 'success', 'Đang hoạt động', SUCCESS_ICON);
  } else if (device.status === 'ready') {
    setBadge(sessionBadge, 'warning', 'Daemon đã dừng', ALERT_ICON);
  } else if (device.status === 'preparing') {
    setBadge(sessionBadge, 'info', 'Đang kết nối', REFRESH_ICON);
  } else if (['unauthorized', 'adb-missing', 'error'].includes(device.status)) {
    setBadge(sessionBadge, 'danger', 'Cần xử lý', ALERT_ICON);
  } else {
    setBadge(sessionBadge, 'neutral', 'Chưa kết nối', PHONE_ICON);
  }
}

function renderDevicePage(device, proxy, app) {
  setText($('#device-detail-serial'), device.serial || '—');
  setText($('#device-detail-model'), device.model || '—');
  setText($('#device-detail-android'), device.android || '—');
  setText($('#device-detail-abi'), device.abi || '—');

  let adbLabel = DEVICE_STATUS_LABELS[device.status] || 'Chưa kết nối';
  if (device.status === 'ready') adbLabel = 'Đã kết nối · USB';
  if (device.status === 'adb-missing' || app?.adb_available === false) adbLabel = 'Không tìm thấy ADB';
  setText($('#device-detail-adb'), adbLabel);

  setText($('#device-detail-daemon'), device.daemon_running ? 'Đang chạy' : 'Đã dừng');
  setText(
    $('#device-detail-forward'),
    proxy.forwarded ? `Đã forward cổng ${proxy.port || '—'}` : 'Chưa forward',
  );
  setText(
    $('#device-detail-uptime'),
    device.since
      ? `${formatDuration(actionUptime(device))} · từ ${formatClock(device.since)}`
      : '—',
  );

  const errorBox = $('#device-error');
  const hasError = Boolean(device.error) && device.status !== 'ready';
  toggleHidden(errorBox, !hasError);
  if (hasError) setText($('#device-error-text'), device.error);

  const rotationRunning = Boolean(state.status?.rotation?.running);
  const reconnect = $('#device-reconnect-page');
  if (reconnect) {
    reconnect.disabled = !device.serial || device.status === 'preparing' || rotationRunning;
    reconnect.title = reconnect.disabled
      ? rotationRunning
        ? 'Đang xoay IP, vui lòng chờ hoàn tất.'
        : 'Cần phát hiện thiết bị trước khi kết nối lại.'
      : '';
  }
  const restart = $('#proxy-restart');
  if (restart) {
    restart.disabled = !device.connected || device.status === 'preparing' || rotationRunning;
    restart.title = restart.disabled
      ? rotationRunning
        ? 'Đang xoay IP, vui lòng chờ hoàn tất.'
        : 'Cần thiết bị đang kết nối để khởi động lại daemon.'
      : '';
  }
}

function actionUptime(device) {
  if (!device?.since) return 0;
  return Math.max(0, nowSeconds() - Number(device.since));
}

function renderNetwork(network, device, rotation) {
  const ip = network.ip || '—';
  const isp = network.isp || '—';
  const location = formatLocation(network);
  const checking = network.state === 'checking';
  const rotating = Boolean(rotation?.running) || network.state === 'rotating';
  const online = network.state === 'online';

  setText($('#ov-ip'), ip);
  setText($('#ov-isp'), isp);
  setText($('#ov-location'), location);
  setText($('#stat-ip'), ip);
  setText($('#stat-isp'), isp);

  let checked = 'Chưa kiểm tra kết nối';
  if (rotating) checked = 'Đang chờ IP mới sau khi xoay…';
  else if (checking) checked = 'Đang kiểm tra kết nối…';
  else if (online && network.checked_at) {
    checked = `Cập nhật ${formatRelative(network.checked_at)} · ${formatClock(network.checked_at)}`;
  } else if (network.state === 'error' && network.error) {
    checked = network.error;
  } else if (network.state === 'offline') {
    checked = 'Thiết bị đã ngắt kết nối.';
  }
  setText($('#ov-checked'), checked);

  let ipHint = 'Chưa có kết nối';
  if (rotating) ipHint = 'Đang chờ nhà mạng cấp IP mới';
  else if (checking) ipHint = 'Đang kiểm tra…';
  else if (online && network.checked_at) ipHint = `Cập nhật ${formatRelative(network.checked_at)}`;
  else if (network.state === 'error') ipHint = 'Không xác minh được IP';
  setText($('#stat-ip-hint'), ipHint);

  let ispHint = 'Chưa xác định';
  if (network.country) ispHint = [network.country, network.region].filter(Boolean).join(' · ');
  else if (online) ispHint = 'Đã kết nối Internet';
  setText($('#stat-isp-hint'), ispHint);

  setText(
    $('#ov-latency'),
    network.latency_ms == null ? '—' : formatLatency(network.latency_ms),
  );

  const proxyUrl = state.status?.app?.proxy_url || state.status?.proxy?.url || 'http://127.0.0.1:8080';
  setText($('#proxy-url'), proxyUrl);

  const copyProxy = $('#copy-proxy');
  if (copyProxy) copyProxy.dataset.copyValue = proxyUrl;

  const check = $('#check-btn');
  if (check) {
    const disabled = !device.connected || rotating;
    check.disabled = disabled;
    check.title = disabled
      ? rotating
        ? 'Đang xoay IP, không thể kiểm tra lúc này.'
        : 'Cần kết nối thiết bị trước khi kiểm tra.'
      : '';
  }
}

function renderRotation(rotation, device, proxy) {
  const order = ['preparing', 'network-off', 'network-on', 'verifying'];
  const steps = $$('#rotation-steps li');
  const succeeded = rotation.status === 'success';
  const failed = rotation.status === 'failed';
  const running = Boolean(rotation.running);
  const progress = Math.max(0, Math.min(100, Number(rotation.progress) || 0));

  steps.forEach((item) => {
    item.classList.remove('is-active', 'is-done', 'is-error');
  });

  if (succeeded) {
    steps.forEach((item) => item.classList.add('is-done'));
  } else if (failed) {
    const failedStep =
      state.rotationStepId === rotation.id ? state.lastRotationStep : null;
    let errorIndex = steps.length - 1;
    if (failedStep === 'preparing') errorIndex = 0;
    else if (failedStep === 'network-off') errorIndex = 1;
    else if (failedStep === 'network-on' || failedStep === 'waiting') errorIndex = 2;
    else if (failedStep === 'verifying') errorIndex = 3;
    steps.forEach((item, index) => {
      if (index < errorIndex) item.classList.add('is-done');
      if (index === errorIndex) item.classList.add('is-error');
    });
  } else if (running) {
    state.lastRotationStep = rotation.step;
    state.rotationStepId = rotation.id;
    let activeIndex = order.indexOf(rotation.step);
    if (rotation.step === 'waiting') activeIndex = -1;
    if (rotation.step === 'done') activeIndex = order.length;
    steps.forEach((item, index) => {
      if (index < activeIndex) item.classList.add('is-done');
      if (index === activeIndex) item.classList.add('is-active');
    });
    if (rotation.step === 'done') steps.forEach((item) => item.classList.add('is-done'));
  }

  const bar = $('#rotation-progress');
  if (bar) {
    bar.value = progress;
    bar.textContent = `${Math.round(progress)}%`;
    bar.className = `progress${succeeded ? ' is-success' : failed ? ' is-error' : ''}`;
  }

  const card = $('#rotate-title')?.closest('.rotate-card');
  if (card) {
    card.classList.toggle('is-running', running);
    card.classList.toggle('is-success', succeeded);
    card.classList.toggle('is-error', failed && !running);
  }

  let statusText = 'Sẵn sàng xoay IP';
  if (running) statusText = rotation.message || 'Đang xoay IP…';
  else if (succeeded) statusText = rotation.message || 'Đã xoay IP thành công';
  else if (failed) statusText = rotation.message || 'Xoay IP thất bại';
  setText($('#rotate-status'), statusText);

  let detail = 'IP mới được xác minh sau khi kết nối lại 4G.';
  if (running) {
    const stepLabel =
      {
        preparing: 'Bước 1/4 · Chuẩn bị',
        'network-off': 'Bước 2/4 · Ngắt mạng',
        'network-on': 'Bước 3/4 · Kết nối lại',
        waiting: 'Bước 3/4 · Chờ nhà mạng cấp IP',
        verifying: 'Bước 4/4 · Xác minh IP',
      }[rotation.step] || 'Đang xử lý';
    detail = `${stepLabel} · ${Math.round(progress)}%`;
  } else if (succeeded) {
    const from = rotation.old_ip || '—';
    const to = rotation.new_ip || '—';
    detail = `${from} → ${to} · ${formatDuration(rotation.duration_sec)}`;
  } else if (failed) {
    detail = rotation.duration_sec != null ? `Dừng sau ${formatDuration(rotation.duration_sec)}.` : 'Kiểm tra nhật ký để biết chi tiết.';
  }
  setText($('#rotate-detail'), detail);

  const canRotate = Boolean(device.connected && device.daemon_running && !running && !state.rotatePending);
  const disabledReason = running
    ? 'Đang xoay IP, vui lòng chờ.'
    : !device.connected
      ? 'Cần kết nối thiết bị trước khi xoay IP.'
      : !device.daemon_running
        ? 'Daemon proxy chưa chạy. Hãy kết nối lại thiết bị.'
        : '';
  ['#rotate-btn', '#rotate-now'].forEach((selector) => {
    const button = $(selector);
    if (!button) return;
    button.disabled = !canRotate;
    button.title = disabledReason;
  });
}

function renderStats(stats, device, network, rotation) {
  const total = Number(stats.total) || 0;
  const success = Number(stats.success) || 0;
  const rate = stats.success_rate;

  setText($('#stat-success'), rate == null ? '—' : `${rate}%`);
  setText(
    $('#stat-success-hint'),
    total ? `${success}/${total} lần thành công` : 'Chưa có dữ liệu',
  );

  const uptime = Number(stats.session_uptime_sec) || 0;
  setText($('#stat-uptime'), device.since ? formatDuration(uptime) : '—');
  let uptimeHint = 'Chưa kết nối thiết bị';
  if (device.since) uptimeHint = `Kết nối từ ${formatClock(device.since)}`;
  else if (device.status === 'preparing') uptimeHint = 'Đang thiết lập phiên proxy';
  else if (rotation?.running) uptimeHint = 'Phiên đang được làm mới';
  setText($('#stat-uptime-hint'), uptimeHint);
}

function renderAutoState(auto, settings) {
  const enabled = Boolean(auto.enabled ?? settings.auto_rotate_enabled);
  const interval = Number(auto.interval_min ?? settings.auto_rotate_interval_min) || 30;
  const nextAt = auto.next_at;
  const connected = Boolean(state.status?.device?.connected);

  setBadge($('#auto-badge'), enabled ? 'success' : 'neutral', enabled ? 'Tự động bật' : 'Tự động tắt');
  setBadge($('#auto-state'), enabled ? 'success' : 'neutral', enabled ? 'Bật' : 'Tắt');

  const toggle = $('#auto-toggle');
  if (toggle && !state.autoPending) {
    toggle.checked = enabled;
    toggle.disabled = false;
  }

  setText($('#auto-interval'), `${interval} phút`);

  let nextLabel = 'Đang tắt';
  if (enabled) {
    if (nextAt) nextLabel = `Sau ${formatCountdown(nextAt)} · ${formatClock(nextAt)}`;
    else if (!connected) nextLabel = 'Chờ thiết bị kết nối';
    else nextLabel = 'Đang lên lịch…';
  }
  setText($('#auto-next-inline'), nextLabel);
  let nextSummary = 'Tự động: đang tắt';
  if (enabled) {
    nextSummary = nextAt
      ? `Tự động: lần tới sau ${formatCountdown(nextAt)}`
      : 'Tự động: chờ thiết bị kết nối';
  }
  setText($('#auto-next'), nextSummary);
}

/* -- Render: recent tables and logs --------------------------------------- */

function historyStatusBadge(status) {
  return status === 'success'
    ? { tone: 'success', label: 'Thành công', icon: SUCCESS_ICON }
    : { tone: 'danger', label: 'Thất bại', icon: ALERT_ICON };
}

function renderRecentHistory(items) {
  const body = $('#recent-history-body');
  if (!body) return;
  const rows = (items || []).slice(0, 5);
  body.replaceChildren();

  rows.forEach((item) => {
    const tr = document.createElement('tr');
    const time = document.createElement('td');
    time.className = 'mono';
    time.textContent = formatDateTime(item.ts);
    time.title = formatDateTime(item.ts);

    const ip = document.createElement('td');
    ip.className = 'mono';
    ip.textContent = item.new_ip || '—';

    const isp = document.createElement('td');
    isp.textContent = item.isp || '—';

    const status = document.createElement('td');
    const badge = document.createElement('span');
    const badgeInfo = historyStatusBadge(item.status);
    setBadge(badge, badgeInfo.tone, badgeInfo.label, badgeInfo.icon);
    status.append(badge);

    tr.append(time, ip, isp, status);
    body.append(tr);
  });

  const empty = rows.length === 0;
  toggleHidden($('#recent-history-empty'), !empty);
  toggleHidden(body.closest('.table-wrap'), empty);
}

function logEntryElement(item, { compact = false } = {}) {
  const li = document.createElement('li');
  li.className = 'log-entry';
  li.dataset.level = item.level || 'info';

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = item.time || formatClock(item.ts);
  time.title = formatDateTime(item.ts);
  if (!compact) time.setAttribute('aria-hidden', 'false');

  const level = document.createElement('span');
  level.className = 'log-level';
  level.dataset.level = item.level || 'info';
  level.textContent = (item.level || 'info').toUpperCase();

  const message = document.createElement('span');
  message.className = 'log-message';
  message.textContent = item.message || '';

  li.append(time, level, message);
  return li;
}

function renderLogList(target, items, options = {}) {
  if (!target) return;
  target.replaceChildren(...items.map((item) => logEntryElement(item, options)));
}

function renderRecentLogs() {
  const list = $('#recent-log-list');
  if (!list) return;
  const items = state.logs.slice(-6);
  renderLogList(list, items, { compact: true });
  toggleHidden($('#recent-log-empty'), items.length > 0);
}

function filteredLogs() {
  const query = state.logQuery.trim().toLowerCase();
  return state.logs.filter((item) => {
    if (state.logLevel !== 'all' && item.level !== state.logLevel) return false;
    if (!query) return true;
    return `${item.message || ''} ${item.source || ''}`.toLowerCase().includes(query);
  });
}

function renderLogs() {
  const list = $('#log-list');
  if (!list) return;
  const items = filteredLogs();
  renderLogList(list, items);

  const empty = $('#logs-empty');
  toggleHidden(empty, items.length > 0);
  if (empty && items.length === 0) {
    const heading = empty.querySelector('h3');
    const text = empty.querySelector('p');
    const filtersActive = state.logLevel !== 'all' || state.logQuery.trim() !== '';
    setText(heading, filtersActive ? 'Không có dòng phù hợp' : 'Chưa có nhật ký');
    setText(text, filtersActive ? 'Thử đổi mức độ hoặc từ khóa tìm kiếm.' : 'Hoạt động của proxy sẽ xuất hiện ở đây.');
  }

  const count = $('#log-count');
  const total = state.logs.length;
  setText(count, items.length === total ? `${total} dòng` : `${items.length} / ${total} dòng`);

  if (state.logFollow) {
    const consoleElement = list.closest('.log-console');
    if (consoleElement) consoleElement.scrollTop = consoleElement.scrollHeight;
  }
  renderRecentLogs();
}

/* -- Data loading --------------------------------------------------------- */

const DEFAULT_SETTINGS = {
  auto_rotate_enabled: false,
  auto_rotate_interval_min: 30,
  rotate_method: 'airplane',
};

async function loadStatus() {
  if (state.statusPromise) return state.statusPromise;
  state.statusPromise = (async () => {
    try {
      const payload = await api('/api/status');
      renderStatus(payload);
      return true;
    } catch (error) {
      renderServiceDown(error);
      return false;
    } finally {
      state.statusPromise = null;
    }
  })();
  return state.statusPromise;
}

async function loadLogs({ reset = false, silent = false } = {}) {
  if (state.logsPromise) return state.logsPromise;
  const after = reset ? 0 : state.logLastId;
  state.logsPromise = (async () => {
    try {
      const payload = await api(`/api/logs?after=${encodeURIComponent(after)}&limit=${MAX_LOGS}`);
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (reset) {
        state.logs = items.slice(-MAX_LOGS);
        state.logLastId = Number(payload.last_id) || 0;
      } else {
        const known = new Set(state.logs.map((item) => item.id));
        items.forEach((item) => {
          if (!known.has(item.id)) state.logs.push(item);
        });
        state.logs.sort((a, b) => Number(a.id) - Number(b.id));
        state.logs = state.logs.slice(-MAX_LOGS);
        state.logLastId = Math.max(state.logLastId, Number(payload.last_id) || 0);
      }
      state.logsLoaded = true;
      renderLogs();
      return true;
    } catch (error) {
      if (!silent) {
        showToast('error', 'Không tải được nhật ký', error.message);
      }
      return false;
    } finally {
      state.logsPromise = null;
    }
  })();
  return state.logsPromise;
}

async function loadHistory({ silent = false } = {}) {
  try {
    const payload = await api('/api/history');
    state.history = Array.isArray(payload.items) ? payload.items : [];
    state.historyStats = payload.stats || {};
    state.historyLoaded = true;
    renderHistory();
    if (state.route === 'overview') renderRecentHistory(state.history);
    return true;
  } catch (error) {
    if (!silent) showToast('error', 'Không tải được lịch sử', error.message);
    return false;
  }
}

async function loadSettings({ silent = false } = {}) {
  try {
    const payload = await api('/api/settings');
    state.settings = payload.settings || state.settings;
    if (!state.settingsDirty) {
      applySettingsForm(state.settings || DEFAULT_SETTINGS);
      updateSettingsDirtyUI();
    }
    renderSettingsBadge(state.settings || DEFAULT_SETTINGS);
    toggleHidden($('#settings-error'), true);
    return true;
  } catch (error) {
    if (!silent) showToast('error', 'Không tải được cài đặt', error.message);
    return false;
  }
}

/* -- Render: history page ------------------------------------------------- */

function historyFilterMatches(item) {
  if (state.historyFilter === 'all') return true;
  return item.status === state.historyFilter;
}

function renderHistory() {
  const body = $('#history-body');
  if (!body) return;

  const all = state.history || [];
  const rows = all.filter(historyFilterMatches);
  body.replaceChildren();

  rows.forEach((item) => {
    const tr = document.createElement('tr');

    const time = document.createElement('td');
    time.className = 'mono';
    time.textContent = formatDateTime(item.ts);
    time.title = formatDateTime(item.ts);

    const trigger = document.createElement('td');
    trigger.textContent = TRIGGER_LABELS[item.trigger] || 'Khác';

    const oldIp = document.createElement('td');
    oldIp.className = 'mono';
    oldIp.textContent = item.old_ip || '—';

    const newIp = document.createElement('td');
    newIp.className = 'mono';
    newIp.textContent = item.new_ip || '—';

    const isp = document.createElement('td');
    isp.textContent = item.isp || '—';

    const duration = document.createElement('td');
    duration.textContent = formatDuration(item.duration_sec);

    const status = document.createElement('td');
    const badge = document.createElement('span');
    const badgeInfo = historyStatusBadge(item.status);
    setBadge(badge, badgeInfo.tone, badgeInfo.label, badgeInfo.icon);
    status.append(badge);

    tr.append(time, trigger, oldIp, newIp, isp, duration, status);
    body.append(tr);
  });

  const empty = rows.length === 0;
  toggleHidden($('#history-empty'), !empty);
  toggleHidden(body.closest('.table-wrap'), empty);

  if (empty) {
    const filtered = state.historyFilter !== 'all';
    setText($('#history-empty-title'), filtered ? 'Không có lần xoay phù hợp' : 'Chưa có lần xoay IP nào');
    setText(
      $('#history-empty-text'),
      filtered
        ? 'Thử chọn bộ lọc khác để xem toàn bộ lịch sử.'
        : 'Xoay IP đầu tiên để bắt đầu ghi lịch sử.',
    );
    toggleHidden($('#history-empty-rotate'), filtered);
  }

  setText(
    $('#history-count'),
    state.historyFilter === 'all'
      ? `${all.length} lần xoay`
      : `${rows.length} / ${all.length} lần xoay`,
  );
  const clear = $('#history-clear');
  if (clear) clear.disabled = all.length === 0;
  $$('[data-history-filter]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.historyFilter === state.historyFilter ? 'true' : 'false');
  });
}

/* -- Render: settings ----------------------------------------------------- */

function renderSettingsBadge(settings) {
  const enabled = Boolean(settings?.auto_rotate_enabled);
  setBadge($('#settings-auto-badge'), enabled ? 'success' : 'neutral', enabled ? 'Bật' : 'Tắt');
}

function applySettingsForm(settings) {
  const source = settings || DEFAULT_SETTINGS;
  const auto = $('#setting-auto');
  if (auto) auto.checked = Boolean(source.auto_rotate_enabled);
  const interval = $('#setting-interval');
  if (interval) {
    interval.value = String(source.auto_rotate_interval_min ?? DEFAULT_SETTINGS.auto_rotate_interval_min);
    interval.removeAttribute('aria-invalid');
  }
  $$('input[name="rotate-method"]').forEach((radio) => {
    radio.checked = radio.value === (source.rotate_method || DEFAULT_SETTINGS.rotate_method);
  });
  toggleHidden($('#setting-interval-error'), true);
}

function clearSettingsError() {
  toggleHidden($('#settings-error'), true);
  const interval = $('#setting-interval');
  if (interval) interval.removeAttribute('aria-invalid');
  toggleHidden($('#setting-interval-error'), true);
}

function updateSettingsDirtyUI() {
  const save = $('#settings-save');
  const reset = $('#settings-reset');
  if (save) save.disabled = !state.settingsDirty || state.settingsSaving;
  if (reset) reset.disabled = state.settingsSaving;
  if (state.settingsDirty) {
    setText($('#settings-saved'), 'Chưa lưu thay đổi');
  } else {
    setText($('#settings-saved'), state.settingsSavedText || '');
  }
}

function markSettingsDirty() {
  if (!state.settingsDirty) {
    state.settingsDirty = true;
    state.settingsSavedText = '';
  }
  clearSettingsError();
  updateSettingsDirtyUI();
}

function readSettingsForm() {
  const intervalInput = $('#setting-interval');
  const raw = intervalInput?.value.trim() ?? '';
  const interval = Number(raw);
  const error = $('#setting-interval-error');
  const valid =
    raw !== '' &&
    Number.isInteger(interval) &&
    interval >= 5 &&
    interval <= 1440;

  if (!valid) {
    if (intervalInput) intervalInput.setAttribute('aria-invalid', 'true');
    if (error) {
      error.textContent = 'Nhập số phút từ 5 đến 1440.';
      toggleHidden(error, false);
    }
    intervalInput?.focus();
    return null;
  }

  if (intervalInput) intervalInput.removeAttribute('aria-invalid');
  toggleHidden(error, true);

  const method =
    $('input[name="rotate-method"]:checked')?.value ||
    state.settings?.rotate_method ||
    DEFAULT_SETTINGS.rotate_method;

  return {
    auto_rotate_enabled: Boolean($('#setting-auto')?.checked),
    auto_rotate_interval_min: interval,
    rotate_method: method,
  };
}

async function saveSettings(event) {
  event.preventDefault();
  if (state.settingsSaving) return;

  const payload = readSettingsForm();
  if (!payload) return;

  clearSettingsError();
  state.settingsSaving = true;
  updateSettingsDirtyUI();
  setLoading($('#settings-save'), true);

  try {
    const response = await api('/api/settings', { method: 'POST', body: payload });
    state.settings = response.settings || payload;
    state.settingsDirty = false;
    state.settingsSavedText = `Đã lưu lúc ${formatClock(nowSeconds())}`;
    applySettingsForm(state.settings);
    renderSettingsBadge(state.settings);
    renderAutoState(response.auto_rotate || {}, state.settings);
    updateSettingsDirtyUI();
    showToast('success', 'Đã lưu cài đặt', 'Lịch xoay IP đã được cập nhật.');
    if (state.status) state.status.settings = state.settings;
  } catch (error) {
    const box = $('#settings-error');
    toggleHidden(box, false);
    setText($('#settings-error-text'), error.message);
    showToast('error', 'Chưa lưu được cài đặt', error.message);
  } finally {
    state.settingsSaving = false;
    setLoading($('#settings-save'), false);
    updateSettingsDirtyUI();
  }
}

/* -- Actions -------------------------------------------------------------- */

function restoreActionAvailability() {
  if (!state.status) return;
  if (state.connection !== 'online') {
    ['#rotate-btn', '#rotate-now', '#check-btn', '#device-reconnect-summary', '#device-reconnect-page', '#proxy-restart'].forEach(
      (selector) => {
        const element = $(selector);
        if (element) element.disabled = true;
      },
    );
    return;
  }
  const { device, proxy, rotation, network } = state.status;
  renderRotation(rotation || {}, device || {}, proxy || {});
  renderNetwork(network || {}, device || {}, rotation || {});
  renderDevicePage(device || {}, proxy || {}, state.status.app || {});
  renderDeviceSummary(device || {}, proxy || {});
  renderDevice(device || {}, proxy || {});
}

async function startRotation() {
  if (state.rotatePending) return;
  if (!state.status?.device?.connected) {
    showToast('warning', 'Chưa có thiết bị', 'Kết nối thiết bị Android trước khi xoay IP.');
    return;
  }

  state.rotatePending = true;
  setLoading($('#rotate-btn'), true);
  setLoading($('#rotate-now'), true);
  try {
    const response = await api('/api/rotate', { method: 'POST', body: {}, timeout: 15000 });
    if (response?.rotation) {
      state.status.rotation = response.rotation;
      renderRotation(response.rotation, state.status.device, state.status.proxy);
    }
    showToast('info', 'Đã bắt đầu xoay IP', 'Tiến trình thường mất 10–25 giây.');
    await loadStatus();
    loadLogs({ silent: true });
  } catch (error) {
    state.rotatePending = false;
    showToast('error', 'Không xoay được IP', error.message);
    restoreActionAvailability();
  } finally {
    setLoading($('#rotate-btn'), false);
    setLoading($('#rotate-now'), false);
    if (state.rotatePending) {
      window.setTimeout(() => {
        if (state.rotatePending) {
          state.rotatePending = false;
          restoreActionAvailability();
        }
      }, 9000);
    }
    restoreActionAvailability();
  }
}

async function checkConnection() {
  const button = $('#check-btn');
  setLoading(button, true);
  try {
    const response = await api('/api/check', { method: 'POST', body: {}, timeout: 25000 });
    if (response.status) renderStatus(response.status);
    showToast(
      'success',
      'Đã kiểm tra kết nối',
      `${response.status?.network?.ip || '—'} · ${formatLatency(response.status?.network?.latency_ms)}`,
    );
    loadLogs({ silent: true });
  } catch (error) {
    showToast('error', 'Không kiểm tra được kết nối', error.message);
    restoreActionAvailability();
  } finally {
    setLoading(button, false);
    restoreActionAvailability();
  }
}

async function reconnectDevice(button) {
  setLoading(button, true);
  try {
    const response = await api('/api/device/reconnect', { method: 'POST', body: {} });
    showToast('info', 'Đang kết nối lại thiết bị', response.message || 'Quá trình mất vài giây.');
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    await loadStatus();
    loadLogs({ silent: true });
  } catch (error) {
    showToast('error', 'Không kết nối lại được thiết bị', error.message);
  } finally {
    setLoading(button, false);
    restoreActionAvailability();
  }
}

async function restartProxy(button) {
  const confirmed = await confirmAction({
    title: 'Khởi động lại daemon proxy?',
    description:
      'Các kết nối đang dùng proxy có thể bị gián đoạn trong vài giây. Thiết bị vẫn được giữ kết nối.',
    confirmLabel: 'Khởi động lại',
    tone: 'danger',
  });
  if (!confirmed) return;

  setLoading(button, true);
  try {
    const response = await api('/api/proxy/restart', { method: 'POST', body: {} });
    showToast('info', 'Đang khởi động lại daemon', response.message || 'Vui lòng chờ vài giây.');
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    await loadStatus();
    loadLogs({ silent: true });
  } catch (error) {
    showToast('error', 'Không khởi động lại được daemon', error.message);
  } finally {
    setLoading(button, false);
    restoreActionAvailability();
  }
}

async function clearHistory(button) {
  if (!state.history.length) return;
  const confirmed = await confirmAction({
    title: 'Xóa toàn bộ lịch sử xoay IP?',
    description: `Sẽ xóa ${state.history.length} bản ghi trên máy tính. Thao tác này không thể hoàn tác.`,
    confirmLabel: 'Xóa lịch sử',
  });
  if (!confirmed) return;

  setLoading(button, true);
  try {
    const response = await api('/api/history/clear', { method: 'POST', body: {} });
    state.history = [];
    state.historyStats = response.stats || {};
    state.historyLoaded = true;
    renderHistory();
    renderRecentHistory([]);
    showToast('success', 'Đã xóa lịch sử', 'Các lần xoay IP trước đây đã được xóa.');
    await loadStatus();
    loadLogs({ silent: true });
  } catch (error) {
    showToast('error', 'Không xóa được lịch sử', error.message);
  } finally {
    setLoading(button, false);
    if (button) button.disabled = state.history.length === 0;
  }
}

async function clearLogs(button) {
  const confirmed = await confirmAction({
    title: 'Xóa toàn bộ nhật ký?',
    description: 'Nhật ký hoạt động cục bộ sẽ bị xóa. Lịch sử xoay IP và cài đặt được giữ nguyên.',
    confirmLabel: 'Xóa nhật ký',
  });
  if (!confirmed) return;

  setLoading(button, true);
  try {
    const response = await api('/api/logs/clear', { method: 'POST', body: {} });
    state.logs = [];
    state.logsLoaded = false;
    state.logLastId = Math.max(0, (Number(response.last_id) || 1) - 1);
    renderLogs();
    await loadLogs({ reset: true });
    showToast('success', 'Đã xóa nhật ký', 'Nhật ký mới sẽ bắt đầu từ bây giờ.');
  } catch (error) {
    showToast('error', 'Không xóa được nhật ký', error.message);
  } finally {
    setLoading(button, false);
  }
}

async function toggleAutoRotate(toggle) {
  if (state.autoPending) return;
  const next = Boolean(toggle?.checked);
  state.autoPending = true;
  if (toggle) toggle.disabled = true;

  try {
    const response = await api('/api/settings', {
      method: 'POST',
      body: { auto_rotate_enabled: next },
    });
    state.settings = response.settings || state.settings;
    state.settingsSavedText = '';
    renderAutoState(response.auto_rotate || {}, state.settings || {});
    if (state.route === 'settings' && !state.settingsDirty) {
      applySettingsForm(state.settings);
      renderSettingsBadge(state.settings);
    }
    showToast(
      'success',
      next ? 'Đã bật xoay IP tự động' : 'Đã tắt xoay IP tự động',
      next
        ? `Chu kỳ ${state.settings?.auto_rotate_interval_min || 30} phút.`
        : 'Lịch tự động đã dừng.',
    );
    await loadStatus();
  } catch (error) {
    if (toggle) toggle.checked = !next;
    showToast('error', 'Không đổi được lịch tự động', error.message);
  } finally {
    state.autoPending = false;
    if (toggle) toggle.disabled = false;
    renderAutoState(state.status?.auto_rotate || {}, state.settings || {});
  }
}

/* -- Rotation completion watcher ------------------------------------------ */

function watchRotation(rotation) {
  state.statusCount += 1;
  if (!rotation?.id) return;

  const previousId = state.rotationId;
  const previousStatus = state.rotationStatus;
  const wasRunning = state.rotationWasRunning;

  state.rotationId = rotation.id;
  state.rotationStatus = rotation.status;

  if (rotation.running) {
    state.rotationWasRunning = true;
    state.rotatePending = false;
    return;
  }

  if (state.statusCount <= 1) {
    state.rotationWasRunning = false;
    return;
  }

  const finished = ['success', 'failed'].includes(rotation.status);
  const isNewJob = previousId !== rotation.id;
  const changedToFinished = previousStatus !== rotation.status && finished;
  const shouldAnnounce =
    finished && (wasRunning || isNewJob || changedToFinished || state.rotatePending);

  state.rotationWasRunning = false;
  if (finished) state.rotatePending = false;

  if (shouldAnnounce) {
    if (rotation.status === 'success') {
      const changed = rotation.changed;
      showToast(
        'success',
        changed === false ? 'Xoay IP hoàn tất' : 'Đã xoay IP thành công',
        rotation.message || `IP mới: ${rotation.new_ip || '—'}`,
        7000,
      );
    } else {
      showToast('error', 'Xoay IP thất bại', rotation.message || 'Kiểm tra nhật ký để biết chi tiết.', 8000);
    }
    loadHistory({ silent: true });
  }
}

/* -- Polling -------------------------------------------------------------- */

function schedulePoll(delay) {
  if (state.pollTimer) window.clearTimeout(state.pollTimer);
  state.pollTimer = window.setTimeout(pollTick, delay);
}

async function pollTick() {
  if (state.pollTimer) {
    window.clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.pollInFlight) return;
  state.pollInFlight = true;
  try {
    await loadStatus();
    await loadLogs({ silent: true });
  } finally {
    state.pollInFlight = false;
    schedulePoll(document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
  }
}

async function refreshAll({ spinner = false } = {}) {
  if (spinner) setLoading($('#refresh-btn'), true);
  try {
    const ok = await loadStatus();
    await Promise.allSettled([
      loadLogs({ silent: true }),
      state.route === 'history' ? loadHistory({ silent: true }) : Promise.resolve(),
      state.route === 'settings' ? loadSettings({ silent: true }) : Promise.resolve(),
    ]);
    if (spinner && !ok) {
      showToast('error', 'Không làm mới được trạng thái', state.statusError || 'Kiểm tra kết nối dịch vụ.');
    }
  } finally {
    if (spinner) {
      setLoading($('#refresh-btn'), false);
      restoreActionAvailability();
    }
  }
}

/* -- Event binding -------------------------------------------------------- */

function bindEvents() {
  window.addEventListener('hashchange', () => applyRoute(readRoute()));

  $('#menu-toggle')?.addEventListener('click', () => {
    if (state.sidebarOpen) closeSidebar();
    else openSidebar();
  });
  $('#sidebar-close')?.addEventListener('click', () => closeSidebar());
  $('#sidebar-scrim')?.addEventListener('click', () => closeSidebar());
  mobileQuery.addEventListener('change', syncSidebarMode);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.sidebarOpen) {
      closeSidebar();
      return;
    }
    trapSidebarFocus(event);
  });

  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => closeSidebar({ restoreFocus: false }));
  });

  $('#refresh-btn')?.addEventListener('click', () => refreshAll({ spinner: true }));
  $('#banner-retry')?.addEventListener('click', () => refreshAll({ spinner: true }));
  $('#rotate-btn')?.addEventListener('click', startRotation);
  $('#rotate-now')?.addEventListener('click', startRotation);
  $('#history-empty-rotate')?.addEventListener('click', startRotation);
  $('#check-btn')?.addEventListener('click', checkConnection);

  $('#device-reconnect-summary')?.addEventListener('click', (event) => {
    reconnectDevice(event.currentTarget);
  });
  $('#device-reconnect-page')?.addEventListener('click', (event) => {
    reconnectDevice(event.currentTarget);
  });
  $('#proxy-restart')?.addEventListener('click', (event) => {
    restartProxy(event.currentTarget);
  });

  $('#auto-toggle')?.addEventListener('change', (event) => {
    toggleAutoRotate(event.currentTarget);
  });

  $('#history-clear')?.addEventListener('click', (event) => {
    clearHistory(event.currentTarget);
  });
  $('#logs-clear')?.addEventListener('click', (event) => {
    clearLogs(event.currentTarget);
  });

  $$('[data-history-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.historyFilter = button.dataset.historyFilter || 'all';
      renderHistory();
    });
  });

  $('#log-level')?.addEventListener('change', (event) => {
    state.logLevel = event.currentTarget.value || 'all';
    renderLogs();
  });
  $('#log-search')?.addEventListener('input', (event) => {
    state.logQuery = event.currentTarget.value || '';
    renderLogs();
  });
  $('#log-follow')?.addEventListener('change', (event) => {
    state.logFollow = Boolean(event.currentTarget.checked);
    if (state.logFollow) renderLogs();
  });

  $('#settings-form')?.addEventListener('submit', saveSettings);
  $('#settings-form')?.addEventListener('input', markSettingsDirty);
  $('#settings-form')?.addEventListener('change', markSettingsDirty);
  $('#setting-interval')?.addEventListener('blur', () => {
    if (!state.settingsDirty) return;
    const valid = readSettingsForm();
    if (!valid) return;
  });
  $('#settings-reset')?.addEventListener('click', () => {
    state.settingsDirty = true;
    state.settingsSavedText = '';
    applySettingsForm(DEFAULT_SETTINGS);
    renderSettingsBadge(DEFAULT_SETTINGS);
    clearSettingsError();
    updateSettingsDirtyUI();
    showToast('info', 'Đã khôi phục mặc định', 'Bấm “Lưu cài đặt” để áp dụng thay đổi.');
    $('#setting-interval')?.focus();
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-copy], [data-copy-value], #copy-proxy');
    if (!trigger) return;
    let text = trigger.getAttribute('data-copy') || trigger.dataset.copyValue || '';
    if (trigger.id === 'copy-proxy') {
      text = state.status?.app?.proxy_url || state.status?.proxy?.url || text;
    }
    if (!text) return;
    event.preventDefault();
    copyText(text);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      schedulePoll(POLL_HIDDEN_MS);
    } else {
      pollTick();
    }
  });
  window.addEventListener('online', () => pollTick());

  window.addEventListener('beforeunload', (event) => {
    if (!state.settingsDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

/* -- Initialisation ------------------------------------------------------- */

function init() {
  state.logFollow = Boolean($('#log-follow')?.checked);
  bindEvents();
  state.settingsDirty = false;
  updateSettingsDirtyUI();
  syncSidebarMode();

  const rawHash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!rawHash || !Object.prototype.hasOwnProperty.call(ROUTES, rawHash)) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/overview`);
  }

  applyRoute(readRoute(), { focus: false });
  loadStatus().then((ok) => {
    if (ok && state.status?.app?.demo) {
      showToast(
        'info',
        'Đang chạy chế độ DEMO',
        'Thiết bị và IP được mô phỏng, không kết nối điện thoại thật.',
        8000,
      );
    }
  });
  loadLogs({ reset: true });
  schedulePoll(POLL_VISIBLE_MS);
}

init();

