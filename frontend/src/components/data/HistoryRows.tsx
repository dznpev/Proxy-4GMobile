import type { HistoryItem } from '../../api/types';
import { TRIGGER_LABEL_KEYS } from '../../lib/constants';
import { formatDateTime, formatDuration } from '../../lib/format';
import { historyStatusBadge } from '../../lib/status';
import { useI18n } from '../../app/providers/I18nProvider';
import { Badge } from '../ui/Badge';

interface HistoryRowsProps {
  items: HistoryItem[];
  compact?: boolean;
}

export function HistoryRows({ items, compact = false }: HistoryRowsProps) {
  const { t } = useI18n();

  return (
    <>
      {items.map((item, index) => {
        const badge = historyStatusBadge(item.status, t);
        const time = formatDateTime(item.ts);
        const triggerKey = TRIGGER_LABEL_KEYS[item.trigger] ?? 'status.triggers.other';
        return (
          <tr key={item.id ?? `${item.ts}-${index}`}>
            <td className="mono text-sm text-foreground" title={time}>
              {time}
            </td>
            {compact ? null : <td>{t(triggerKey)}</td>}
            {compact ? null : (
              <td className="mono text-sm text-foreground">
                {item.old_ip || '—'}
              </td>
            )}
            <td className="mono text-sm text-foreground">
              {item.new_ip || '—'}
            </td>
            <td>{item.isp || '—'}</td>
            {compact ? null : <td>{formatDuration(item.duration_sec)}</td>}
            <td>
              <Badge
                tone={badge.tone}
                label={badge.label}
                icon={badge.icon}
                size="sm"
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}
