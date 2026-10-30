import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Card, CardFooter } from '../components/ui/card';

type HistoryFilter = 'all' | 'success' | 'failed';

const FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'success', label: 'Thành công' },
  { value: 'failed', label: 'Thất bại' },
];

const PAGE_SIZES = [10, 25, 50, 100] as const;

const PAGE_SIZE_ITEMS = PAGE_SIZES.map((size) => ({
  value: String(size),
  label: String(size),
}));

export function HistoryPage() {
  const { history, historyLoaded, clearingHistory, clearHistory, startRotation } =
    useDashboard();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const pageSizeValue = Number(pageSize);
  const rows = history.filter(
    (item) => filter === 'all' || item.status === filter,
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSizeValue));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSizeValue;
  const pageRows = rows.slice(pageStart, pageStart + pageSizeValue);
  const rangeStart = rows.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + pageSizeValue, rows.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
              onClick={() => {
                setFilter(item.value);
                setPage(1);
              }}
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

      <Card render={<article />} aria-labelledby="history-table-title">
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
          <>
            <Table className="min-w-[780px]">
              <TableCaption className="visually-hidden">
                Lịch sử xoay IP, mới nhất trước
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
                <HistoryRows items={pageRows} />
              </TableBody>
            </Table>

            {rows.length > 0 ? (
              <CardFooter
                className="max-[640px]:flex-col max-[640px]:items-start"
                render={<nav aria-label="Phân trang lịch sử" />}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {rangeStart}–{rangeEnd} / {rows.length} lần xoay
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="whitespace-nowrap text-sm text-muted-foreground"
                      id="history-page-size-label"
                    >
                      Số dòng
                    </span>
                    <Select
                      items={PAGE_SIZE_ITEMS}
                      value={pageSize}
                      onValueChange={(value) => {
                        if (value !== null) {
                          setPageSize(value);
                          setPage(1);
                        }
                      }}
                    >
                      <SelectTrigger
                        id="history-page-size"
                        aria-labelledby="history-page-size-label"
                        className="h-[30px] w-auto min-w-[74px]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        {PAGE_SIZES.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Trang trước"
                    disabled={currentPage === 1}
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <Icon name="chevron-left" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Trang sau"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <Icon name="chevron-right" />
                  </Button>
                </div>
              </CardFooter>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}
