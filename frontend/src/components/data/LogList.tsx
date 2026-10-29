import type { LogItem } from '../../api/types';
import { formatClock, formatDateTime } from '../../lib/format';

interface LogListProps {
  items: LogItem[];
  compact?: boolean;
  ariaLabel: string;
}

export function LogList({ items, compact = false, ariaLabel }: LogListProps) {
  return (
    <ol
      className={`log-list ${compact ? 'log-list-compact' : 'log-list-full'}`}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const level = item.level || 'info';
        return (
          <li key={item.id} className="log-entry" data-level={level}>
            <span
              className="log-time"
              title={formatDateTime(item.ts)}
            >
              {item.time || formatClock(item.ts)}
            </span>
            <span className="log-level" data-level={level}>
              {level.toUpperCase()}
            </span>
            <span className="log-message">{item.message || ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
