import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { HistoryRows } from '../components/data/HistoryRows';
import { useDashboard } from '../app/providers/DashboardProvider';
import { useI18n } from '../app/providers/I18nProvider';
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

const FILTERS: Array<{ value: HistoryFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'history.filterAll' },
  { value: 'success', labelKey: 'history.filterSuccess' },
  { value: 'failed', labelKey: 'history.filterFailed' },
];

const PAGE_SIZES = [10, 25, 50, 100] as const;

const PAGE_SIZE_ITEMS = PAGE_SIZES.map((size) => ({
  value: String(size),
  label: String(size),
}));

export function HistoryPage() {
  const { history, historyLoaded, clearingHistory, clearHistory, startRotation } =
    useDashboard();
  const { t } = useI18n();
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
            {t('history.title')}
          </h2>
          <p className="page-lead-text">{t('history.lead')}</p>
        </div>
      </div>

      <div className="toolbar">
        <SegmentedControl
          aria-label={t('history.filterLabel')}
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
              {t(item.labelKey)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <div className="toolbar-end">
          <span className="meta-text">
            {filtered
              ? t('history.countFiltered', { shown: rows.length, total: history.length })
              : t('history.count', { count: history.length })}
          </span>
          <Button
            variant="outline"
            disabled={history.length === 0 || clearingHistory}
            loading={clearingHistory}
            onClick={() => void clearHistory()}
          >
            {clearingHistory ? null : <Icon name="trash" />}
            <span>{t('history.clear')}</span>
          </Button>
        </div>
      </div>

      <Card render={<article />} aria-labelledby="history-table-title">
        <h2 className="visually-hidden" id="history-table-title">
          {t('history.tableTitle')}
        </h2>
        {empty ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Icon name="history" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>
                {filtered ? t('history.emptyFilteredTitle') : t('history.emptyTitle')}
              </EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? t('history.emptyFilteredDescription')
                  : t('history.emptyDescription')}
              </EmptyDescription>
            </EmptyHeader>
            {filtered ? null : (
              <Button className="mt-1" onClick={() => void startRotation()}>
                {t('history.rotateNow')}
              </Button>
            )}
          </Empty>
        ) : (
          <>
            <Table className="min-w-[780px]">
              <TableCaption className="visually-hidden">
                {t('history.tableCaption')}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('history.colTime')}</TableHead>
                  <TableHead scope="col">{t('history.colTrigger')}</TableHead>
                  <TableHead scope="col">{t('history.colOldIp')}</TableHead>
                  <TableHead scope="col">{t('history.colNewIp')}</TableHead>
                  <TableHead scope="col">{t('history.colIsp')}</TableHead>
                  <TableHead scope="col">{t('history.colDuration')}</TableHead>
                  <TableHead scope="col">{t('history.colStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <HistoryRows items={pageRows} />
              </TableBody>
            </Table>

            {rows.length > 0 ? (
              <CardFooter
                className="max-[640px]:flex-col max-[640px]:items-start"
                render={<nav aria-label={t('history.paginationLabel')} />}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {t('history.range', {
                      start: rangeStart,
                      end: rangeEnd,
                      total: rows.length,
                    })}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="whitespace-nowrap text-sm text-muted-foreground"
                      id="history-page-size-label"
                    >
                      {t('history.pageSize')}
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
                    {t('history.pageOf', { page: currentPage, total: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t('history.previousPage')}
                    disabled={currentPage === 1}
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  >
                    <Icon name="chevron-left" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t('history.nextPage')}
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
