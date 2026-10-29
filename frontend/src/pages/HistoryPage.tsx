import { useState } from 'react';
import { Icon } from '../components/Icon';
import { HistoryRows } from '../components/data/HistoryRows';
import { useDashboard } from '../app/providers/DashboardProvider';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../components/ui/empty';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '../components/ui/segmented-control';
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';

type HistoryFilter = 'all' | 'success' | 'failed';

const FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'success', label: 'Thành công' },
  { value: 'failed', label: 'Thất bại' },
];

export function HistoryPage() {
  const { history, historyLoaded, clearingHistory, clearHistory, startRotation } =
    useDashboard();
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const rows = history.filter(
    (item) => filter === 'all' || item.status === filter,
  );
  const filtered = filter !== 'all';
  const empty = historyLoaded && rows.length === 0;

  return (
    <section
      className="page"
      data-page="history"
      aria-labelledby="history-page-title"
    >
      <div className="page-lead">
        <div>
          <h2 className="page-section-title" id="history-page-title">
            Lịch sử xoay IP
          </h2>
          <p className="page-lead-text">
            Mỗi lần xoay được ghi lại cùng IP trước, IP mới, nhà mạng và thời lượng.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <SegmentedControl
          aria-label="Lọc theo trạng thái xoay"
          className="max-sm:w-full"
          role="group"
        >
          {FILTERS.map((item) => (
            <SegmentedControlItem
              key={item.value}
              aria-pressed={filter === item.value ? 'true' : 'false'}
              className="max-sm:flex-1"
              data-checked={filter === item.value ? '' : undefined}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <div className="toolbar-end">
          <span className="meta-text">
            {filtered
              ? `${rows.length} / ${history.length} lần xoay`
              : `${history.length} lần xoay`}
          </span>
          <Button
            variant="outline"
            disabled={history.length === 0 || clearingHistory}
            loading={clearingHistory}
            onClick={() => void clearHistory()}
          >
            {clearingHistory ? null : <Icon name="trash" />}
            <span>Xóa lịch sử</span>
          </Button>
        </div>
      </div>

      <article className="card" aria-labelledby="history-table-title">
        <h2 className="visually-hidden" id="history-table-title">
          Bảng lịch sử xoay IP
        </h2>
        {empty ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Icon name="history" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>
                {filtered ? 'Không có lần xoay phù hợp' : 'Chưa có lần xoay IP nào'}
              </EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? 'Thử chọn bộ lọc khác để xem toàn bộ lịch sử.'
                  : 'Xoay IP đầu tiên để bắt đầu ghi lịch sử.'}
              </EmptyDescription>
            </EmptyHeader>
            {filtered ? null : (
              <Button className="mt-1" onClick={() => void startRotation()}>
                Xoay IP ngay
              </Button>
            )}
          </Empty>
        ) : (
          <Table className="min-w-[780px]">
            <TableCaption className="visually-hidden">
              Toàn bộ lịch sử xoay IP, mới nhất trước
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Thời gian</TableHead>
                <TableHead scope="col">Kiểu</TableHead>
                <TableHead scope="col">IP trước</TableHead>
                <TableHead scope="col">IP mới</TableHead>
                <TableHead scope="col">Nhà mạng</TableHead>
                <TableHead scope="col">Thời lượng</TableHead>
                <TableHead scope="col">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <HistoryRows items={rows} />
            </TableBody>
          </Table>
        )}
      </article>
    </section>
  );
}
