import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { LogList } from '../components/data/LogList';
import { Card } from '../components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../components/ui/empty';
import { useDashboard } from '../app/providers/DashboardProvider';

const LEVELS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'info', label: 'Thông tin' },
  { value: 'success', label: 'Thành công' },
  { value: 'warning', label: 'Cảnh báo' },
  { value: 'error', label: 'Lỗi' },
  { value: 'debug', label: 'Debug' },
];

export function LogsPage() {
  const { logs, logsLoaded, clearingLogs, clearLogs } = useDashboard();
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
            Nhật ký hoạt động
          </h2>
          <p className="page-lead-text">
            Sự kiện ADB, daemon, mạng và xoay IP được ghi cục bộ, tối đa 500 dòng gần nhất.
          </p>
        </div>
      </div>

      <div className="toolbar toolbar-wrap">
        <label className="field field-inline" htmlFor="log-level">
          <span>Mức độ</span>
          <select
            id="log-level"
            value={level}
            onChange={(event) => setLevel(event.currentTarget.value)}
          >
            {LEVELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-inline" htmlFor="log-search">
          <span>Tìm kiếm</span>
          <input
            id="log-search"
            type="search"
            placeholder="Nội dung nhật ký"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => setFollow(event.currentTarget.checked)}
          />
          <span>Tự cuộn</span>
        </label>
        <div className="toolbar-end">
          <span className="meta-text">
            {items.length === total ? `${total} dòng` : `${items.length} / ${total} dòng`}
          </span>
          <button
            className={`btn btn-secondary${clearingLogs ? ' is-loading' : ''}`}
            type="button"
            disabled={clearingLogs}
            aria-busy={clearingLogs ? 'true' : 'false'}
            onClick={() => void clearLogs()}
          >
            <Icon name="trash" />
            <span>Xóa nhật ký</span>
          </button>
        </div>
      </div>

      <Card render={<article />} flush aria-labelledby="log-console-title">
        <h2 className="visually-hidden" id="log-console-title">
          Nhật ký hoạt động chi tiết
        </h2>
        <div className="log-console" ref={consoleRef}>
          <LogList items={items} ariaLabel="Nhật ký hoạt động chi tiết" />
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
                  {filtersActive ? 'Không có dòng phù hợp' : 'Chưa có nhật ký'}
                </EmptyTitle>
                <EmptyDescription className="text-(--log-time)">
                  {filtersActive
                    ? 'Thử đổi mức độ hoặc từ khóa tìm kiếm.'
                    : 'Hoạt động của proxy sẽ xuất hiện ở đây.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
