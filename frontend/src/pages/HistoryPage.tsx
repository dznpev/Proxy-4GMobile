import { useState } from 'react';
import { Icon } from '../components/Icon';
import { HistoryRows } from '../components/data/HistoryRows';
import { useDashboard } from '../app/providers/DashboardProvider';

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

  const rows = history.filter((item) => filter === 'all' || item.status === filter);
  const filtered = filter !== 'all';
  const empty = historyLoaded && rows.length === 0;

  return (
    <section className="page" data-page="history" aria-labelledby="history-page-title">
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
        <div className="segmented" role="group" aria-label="Lọc theo trạng thái xoay">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value ? 'true' : 'false'}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="toolbar-end">
          <span className="meta-text">
            {filtered
              ? `${rows.length} / ${history.length} lần xoay`
              : `${history.length} lần xoay`}
          </span>
          <button
            className={`btn btn-secondary${clearingHistory ? ' is-loading' : ''}`}
            type="button"
            disabled={history.length === 0 || clearingHistory}
            aria-busy={clearingHistory ? 'true' : 'false'}
            onClick={() => void clearHistory()}
          >
            <Icon name="trash" />
            <span>Xóa lịch sử</span>
          </button>
        </div>
      </div>

      <article className="card" aria-labelledby="history-table-title">
        <h2 className="visually-hidden" id="history-table-title">
          Bảng lịch sử xoay IP
        </h2>
        <div className="table-wrap" hidden={empty}>
          <table className="data-table data-table-wide">
            <caption className="visually-hidden">
              Toàn bộ lịch sử xoay IP, mới nhất trước
            </caption>
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Kiểu</th>
                <th scope="col">IP trước</th>
                <th scope="col">IP mới</th>
                <th scope="col">Nhà mạng</th>
                <th scope="col">Thời lượng</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <HistoryRows items={rows} />
            </tbody>
          </table>
        </div>
        <div className="empty-state" hidden={!empty}>
          <div className="empty-icon" aria-hidden="true">
            <Icon name="history" />
          </div>
          <h3>{filtered ? 'Không có lần xoay phù hợp' : 'Chưa có lần xoay IP nào'}</h3>
          <p>
            {filtered
              ? 'Thử chọn bộ lọc khác để xem toàn bộ lịch sử.'
              : 'Xoay IP đầu tiên để bắt đầu ghi lịch sử.'}
          </p>
          <button
            className="btn btn-primary"
            type="button"
            hidden={filtered}
            onClick={() => void startRotation()}
          >
            Xoay IP ngay
          </button>
        </div>
      </article>
    </section>
  );
}
