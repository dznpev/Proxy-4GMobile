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
import { FlagIcon } from '../components/ui/FlagIcon';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Radio, RadioGroup } from '../components/ui/radio-group';
import { Switch } from '../components/ui/switch';
import { useDashboard } from '../app/providers/DashboardProvider';
import { useI18n } from '../app/providers/I18nProvider';
import { useToast } from '../app/providers/ToastProvider';
import { DEFAULT_SETTINGS, DEFAULT_SETTINGS_OPTIONS } from '../lib/constants';
import { errorMessage } from '../lib/errors';
import { formatClock } from '../lib/format';
import { isLocale, translate } from '../lib/i18n';

const MIN_INTERVAL = DEFAULT_SETTINGS_OPTIONS.min_interval_min;
const MAX_INTERVAL = DEFAULT_SETTINGS_OPTIONS.max_interval_min;

interface SettingsForm {
  auto_rotate_enabled: boolean;
  auto_rotate_interval_min: string;
  rotate_method: RotateMethod;
  daily_data_limit_gb: string;
}

function toForm(settings: Settings): SettingsForm {
  return {
    auto_rotate_enabled: Boolean(settings.auto_rotate_enabled),
    auto_rotate_interval_min: String(settings.auto_rotate_interval_min ?? 30),
    rotate_method: settings.rotate_method || 'airplane',
    daily_data_limit_gb: String(settings.daily_data_limit_gb ?? 4),
  };
}

function isSameForm(left: SettingsForm, right: SettingsForm): boolean {
  return (
    left.auto_rotate_enabled === right.auto_rotate_enabled &&
    left.auto_rotate_interval_min === right.auto_rotate_interval_min &&
    left.rotate_method === right.rotate_method &&
    left.daily_data_limit_gb === right.daily_data_limit_gb
  );
}

