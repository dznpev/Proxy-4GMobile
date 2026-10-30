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
        <div className="flex items-center gap-1.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-start">
          <span
            id="log-level-label"
            className="whitespace-nowrap text-sm font-medium text-(--text-secondary)"
          >
            Mức độ
          </span>
          <Select
            items={LEVELS}
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
                  {item.label}
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
            Tìm kiếm
          </span>
          <Input
            id="log-search"
            type="search"
            placeholder="Nội dung nhật ký"
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
          <span id="log-follow-label">Tự cuộn</span>
        </label>
        <div className="toolbar-end">
          <span className="meta-text">
            {items.length === total ? `${total} dòng` : `${items.length} / ${total} dòng`}
          </span>
          <Button
            variant="outline"
            loading={clearingLogs}
            onClick={() => void clearLogs()}
          >
            {clearingLogs ? null : <Icon name="trash" />}
            <span>Xóa nhật ký</span>
          </Button>
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
