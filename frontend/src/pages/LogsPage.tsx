import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { LogList } from '../components/data/LogList';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../components/ui/empty';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useDashboard } from '../app/providers/DashboardProvider';
import { useI18n } from '../app/providers/I18nProvider';

const LEVELS = [
  { value: 'all', labelKey: 'logs.all' },
  { value: 'info', labelKey: 'logs.info' },
  { value: 'success', labelKey: 'logs.success' },
  { value: 'warning', labelKey: 'logs.warning' },
  { value: 'error', labelKey: 'logs.error' },
  { value: 'debug', labelKey: 'logs.debug' },
];

export function LogsPage() {
  const { logs, logsLoaded, clearingLogs, clearLogs } = useDashboard();
  const { t } = useI18n();
  const [level, setLevel] = useState('all');
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(true);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return logs.filter((item) => {
      if (level !== 'all' && item.level !== level) return false;
      if (!normalized) return true;
      return `${item.message || ''} ${item.source || ''}`.toLowerCase().includes(normalized);
    });
  }, [level, logs, query]);

  const filtersActive = level !== 'all' || query.trim() !== '';
  const total = logs.length;
  const empty = logsLoaded && items.length === 0;

  useEffect(() => {
    if (!follow) return;
    const element = consoleRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [follow, items]);

  return (
    <section className="page" data-page="logs" aria-labelledby="logs-page-title">
      <div className="page-lead">
        <div>
          <h2 className="page-section-title" id="logs-page-title">
            {t('logs.title')}
          </h2>
          <p className="page-lead-text">{t('logs.lead')}</p>
        </div>
      </div>

      <div className="toolbar toolbar-wrap">
        <div className="flex items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-start">
          <span
            id="log-level-label"
            className="whitespace-nowrap text-sm font-medium text-(--text-secondary)"
          >
            {t('logs.level')}
          </span>
          <Select
            items={LEVELS.map((item) => ({
              value: item.value,
              label: t(item.labelKey),
            }))}
            value={level}
            onValueChange={(value) => {
              if (value !== null) setLevel(value);
            }}
          >
            <SelectTrigger
              id="log-level"
              aria-labelledby="log-level-label"
              className="w-auto min-w-[150px] max-[640px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {LEVELS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {t(item.labelKey)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        <label
          className="flex items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-start"
          htmlFor="log-search"
        >
          <span className="whitespace-nowrap text-sm font-medium text-(--text-secondary)">
            {t('logs.search')}
          </span>
          <Input
            id="log-search"
            type="search"
            placeholder={t('logs.searchPlaceholder')}
            autoComplete="off"
            className="w-auto min-w-[220px] max-[640px]:w-full"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <label
          className="flex min-h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm text-(--text-secondary)"
          htmlFor="log-follow"
        >
          <Checkbox
            id="log-follow"
            checked={follow}
            aria-labelledby="log-follow-label"
            onCheckedChange={(checked) => setFollow(checked)}
          />
          <span id="log-follow-label">{t('logs.follow')}</span>
        </label>
        <div className="toolbar-end">
          <span className="meta-text">
            {items.length === total
              ? t('logs.count', { count: total })
              : t('logs.countFiltered', { shown: items.length, total })}
          </span>
          <Button
            variant="outline"
            loading={clearingLogs}
            onClick={() => void clearLogs()}
          >
            {clearingLogs ? null : <Icon name="trash" />}
            <span>{t('logs.clear')}</span>
          </Button>
        </div>
      </div>

      <Card render={<article />} flush aria-labelledby="log-console-title">
        <h2 className="visually-hidden" id="log-console-title">
          {t('logs.tableTitle')}
        </h2>
        <div className="log-console" ref={consoleRef}>
          <LogList items={items} ariaLabel={t('logs.ariaLabel')} />
          {empty ? (
            <Empty className="gap-2 px-5 py-12 text-(--text-inverse)">
              <EmptyMedia
                className="mb-1 bg-white/8 text-(--text-inverse)"
                variant="icon"
              >
                <Icon name="terminal" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-(--text-inverse)">
                  {filtersActive ? t('logs.emptyFilteredTitle') : t('logs.emptyTitle')}
                </EmptyTitle>
                <EmptyDescription className="text-(--log-time)">
                  {filtersActive
                    ? t('logs.emptyFilteredDescription')
                    : t('logs.emptyDescription')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