export function SettingsPage() {
  const { status, settings, now, saveSettings, resettingUsage, resetUsage } = useDashboard();
  const { locale, setLocale, t } = useI18n();
  const { showToast } = useToast();
  const [form, setForm] = useState<SettingsForm>(() =>
    toForm(settings ?? DEFAULT_SETTINGS),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [intervalError, setIntervalError] = useState('');
  const [limitError, setLimitError] = useState('');
  const intervalRef = useRef<HTMLInputElement | null>(null);
  const limitRef = useRef<HTMLInputElement | null>(null);

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
      setSavedAt(null);
    }
    setError('');
    setIntervalError('');
    setLimitError('');
  };

  const readForm = (): Settings | null => {
    const raw = form.auto_rotate_interval_min.trim();
    const interval = Number(raw);
    const valid =
      raw !== '' &&
      Number.isInteger(interval) &&
      interval >= MIN_INTERVAL &&
      interval <= MAX_INTERVAL;

    if (!valid) {
      setIntervalError(t('settings.intervalError', { min: MIN_INTERVAL, max: MAX_INTERVAL }));
      intervalRef.current?.focus();
      return null;
    }

    const rawLimit = form.daily_data_limit_gb.trim();
    const limit = Number(rawLimit);
    const limitValid = rawLimit !== '' && Number.isFinite(limit) && limit >= 0 && limit <= 1000;
    if (!limitValid) {
      setLimitError(t('settings.dataLimitError'));
      limitRef.current?.focus();
      return null;
    }

    setIntervalError('');
    setLimitError('');
    return {
      auto_rotate_enabled: form.auto_rotate_enabled,
      auto_rotate_interval_min: interval,
      rotate_method: form.rotate_method,
      daily_data_limit_gb: Math.round(limit * 100) / 100,
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
      setSavedAt(now);
      showToast('success', t('toasts.settingsSaved.title'), t('toasts.settingsSaved.message'));
    } catch (caught) {
      const message = errorMessage(caught, t('errors.generic'), t);
      setError(message);
      showToast('error', t('toasts.settingsSaveFailed.title'), message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(toForm(DEFAULT_SETTINGS));
    setDirty(true);
    setSavedAt(null);
    setError('');
    setIntervalError('');
    showToast('info', t('toasts.defaultsRestored.title'), t('toasts.defaultsRestored.message'));
    intervalRef.current?.focus();
  };

  const handleIntervalBlur = () => {
    if (!dirty) return;
    readForm();
  };

  const handleLanguageChange = (value: string) => {
    if (!isLocale(value) || value === locale) return;
    void setLocale(value);
    // The toast is rendered after the locale switches, so translate it with the
    // newly selected language instead of the current render's translator.
    showToast('success', translate(value, 'settings.languageSaved'));
  };

  const badgeEnabled = Boolean(form.auto_rotate_enabled);

  return (
    <section className="page" data-page="settings" aria-labelledby="settings-page-title">
      <div className="page-lead">
        <div>
          <h2 className="page-section-title" id="settings-page-title">
            {t('settings.title')}
          </h2>
          <p className="page-lead-text">{t('settings.lead')}</p>
        </div>
      </div>

      <form id="settings-form" className="mb-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <Card render={<article />} aria-labelledby="settings-auto-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('settings.autoEyebrow')}</p>
              <CardTitle render={<h2 />} id="settings-auto-title">
                {t('settings.autoTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Badge
                tone={badgeEnabled ? 'success' : 'neutral'}
                label={badgeEnabled ? t('common.on') : t('common.off')}
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
                {t('settings.autoLabel')}
              </Label>
              <p className="meta-text" id="setting-auto-help">
                {t('settings.autoHelp')}
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
              <Label htmlFor="setting-interval">{t('settings.intervalLabel')}</Label>
              <Input
                ref={intervalRef}
                id="setting-interval"
                type="number"
                min={MIN_INTERVAL}
                max={MAX_INTERVAL}
                step={1}
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
                {t('settings.intervalHelp', { min: MIN_INTERVAL, max: MAX_INTERVAL })}
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
              <legend id="rotate-method-label">{t('settings.methodLabel')}</legend>
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
                    <strong id="rotate-method-airplane-label">
                      {t('settings.methodAirplane')}
                    </strong>
                    <small id="rotate-method-airplane-help">
                      {t('settings.methodAirplaneHelp')}
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
                    <strong id="rotate-method-data-label">{t('settings.methodData')}</strong>
                    <small id="rotate-method-data-help">{t('settings.methodDataHelp')}</small>
                  </span>
                </label>
              </RadioGroup>
            </fieldset>

            <div className="field">
              <Label htmlFor="setting-data-limit">{t('settings.dataLimitLabel')}</Label>
              <Input
                ref={limitRef}
                id="setting-data-limit"
                type="number"
                step="0.5"
                min="0"
                max="1000"
                value={form.daily_data_limit_gb}
                aria-invalid={limitError ? 'true' : undefined}
                aria-describedby="setting-limit-help setting-limit-error"
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({
                    ...current,
                    daily_data_limit_gb: value,
                  }));
                  markDirty();
                }}
              />
              <p className="help-text" id="setting-limit-help">
                {t('settings.dataLimitHelp')}
              </p>
              {limitError && (
                <p className="error-text" id="setting-limit-error" role="alert">
                  {limitError}
                </p>
              )}
            </div>
          </div>

          <div className="inline-alert inline-alert-danger" role="alert" hidden={!error}>
            <strong>{t('settings.saveErrorTitle')}</strong>
            <p>{error}</p>
          </div>

          <CardFooter>
            <Button type="submit" loading={saving} disabled={!dirty}>
              {t('settings.save')}
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={saving}
              onClick={handleReset}
            >
              {t('settings.restoreDefaults')}
            </Button>
            <span className="meta-text" role="status">
              {dirty
                ? t('settings.unsaved')
                : savedAt !== null
                  ? t('settings.savedAt', { time: formatClock(savedAt) })
                  : ''}
            </span>
          </CardFooter>
        </Card>
      </form>

      <Card render={<article />} aria-labelledby="settings-language-title" className="mb-4">
        <CardHeader>
          <div>
            <p className="eyebrow">{t('settings.languageEyebrow')}</p>
            <CardTitle render={<h2 />} id="settings-language-title">
              {t('settings.languageTitle')}
            </CardTitle>
          </div>
        </CardHeader>
        <div className="px-5 py-2">
          <p className="meta-text mb-4">{t('settings.languageDescription')}</p>
          <RadioGroup
            className="gap-2"
            name="settings-language"
            value={locale}
            aria-labelledby="settings-language-title"
            onValueChange={handleLanguageChange}
          >
            <label className="radio-row">
              <Radio
                className="mt-[3px]"
                value="en"
                aria-labelledby="settings-language-en-label"
              />
              <span className="inline-flex items-center gap-2">
                <FlagIcon code="us" />
                <strong id="settings-language-en-label">
                  {t('settings.languageEnglish')}
                </strong>
              </span>
            </label>
            <label className="radio-row">
              <Radio
                className="mt-[3px]"
                value="vi"
                aria-labelledby="settings-language-vi-label"
              />
              <span className="inline-flex items-center gap-2">
                <FlagIcon code="vn" />
                <strong id="settings-language-vi-label">
                  {t('settings.languageVietnamese')}
                </strong>
              </span>
            </label>
          </RadioGroup>
        </div>
      </Card>

      <Card render={<article />} aria-labelledby="settings-data-title" className="mb-4">
        <CardHeader>
          <div>
            <p className="eyebrow">{t('settings.dataEyebrow')}</p>
            <CardTitle render={<h2 />} id="settings-data-title">
              {t('settings.dataTitle')}
            </CardTitle>
          </div>
        </CardHeader>
        <div className="px-5 py-2">
          <p className="meta-text mb-4">{t('settings.dataDescription')}</p>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <strong className="block text-sm">{t('settings.resetTitle')}</strong>
              <span className="text-xs text-(--text-secondary)">
                {t('settings.resetDescription')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              loading={resettingUsage}
              disabled={resettingUsage}
              onClick={() => void resetUsage()}
            >
              {t('settings.resetToday')}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid-2">
        <Card render={<article />} aria-labelledby="api-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('settings.apiEyebrow')}</p>
              <CardTitle render={<h2 />} id="api-title">
                {t('settings.apiTitle')}
              </CardTitle>
            </div>
          </CardHeader>
          <dl className="endpoint-list">
            <div>
              <dt>
                <code>GET /api/status</code>
              </dt>
              <dd>{t('settings.apiStatusDescription')}</dd>
            </div>
            <div>
              <dt>
                <code>POST /api/rotate</code>
              </dt>
              <dd>{t('settings.apiRotateDescription')}</dd>
            </div>
          </dl>
          <p className="meta-text">{t('settings.apiNote')}</p>
        </Card>

        <Card render={<article />} aria-labelledby="about-title">
          <CardHeader>
            <div>
              <p className="eyebrow">{t('settings.aboutEyebrow')}</p>
              <CardTitle render={<h2 />} id="about-title">
                {t('settings.aboutTitle')}
              </CardTitle>
            </div>
            <CardAction>
              <Badge tone="neutral" label="Demo" hidden={!app?.demo} />
            </CardAction>
          </CardHeader>
          <dl className="detail-list detail-list-compact">
            <div>
              <dt>{t('settings.version')}</dt>
              <dd>{version}</dd>
            </div>
            <div>
              <dt>{t('settings.dashboard')}</dt>
              <dd className="mono">{dashboardUrl}</dd>
            </div>
            <div>
              <dt>{t('settings.proxy')}</dt>
              <dd className="mono">{proxyUrl}</dd>
            </div>
            <div>
              <dt>{t('settings.dataDir')}</dt>
              <dd className="mono break-all">{dataDir}</dd>
            </div>
          </dl>
          <p className="meta-text">{t('settings.aboutNote')}</p>
        </Card>
      </div>
    </section>
  );
}
