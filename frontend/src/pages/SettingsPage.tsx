import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RotateMethod, Settings } from '../api/types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Radio, RadioGroup } from '../components/ui/radio-group';
import { Switch } from '../components/ui/switch';
import { useDashboard } from '../app/providers/DashboardProvider';
import { useToast } from '../app/providers/ToastProvider';
import { DEFAULT_SETTINGS } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { formatClock } from '../lib/format';

interface SettingsForm {
  auto_rotate_enabled: boolean;
  auto_rotate_interval_min: string;
  rotate_method: RotateMethod;
}

function toForm(settings: Settings): SettingsForm {
  return {
    auto_rotate_enabled: Boolean(settings.auto_rotate_enabled),
    auto_rotate_interval_min: String(settings.auto_rotate_interval_min ?? 30),
    rotate_method: settings.rotate_method || 'airplane',
  };
}

function isSameForm(left: SettingsForm, right: SettingsForm): boolean {
  return (
    left.auto_rotate_enabled === right.auto_rotate_enabled &&
    left.auto_rotate_interval_min === right.auto_rotate_interval_min &&
    left.rotate_method === right.rotate_method
  );
}

export function SettingsPage() {
  const { status, settings, now, saveSettings } = useDashboard();
  const { showToast } = useToast();
  const [form, setForm] = useState<SettingsForm>(() =>
    toForm(settings ?? DEFAULT_SETTINGS),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState('');
  const [error, setError] = useState('');
  const [intervalError, setIntervalError] = useState('');
  const intervalRef = useRef<HTMLInputElement | null>(null);

  const app = status?.app;
  const version = app?.version || '2.0.0';
  const dashboardUrl = app?.dashboard_url || window.location.origin;
  const proxyUrl = app?.proxy_url || '—';
  const dataDir = app?.data_dir || '—';

  useEffect(() => {
    if (!settings || dirty) return;
    const next = toForm(settings);
    setForm((current) => (isSameForm(current, next) ? current : next));
  }, [dirty, settings]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const markDirty = () => {
    if (!dirty) {
      setDirty(true);
      setSavedText('');
    }
    setError('');
    setIntervalError('');
  };

  const readForm = (): Settings | null => {
    const raw = form.auto_rotate_interval_min.trim();
    const interval = Number(raw);
    const valid =
      raw !== '' && Number.isInteger(interval) && interval >= 5 && interval <= 1440;

    if (!valid) {
      setIntervalError('Nhập số phút từ 5 đến 1440.');
      intervalRef.current?.focus();
      return null;
    }

    setIntervalError('');
    return {
      auto_rotate_enabled: form.auto_rotate_enabled,
      auto_rotate_interval_min: interval,
      rotate_method: form.rotate_method,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const payload = readForm();
    if (!payload) return;

    setError('');
    setSaving(true);
    try {
      const response = await saveSettings(payload);
      const next = response.settings ?? payload;
      setForm(toForm(next));
      setDirty(false);
      setSavedText(`Đã lưu lúc ${formatClock(now)}`);
      showToast('success', 'Đã lưu cài đặt', 'Lịch xoay IP đã được cập nhật.');
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      showToast('error', 'Chưa lưu được cài đặt', message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(toForm(DEFAULT_SETTINGS));
    setDirty(true);
    setSavedText('');
    setError('');
    setIntervalError('');
    showToast(
      'info',
      'Đã khôi phục mặc định',
      'Bấm “Lưu cài đặt” để áp dụng thay đổi.',
    );
    intervalRef.current?.focus();
  };

  const handleIntervalBlur = () => {
    if (!dirty) return;
    readForm();
  };

  const badgeEnabled = Boolean(form.auto_rotate_enabled);

  return (
    <section className="page" data-page="settings" aria-labelledby="settings-page-title">
      <div className="page-lead">
        <div>
          <h2 className="page-section-title" id="settings-page-title">
            Cài đặt
          </h2>
          <p className="page-lead-text">
            Cấu hình lịch xoay IP và phương thức ngắt kết nối. Thay đổi được lưu cục bộ.
          </p>
        </div>
      </div>

      <form id="settings-form" className="mb-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <Card render={<article />} aria-labelledby="settings-auto-title">
          <CardHeader>
            <div>
              <p className="eyebrow">Lịch</p>
              <CardTitle render={<h2 />} id="settings-auto-title">
                Tự động xoay IP
              </CardTitle>
            </div>
            <CardAction>
              <Badge
                tone={badgeEnabled ? 'success' : 'neutral'}
                label={badgeEnabled ? 'Bật' : 'Tắt'}
              />
            </CardAction>
          </CardHeader>

          <div className="switch-row switch-row-bordered">
            <div>
              <Label
                className="text-base text-foreground"
                id="setting-auto-label"
                htmlFor="setting-auto"
              >
                Tự động xoay IP
              </Label>
              <p className="meta-text" id="setting-auto-help">
                Khi bật, proxy tự xoay theo chu kỳ nếu thiết bị đang kết nối.
              </p>
            </div>
            <Switch
              id="setting-auto"
              checked={form.auto_rotate_enabled}
              aria-labelledby="setting-auto-label"
              aria-describedby="setting-auto-help"
              onCheckedChange={(checked) => {
                setForm((current) => ({ ...current, auto_rotate_enabled: checked }));
                markDirty();
              }}
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <Label htmlFor="setting-interval">Chu kỳ xoay (phút)</Label>
              <Input
                ref={intervalRef}
                id="setting-interval"
                type="number"
                min={5}
                max={1440}
                step={5}
                inputMode="numeric"
                aria-describedby="setting-interval-help setting-interval-error"
                aria-invalid={intervalError ? 'true' : undefined}
                value={form.auto_rotate_interval_min}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({
                    ...current,
                    auto_rotate_interval_min: value,
                  }));
                  markDirty();
                }}
                onBlur={handleIntervalBlur}
              />
              <p className="help-text" id="setting-interval-help">
                Từ 5 đến 1440 phút. Mặc định 30 phút.
              </p>
              <p
                className="field-error"
                id="setting-interval-error"
                role="alert"
                hidden={!intervalError}
              >
                {intervalError}
              </p>
            </div>

            <fieldset className="field field-radio-group">
              <legend id="rotate-method-label">Phương thức xoay</legend>
              <RadioGroup
                name="rotate-method"
                value={form.rotate_method}
                aria-labelledby="rotate-method-label"
                onValueChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    rotate_method: value as RotateMethod,
                  }));
                  markDirty();
                }}
              >
                <label className="radio-row">
                  <Radio
                    className="mt-[3px]"
                    value="airplane"
                    aria-labelledby="rotate-method-airplane-label"
                    aria-describedby="rotate-method-airplane-help"
                  />
                  <span>
                    <strong id="rotate-method-airplane-label">Chế độ máy bay</strong>
                    <small id="rotate-method-airplane-help">
                      Ổn định hơn, ngắt 4G khoảng 5–10 giây.
                    </small>
                  </span>
                </label>
                <label className="radio-row">
                  <Radio
                    className="mt-[3px]"
                    value="data"
                    aria-labelledby="rotate-method-data-label"
                    aria-describedby="rotate-method-data-help"
                  />
                  <span>
                    <strong id="rotate-method-data-label">Dữ liệu di động</strong>
                    <small id="rotate-method-data-help">
                      Tắt/mở dữ liệu; phù hợp một số nhà mạng.
                    </small>
                  </span>
                </label>
              </RadioGroup>
            </fieldset>
          </div>

          <div className="inline-alert inline-alert-danger" role="alert" hidden={!error}>
            <strong>Chưa lưu được cài đặt</strong>
            <p>{error}</p>
          </div>

          <CardFooter>
            <Button type="submit" loading={saving} disabled={!dirty}>
              Lưu cài đặt
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={saving}
              onClick={handleReset}
            >
              Khôi phục mặc định
            </Button>
            <span className="meta-text" role="status">
              {dirty ? 'Chưa lưu thay đổi' : savedText}
            </span>
          </CardFooter>
        </Card>
      </form>

      <div className="grid-2">
        <Card render={<article />} aria-labelledby="api-title">
          <CardHeader>
            <div>
              <p className="eyebrow">Tích hợp</p>
              <CardTitle render={<h2 />} id="api-title">
                API cục bộ
              </CardTitle>
            </div>
          </CardHeader>
          <dl className="endpoint-list">
            <div>
              <dt>
                <code>GET /api/status</code>
              </dt>
              <dd>Toàn bộ trạng thái dashboard.</dd>
            </div>
            <div>
              <dt>
                <code>POST /api/rotate</code>
              </dt>
              <dd>Bắt đầu xoay IP, trả về ngay.</dd>
            </div>
            <div>
              <dt>
                <code>GET /rotate</code>
              </dt>
              <dd>Tương thích API cũ; chờ và trả IP mới.</dd>
            </div>
            <div>
              <dt>
                <code>GET /status</code>
              </dt>
              <dd>Tương thích API cũ; kết nối và IP.</dd>
            </div>
          </dl>
          <p className="meta-text">
            API chỉ lắng nghe trên loopback và không yêu cầu xác thực.
          </p>
        </Card>

        <Card render={<article />} aria-labelledby="about-title">
          <CardHeader>
            <div>
              <p className="eyebrow">Hệ thống</p>
              <CardTitle render={<h2 />} id="about-title">
                Về ứng dụng
              </CardTitle>
            </div>
            <CardAction>
              <Badge tone="neutral" label="Demo" hidden={!app?.demo} />
            </CardAction>
          </CardHeader>
          <dl className="detail-list detail-list-compact">
            <div>
              <dt>Phiên bản</dt>
              <dd>{version}</dd>
            </div>
            <div>
              <dt>Dashboard</dt>
              <dd className="mono">{dashboardUrl}</dd>
            </div>
            <div>
              <dt>Proxy</dt>
              <dd className="mono">{proxyUrl}</dd>
            </div>
            <div>
              <dt>Thư mục dữ liệu</dt>
              <dd className="mono break-all">{dataDir}</dd>
            </div>
          </dl>
          <p className="meta-text">
            Zero-app: daemon được đẩy tới <code>/data/local/tmp</code>, không cài APK.
          </p>
        </Card>
      </div>
    </section>
  );
}
